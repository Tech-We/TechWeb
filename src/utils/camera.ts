import {Html5Qrcode} from 'html5-qrcode';

export const CLAVE_ZOOM = 'tech_camera_zoom';
const LEGACY_CLAVE_CAMARA = 'tech_camera_id';

export interface CameraDevice {
  id: string;
  label: string;
}

export interface ZoomCapabilities {
  min: number;
  max: number;
  step: number;
  valor: number;
}

export function puntuarCamara(label: string, index: number): number {
  const lower = (label || '').toLowerCase();
  let score = 0;

  // Strongly reject front/selfie/FaceTime cameras
  if (/\b(front|user|selfie|frontal|facetime)\b/i.test(lower)) {
    score -= 1000;
  }

  // Strongly reject ultra-wide / gran angular lenses (0.5x / 0.6x)
  if (
    /ultra[\s_-]*wide|ultrawide|gran[\s_-]*angular|super[\s_-]*wide|fisheye|\b0\.[56]x?\b/i.test(
      lower,
    )
  ) {
    score -= 700;
  }

  // Strongly reject auxiliary macro, depth, ToF, IR, or monochrome sensors
  if (
    /\b(macro|depth|profundidad|tof|bokeh|infrared|ir|monochrome|mono)\b/i.test(
      lower,
    )
  ) {
    score -= 650;
  }

  // Deprioritize telephoto lenses (poor close-range focus for barcodes)
  if (/telephoto|\btele\b|periscope|\b(3|5|10)x\b/i.test(lower)) {
    score -= 250;
  }

  // Strong preference for rear / environment cameras
  if (/\b(back|rear|environment|trasera|posterior)\b/i.test(lower)) {
    score += 300;
  }

  // Primary rear lens indicators (iOS Triple/Dual/Back Camera & Android Camera2 ID 0)
  if (
    /\b(main|principal|primary|standard|triple\s*camera|dual\s*camera|back\s*camera|rear\s*camera)\b/i.test(
      lower,
    )
  ) {
    score += 180;
  }

  // On Android Camera2 API, camera2 0 is the primary 1x sensor; IDs 2+ are auxiliary lenses
  if (/\b(camera2?\s*0|cam\s*0|id\s*0)\b/i.test(lower)) {
    score += 180;
  } else if (/\bcamera2?\s*[2-9]\b/i.test(lower)) {
    score -= 140;
  }

  // Slight tie-breaker favoring earlier primary entries
  score -= index * 2;
  return score;
}

export async function elegirMejorCamara(): Promise<CameraDevice | null> {
  const devices = await Html5Qrcode.getCameras();
  if (!devices || devices.length === 0) return null;

  const ranked = devices
    .map((d, idx) => ({
      device: {
        id: d.id,
        label: d.label || `Cámara ${idx + 1}`,
      },
      score: puntuarCamara(d.label || '', idx),
    }))
    .sort((a, b) => b.score - a.score);

  return ranked[0].device;
}

export async function crearLectorCamara(elementId: string): Promise<Html5Qrcode> {
  return new Html5Qrcode(elementId);
}

export async function iniciarMejorCamara(
  lector: Html5Qrcode,
  onDecode: (decodedText: string) => void,
): Promise<ZoomCapabilities | null> {
  try {
    localStorage.removeItem(LEGACY_CLAVE_CAMARA);
  } catch {
    // ignore storage access issues
  }

  const bestCamera = await elegirMejorCamara().catch(() => null);

  const scanOptions = {
    fps: 12,
    qrbox: {width: 250, height: 150},
    aspectRatio: 1.5,
  };

  const handleSuccess = (decodedText: string) => {
    onDecode(decodedText);
  };
  const handleError = () => undefined;

  if (bestCamera) {
    try {
      await lector.start(
        bestCamera.id,
        {
          ...scanOptions,
          videoConstraints: {
            deviceId: {exact: bestCamera.id},
            width: {ideal: 1920},
            height: {ideal: 1080},
          },
        },
        handleSuccess,
        handleError,
      );
    } catch {
      await lector.start(
        {deviceId: {exact: bestCamera.id}},
        scanOptions,
        handleSuccess,
        handleError,
      );
    }
  } else {
    try {
      await lector.start(
        {facingMode: 'environment'},
        {
          ...scanOptions,
          videoConstraints: {
            facingMode: {ideal: 'environment'},
            width: {ideal: 1920},
            height: {ideal: 1080},
          },
        },
        handleSuccess,
        handleError,
      );
    } catch {
      await lector.start(
        {facingMode: 'environment'},
        scanOptions,
        handleSuccess,
        handleError,
      );
    }
  }

  try {
    const capabilities = lector.getRunningTrackCapabilities() as unknown as {
      focusMode?: string[];
      zoom?: {min?: number; max?: number; step?: number};
    };
    const settings = lector.getRunningTrackSettings() as unknown as {
      zoom?: number;
    };

    if (
      Array.isArray(capabilities?.focusMode) &&
      capabilities.focusMode.includes('continuous')
    ) {
      await lector
        .applyVideoConstraints({
          advanced: [{focusMode: 'continuous'}],
        } as unknown as MediaTrackConstraints)
        .catch(() => undefined);
    }

    const zoom = capabilities?.zoom;
    if (
      zoom &&
      typeof zoom.min === 'number' &&
      typeof zoom.max === 'number' &&
      zoom.max > zoom.min
    ) {
      // Never start or allow zooming below 1.0x (prevents switching to ultra-wide lens)
      const safeMin = zoom.max >= 1 ? Math.max(zoom.min, 1) : zoom.min;
      const step = typeof zoom.step === 'number' && zoom.step > 0 ? zoom.step : 0.1;
      const savedRaw = parseFloat(localStorage.getItem(CLAVE_ZOOM) || '');
      const valor = Number.isFinite(savedRaw)
        ? Math.min(zoom.max, Math.max(safeMin, savedRaw))
        : safeMin;

      const currentZoom =
        typeof settings?.zoom === 'number' ? settings.zoom : undefined;
      if (valor > zoom.min || (currentZoom !== undefined && currentZoom < safeMin)) {
        await lector
          .applyVideoConstraints({
            advanced: [{zoom: valor}],
          } as unknown as MediaTrackConstraints)
          .catch(() => undefined);
      }

      return {
        min: safeMin,
        max: zoom.max,
        step,
        valor,
      };
    }
  } catch {
    // Capabilities unsupported on this device/browser
  }

  return null;
}

export function sonidoEscaneo(ok = true): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as {webkitAudioContext?: typeof AudioContext})
        .webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (ok) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1180, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.start(now);
      osc.stop(now + 0.12);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.setValueAtTime(220, now + 0.08);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.23);
    }

    setTimeout(() => {
      ctx.close().catch(() => undefined);
    }, 350);
  } catch {
    // Ignore audio errors
  }
}

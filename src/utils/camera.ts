import {Html5Qrcode} from 'html5-qrcode';

export const CLAVE_CAMARA = 'tech_camera_id';
export const CLAVE_ZOOM = 'tech_camera_zoom';

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

export async function obtenerCamarasTraseras(): Promise<CameraDevice[]> {
  const devices = await Html5Qrcode.getCameras();
  if (!devices || devices.length === 0) return [];

  const isRear = (label: string) =>
    /back|rear|environment|trasera|main|wide|ultra|macro/i.test(label);

  const rear = devices.filter((d) => isRear(d.label));
  const list = rear.length > 0 ? rear : devices;
  return list.map((d, idx) => ({
    id: d.id,
    label: d.label || `Cámara ${idx + 1}`,
  }));
}

export async function crearLectorCamara(elementId: string): Promise<Html5Qrcode> {
  return new Html5Qrcode(elementId);
}

export async function iniciarLectorConOpciones(
  lector: Html5Qrcode,
  deviceId: string | null,
  onDecode: (decodedText: string) => void,
): Promise<ZoomCapabilities | null> {
  const cameraConfig = deviceId
    ? {deviceId: {exact: deviceId}}
    : {facingMode: 'environment'};

  await lector.start(
    cameraConfig,
    {
      fps: 12,
      qrbox: {width: 250, height: 150},
      aspectRatio: 1.5,
    },
    (decodedText) => {
      onDecode(decodedText);
    },
    () => undefined,
  );

  try {
    const capabilities = lector.getRunningTrackCapabilities() as unknown as {
      zoom?: {min?: number; max?: number; step?: number};
    };
    const zoom = capabilities?.zoom;
    if (
      zoom &&
      typeof zoom.min === 'number' &&
      typeof zoom.max === 'number' &&
      zoom.max > zoom.min
    ) {
      const step = typeof zoom.step === 'number' && zoom.step > 0 ? zoom.step : 0.1;
      const savedRaw = parseFloat(localStorage.getItem(CLAVE_ZOOM) || '');
      const valor = Number.isFinite(savedRaw)
        ? Math.min(zoom.max, Math.max(zoom.min, savedRaw))
        : zoom.min;

      if (valor > zoom.min) {
        await lector
          .applyVideoConstraints({
            advanced: [{zoom: valor}],
          } as unknown as MediaTrackConstraints)
          .catch(() => undefined);
      }

      return {
        min: zoom.min,
        max: zoom.max,
        step,
        valor,
      };
    }
  } catch {
    // Zoom capabilities unsupported on this device/browser
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

import {useEffect, useRef, useState} from 'react';
import {prepararLogoWatermark} from '../utils/thermalPrint';

interface Logo3DBackgroundProps {
  sidebarCollapsed: boolean;
}

export function Logo3DBackground({sidebarCollapsed}: Logo3DBackgroundProps) {
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [tilt, setTilt] = useState<{rx: number; ry: number}>({rx: -10, ry: 15});
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    prepararLogoWatermark().then((url) => {
      if (active) setLogoSrc(url);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const handleMove = (e: MouseEvent) => {
      if (rafRef.current !== null) return;
      const clientX = e.clientX;
      const clientY = e.clientY;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const nx = clientX / Math.max(1, window.innerWidth) - 0.5;
        const ny = clientY / Math.max(1, window.innerHeight) - 0.5;
        setTilt({
          rx: -10 - ny * 8,
          ry: 15 + nx * 10,
        });
      });
    };

    window.addEventListener('mousemove', handleMove, {passive: true});
    return () => {
      window.removeEventListener('mousemove', handleMove);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  if (!logoSrc) return null;

  return (
    <div
      aria-hidden="true"
      className={`tech-3d-watermark pointer-events-none select-none fixed inset-y-0 right-0 left-0 z-0 flex items-center justify-center overflow-hidden transition-[left] duration-200 print:hidden ${
        sidebarCollapsed ? 'md:left-[72px]' : 'md:left-64'
      }`}
    >
      <div
        className="relative w-[320px] sm:w-[460px] lg:w-[540px] max-w-[82vw] aspect-[873/515] transition-transform duration-300 ease-out"
        style={{
          transform: `perspective(680px) rotateY(${tilt.ry.toFixed(2)}deg) rotateX(${tilt.rx.toFixed(2)}deg) scale(0.94)`,
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Back depth plane for 3D parallax extrusion */}
        <img
          src={logoSrc}
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full object-contain opacity-[0.07] blur-[2px]"
          style={{
            transform: 'translate3d(12px, 16px, -28px)',
          }}
        />

        {/* Primary 3D logo plane */}
        <img
          src={logoSrc}
          alt=""
          draggable={false}
          className="relative w-full h-full object-contain opacity-[0.17]"
          style={{
            filter: 'drop-shadow(10px 15px 20px rgba(15, 23, 42, 0.24))',
            transform: 'translateZ(12px)',
          }}
        />
      </div>
    </div>
  );
}

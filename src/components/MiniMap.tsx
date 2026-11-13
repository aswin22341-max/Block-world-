import React, { useEffect, useRef } from 'react';
import { HudSnapshot, WORLD_ZONES } from '../types/game';

interface MiniMapProps {
  hud: HudSnapshot;
}

export const MiniMap: React.FC<MiniMapProps> = ({ hud }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const w = c.width;
    const h = c.height;
    const mapRange = 175;
    const toMap = (wx: number, wz: number) => ({
      x: (wx / mapRange) * (w / 2) + w / 2,
      y: (wz / mapRange) * (h / 2) + h / 2,
    });

    // Grass base
    ctx.fillStyle = '#14532d';
    ctx.fillRect(0, 0, w, h);

    // Beach & Ocean on right
    ctx.fillStyle = '#eab308';
    ctx.fillRect(w * 0.78, 0, w * 0.1, h);
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(w * 0.86, 0, w * 0.14, h);

    // Crystal River
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let z = -70; z <= 110; z += 10) {
      const rx = 70 + Math.sin(z * 0.04) * 10;
      const p = toMap(rx, z);
      if (z === -70) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // City Roads
    ctx.fillStyle = '#475569';
    const roadOrigin = toMap(0, 0);
    ctx.fillRect(roadOrigin.x - 2, toMap(0, -85).y, 4, 72);
    ctx.fillRect(toMap(-85, 0).x, roadOrigin.y - 2, 72, 4);

    // Zone markers
    for (const z of WORLD_ZONES) {
      const p = toMap(z.x, z.z);
      ctx.fillStyle = z.color;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Vehicles, Bots, Remote Players
    for (const ent of hud.minimapEntities) {
      const p = toMap(ent.x, ent.z);
      ctx.fillStyle = ent.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, ent.kind === 'vehicle' ? 2.2 : 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Local Player Arrow
    const me = toMap(hud.playerPos.x, hud.playerPos.z);
    ctx.save();
    ctx.translate(me.x, me.y);
    ctx.rotate(-hud.playerRotY + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }, [hud]);

  return (
    <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-2 shadow-lg">
      <div className="flex items-center justify-between text-[11px] font-medium text-slate-300 px-1 pb-1.5">
        <span className="truncate max-w-[116px]">{hud.zoneName}</span>
        <span className="font-mono tabular-nums text-slate-400">
          {Math.round(hud.playerPos.x)},{Math.round(hud.playerPos.z)}
        </span>
      </div>
      <canvas ref={canvasRef} width={156} height={156} className="rounded-lg block border border-slate-800" />
    </div>
  );
};

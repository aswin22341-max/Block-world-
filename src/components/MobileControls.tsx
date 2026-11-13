import React, { useRef, useState } from 'react';

interface MobileControlsProps {
  onMove: (vec: { x: number; y: number }, jump: boolean, sprint: boolean) => void;
  onCameraDrag: (dx: number, dy: number) => void;
  onInteract: () => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({ onMove, onCameraDrag, onInteract }) => {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [sprint, setSprint] = useState(false);
  const joyOrigin = useRef<{ x: number; y: number } | null>(null);
  const joyVec = useRef({ x: 0, y: 0 });
  const jumpRef = useRef(false);
  const sprintRef = useRef(false);
  const camLast = useRef<{ x: number; y: number } | null>(null);

  const emit = () => {
    onMove({ ...joyVec.current }, jumpRef.current, sprintRef.current);
  };

  const handleJoyStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    const t = e.changedTouches[0];
    joyOrigin.current = { x: t.clientX, y: t.clientY };
  };

  const handleJoyMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (!joyOrigin.current) return;
    const t = e.changedTouches[0];
    const maxR = 42;
    let dx = t.clientX - joyOrigin.current.x;
    let dy = t.clientY - joyOrigin.current.y;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setKnob({ x: dx, y: dy });
    joyVec.current = { x: dx / maxR, y: dy / maxR };
    emit();
  };

  const handleJoyEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    joyOrigin.current = null;
    setKnob({ x: 0, y: 0 });
    joyVec.current = { x: 0, y: 0 };
    emit();
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-20">
      {/* Left Virtual Joystick */}
      <div
        className="pointer-events-auto absolute bottom-24 left-5 w-28 h-28 rounded-full bg-slate-900/75 border-2 border-slate-600/80 flex items-center justify-center touch-none"
        onTouchStart={handleJoyStart}
        onTouchMove={handleJoyMove}
        onTouchEnd={handleJoyEnd}
      >
        <div
          className="w-12 h-12 rounded-full bg-sky-400 border-2 border-white shadow-md"
          style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
        />
      </div>

      {/* Right Camera Touch Pad */}
      <div
        className="pointer-events-auto absolute top-24 right-4 bottom-48 w-40 touch-none"
        onTouchStart={(e) => {
          const t = e.changedTouches[0];
          camLast.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchMove={(e) => {
          if (!camLast.current) return;
          const t = e.changedTouches[0];
          onCameraDrag(t.clientX - camLast.current.x, t.clientY - camLast.current.y);
          camLast.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={() => {
          camLast.current = null;
        }}
      />

      {/* Action Buttons Bottom-Right */}
      <div className="pointer-events-auto absolute bottom-24 right-5 flex flex-col items-end gap-3">
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onInteract}
            className="w-13 h-13 rounded-xl bg-amber-500 active:bg-amber-400 text-slate-950 font-bold text-sm border border-amber-300 shadow-lg"
          >
            USE
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !sprint;
              setSprint(next);
              sprintRef.current = next;
              emit();
            }}
            className={`w-13 h-13 rounded-xl font-bold text-xs border shadow-lg ${
              sprint ? 'bg-emerald-500 text-slate-950 border-emerald-300' : 'bg-slate-800/90 text-slate-100 border-slate-600'
            }`}
          >
            RUN
          </button>
        </div>
        <button
          type="button"
          onTouchStart={(e) => {
            e.preventDefault();
            jumpRef.current = true;
            emit();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            jumpRef.current = false;
            emit();
          }}
          className="w-18 h-18 rounded-2xl bg-sky-500 active:bg-sky-400 text-slate-950 font-extrabold text-sm border-2 border-sky-200 shadow-lg"
        >
          JUMP
        </button>
      </div>
    </div>
  );
};

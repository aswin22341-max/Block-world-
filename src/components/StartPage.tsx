import React from 'react';
import { Compass, Gamepad2, Play, Settings, Sparkles, User } from 'lucide-react';
import { MenuTab } from './GameMenus';

interface StartPageProps {
  playerName: string;
  onChangePlayerName: (name: string) => void;
  onStartPlay: () => void;
  onOpenMenuTab: (tab: MenuTab) => void;
  coins: number;
  level: number;
}

export const StartPage: React.FC<StartPageProps> = ({
  playerName,
  onChangePlayerName,
  onStartPlay,
  onOpenMenuTab,
  coins,
  level,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-gradient-to-b from-slate-950/75 via-slate-950/55 to-slate-950/90 p-5 md:p-10">
      {/* Top Bar */}
      <header className="flex items-center justify-between gap-6 max-w-6xl w-full mx-auto">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-sky-500 flex items-center justify-center font-display font-extrabold text-slate-950 text-xl">
            B
          </div>
          <span className="font-display font-extrabold text-xl tracking-tight text-white whitespace-nowrap">
            BLOCKVERSE 3D
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-300 font-medium">
          <span className="hidden sm:inline tabular-nums">Level {level} · {coins.toLocaleString()} Coins</span>
          <button
            type="button"
            onClick={() => onOpenMenuTab('settings')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 transition-colors whitespace-nowrap"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </div>
      </header>

      {/* Center Hero Start Card */}
      <main className="flex-1 flex items-center justify-center py-6">
        <div className="w-full max-w-xl bg-slate-900/92 border border-slate-700/85 rounded-2xl p-7 md:p-9 shadow-2xl space-y-6 text-center">
          <div className="space-y-2">
            <div className="text-xs font-semibold tracking-wide text-sky-400">
              3D Multiplayer Sandbox Adventure
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-extrabold tracking-tight text-white text-balance">
              BLOCKVERSE 3D
            </h1>
            <div className="text-sm font-bold text-amber-400">
              Developed by Adway 3rd D
            </div>
            <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
              Explore cities, beaches, mountains, and airports. Customize your blocky avatar, build worlds, drive vehicles, adopt pets, and compete in 7 mini-games.
            </p>
          </div>

          {/* Player Name Input + Primary Start CTA */}
          <div className="space-y-3 text-left max-w-sm mx-auto">
            <label htmlFor="start-player-name" className="block text-xs font-semibold text-slate-300">
              Player Name
            </label>
            <input
              id="start-player-name"
              type="text"
              maxLength={16}
              value={playerName}
              onChange={(e) => onChangePlayerName(e.target.value)}
              placeholder="Enter your name..."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-medium focus:outline-none focus:border-sky-400"
            />

            <button
              type="button"
              onClick={onStartPlay}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-base shadow-lg transition-colors"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Start Playing</span>
            </button>
          </div>

          {/* Secondary Quick Actions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => onOpenMenuTab('avatar')}
              className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl bg-slate-800/85 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-100 transition-colors"
            >
              <User className="w-4 h-4 text-sky-400" />
              <span>Avatar</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenMenuTab('worlds')}
              className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl bg-slate-800/85 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-100 transition-colors"
            >
              <Compass className="w-4 h-4 text-emerald-400" />
              <span>Worlds</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenMenuTab('minigames')}
              className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl bg-slate-800/85 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-100 transition-colors"
            >
              <Gamepad2 className="w-4 h-4 text-amber-400" />
              <span>Mini-Games</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenMenuTab('play')}
              className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl bg-slate-800/85 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-100 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-fuchsia-400" />
              <span>Main Hub</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer with Developer Credit */}
      <footer className="max-w-6xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-300 pt-2">
        <div className="font-semibold text-white">
          Developer: Adway 3rd D
        </div>
        <div className="text-slate-400">
          Controls: WASD to move · SPACE to jump · Drag mouse to look · E to interact
        </div>
      </footer>
    </div>
  );
};

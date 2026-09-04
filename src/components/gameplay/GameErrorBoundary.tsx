import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  gameTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GameErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Game Module Exception caught by GameErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center p-6 text-center bg-zinc-950 border border-rose-500/40 rounded-2xl shadow-2xl relative overflow-hidden select-none">
          <div className="absolute inset-0 bg-scanlines opacity-20 pointer-events-none"></div>
          <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-4 text-rose-500 shadow-lg animate-pulse">
            <AlertTriangle size={32} />
          </div>

          <h3 className="text-sm font-black font-display text-white uppercase tracking-wider mb-2">
            MODUL GAME {this.props.gameTitle ? `(${this.props.gameTitle.toUpperCase()})` : ''} MENGALAMI TROUBLE
          </h3>

          <p className="text-xs text-zinc-400 font-sans max-w-md mb-2 leading-relaxed">
            Terjadi kesalahan teknis yang tidak terduga pada pengolah grafik/logika game ini.
          </p>

          {this.state.error && (
            <div className="text-[10px] font-mono bg-zinc-900/80 border border-zinc-800 text-rose-300 p-2.5 rounded-lg max-w-md w-full mb-5 truncate">
              {this.state.error.message || 'Runtime Execution Exception'}
            </div>
          )}

          <button
            onClick={this.handleReset}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-mono text-xs font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(225,29,72,0.4)] flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw size={14} />
            RESTART MODUL PERMAINAN
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

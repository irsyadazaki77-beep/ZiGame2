import React from 'react';
import { AlertTriangle, RefreshCw, RotateCcw, Home } from 'lucide-react';
import { logger } from '../../utils/logger';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  info: any;
}

export class AppErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    this.setState({ error, info });
    logger.fatal("Critical error caught by AppErrorBoundary", {
      code: 'FATAL_REACT_CRASH',
      error,
      context: { componentStack: info?.componentStack }
    });
  }

  handleSafeReset = () => {
    try {
      this.setState({ hasError: false, error: null, info: null });
    } catch {
      window.location.href = '/';
    }
  };

  handleHardReboot = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isChunkError = this.state.error?.message?.includes('dynamically imported module') || 
                           this.state.error?.name === 'ChunkLoadError';

      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6 text-red-500 font-mono">
          <div className="border-2 border-red-500/80 p-8 max-w-2xl w-full bg-red-950/20 backdrop-blur-md shadow-[0_0_40px_rgba(220,38,38,0.25)] rounded-2xl">
            <h2 className="text-2xl font-black mb-3 uppercase flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-red-500 animate-pulse" /> 
              <span>SYSTEM ANOMALY DETECTED</span>
            </h2>
            <p className="text-sm text-red-400/90 mb-6">
              {isChunkError 
                ? 'Modul aset aplikasi versi baru telah tersedia di server. Diperlukan sinkronisasi ulang.'
                : 'Pengecualian kritis tertangkap pada lapisan runtime UI ZiGame.'}
            </p>
            
            <div className="bg-black/80 p-4 border border-red-900/60 rounded-xl overflow-auto max-h-48 text-xs mb-6 text-zinc-300">
              <p className="font-bold text-red-400 mb-1">{this.state.error?.toString()}</p>
              <pre className="opacity-60 whitespace-pre-wrap text-[11px] font-mono">{this.state.error?.stack}</pre>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button 
                onClick={this.handleHardReboot} 
                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold tracking-wider uppercase transition-colors rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-red-600/30 text-xs"
              >
                <RefreshCw className="w-4 h-4" />
                <span>RELOAD SYSTEM</span>
              </button>

              <button 
                onClick={this.handleSafeReset} 
                className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-200 font-bold tracking-wider uppercase transition-colors rounded-xl flex items-center gap-2 cursor-pointer text-xs"
              >
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <span>RETRY RENDER</span>
              </button>

              <a 
                href="/" 
                className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-200 font-bold tracking-wider uppercase transition-colors rounded-xl flex items-center gap-2 text-xs"
              >
                <Home className="w-4 h-4 text-cyan-400" />
                <span>HOME BASE</span>
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}


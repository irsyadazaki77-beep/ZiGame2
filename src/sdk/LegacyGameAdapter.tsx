import React, { useEffect, useRef, useState } from 'react';
import { GameModule, GameRuntimeContext } from '../types/gameSdk';
import { GameComponentProps } from '../types';
import { createGameRuntimeContext } from './runtimeContext';
import { GameErrorBoundary } from '../components/gameplay/GameErrorBoundary';
import { GameOverlay } from '../components/gameplay/GameOverlay';
import { GameContainer } from '../components/gameplay/GameContainer';

export interface LegacyGameAdapterProps extends GameComponentProps {
  gameId: string;
  gameTitle?: string;
  module?: GameModule;
  children?: (context: GameRuntimeContext) => React.ReactNode;
}

/**
 * LegacyGameAdapter bridges traditional components or standard GameModules to the unified engine.
 * Ensures strict error isolation, score idempotency, loop cleanup, and lifecycle stability.
 */
export const LegacyGameAdapter: React.FC<LegacyGameAdapterProps> = ({
  gameId,
  gameTitle,
  module,
  children,
  onGameOver,
  onScoreUpdate,
  highScore
}) => {
  const [key, setKey] = useState(0);
  const contextRef = useRef<GameRuntimeContext | null>(null);

  // Initialize runtime context for the adapter
  if (!contextRef.current) {
    contextRef.current = createGameRuntimeContext({
      gameId,
      onGameOver,
      onScoreUpdate,
      onRestart: () => setKey(k => k + 1)
    });
  }

  const ctx = contextRef.current;

  useEffect(() => {
    if (module && ctx) {
      if (module.init) {
        module.init(ctx);
      }
    }
    return () => {
      if (module?.onDestroy) {
        module.onDestroy();
      }
      ctx.lifecycle.destroy();
    };
  }, [module, ctx]);

  return (
    <GameErrorBoundary gameTitle={gameTitle || gameId} onReset={() => setKey(k => k + 1)}>
      <GameContainer key={key}>
        {children ? children(ctx) : null}
        <GameOverlay
          gameState={ctx.lifecycle.getState() as any}
          score={ctx.score.get()}
          highScore={highScore}
          onStart={() => ctx.lifecycle.startWithCountdown()}
          onRestart={() => ctx.lifecycle.triggerRestart()}
        />
      </GameContainer>
    </GameErrorBoundary>
  );
};

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audio } from '../../utils/audio';
import { useGameEngine } from '../../hooks/useGameEngine';
import { Particle } from '../../types';
import { GameContainer } from '../gameplay/GameContainer';
import { GameHUD } from '../gameplay/GameHUD';
import { GameOverlay } from '../gameplay/GameOverlay';

interface CyberSimonGameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

interface SimonPad {
  id: number;
  name: string;
  color: string;
  glowColor: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function CyberSimonGame({ onGameOver, onScoreUpdate, highScore }: CyberSimonGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const {
    gameState,
    setGameState,
    score,
    updateScore,
    addScore,
    startLoop,
    stopLoop,
    triggerGameOver,
    startWithCountdown,
    countdown,
  } = useGameEngine({
    gameId: 'cybersimon',
    onGameOver,
    onScoreUpdate,
  });

  const gameStateRef = useRef(gameState);
  
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const CANVAS_WIDTH = 400;
  const CANVAS_HEIGHT = 500;

  // Simon Pads Layout definitions (4 quadrants)
  const pads: SimonPad[] = [
    { id: 0, name: 'GREEN', color: '#064e3b', glowColor: '#10b981', x: 40, y: 120, width: 150, height: 150 }, // Top Left
    { id: 1, name: 'RED', color: '#7f1d1d', glowColor: '#ef4444', x: 210, y: 120, width: 150, height: 150 }, // Top Right
    { id: 2, name: 'YELLOW', color: '#78350f', glowColor: '#f59e0b', x: 40, y: 290, width: 150, height: 150 }, // Bottom Left
    { id: 3, name: 'BLUE', color: '#1e3a8a', glowColor: '#3b82f6', x: 210, y: 290, width: 150, height: 150 }, // Bottom Right
  ];

  const sequenceRef = useRef<number[]>([]);
  const playerSequenceRef = useRef<number[]>([]);
  const isPlaybackRef = useRef(false);
  const activePadRef = useRef<number | null>(null);
  const playbackIndexRef = useRef(0);
  const playbackTimerRef = useRef(0);

  const particlesRef = useRef<Particle[]>([]);

  const lastTimeRef = useRef(0);

  useEffect(() => {
    drawStatic();
  }, []);

  const drawStatic = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 20px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('CYBER SIMON', CANVAS_WIDTH / 2, 60);

    ctx.fillStyle = '#3b82f6';
    ctx.font = "12px 'JetBrains Mono', monospace";
    ctx.fillText('IKUTI SEQUENCE POLA LAMPU NEON', CANVAS_WIDTH / 2, 85);

    // Draw static dim pads
    pads.forEach(pad => {
      ctx.fillStyle = pad.color;
      ctx.beginPath();
      ctx.roundRect(pad.x, pad.y, pad.width, pad.height, 15);
      ctx.fill();
    });
  };

  const startGame = useCallback(() => {
    updateScore(0);
    sequenceRef.current = [];
    playerSequenceRef.current = [];
    isPlaybackRef.current = false;
    activePadRef.current = null;
    particlesRef.current = [];

    startWithCountdown(() => {
      lastTimeRef.current = performance.now();
      addNewSequenceStep();
      startLoop(gameStep);
    });
  }, [startWithCountdown, startLoop, updateScore]);

  const addNewSequenceStep = () => {
    const randomPad = Math.floor(Math.random() * 4);
    sequenceRef.current.push(randomPad);
    startPlayback();
  };

  const startPlayback = () => {
    isPlaybackRef.current = true;
    playbackIndexRef.current = 0;
    playbackTimerRef.current = 0;
    activePadRef.current = null;
  };

  const createPadParticles = (pad: SimonPad) => {
    const px = pad.x + pad.width / 2;
    const py = pad.y + pad.height / 2;
    for (let i = 0; i < 10; i++) {
      particlesRef.current.push({
        x: px,
        y: py,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        color: pad.glowColor,
        radius: Math.random() * 2.5 + 1,
        alpha: 1,
        decay: Math.random() * 0.05 + 0.03,
      });
    }
  };

  const playPadGlow = (padId: number) => {
    activePadRef.current = padId;
    audio.playJump(); // Plays audio chime
    
    // Trigger sparks
    const pad = pads[padId];
    createPadParticles(pad);

    // Turn off glow after a delay
    setTimeout(() => {
      if (activePadRef.current === padId) {
        activePadRef.current = null;
      }
    }, 350);
  };

  const handlePadClick = (padId: number) => {
    if (gameStateRef.current !== 'playing' || isPlaybackRef.current) return;

    playPadGlow(padId);
    playerSequenceRef.current.push(padId);

    // Compare
    const currentIndex = playerSequenceRef.current.length - 1;
    if (playerSequenceRef.current[currentIndex] !== sequenceRef.current[currentIndex]) {
      // Game Over!
      audio.playExplosion();
      triggerGameOver();
      return;
    }

    if (playerSequenceRef.current.length === sequenceRef.current.length) {
      // Completed full turn!
      addScore(10);

      playerSequenceRef.current = [];
      setTimeout(() => {
        if (gameStateRef.current === 'playing') {
          audio.playScore();
          addNewSequenceStep();
        }
      }, 1000);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameStateRef.current !== 'playing' || isPlaybackRef.current) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Get click coordinates normalized to canvas size
    const clickX = ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
    const clickY = ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT;

    pads.forEach(pad => {
      if (
        clickX >= pad.x &&
        clickX <= pad.x + pad.width &&
        clickY >= pad.y &&
        clickY <= pad.y + pad.height
      ) {
        handlePadClick(pad.id);
      }
    });
  };

  const gameStep = useCallback((timestamp: number) => {
    if (gameStateRef.current !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Sequence playback handling
    if (isPlaybackRef.current) {
      playbackTimerRef.current += 1.5; // speeds up simulation a bit
      const stepDuration = 40;

      if (playbackTimerRef.current > stepDuration) {
        playbackTimerRef.current = 0;
        
        if (playbackIndexRef.current < sequenceRef.current.length) {
          const nextPadId = sequenceRef.current[playbackIndexRef.current];
          playPadGlow(nextPadId);
          playbackIndexRef.current++;
        } else {
          // Finished playing full sequence, player's turn!
          isPlaybackRef.current = false;
          playerSequenceRef.current = [];
        }
      }
    }

    draw(ctx);
  }, []);

  const draw = (ctx: CanvasRenderingContext2D) => {

    // DRAW
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Title Info
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 18px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('CYBER SIMON', CANVAS_WIDTH / 2, 45);

    // Draw Pads
    pads.forEach(pad => {
      const isGlowing = activePadRef.current === pad.id;

      if (isGlowing) {
        ctx.shadowBlur = 25;
        ctx.shadowColor = pad.glowColor;
        ctx.fillStyle = pad.glowColor;
      } else {
        ctx.fillStyle = pad.color;
      }

      ctx.beginPath();
      ctx.roundRect(pad.x, pad.y, pad.width, pad.height, 16);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Draw center controller hud circle
    ctx.fillStyle = '#09090b';
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH / 2, 280, 45, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isPlaybackRef.current ? '#f59e0b' : '#10b981';
    ctx.font = "bold 10px 'JetBrains Mono', monospace";
    ctx.textAlign = 'center';
    ctx.fillText(isPlaybackRef.current ? 'WATCH' : 'REPEAT', CANVAS_WIDTH / 2, 275);

    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 16px 'Space Grotesk', sans-serif";
    ctx.fillText(`${sequenceRef.current.length}`, CANVAS_WIDTH / 2, 296);

    // Draw particle effects
    particlesRef.current.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;

      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;
    particlesRef.current = particlesRef.current.filter(p => p.alpha > 0);

    // Bottom HUD score
    ctx.fillStyle = '#52525b';
    ctx.font = "bold 11px 'JetBrains Mono', monospace";
    ctx.fillText(`SKOR: ${score}`, CANVAS_WIDTH / 2, 475);
  };

  return (
    <GameContainer aspect="portrait" maxWidth="sm">
      {gameState === 'playing' && (
        <GameHUD 
          stats={[
            { id: 'score', label: 'SKOR', value: score, emphasized: true }
          ]} 
        />
      )}

      <GameOverlay
        gameState={gameState}
        score={score}
        countdown={countdown}
        onStart={startGame}
        onRestart={startGame}
        instructions="IKUTI SEQUENCE POLA LAMPU NEON. Ketuk langsung pada panel menyala."
      />

      <div className="relative w-full aspect-[4/5] mx-auto bg-zinc-950 rounded-xl border-4 border-zinc-900 shadow-2xl overflow-hidden cursor-pointer">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onClick={handleCanvasClick}
          className="w-full h-full display-block bg-zinc-950 cursor-pointer"
        />
      </div>
    </GameContainer>
  );
}

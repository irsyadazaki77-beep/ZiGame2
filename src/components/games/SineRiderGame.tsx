import React, { useEffect, useRef, useState } from 'react';
import { audio } from '../../utils/audio';
import { Particle } from '../../types';
import { GameContainer } from '../gameplay/GameContainer';
import { GameHUD } from '../gameplay/GameHUD';
import { GameOverlay } from '../gameplay/GameOverlay';
import { MobileControls } from '../gameplay/MobileControls';

interface SineRiderGameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

interface ObstacleWall {
  x: number;
  gapY: number; // Y center of gap
  gapHeight: number; // height of gap
  passed: boolean;
}

export default function SineRiderGame({ onGameOver, onScoreUpdate, highScore }: SineRiderGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const lastTimeRef = useRef<number>(0);
  const gameLoopRef = useRef<number | null>(null);
  const scoreRef = useRef(0);
  const [gameOver, setGameOver] = useState(false);
  const isPlayingRef = useRef(false);
  const gameOverRef = useRef(false);


  useEffect(() => {
    isPlayingRef.current = isPlaying;
    gameOverRef.current = gameOver;
    scoreRef.current = score;
  }, [isPlaying, gameOver, score]);
  const [muted, setMuted] = useState(audio.getMuteState());

  const CANVAS_WIDTH = 400;
  const CANVAS_HEIGHT = 500;

  // Physics state
  const riderYRef = useRef(CANVAS_HEIGHT / 2);
  const riderVyRef = useRef(0);
  const gravity = 0.28;
  const liftForce = -5.8;
  const isHoldingRef = useRef(false);

  const obstaclesRef = useRef<ObstacleWall[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const spawnTimerRef = useRef(0);

  useEffect(() => {
    drawStatic();
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, []);

  const drawStatic = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Grid wires
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 1;
    for (let y = 0; y < CANVAS_HEIGHT; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 20px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('SINE RIDER', CANVAS_WIDTH / 2, 200);

    ctx.fillStyle = '#06b6d4';
    ctx.font = "12px 'JetBrains Mono', monospace";
    ctx.fillText('TAHAN UNTUK MENAIKKAN GELOMBANG SINE', CANVAS_WIDTH / 2, 225);

    ctx.fillStyle = '#71717a';
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.fillText('Lewati celah dinding laser bercahaya', CANVAS_WIDTH / 2, 250);
  };

  const startNewGame = () => {
    audio.playCoin();
    setIsPlaying(true);
    setGameOver(false);
    setScore(0);
    onScoreUpdate(0);

    riderYRef.current = CANVAS_HEIGHT / 2;
    riderVyRef.current = 0;
    obstaclesRef.current = [];
    particlesRef.current = [];
    spawnTimerRef.current = 0;
    lastTimeRef.current = performance.now();

    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    gameLoopRef.current = requestAnimationFrame(update);
  };

  const handlePointerDown = () => {
    isHoldingRef.current = true;
    if (isPlaying && !gameOver) {
      audio.playJump();
    }
  };

  const handlePointerUp = () => {
    isHoldingRef.current = false;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault();
        isHoldingRef.current = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault();
        isHoldingRef.current = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const createRiderTrail = (x: number, y: number) => {
    particlesRef.current.push({
      x,
      y,
      vx: -1.8 - Math.random() * 1.5,
      vy: (Math.random() - 0.5) * 1.2,
      color: '#06b6d4',
      radius: Math.random() * 3 + 1,
      alpha: 0.9,
      decay: 0.04,
    });
  };

  const createExplosion = (x: number, y: number) => {
    for (let i = 0; i < 20; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        color: '#f43f5e',
        radius: Math.random() * 3.5 + 1.5,
        alpha: 1,
        decay: Math.random() * 0.04 + 0.02,
      });
    }
  };

  const update = (timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !isPlayingRef.current || gameOverRef.current ) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const delta = (timestamp - lastTimeRef.current) / 16.666;
    lastTimeRef.current = timestamp;

    const gameSpeed = 3.2 + scoreRef.current * 0.005;

    // Movement updates
    if (isHoldingRef.current) {
      riderVyRef.current += liftForce * 0.08 * delta;
    } else {
      riderVyRef.current += gravity * delta;
    }

    // Terminal velocity
    riderVyRef.current = Math.max(-6, Math.min(6, riderVyRef.current));
    riderYRef.current += riderVyRef.current * delta;

    // Trail particles
    if (Math.random() < 0.6) {
      createRiderTrail(80, riderYRef.current);
    }

    // Spawn walls
    spawnTimerRef.current += delta;
    if (spawnTimerRef.current > 75) {
      spawnTimerRef.current = 0;

      const gapH = Math.max(105, 140 - scoreRef.current * 0.5);
      const gapY = 80 + Math.random() * (CANVAS_HEIGHT - 160);

      obstaclesRef.current.push({
        x: CANVAS_WIDTH + 40,
        gapY,
        gapHeight: gapH,
        passed: false,
      });
    }

    // Screen bound death
    if (riderYRef.current < 0 || riderYRef.current > CANVAS_HEIGHT) {
      audio.playExplosion();
      setGameOver(true);
      setIsPlaying(false);
      createExplosion(80, riderYRef.current);
      onGameOver(scoreRef.current);
      return;
    }

    // DRAW
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw background vector line grids
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1;
    for (let i = 0; i < CANVAS_WIDTH; i += 30) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, CANVAS_HEIGHT);
      ctx.stroke();
    }

    // Sine rider trajectory visual line
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_HEIGHT / 2);
    for (let x = 0; x < CANVAS_WIDTH; x += 10) {
      const offsetSine = Math.sin(x * 0.02 + timestamp * 0.003) * 35;
      ctx.lineTo(x, CANVAS_HEIGHT / 2 + offsetSine);
    }
    ctx.stroke();

    // Render obstacles
    obstaclesRef.current.forEach(wall => {
      wall.x -= gameSpeed * delta;

      // Draw Top block
      ctx.fillStyle = '#1e1b4b';
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2;

      ctx.shadowBlur = 10;
      ctx.shadowColor = '#f43f5e';

      // Top wall
      ctx.fillRect(wall.x - 15, 0, 30, wall.gapY - wall.gapHeight / 2);
      ctx.strokeRect(wall.x - 15, 0, 30, wall.gapY - wall.gapHeight / 2);

      // Bottom wall
      const botY = wall.gapY + wall.gapHeight / 2;
      ctx.fillRect(wall.x - 15, botY, 30, CANVAS_HEIGHT - botY);
      ctx.strokeRect(wall.x - 15, botY, 30, CANVAS_HEIGHT - botY);

      ctx.shadowBlur = 0;

      // Pass detection
      if (wall.x < 80 && !wall.passed) {
        wall.passed = true;
        audio.playScore();
        setScore(prev => {
          const next = prev + 10;
          onScoreUpdate(next);
          return next;
        });
      }

      // Collision checks
      const withinX = (80 + 10 > wall.x - 15 && 80 - 10 < wall.x + 15);
      const inTopGap = (riderYRef.current - 10 < wall.gapY - wall.gapHeight / 2);
      const inBotGap = (riderYRef.current + 10 > wall.gapY + wall.gapHeight / 2);

      if (withinX && (inTopGap || inBotGap)) {
        audio.playExplosion();
        setGameOver(true);
        setIsPlaying(false);
        createExplosion(80, riderYRef.current);
        onGameOver(scoreRef.current);
      }
    });
    obstaclesRef.current = obstaclesRef.current.filter(w => w.x > -50);

    // Draw particle effects
    particlesRef.current.forEach(p => {
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.alpha -= p.decay * delta;

      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;
    particlesRef.current = particlesRef.current.filter(p => p.alpha > 0);

    // Render Rider (glowing neon circle with wings)
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#06b6d4';
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(80, riderYRef.current, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(80, riderYRef.current, 4, 0, Math.PI * 2);
    ctx.fill();

    // Bottom dashboard HUD
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 11px 'JetBrains Mono', monospace";
    ctx.textAlign = 'left';
    ctx.fillText(`KESTABILAN: ${(100 - Math.abs(riderVyRef.current) * 12).toFixed(0)}%`, 15, 30);
    ctx.textAlign = 'right';
    ctx.fillText(`SKOR: ${score}`, CANVAS_WIDTH - 15, 30);

    gameLoopRef.current = requestAnimationFrame(update);
  };

  const toggleMute = () => {
    const nextMuted = audio.toggleMute();
    setMuted(nextMuted);
  };

  const getGameState = () => {
    if (!isPlaying && score === 0 && !gameOver) return 'ready';
    if (!isPlaying) return 'gameover';
    return 'playing';
  };

  return (
    <GameContainer aspect="portrait" maxWidth="sm">
      {isPlaying && (
        <GameHUD 
          stats={[
            { id: 'score', label: 'SKOR', value: score, emphasized: true }
          ]} 
        />
      )}

      <GameOverlay
        gameState={getGameState()}
        score={score}
        onStart={startNewGame}
        onRestart={startNewGame}
        instructions="Tahan spasi atau ketuk layar untuk menaikkan gelombang sine. Lewati celah dinding laser bercahaya!"
      />

      <div className="w-full h-full border-4 border-zinc-900 bg-black rounded-2xl overflow-hidden shadow-2xl relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full block bg-zinc-950 cursor-pointer"
          onMouseDown={handlePointerDown}
          onMouseUp={handlePointerUp}
          onTouchStart={(e) => { e.preventDefault(); handlePointerDown(); }}
          onTouchEnd={(e) => { e.preventDefault(); handlePointerUp(); }}
        />
      </div>

      {isPlaying && (
        <div className="mt-4 flex gap-4 w-full md:hidden">
          <button
            onMouseDown={handlePointerDown}
            onMouseUp={handlePointerUp}
            onTouchStart={(e) => { e.preventDefault(); handlePointerDown(); }}
            onTouchEnd={(e) => { e.preventDefault(); handlePointerUp(); }}
            className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 active:scale-95 rounded-xl text-sm font-black text-white flex items-center justify-center uppercase select-none"
          >
            SINE LIFT (TAHAN)
          </button>
        </div>
      )}
    </GameContainer>
  );
}

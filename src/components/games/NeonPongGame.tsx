import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audio } from '../../utils/audio';
import { inputManager } from '../../services/inputService';
import { GameOverlay } from '../gameplay/GameOverlay';
import { Sparkles, Trophy, Flame } from 'lucide-react';

interface NeonPongGameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
}

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 340;
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 65;
const BALL_SIZE = 8;
const MAX_BALL_SPEED = 12;

export default function NeonPongGame({ onGameOver, onScoreUpdate, highScore }: NeonPongGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [gameState, setGameState] = useState<'ready' | 'countdown' | 'playing' | 'paused' | 'gameover'>('ready');
  const [countdown, setCountdown] = useState(3);
  const [playerScore, setPlayerScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [rallyStreak, setRallyStreak] = useState(0);

  const gameStateRef = useRef(gameState);
  const playerScoreRef = useRef(0);
  const botScoreRef = useRef(0);
  const rallyRef = useRef(0);
  const gameLoopRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const shakeRef = useRef<number>(0);
  const hitStopRef = useRef<number>(0);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Paddles & Ball
  const playerYRef = useRef((CANVAS_HEIGHT - PADDLE_HEIGHT) / 2);
  const playerTargetYRef = useRef((CANVAS_HEIGHT - PADDLE_HEIGHT) / 2);
  const playerPrevYRef = useRef((CANVAS_HEIGHT - PADDLE_HEIGHT) / 2);

  const opponentYRef = useRef((CANVAS_HEIGHT - PADDLE_HEIGHT) / 2);

  const ballRef = useRef({
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2,
    vx: 4.5,
    vy: 2.2,
    speed: 4.8,
  });

  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const trailsRef = useRef<{ x: number; y: number; color: string }[]>([]);
  const activeKeysRef = useRef<{ [key: string]: boolean }>({});

  // Auto-pause when tab hidden
  useEffect(() => {
    const handleVis = () => {
      if (document.hidden && gameStateRef.current === 'playing') {
        setGameState('paused');
      }
    };
    document.addEventListener('visibilitychange', handleVis);
    return () => document.removeEventListener('visibilitychange', handleVis);
  }, []);

  const spawnParticles = (x: number, y: number, color: string, count = 12, speed = 3) => {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5);
      const spd = Math.random() * speed + 1;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: Math.random() * 2.5 + 1.5,
        color,
        alpha: 1.0,
        decay: 0.04 + Math.random() * 0.02,
      });
    }
  };

  const spawnFloatingText = (x: number, y: number, text: string, color = '#fbbf24') => {
    floatingTextsRef.current.push({
      x,
      y,
      text,
      color,
      alpha: 1.0,
      vy: -1.0,
    });
  };

  const resetBall = (toPlayer: boolean) => {
    const angle = (Math.random() - 0.5) * (Math.PI / 4);
    const speed = 4.8;
    ballRef.current = {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      vx: (toPlayer ? -1 : 1) * speed * Math.cos(angle),
      vy: speed * Math.sin(angle),
      speed,
    };
    rallyRef.current = 0;
    setRallyStreak(0);
  };

  const resetGame = useCallback(() => {
    playerScoreRef.current = 0;
    botScoreRef.current = 0;
    setPlayerScore(0);
    setBotScore(0);
    onScoreUpdate(0);
    rallyRef.current = 0;
    setRallyStreak(0);

    playerYRef.current = (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2;
    opponentYRef.current = (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2;
    particlesRef.current = [];
    floatingTextsRef.current = [];
    trailsRef.current = [];

    resetBall(true);
    draw();
  }, [onScoreUpdate]);

  const startGame = useCallback(() => {
    resetGame();
    setGameState('countdown');
    setCountdown(3);
    audio.playCountdownTick();

    let count = 3;
    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
        audio.playCountdownTick();
      } else {
        clearInterval(interval);
        audio.playCountdownGo();
        setGameState('playing');
        lastTimeRef.current = performance.now();
        if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = requestAnimationFrame(gameLoop);
      }
    }, 800);
  }, [resetGame]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(e.code)) {
        e.preventDefault();
        activeKeysRef.current[e.code] = true;
      }
      if (e.key === 'Escape' && gameStateRef.current === 'playing') {
        setGameState('paused');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(e.code)) {
        e.preventDefault();
        activeKeysRef.current[e.code] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const gameLoop = (timestamp: number) => {
    if (gameStateRef.current !== 'playing') return;

    const dt = Math.min(timestamp - lastTimeRef.current, 100);
    lastTimeRef.current = timestamp;

    if (hitStopRef.current > 0) {
      hitStopRef.current -= dt;
      draw();
      gameLoopRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    updatePhysics(dt);
    draw();

    if (gameStateRef.current === 'playing') {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
  };

  const updatePhysics = (dt: number) => {
    const keys = activeKeysRef.current;
    const speed = 7.0;

    // Keyboard paddle movement
    playerPrevYRef.current = playerYRef.current;
    if (keys['ArrowUp'] || keys['KeyW']) {
      playerYRef.current = Math.max(10, playerYRef.current - speed);
    }
    if (keys['ArrowDown'] || keys['KeyS']) {
      playerYRef.current = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT - 10, playerYRef.current + speed);
    }

    // Ball movement
    const ball = ballRef.current;
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Trails
    if (Math.random() < 0.6) {
      trailsRef.current.push({ x: ball.x, y: ball.y, color: '#38bdf8' });
      if (trailsRef.current.length > 16) trailsRef.current.shift();
    }

    // Top & Bottom Wall Bounces
    if (ball.y - BALL_SIZE / 2 <= 0) {
      ball.y = BALL_SIZE / 2;
      ball.vy = Math.abs(ball.vy);
      audio.playReflect();
      spawnParticles(ball.x, 0, '#38bdf8', 6);
    } else if (ball.y + BALL_SIZE / 2 >= CANVAS_HEIGHT) {
      ball.y = CANVAS_HEIGHT - BALL_SIZE / 2;
      ball.vy = -Math.abs(ball.vy);
      audio.playReflect();
      spawnParticles(ball.x, CANVAS_HEIGHT, '#38bdf8', 6);
    }

    // AI Bot Movement (Realistic tracking with slight delay & speed cap)
    const botCenter = opponentYRef.current + PADDLE_HEIGHT / 2;
    const botSpeed = Math.min(5.2, 3.6 + rallyRef.current * 0.15);
    if (ball.vx > 0) {
      // Predict ball position
      const diff = ball.y - botCenter;
      if (Math.abs(diff) > 8) {
        opponentYRef.current += Math.sign(diff) * botSpeed;
      }
    } else {
      // Idle return to center
      const centerDiff = CANVAS_HEIGHT / 2 - botCenter;
      if (Math.abs(centerDiff) > 10) {
        opponentYRef.current += Math.sign(centerDiff) * 2;
      }
    }
    opponentYRef.current = Math.max(10, Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT - 10, opponentYRef.current));

    // Player Paddle Collision (Left side: x=25)
    const playerX = 25;
    if (
      ball.x - BALL_SIZE / 2 <= playerX + PADDLE_WIDTH &&
      ball.x + BALL_SIZE / 2 >= playerX &&
      ball.y >= playerYRef.current &&
      ball.y <= playerYRef.current + PADDLE_HEIGHT &&
      ball.vx < 0
    ) {
      // Calculate dynamic reflection & spin from paddle movement
      const hitRatio = (ball.y - (playerYRef.current + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
      const paddleVelocity = (playerYRef.current - playerPrevYRef.current) * 0.2;

      rallyRef.current += 1;
      setRallyStreak(rallyRef.current);

      const newSpeed = Math.min(MAX_BALL_SPEED, ball.speed + 0.35);
      ball.speed = newSpeed;

      const angle = hitRatio * (Math.PI / 3) + paddleVelocity;
      ball.vx = Math.abs(Math.cos(angle) * newSpeed);
      ball.vy = Math.sin(angle) * newSpeed;
      ball.x = playerX + PADDLE_WIDTH + BALL_SIZE / 2;

      audio.playReflect();
      inputManager.vibrateGamepad(50, 0.4);
      shakeRef.current = Math.min(6, 2 + rallyRef.current * 0.4);
      hitStopRef.current = rallyRef.current >= 5 ? 40 : 0;

      spawnParticles(ball.x, ball.y, '#10b981', 12);
      if (rallyRef.current >= 4) {
        spawnFloatingText(ball.x + 30, ball.y, `RALLY x${rallyRef.current}!`, '#38bdf8');
      }
    }

    // Opponent Paddle Collision (Right side: x=CANVAS_WIDTH - 25 - PADDLE_WIDTH)
    const oppX = CANVAS_WIDTH - 25 - PADDLE_WIDTH;
    if (
      ball.x + BALL_SIZE / 2 >= oppX &&
      ball.x - BALL_SIZE / 2 <= oppX + PADDLE_WIDTH &&
      ball.y >= opponentYRef.current &&
      ball.y <= opponentYRef.current + PADDLE_HEIGHT &&
      ball.vx > 0
    ) {
      const hitRatio = (ball.y - (opponentYRef.current + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
      rallyRef.current += 1;
      setRallyStreak(rallyRef.current);

      const newSpeed = Math.min(MAX_BALL_SPEED, ball.speed + 0.35);
      ball.speed = newSpeed;

      const angle = hitRatio * (Math.PI / 3);
      ball.vx = -Math.abs(Math.cos(angle) * newSpeed);
      ball.vy = Math.sin(angle) * newSpeed;
      ball.x = oppX - BALL_SIZE / 2;

      audio.playReflect();
      spawnParticles(ball.x, ball.y, '#f43f5e', 10);
    }

    // Scoring conditions
    // Player scores (ball passes right wall)
    if (ball.x - BALL_SIZE / 2 > CANVAS_WIDTH) {
      audio.playCoin();
      shakeRef.current = 6;
      hitStopRef.current = 50;
      inputManager.vibrateGamepad(100, 0.5);

      const rallyBonus = Math.max(1, Math.floor(rallyRef.current / 2));
      const points = 10 + rallyBonus * 5;
      const nextScore = playerScoreRef.current + points;
      playerScoreRef.current = nextScore;
      setPlayerScore(nextScore);
      onScoreUpdate(nextScore);

      spawnFloatingText(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, `+${points} POINT!`, '#10b981');
      spawnParticles(CANVAS_WIDTH - 20, ball.y, '#10b981', 18);

      if (nextScore >= 100) {
        // Player wins the match!
        handleMatchEnd(true);
      } else {
        resetBall(false);
      }
    }

    // Bot scores (ball passes left wall)
    if (ball.x + BALL_SIZE / 2 < 0) {
      audio.playHit();
      shakeRef.current = 8;
      hitStopRef.current = 60;
      inputManager.vibrateGamepad(150, 0.6);

      const nextBotScore = botScoreRef.current + 10;
      botScoreRef.current = nextBotScore;
      setBotScore(nextBotScore);

      spawnFloatingText(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 'BOT SCORED', '#f43f5e');
      spawnParticles(20, ball.y, '#f43f5e', 18);

      if (nextBotScore >= 50) {
        // Match over
        handleMatchEnd(false);
      } else {
        resetBall(true);
      }
    }

    // Update Particles
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      if (p.alpha <= 0) particlesRef.current.splice(i, 1);
    }

    // Update Floating Texts
    for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) {
      const t = floatingTextsRef.current[i];
      t.y += t.vy;
      t.alpha -= 0.025;
      if (t.alpha <= 0) floatingTextsRef.current.splice(i, 1);
    }
  };

  const handleMatchEnd = (playerWon: boolean) => {
    if (playerWon) audio.playLevelUp();
    else audio.playExplosion();

    setGameState('gameover');
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    onGameOver(playerScoreRef.current);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();

    // Screen Shake
    if (shakeRef.current > 0) {
      const sx = (Math.random() - 0.5) * shakeRef.current;
      const sy = (Math.random() - 0.5) * shakeRef.current;
      ctx.translate(sx, sy);
      shakeRef.current = Math.max(0, shakeRef.current - 0.4);
    }

    // Dark Arena Background
    ctx.fillStyle = '#080a0f';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Neon Net Divider
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2, 0);
    ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    // Big Background Score Watermark
    ctx.font = 'bold 80px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(16, 185, 129, 0.06)';
    ctx.fillText(playerScoreRef.current.toString(), CANVAS_WIDTH / 4, CANVAS_HEIGHT / 2);
    ctx.fillStyle = 'rgba(244, 63, 94, 0.06)';
    ctx.fillText(botScoreRef.current.toString(), (3 * CANVAS_WIDTH) / 4, CANVAS_HEIGHT / 2);

    // Ball Trails
    trailsRef.current.forEach((t, i) => {
      ctx.fillStyle = t.color;
      ctx.globalAlpha = (i / trailsRef.current.length) * 0.35;
      ctx.beginPath();
      ctx.arc(t.x, t.y, BALL_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Player Paddle (Neon Green)
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.roundRect(25, playerYRef.current, PADDLE_WIDTH, PADDLE_HEIGHT, 6);
    ctx.fill();

    // Opponent Paddle (Neon Rose)
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.roundRect(CANVAS_WIDTH - 25 - PADDLE_WIDTH, opponentYRef.current, PADDLE_WIDTH, PADDLE_HEIGHT, 6);
    ctx.fill();

    // Ball
    const ball = ballRef.current;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();

    // Ball glow
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Particles
    particlesRef.current.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Floating Texts
    floatingTextsRef.current.forEach(t => {
      ctx.fillStyle = t.color;
      ctx.globalAlpha = t.alpha;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);
    });
    ctx.globalAlpha = 1;

    ctx.restore();
  };

  // Direct Pointer / Touch paddle tracking on mobile
  const handlePointerMove = (e: React.PointerEvent) => {
    if (gameStateRef.current !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientY = e.clientY - rect.top;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const targetY = clientY * scaleY - PADDLE_HEIGHT / 2;

    playerPrevYRef.current = playerYRef.current;
    playerYRef.current = Math.max(10, Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT - 10, targetY));
  };

  useEffect(() => {
    draw();
  }, []);

  return (
    <div 
      ref={containerRef}
      className="relative flex flex-col h-full w-full min-h-0 items-center justify-center overflow-hidden p-2 bg-[#090b10]"
    >
      {/* Pong Scoreboard Header */}
      <div className="w-full max-w-[600px] flex-none flex justify-between items-center mb-2 px-3 py-1 bg-[#121622]/80 border border-white/[0.06] rounded-xl text-xs font-mono">
        <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
          <span>YOU: {playerScore}</span>
        </div>

        {rallyStreak >= 3 && (
          <div className="flex items-center gap-1 text-amber-400 font-bold animate-pulse">
            <Flame size={12} />
            <span>RALLY {rallyStreak}x</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-zinc-400">
          <Trophy size={12} className="text-amber-400" />
          <span>BEST: <strong className="text-white">{highScore}</strong></span>
        </div>

        <div className="flex items-center gap-1.5 text-rose-400 font-bold">
          <span>AI BOT: {botScore}</span>
        </div>
      </div>

      {/* Canvas Wrapper */}
      <div 
        className="relative flex-1 min-h-0 w-full max-w-[600px] max-h-[340px] flex items-center justify-center bg-[#080a0f] rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden touch-none select-none"
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerMove}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full object-contain block cursor-ns-resize"
        />

        <GameOverlay
          gameState={gameState}
          score={playerScore}
          highScore={highScore}
          countdown={countdown}
          onStart={startGame}
          onRestart={startGame}
          instructions="Geser pointer atau gunakan PANAH ATAS / BAWAH untuk mengendalikan paddle. Pantulkan bola melewati bot lawan!"
        />
      </div>
    </div>
  );
}

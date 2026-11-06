import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audio } from '../../utils/audio';
import { useGameEngine } from '../../hooks/useGameEngine';
import { inputManager } from '../../services/inputService';
import { GameOverlay } from '../gameplay/GameOverlay';
import { Sparkles, Trophy, Flame, Users, User, RotateCcw } from 'lucide-react';
import { haptics } from '../../utils/haptics';

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

type PongMode = '1p' | '2p';

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 340;
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 65;
const BALL_SIZE = 8;
const MAX_BALL_SPEED = 12;
const DUEL_TARGET_SCORE = 5;

export default function NeonPongGame({ onGameOver, onScoreUpdate, highScore }: NeonPongGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [gameMode, setGameMode] = useState<PongMode>('1p');
  const gameModeRef = useRef<PongMode>('1p');
  useEffect(() => {
    gameModeRef.current = gameMode;
  }, [gameMode]);

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
    gameId: 'pong',
    onGameOver,
    onScoreUpdate,
  });

  const [botScore, setBotScore] = useState(0);
  const [p1DuelScore, setP1DuelScore] = useState(0);
  const [p2DuelScore, setP2DuelScore] = useState(0);
  const [duelWinner, setDuelWinner] = useState<'p1' | 'p2' | null>(null);
  const [rallyStreak, setRallyStreak] = useState(0);

  const gameStateRef = useRef(gameState);
  const playerScoreRef = useRef(0);
  const botScoreRef = useRef(0);
  const p1DuelScoreRef = useRef(0);
  const p2DuelScoreRef = useRef(0);
  const rallyRef = useRef(0);
  const shakeRef = useRef<number>(0);
  const hitStopRef = useRef<number>(0);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Paddles & Ball
  const playerYRef = useRef((CANVAS_HEIGHT - PADDLE_HEIGHT) / 2);
  const playerPrevYRef = useRef((CANVAS_HEIGHT - PADDLE_HEIGHT) / 2);
  const opponentYRef = useRef((CANVAS_HEIGHT - PADDLE_HEIGHT) / 2);
  const opponentPrevYRef = useRef((CANVAS_HEIGHT - PADDLE_HEIGHT) / 2);

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
  const activePointersRef = useRef<Map<number, { side: 'left' | 'right'; y: number }>>(new Map());

  // Auto-pause when tab hidden
  useEffect(() => {
    const handleVis = () => {
      if (document.hidden && gameStateRef.current === 'playing') {
        setGameState('paused');
      }
    };
    document.addEventListener('visibilitychange', handleVis);
    return () => document.removeEventListener('visibilitychange', handleVis);
  }, [setGameState]);

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
    p1DuelScoreRef.current = 0;
    p2DuelScoreRef.current = 0;
    updateScore(0);
    setBotScore(0);
    setP1DuelScore(0);
    setP2DuelScore(0);
    setDuelWinner(null);
    rallyRef.current = 0;
    setRallyStreak(0);

    playerYRef.current = (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2;
    playerPrevYRef.current = (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2;
    opponentYRef.current = (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2;
    opponentPrevYRef.current = (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2;

    particlesRef.current = [];
    floatingTextsRef.current = [];
    trailsRef.current = [];
    activePointersRef.current.clear();

    resetBall(true);
    draw();
  }, [updateScore]);

  const startGame = useCallback(() => {
    resetGame();
    startWithCountdown(() => {
      startLoop(gameStep);
    });
  }, [resetGame, startWithCountdown, startLoop]);

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
  }, [setGameState]);

  const gameStep = useCallback((timestamp: number, dt: number) => {
    if (gameStateRef.current !== 'playing') return;

    if (hitStopRef.current > 0) {
      hitStopRef.current -= dt;
      draw();
      return;
    }

    updatePhysics(dt);
    draw();
  }, []);

  const updatePhysics = (dt: number) => {
    const keys = activeKeysRef.current;
    const speed = 7.0;
    const isDuel = gameModeRef.current === '2p';

    // Player 1 movement (Keys)
    playerPrevYRef.current = playerYRef.current;
    if (isDuel) {
      if (keys['KeyW']) {
        playerYRef.current = Math.max(10, playerYRef.current - speed);
      }
      if (keys['KeyS']) {
        playerYRef.current = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT - 10, playerYRef.current + speed);
      }
    } else {
      if (keys['ArrowUp'] || keys['KeyW']) {
        playerYRef.current = Math.max(10, playerYRef.current - speed);
      }
      if (keys['ArrowDown'] || keys['KeyS']) {
        playerYRef.current = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT - 10, playerYRef.current + speed);
      }
    }

    // Opponent movement (P2 in 2P Mode, or AI in 1P Mode)
    opponentPrevYRef.current = opponentYRef.current;
    if (isDuel) {
      if (keys['ArrowUp']) {
        opponentYRef.current = Math.max(10, opponentYRef.current - speed);
      }
      if (keys['ArrowDown']) {
        opponentYRef.current = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT - 10, opponentYRef.current + speed);
      }
    } else {
      // AI Bot Movement
      const botCenter = opponentYRef.current + PADDLE_HEIGHT / 2;
      const botSpeed = Math.min(5.2, 3.6 + rallyRef.current * 0.15);
      const ball = ballRef.current;
      if (ball.vx > 0) {
        const diff = ball.y - botCenter;
        if (Math.abs(diff) > 8) {
          opponentYRef.current += Math.sign(diff) * botSpeed;
        }
      } else {
        const centerDiff = CANVAS_HEIGHT / 2 - botCenter;
        if (Math.abs(centerDiff) > 10) {
          opponentYRef.current += Math.sign(centerDiff) * 2;
        }
      }
      opponentYRef.current = Math.max(10, Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT - 10, opponentYRef.current));
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

    // Player 1 Paddle Collision (Left side: x=25)
    const playerX = 25;
    if (
      ball.x - BALL_SIZE / 2 <= playerX + PADDLE_WIDTH &&
      ball.x + BALL_SIZE / 2 >= playerX &&
      ball.y >= playerYRef.current &&
      ball.y <= playerYRef.current + PADDLE_HEIGHT &&
      ball.vx < 0
    ) {
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
      haptics.trigger('light');
      inputManager.vibrateGamepad(50, 0.4);
      shakeRef.current = Math.min(6, 2 + rallyRef.current * 0.4);
      hitStopRef.current = rallyRef.current >= 5 ? 40 : 0;

      spawnParticles(ball.x, ball.y, '#06b6d4', 12);
      if (rallyRef.current >= 4) {
        spawnFloatingText(ball.x + 30, ball.y, `RALLY x${rallyRef.current}!`, '#38bdf8');
      }
    }

    // Opponent / P2 Paddle Collision (Right side: x=CANVAS_WIDTH - 25 - PADDLE_WIDTH)
    const oppX = CANVAS_WIDTH - 25 - PADDLE_WIDTH;
    if (
      ball.x + BALL_SIZE / 2 >= oppX &&
      ball.x - BALL_SIZE / 2 <= oppX + PADDLE_WIDTH &&
      ball.y >= opponentYRef.current &&
      ball.y <= opponentYRef.current + PADDLE_HEIGHT &&
      ball.vx > 0
    ) {
      const hitRatio = (ball.y - (opponentYRef.current + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
      const paddleVelocity = (opponentYRef.current - opponentPrevYRef.current) * 0.2;

      rallyRef.current += 1;
      setRallyStreak(rallyRef.current);

      const newSpeed = Math.min(MAX_BALL_SPEED, ball.speed + 0.35);
      ball.speed = newSpeed;

      const angle = hitRatio * (Math.PI / 3) + paddleVelocity;
      ball.vx = -Math.abs(Math.cos(angle) * newSpeed);
      ball.vy = Math.sin(angle) * newSpeed;
      ball.x = oppX - BALL_SIZE / 2;

      audio.playReflect();
      haptics.trigger('light');
      inputManager.vibrateGamepad(50, 0.4);
      shakeRef.current = Math.min(6, 2 + rallyRef.current * 0.4);
      spawnParticles(ball.x, ball.y, '#f43f5e', 10);
    }

    // Scoring conditions
    // Left Player (P1) scores (ball passes right wall)
    if (ball.x - BALL_SIZE / 2 > CANVAS_WIDTH) {
      audio.playCoin();
      shakeRef.current = 6;
      hitStopRef.current = 50;
      haptics.trigger('medium');
      inputManager.vibrateGamepad(100, 0.5);

      if (isDuel) {
        const nextP1 = p1DuelScoreRef.current + 1;
        p1DuelScoreRef.current = nextP1;
        setP1DuelScore(nextP1);
        spawnFloatingText(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 'P1 POIN!', '#06b6d4');
        spawnParticles(CANVAS_WIDTH - 20, ball.y, '#06b6d4', 20);

        if (nextP1 >= DUEL_TARGET_SCORE) {
          handleDuelMatchEnd('p1');
        } else {
          resetBall(false);
        }
      } else {
        const rallyBonus = Math.max(1, Math.floor(rallyRef.current / 2));
        const points = 10 + rallyBonus * 5;
        const nextScore = playerScoreRef.current + points;
        playerScoreRef.current = nextScore;
        addScore(points);

        spawnFloatingText(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, `+${points} POINT!`, '#10b981');
        spawnParticles(CANVAS_WIDTH - 20, ball.y, '#10b981', 18);

        if (nextScore >= 100) {
          handle1PMatchEnd(true);
        } else {
          resetBall(false);
        }
      }
    }

    // Right Player (P2 / Bot) scores (ball passes left wall)
    if (ball.x + BALL_SIZE / 2 < 0) {
      audio.playHit();
      shakeRef.current = 8;
      hitStopRef.current = 60;
      haptics.trigger('medium');
      inputManager.vibrateGamepad(150, 0.6);

      if (isDuel) {
        const nextP2 = p2DuelScoreRef.current + 1;
        p2DuelScoreRef.current = nextP2;
        setP2DuelScore(nextP2);
        spawnFloatingText(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 'P2 POIN!', '#f43f5e');
        spawnParticles(20, ball.y, '#f43f5e', 20);

        if (nextP2 >= DUEL_TARGET_SCORE) {
          handleDuelMatchEnd('p2');
        } else {
          resetBall(true);
        }
      } else {
        const nextBotScore = botScoreRef.current + 10;
        botScoreRef.current = nextBotScore;
        setBotScore(nextBotScore);

        spawnFloatingText(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 'BOT SCORED', '#f43f5e');
        spawnParticles(20, ball.y, '#f43f5e', 18);

        if (nextBotScore >= 50) {
          handle1PMatchEnd(false);
        } else {
          resetBall(true);
        }
      }
    }

    // Update Particles
    let partIdx = 0;
    for (let i = 0; i < particlesRef.current.length; i++) {
      const p = particlesRef.current[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      if (p.alpha > 0) {
        particlesRef.current[partIdx++] = p;
      }
    }
    particlesRef.current.length = partIdx;

    // Update Floating Texts
    let textIdx = 0;
    for (let i = 0; i < floatingTextsRef.current.length; i++) {
      const t = floatingTextsRef.current[i];
      t.y += t.vy;
      t.alpha -= 0.025;
      if (t.alpha > 0) {
        floatingTextsRef.current[textIdx++] = t;
      }
    }
    floatingTextsRef.current.length = textIdx;
  };

  const handle1PMatchEnd = (playerWon: boolean) => {
    if (playerWon) {
      audio.playLevelUp();
      haptics.trigger('success');
    } else {
      audio.playExplosion();
      haptics.trigger('gameOver');
    }
    triggerGameOver();
  };

  const handleDuelMatchEnd = (winner: 'p1' | 'p2') => {
    setDuelWinner(winner);
    audio.playLevelUp();
    haptics.trigger('success');
    // Spawn celebratory fireworks across the canvas
    for (let i = 0; i < 40; i++) {
      spawnParticles(
        winner === 'p1' ? 80 : CANVAS_WIDTH - 80,
        Math.random() * CANVAS_HEIGHT,
        winner === 'p1' ? '#06b6d4' : '#f43f5e',
        10,
        5
      );
    }
    triggerGameOver();
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
    if (gameModeRef.current === '2p') {
      ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
      ctx.fillText(p1DuelScoreRef.current.toString(), CANVAS_WIDTH / 4, CANVAS_HEIGHT / 2);
      ctx.fillStyle = 'rgba(244, 63, 94, 0.08)';
      ctx.fillText(p2DuelScoreRef.current.toString(), (3 * CANVAS_WIDTH) / 4, CANVAS_HEIGHT / 2);
    } else {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.06)';
      ctx.fillText(playerScoreRef.current.toString(), CANVAS_WIDTH / 4, CANVAS_HEIGHT / 2);
      ctx.fillStyle = 'rgba(244, 63, 94, 0.06)';
      ctx.fillText(botScoreRef.current.toString(), (3 * CANVAS_WIDTH) / 4, CANVAS_HEIGHT / 2);
    }

    // Ball Trails
    trailsRef.current.forEach((t, i) => {
      ctx.fillStyle = t.color;
      ctx.globalAlpha = (i / trailsRef.current.length) * 0.35;
      ctx.beginPath();
      ctx.arc(t.x, t.y, BALL_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // P1 Paddle (Cyan in 2P, Emerald in 1P)
    ctx.fillStyle = gameModeRef.current === '2p' ? '#06b6d4' : '#10b981';
    ctx.beginPath();
    ctx.roundRect(25, playerYRef.current, PADDLE_WIDTH, PADDLE_HEIGHT, 6);
    ctx.fill();

    // Opponent / P2 Paddle (Rose)
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

  // Simultaneous multi-touch pointer tracking (P1 left half, P2 right half in 2P mode)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (gameStateRef.current !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const targetY = Math.max(10, Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT - 10, clientY * scaleY - PADDLE_HEIGHT / 2));

    const isLeft = clientX < rect.width / 2;
    activePointersRef.current.set(e.pointerId, {
      side: isLeft ? 'left' : 'right',
      y: targetY,
    });

    if (isLeft || gameModeRef.current === '1p') {
      playerPrevYRef.current = playerYRef.current;
      playerYRef.current = targetY;
    } else if (gameModeRef.current === '2p' && !isLeft) {
      opponentPrevYRef.current = opponentYRef.current;
      opponentYRef.current = targetY;
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (gameStateRef.current !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const targetY = Math.max(10, Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT - 10, clientY * scaleY - PADDLE_HEIGHT / 2));

    const pointer = activePointersRef.current.get(e.pointerId);
    const side = pointer ? pointer.side : clientX < rect.width / 2 ? 'left' : 'right';

    if (side === 'left' || gameModeRef.current === '1p') {
      playerPrevYRef.current = playerYRef.current;
      playerYRef.current = targetY;
    } else if (gameModeRef.current === '2p' && side === 'right') {
      opponentPrevYRef.current = opponentYRef.current;
      opponentYRef.current = targetY;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    activePointersRef.current.delete(e.pointerId);
  };

  useEffect(() => {
    draw();
  }, []);

  const switchMode = (mode: PongMode) => {
    if (gameState === 'playing') {
      setGameState('paused');
    }
    audio.playCoin();
    haptics.trigger('selection');
    setGameMode(mode);
    resetGame();
  };

  return (
    <div 
      ref={containerRef}
      className="relative flex flex-col h-full w-full min-h-0 items-center justify-center overflow-hidden p-2 bg-[#090b10]"
    >
      {/* Mode Switcher & Pong Scoreboard Header */}
      <div className="w-full max-w-[600px] flex-none flex flex-wrap justify-between items-center gap-2 mb-2 px-3 py-1.5 bg-[#121622]/90 border border-white/[0.08] rounded-xl text-xs font-mono shadow-md">
        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-1 bg-surface-base p-0.5 rounded-lg border border-border-subtle">
          <button
            onClick={() => switchMode('1p')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
              gameMode === '1p'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <User size={12} />
            <span>1P vs AI</span>
          </button>
          <button
            onClick={() => switchMode('2p')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
              gameMode === '2p'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Users size={12} />
            <span>2P Duel (1 Layar)</span>
          </button>
        </div>

        {/* Live Score Display */}
        {gameMode === '2p' ? (
          <div className="flex items-center gap-3 font-bold text-xs">
            <span className="text-cyan-400">P1 (W/S): {p1DuelScore}</span>
            <span className="text-zinc-500 font-normal">vs (Target: {DUEL_TARGET_SCORE})</span>
            <span className="text-rose-400">P2 (▲/▼): {p2DuelScore}</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-emerald-400 font-bold">YOU: {score}</span>
            {rallyStreak >= 3 && (
              <div className="hidden sm:flex items-center gap-1 text-amber-400 font-bold animate-pulse">
                <Flame size={12} />
                <span>RALLY {rallyStreak}x</span>
              </div>
            )}
            <div className="hidden sm:flex items-center gap-1 text-zinc-400">
              <Trophy size={11} className="text-amber-400" />
              <span>BEST: <strong className="text-white">{highScore}</strong></span>
            </div>
            <span className="text-rose-400 font-bold">BOT: {botScore}</span>
          </div>
        )}
      </div>

      {/* Canvas Wrapper */}
      <div 
        className="relative flex-1 min-h-0 w-full max-w-[600px] max-h-[340px] flex items-center justify-center bg-[#080a0f] rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden touch-none select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full object-contain block cursor-ns-resize"
        />

        {/* 2P Control Hints Overlay during countdown or start */}
        {gameMode === '2p' && gameState === 'idle' && (
          <div className="absolute inset-x-4 bottom-3 flex justify-between pointer-events-none text-[11px] font-mono text-zinc-400 z-10">
            <div className="bg-zinc-950/80 px-2.5 py-1 rounded-lg border border-cyan-500/30 text-cyan-400">
              Pemain 1: [W / S] atau Sentuh Kiri
            </div>
            <div className="bg-zinc-950/80 px-2.5 py-1 rounded-lg border border-rose-500/30 text-rose-400">
              Pemain 2: [Panah ▲ / ▼] atau Sentuh Kanan
            </div>
          </div>
        )}

        {/* Duel Winner Banner Overlay */}
        {gameMode === '2p' && duelWinner && gameState === 'gameover' && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-6 animate-in zoom-in-95 duration-200 text-center font-sans">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-3 shadow-[0_0_30px_rgba(245,158,11,0.3)] animate-bounce">
              <Trophy size={32} />
            </div>

            <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 mb-1">
              HASIL DUEL 2 PEMAIN
            </span>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
              {duelWinner === 'p1' ? (
                <span className="text-cyan-400">PLAYER 1 JUARA DUEL! 🏆</span>
              ) : (
                <span className="text-rose-400">PLAYER 2 JUARA DUEL! 🏆</span>
              )}
            </h2>

            <p className="text-xs text-zinc-400 max-w-sm mb-6">
              Skor Akhir: <strong className="text-cyan-400">P1 ({p1DuelScore})</strong> vs{' '}
              <strong className="text-rose-400">P2 ({p2DuelScore})</strong>. Duel sengit hingga target {DUEL_TARGET_SCORE} poin selesai!
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={startGame}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition cursor-pointer active:scale-95"
              >
                <RotateCcw size={14} />
                <span>Rematch (Duel Ulang)</span>
              </button>
              <button
                onClick={() => switchMode('1p')}
                className="px-4 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-zinc-300 hover:text-white font-bold text-xs transition cursor-pointer"
              >
                Mode 1P vs AI
              </button>
            </div>
          </div>
        )}

        {/* Regular 1P Overlay */}
        {(!duelWinner || gameMode === '1p') && (
          <GameOverlay
            gameState={gameState}
            score={score}
            highScore={highScore}
            countdown={countdown}
            onStart={startGame}
            onRestart={startGame}
            instructions={
              gameMode === '2p'
                ? "DUEL 2 PEMAIN 1 LAYAR: P1 gunakan [W/S] atau sentuh kiri layar. P2 gunakan [Panah Atas/Bawah] atau sentuh kanan layar. Yang pertama mencapai 5 poin menang!"
                : "Geser pointer atau gunakan PANAH ATAS / BAWAH untuk mengendalikan paddle. Pantulkan bola melewati bot lawan!"
            }
          />
        )}
      </div>
    </div>
  );
}

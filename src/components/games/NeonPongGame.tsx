import React, { useEffect, useRef, useState } from 'react';
import { audio } from '../../utils/audio';
import { Particle } from '../../types';
import { GameOverlay } from '../gameplay/GameOverlay';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface NeonPongGameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

export default function NeonPongGame({ onGameOver, onScoreUpdate, highScore }: NeonPongGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const gameLoopRef = useRef<number | null>(null);
  const scoreRef = useRef(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const isPlayingRef = useRef(false);
  const gameOverRef = useRef(false);


  useEffect(() => {
    isPlayingRef.current = isPlaying;
    gameOverRef.current = gameOver;
    scoreRef.current = score;
  }, [isPlaying, gameOver, score]);
  const [muted, setMuted] = useState(audio.getMuteState());

  // Game settings
  const CANVAS_WIDTH = 600;
  const CANVAS_HEIGHT = 300;
  const PADDLE_WIDTH = 10;
  const PADDLE_HEIGHT = 60;
  const BALL_SIZE = 8;

  const playerYRef = useRef((CANVAS_HEIGHT - PADDLE_HEIGHT) / 2);
  const opponentYRef = useRef((CANVAS_HEIGHT - PADDLE_HEIGHT) / 2);
  const ballRef = useRef({
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2,
    vx: 3,
    vy: 2,
    speed: 4,
  });

  const particlesRef = useRef<Particle[]>([]);
  const shakeRef = useRef<number>(0);
  const floatingTextsRef = useRef<{ x: number; y: number; text: string; color: string; alpha: number; vy: number }[]>([]);
  const trailsRef = useRef<{ x: number; y: number; color: string }[]>([]);
  const lastTimeRef = useRef<number>(0);

  // Control keys
  const keysPressedRef = useRef<{ [key: string]: boolean }>({});

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

    // Clear background
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Decorative neon net divider
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2, 0);
    ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]); // Reset

    // Draw Title Text
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 20px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('NEON PONG ARCADE', CANVAS_WIDTH / 2, 110);

    ctx.fillStyle = '#3b82f6';
    ctx.font = "12px 'JetBrains Mono', monospace";
    ctx.fillText('PANTULKAN BOLA & KALAHKAN BOT CYBER', CANVAS_WIDTH / 2, 135);

    ctx.fillStyle = '#71717a';
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.fillText('Gunakan PANAH ATAS / BAWAH untuk Mengontrol Paddle', CANVAS_WIDTH / 2, 170);
    ctx.fillText('Skor bertambah jika Anda memenangkan satu putaran', CANVAS_WIDTH / 2, 190);
  };

  const startNewGame = () => {
    audio.playCoin();
    
    // Explicitly update ref states to guarantee synchronous start
    isPlayingRef.current = true;
    gameOverRef.current = false;
    
    setIsPlaying(true);
    setGameOver(false);
    setScore(0);
    setOpponentScore(0);
    onScoreUpdate(0);

    // Reset paddles and ball
    playerYRef.current = (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2;
    opponentYRef.current = (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2;
    resetBall(true); // Player serves first

    particlesRef.current = [];
    lastTimeRef.current = performance.now();

    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    gameLoopRef.current = requestAnimationFrame(update);
  };

  const resetBall = (toPlayer: boolean) => {
    ballRef.current = {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      vx: toPlayer ? -3.5 : 3.5,
      vy: (Math.random() - 0.5) * 4,
      speed: 4.5,
    };
  };

  const createHitParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 15; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        color,
        radius: Math.random() * 2.5 + 1,
        alpha: 1,
        decay: Math.random() * 0.05 + 0.03,
      });
    }
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        keysPressedRef.current[e.key] = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        keysPressedRef.current[e.key] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const movePaddle = (dir: 'up' | 'down') => {
    const speed = 6;
    if (dir === 'up') {
      playerYRef.current = Math.max(0, playerYRef.current - speed);
    } else {
      playerYRef.current = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, playerYRef.current + speed);
    }
  };

  // Game Engine Frame
  const update = (timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !isPlayingRef.current || gameOverRef.current ) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const delta = (timestamp - lastTimeRef.current) / 16.666;
    lastTimeRef.current = timestamp;

    // 1. Move Player paddle using key states
    const paddleMoveSpeed = 5 * delta;
    if (keysPressedRef.current['ArrowUp']) {
      playerYRef.current = Math.max(0, playerYRef.current - paddleMoveSpeed);
    }
    if (keysPressedRef.current['ArrowDown']) {
      playerYRef.current = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, playerYRef.current + paddleMoveSpeed);
    }

    // 2. Ball physics & movement
    const ball = ballRef.current;
    ball.x += ball.vx * delta;
    ball.y += ball.vy * delta;

    // Push to trails for glowing speed effect
    trailsRef.current.push({ x: ball.x, y: ball.y, color: '#38bdf8' });
    if (trailsRef.current.length > 12) {
      trailsRef.current.shift();
    }

    // Wall bounces top / bottom
    if (ball.y <= BALL_SIZE / 2) {
      ball.y = BALL_SIZE / 2;
      ball.vy = -ball.vy;
      audio.playHit();
      shakeRef.current = 2;
      createHitParticles(ball.x, ball.y, '#38bdf8');
    } else if (ball.y >= CANVAS_HEIGHT - BALL_SIZE / 2) {
      ball.y = CANVAS_HEIGHT - BALL_SIZE / 2;
      ball.vy = -ball.vy;
      audio.playHit();
      shakeRef.current = 2;
      createHitParticles(ball.x, ball.y, '#38bdf8');
    }

    // 3. Simple Intelligent AI Opponent (right side)
    const opponentSpeed = 3.6 * (1 + scoreRef.current * 0.05) * delta; // Scales slightly with score
    const targetY = ball.y - PADDLE_HEIGHT / 2;
    const diff = targetY - opponentYRef.current;

    if (Math.abs(diff) > 4) {
      if (diff > 0) {
        opponentYRef.current = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, opponentYRef.current + opponentSpeed);
      } else {
        opponentYRef.current = Math.max(0, opponentYRef.current - opponentSpeed);
      }
    }

    // 4. Ball & Paddle Collisions
    // Player Paddle collision (left side)
    const PLAYER_X = 20;
    if (ball.x <= PLAYER_X + PADDLE_WIDTH && ball.x >= PLAYER_X) {
      if (ball.y >= playerYRef.current && ball.y <= playerYRef.current + PADDLE_HEIGHT) {
        ball.x = PLAYER_X + PADDLE_WIDTH;
        
        // Speed increase & dynamic bounce angles based on relative hit position
        const relativeHit = (ball.y - (playerYRef.current + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
        ball.speed = Math.min(10, ball.speed + 0.5);
        ball.vx = ball.speed;
        ball.vy = relativeHit * 4.5;
        
        audio.playScore();
        shakeRef.current = 5;
        floatingTextsRef.current.push({
          x: ball.x + 10,
          y: ball.y,
          text: "BOUNCE!",
          color: '#3b82f6',
          alpha: 1.0,
          vy: -0.8
        });
        createHitParticles(ball.x, ball.y, '#3b82f6');
      }
    }

    // Opponent Paddle collision (right side)
    const OPPONENT_X = CANVAS_WIDTH - 20 - PADDLE_WIDTH;
    if (ball.x >= OPPONENT_X - BALL_SIZE && ball.x <= OPPONENT_X) {
      if (ball.y >= opponentYRef.current && ball.y <= opponentYRef.current + PADDLE_HEIGHT) {
        ball.x = OPPONENT_X - BALL_SIZE;

        const relativeHit = (ball.y - (opponentYRef.current + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
        ball.speed = Math.min(10, ball.speed + 0.5);
        ball.vx = -ball.speed;
        ball.vy = relativeHit * 4.5;

        audio.playScore();
        shakeRef.current = 5;
        floatingTextsRef.current.push({
          x: ball.x - 30,
          y: ball.y,
          text: "AI BLOCK!",
          color: '#ec4899',
          alpha: 1.0,
          vy: -0.8
        });
        createHitParticles(ball.x, ball.y, '#ec4899');
      }
    }

    // 5. Score Points & Round reset
    // Opponent scores (Ball leaves left side)
    if (ball.x < 0) {
      audio.playExplosion();
      shakeRef.current = 10;
      floatingTextsRef.current.push({
        x: CANVAS_WIDTH * 0.25,
        y: CANVAS_HEIGHT / 2,
        text: "AI POINT!",
        color: '#ef4444',
        alpha: 1.0,
        vy: -1.0
      });
      setOpponentScore(prev => {
        const next = prev + 1;
        if (next >= 5) {
          triggerGameOver(false);
        } else {
          resetBall(false); // Serve to AI
        }
        return next;
      });
    }
    // Player scores (Ball leaves right side)
    else if (ball.x > CANVAS_WIDTH) {
      audio.playLevelUp();
      shakeRef.current = 12;
      floatingTextsRef.current.push({
        x: CANVAS_WIDTH * 0.75,
        y: CANVAS_HEIGHT / 2,
        text: "GOAL!",
        color: '#eab308',
        alpha: 1.0,
        vy: -1.0
      });
      setScore(prev => {
        const next = prev + 1;
        onScoreUpdate(next * 50); // Give 50 pts per point won
        if (next >= 5) {
          triggerGameOver(true);
        } else {
          resetBall(true); // Serve to Player
        }
        return next;
      });
    }

    // --- RENDER SECTION ---
    ctx.save();
    if (shakeRef.current > 0) {
      const dx = (Math.random() - 0.5) * shakeRef.current;
      const dy = (Math.random() - 0.5) * shakeRef.current;
      ctx.translate(dx, dy);
      shakeRef.current *= 0.85;
      if (shakeRef.current < 0.5) shakeRef.current = 0;
    }

    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Grid details
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1;
    for (let i = 0; i < CANVAS_WIDTH; i += 30) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let j = 0; j < CANVAS_HEIGHT; j += 30) {
      ctx.beginPath();
      ctx.moveTo(0, j);
      ctx.lineTo(CANVAS_WIDTH, j);
      ctx.stroke();
    }

    // Neon Net Divider
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2, 0);
    ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw ball trails
    ctx.shadowBlur = 0;
    trailsRef.current.forEach((t, idx) => {
      const alpha = (idx / trailsRef.current.length) * 0.35;
      ctx.fillStyle = t.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(t.x, t.y, BALL_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // Draw Player Paddle (Blue Glow)
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#3b82f6';
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(PLAYER_X, playerYRef.current, PADDLE_WIDTH, PADDLE_HEIGHT);

    // Draw Opponent Paddle (Pink Glow)
    ctx.shadowColor = '#ec4899';
    ctx.fillStyle = '#ec4899';
    ctx.fillRect(OPPONENT_X, opponentYRef.current, PADDLE_WIDTH, PADDLE_HEIGHT);

    // Draw Ball (White/Blue mix)
    ctx.shadowColor = '#38bdf8';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw scoreboard
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 24px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(`${score}`, CANVAS_WIDTH / 2 - 40, 40);
    ctx.fillText(`${opponentScore}`, CANVAS_WIDTH / 2 + 40, 40);

    // Particle update and drawing
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

    // Floating texts update and draw
    floatingTextsRef.current.forEach(t => {
      t.y += t.vy * delta;
      t.alpha -= 0.025 * delta;

      ctx.fillStyle = t.color;
      ctx.globalAlpha = Math.max(0, t.alpha);
      ctx.font = 'bold 9px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);
    });
    ctx.globalAlpha = 1.0;
    floatingTextsRef.current = floatingTextsRef.current.filter(t => t.alpha > 0);

    ctx.restore();
    gameLoopRef.current = requestAnimationFrame(update);
  };

  const triggerGameOver = (playerWon: boolean) => {
    audio.playGameOver();
    setIsPlaying(false);
    setGameOver(true);
    const finalCalculatedScore = scoreRef.current * 100;
    onGameOver(finalCalculatedScore);
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
  };

  const toggleMute = () => {
    const nextMuted = audio.toggleMute();
    setMuted(nextMuted);
  };

  const getGameState = () => {
    if (!isPlaying && score === 0 && opponentScore === 0 && !gameOver) return 'ready';
    if (!isPlaying) return 'gameover';
    return 'playing';
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPlayingRef.current || gameOverRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    // Get pointer position relative to canvas height
    const relativeY = ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
    // Set paddle center to relativeY
    playerYRef.current = Math.max(0, Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, relativeY - PADDLE_HEIGHT / 2));
  };

  return (
    <div className="relative flex flex-col h-full w-full min-h-0 items-center justify-center overflow-hidden p-2 bg-zinc-950">
      {/* HUD Bar inside the flex layout to prevent overlap */}
      <div className="w-full flex-none flex justify-between items-center mb-2 px-2 font-mono text-xs">
        <div className="text-blue-400 font-bold uppercase tracking-wider">
          SKOR ANDA: <span className="text-white">{score}</span>
        </div>
        <div className="text-pink-400 font-bold uppercase tracking-wider">
          CYBER BOT: <span className="text-white">{opponentScore}</span>
        </div>
      </div>

      {/* Canvas Wrapper */}
      <div 
        onPointerMove={handlePointerMove}
        className="relative flex-1 min-h-0 w-full flex items-center justify-center bg-black rounded-xl border border-zinc-800 shadow-[0_0_20px_rgba(0,0,0,0.5)] overflow-hidden touch-none"
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="max-w-full max-h-full object-contain block bg-zinc-950"
        />

        <GameOverlay
          gameState={getGameState()}
          score={score * 100}
          onStart={startNewGame}
          onRestart={startNewGame}
          instructions="Gunakan PANAH ATAS / BAWAH atau seret di layar untuk Mengontrol Paddle. Pantulkan bola dan kalahkan bot cyber!"
        />
      </div>

    </div>
  );
}

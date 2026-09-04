import React, { useEffect, useRef, useState } from 'react';
import { audio } from '../../utils/audio';
import { Particle } from '../../types';
import { GameContainer } from '../gameplay/GameContainer';
import { GameHUD } from '../gameplay/GameHUD';
import { GameOverlay } from '../gameplay/GameOverlay';
import { MobileControls } from '../gameplay/MobileControls';

interface LaserGridGameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

export default function LaserGridGame({ onGameOver, onScoreUpdate, highScore }: LaserGridGameProps) {
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
  const GRID_SIZE = 3;
  const CELL_WIDTH = CANVAS_WIDTH / GRID_SIZE;
  const CELL_HEIGHT = 380 / GRID_SIZE; // Top 380px is grid, bottom 120px for controls / info

  // Player Grid Position
  const playerXRef = useRef(1); // 0, 1, 2
  const playerYRef = useRef(1); // 0, 1, 2

  // Laser state
  const warningLaserRowsRef = useRef<number[]>([]);
  const warningLaserColsRef = useRef<number[]>([]);
  const activeLaserRowsRef = useRef<number[]>([]);
  const activeLaserColsRef = useRef<number[]>([]);

  const laserTimerRef = useRef(0);
  const roundStateRef = useRef<'warning' | 'firing' | 'safe'>('safe');
  const durationRef = useRef(150); // Speed in frames/ticks

  const particlesRef = useRef<Particle[]>([]);

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

    // Grid lines
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 2;
    for (let i = 1; i < GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_WIDTH, 0);
      ctx.lineTo(i * CELL_WIDTH, 380);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * CELL_HEIGHT);
      ctx.lineTo(CANVAS_WIDTH, i * CELL_HEIGHT);
      ctx.stroke();
    }

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 20px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('LASER GRID SURVIVAL', CANVAS_WIDTH / 2, 420);

    ctx.fillStyle = '#ef4444';
    ctx.font = "12px 'JetBrains Mono', monospace";
    ctx.fillText('HINDARI SEKTOR DENGAN WARNING LASER', CANVAS_WIDTH / 2, 445);

    ctx.fillStyle = '#71717a';
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.fillText('Gunakan tombol arah untuk melompat petak', CANVAS_WIDTH / 2, 470);
  };

  const startNewGame = () => {
    audio.playCoin();
    setIsPlaying(true);
    setGameOver(false);
    setScore(0);
    onScoreUpdate(0);

    playerXRef.current = 1;
    playerYRef.current = 1;

    warningLaserRowsRef.current = [];
    warningLaserColsRef.current = [];
    activeLaserRowsRef.current = [];
    activeLaserColsRef.current = [];

    laserTimerRef.current = 0;
    roundStateRef.current = 'safe';
    durationRef.current = 110;
    particlesRef.current = [];
    lastTimeRef.current = performance.now();

    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    gameLoopRef.current = requestAnimationFrame(update);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlayingRef.current || gameOverRef.current ) return;
      if (e.key === 'ArrowUp' || e.key === 'w') {
        e.preventDefault();
        moveUp();
      } else if (e.key === 'ArrowDown' || e.key === 's') {
        e.preventDefault();
        moveDown();
      } else if (e.key === 'ArrowLeft' || e.key === 'a') {
        e.preventDefault();
        moveLeft();
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        e.preventDefault();
        moveRight();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, gameOver]);

  const moveUp = () => {
    if (playerYRef.current > 0) {
      playerYRef.current--;
      audio.playJump();
    }
  };

  const moveDown = () => {
    if (playerYRef.current < GRID_SIZE - 1) {
      playerYRef.current++;
      audio.playJump();
    }
  };

  const moveLeft = () => {
    if (playerXRef.current > 0) {
      playerXRef.current--;
      audio.playJump();
    }
  };

  const moveRight = () => {
    if (playerXRef.current < GRID_SIZE - 1) {
      playerXRef.current++;
      audio.playJump();
    }
  };

  const startLaserRound = () => {
    roundStateRef.current = 'warning';
    laserTimerRef.current = 0;

    // Pick 1 row or 1 column or both to target
    warningLaserRowsRef.current = [];
    warningLaserColsRef.current = [];

    const mode = Math.random();
    if (mode < 0.4) {
      warningLaserRowsRef.current.push(Math.floor(Math.random() * GRID_SIZE));
    } else if (mode < 0.8) {
      warningLaserColsRef.current.push(Math.floor(Math.random() * GRID_SIZE));
    } else {
      warningLaserRowsRef.current.push(Math.floor(Math.random() * GRID_SIZE));
      warningLaserColsRef.current.push(Math.floor(Math.random() * GRID_SIZE));
    }
  };

  const createSparkParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 12; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        color,
        radius: Math.random() * 2 + 1,
        alpha: 1,
        decay: Math.random() * 0.05 + 0.02,
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

    // Round timing
    laserTimerRef.current += delta;

    // State machine for lasers
    if (roundStateRef.current === 'safe') {
      if (laserTimerRef.current > 35) {
        startLaserRound();
      }
    } else if (roundStateRef.current === 'warning') {
      const limit = Math.max(45, durationRef.current - scoreRef.current * 0.4);
      if (laserTimerRef.current > limit) {
        // Ignite lasers!
        roundStateRef.current = 'firing';
        laserTimerRef.current = 0;
        activeLaserRowsRef.current = [...warningLaserRowsRef.current];
        activeLaserColsRef.current = [...warningLaserColsRef.current];
        warningLaserRowsRef.current = [];
        warningLaserColsRef.current = [];
        audio.playHit();
      }
    } else if (roundStateRef.current === 'firing') {
      if (laserTimerRef.current > 25) {
        // Lasers finished firing
        roundStateRef.current = 'safe';
        laserTimerRef.current = 0;

        // Check survival
        const curX = playerXRef.current;
        const curY = playerYRef.current;
        const hitRow = activeLaserRowsRef.current.includes(curY);
        const hitCol = activeLaserColsRef.current.includes(curX);

        if (hitRow || hitCol) {
          // Player hit!
          audio.playExplosion();
          setGameOver(true);
          setIsPlaying(false);
          createSparkParticles(curX * CELL_WIDTH + CELL_WIDTH / 2, curY * CELL_HEIGHT + CELL_HEIGHT / 2, '#ef4444');
          onGameOver(scoreRef.current);
          return;
        } else {
          // Gained survival bonus points
          audio.playScore();
          setScore(prev => {
            const next = prev + 25;
            onScoreUpdate(next);
            return next;
          });
          // Speed up slightly
          durationRef.current = Math.max(25, durationRef.current - 4);
        }

        activeLaserRowsRef.current = [];
        activeLaserColsRef.current = [];
      }
    }

    // DRAW
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Grid Sectors background
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        // sector color based on danger
        const warningRow = warningLaserRowsRef.current.includes(r);
        const warningCol = warningLaserColsRef.current.includes(c);
        const activeRow = activeLaserRowsRef.current.includes(r);
        const activeCol = activeLaserColsRef.current.includes(c);

        if (activeRow || activeCol) {
          // Lasers firing!
          ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
          ctx.fillRect(c * CELL_WIDTH, r * CELL_HEIGHT, CELL_WIDTH, CELL_HEIGHT);
        } else if (warningRow || warningCol) {
          // Pulse yellow/orange warning flash
          const alpha = 0.15 + Math.sin(timestamp * 0.015) * 0.1;
          ctx.fillStyle = `rgba(249, 115, 22, ${alpha})`;
          ctx.fillRect(c * CELL_WIDTH, r * CELL_HEIGHT, CELL_WIDTH, CELL_HEIGHT);
        }
      }
    }

    // Draw Grid Lines (borders)
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_WIDTH, 0);
      ctx.lineTo(i * CELL_WIDTH, 380);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * CELL_HEIGHT);
      ctx.lineTo(CANVAS_WIDTH, i * CELL_HEIGHT);
      ctx.stroke();
    }

    // Draw Glowing Warnings indicator stripes on sides
    warningLaserRowsRef.current.forEach(r => {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(0, r * CELL_HEIGHT + 2, 4, CELL_HEIGHT - 4);
      ctx.fillRect(CANVAS_WIDTH - 4, r * CELL_HEIGHT + 2, 4, CELL_HEIGHT - 4);
    });
    warningLaserColsRef.current.forEach(c => {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(c * CELL_WIDTH + 2, 0, CELL_WIDTH - 4, 4);
      ctx.fillRect(c * CELL_WIDTH + 2, 376, CELL_WIDTH - 4, 4);
    });

    // Draw Firing Lasers (thick lines)
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#f43f5e';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ef4444';
    activeLaserRowsRef.current.forEach(r => {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL_HEIGHT + CELL_HEIGHT / 2);
      ctx.lineTo(CANVAS_WIDTH, r * CELL_HEIGHT + CELL_HEIGHT / 2);
      ctx.stroke();
    });
    activeLaserColsRef.current.forEach(c => {
      ctx.beginPath();
      ctx.moveTo(c * CELL_WIDTH + CELL_WIDTH / 2, 0);
      ctx.lineTo(c * CELL_WIDTH + CELL_WIDTH / 2, 380);
      ctx.stroke();
    });
    ctx.shadowBlur = 0;

    // Draw particles
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

    // Draw Player Neon Green Dot
    const pX = playerXRef.current * CELL_WIDTH + CELL_WIDTH / 2;
    const pY = playerYRef.current * CELL_HEIGHT + CELL_HEIGHT / 2;

    ctx.shadowBlur = 12;
    ctx.shadowColor = '#10b981';
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(pX, pY, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(pX, pY, 7, 0, Math.PI * 2);
    ctx.fill();

    // Footer divider and stats text
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 380, CANVAS_WIDTH, 120);

    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 15px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('LASER SURVIVAL', CANVAS_WIDTH / 2, 415);

    ctx.fillStyle = '#71717a';
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.fillText(`STATUS LEVEL: ${Math.min(10, 1 + scoreRef.current / 50)} | SKOR: ${score}`, CANVAS_WIDTH / 2, 440);

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
            { id: 'level', label: 'STATUS LEVEL', value: Math.min(10, 1 + Math.floor(scoreRef.current / 50)) },
            { id: 'score', label: 'SKOR', value: score, emphasized: true }
          ]} 
        />
      )}

      <GameOverlay
        gameState={getGameState()}
        score={score}
        onStart={startNewGame}
        onRestart={startNewGame}
        instructions="Gunakan tombol panah atau D-Pad untuk melompat petak. HINDARI SEKTOR DENGAN WARNING LASER!"
      />

      <div className="relative w-full aspect-[4/5] mx-auto bg-zinc-950 rounded-xl border-4 border-zinc-900 shadow-2xl overflow-hidden cursor-crosshair">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full display-block bg-zinc-950"
        />
      </div>

      {isPlaying && (
        <MobileControls
          onUp={moveUp}
          onDown={moveDown}
          onLeft={moveLeft}
          onRight={moveRight}
        />
      )}
    </GameContainer>
  );
}

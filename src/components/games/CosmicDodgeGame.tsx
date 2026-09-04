import React, { useEffect, useRef, useState } from 'react';
import { audio } from '../../utils/audio';
import { Particle } from '../../types';
import { GameContainer } from '../gameplay/GameContainer';
import { GameHUD } from '../gameplay/GameHUD';
import { GameOverlay } from '../gameplay/GameOverlay';
import { MobileControls } from '../gameplay/MobileControls';

interface CosmicDodgeGameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

interface DodgeObject {
  id: number;
  x: number;
  y: number;
  speed: number;
  type: 'star' | 'asteroid';
  size: number;
  color: string;
}

export default function CosmicDodgeGame({ onGameOver, onScoreUpdate, highScore }: CosmicDodgeGameProps) {
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

  const playerXRef = useRef(180);
  const playerY = CANVAS_HEIGHT - 60;
  const PLAYER_SIZE = 24;

  const objectsRef = useRef<DodgeObject[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const spawnTimerRef = useRef(0);
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

    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Grid lines
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_WIDTH; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 20px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('COSMIC DODGE', CANVAS_WIDTH / 2, 200);

    ctx.fillStyle = '#10b981';
    ctx.font = "12px 'JetBrains Mono', monospace";
    ctx.fillText('AMBIL BINTANG, HINDARI METEOR MERAH', CANVAS_WIDTH / 2, 225);

    ctx.fillStyle = '#71717a';
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.fillText('Gunakan PANAH KIRI / KANAN untuk bergerak', CANVAS_WIDTH / 2, 250);
  };

  const startNewGame = () => {
    audio.playCoin();
    setIsPlaying(true);
    setGameOver(false);
    setScore(0);
    onScoreUpdate(0);

    playerXRef.current = 180;
    objectsRef.current = [];
    particlesRef.current = [];
    spawnTimerRef.current = 0;
    lastTimeRef.current = performance.now();

    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    gameLoopRef.current = requestAnimationFrame(update);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'a' || e.key === 'd') {
        e.preventDefault();
        keysPressedRef.current[e.key] = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'a' || e.key === 'd') {
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

  const moveLeft = () => {
    playerXRef.current = Math.max(PLAYER_SIZE, playerXRef.current - 22);
  };

  const moveRight = () => {
    playerXRef.current = Math.min(CANVAS_WIDTH - PLAYER_SIZE, playerXRef.current + 22);
  };

  const createSparkParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 10; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        color,
        radius: Math.random() * 2 + 1,
        alpha: 1,
        decay: Math.random() * 0.05 + 0.03,
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

    const fallSpeed = 3.5 + scoreRef.current * 0.006;

    // Player inputs
    if (keysPressedRef.current['ArrowLeft'] || keysPressedRef.current['a']) {
      playerXRef.current = Math.max(PLAYER_SIZE, playerXRef.current - 5.5 * delta);
    }
    if (keysPressedRef.current['ArrowRight'] || keysPressedRef.current['d']) {
      playerXRef.current = Math.min(CANVAS_WIDTH - PLAYER_SIZE, playerXRef.current + 5.5 * delta);
    }

    // Spawn falling objects
    spawnTimerRef.current += delta;
    if (spawnTimerRef.current > Math.max(12, 30 - scoreRef.current * 0.04)) {
      spawnTimerRef.current = 0;
      
      const isAsteroid = Math.random() < 0.6;
      objectsRef.current.push({
        id: Math.random(),
        x: PLAYER_SIZE + Math.random() * (CANVAS_WIDTH - PLAYER_SIZE * 2),
        y: -20,
        speed: fallSpeed * (0.8 + Math.random() * 0.5),
        type: isAsteroid ? 'asteroid' : 'star',
        size: isAsteroid ? 12 + Math.random() * 10 : 9,
        color: isAsteroid ? '#ef4444' : '#eab308',
      });
    }

    // DRAW
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Grid details
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < CANVAS_HEIGHT; i += 40) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(CANVAS_WIDTH, i);
      ctx.stroke();
    }

    // Render stars and asteroids
    objectsRef.current.forEach(obj => {
      obj.y += obj.speed * delta;

      ctx.shadowBlur = 8;
      ctx.shadowColor = obj.color;
      ctx.fillStyle = obj.color;

      if (obj.type === 'star') {
        // Draw star diamond
        ctx.beginPath();
        ctx.moveTo(obj.x, obj.y - obj.size);
        ctx.lineTo(obj.x + obj.size, obj.y);
        ctx.lineTo(obj.x, obj.y + obj.size);
        ctx.lineTo(obj.x - obj.size, obj.y);
        ctx.closePath();
        ctx.fill();
      } else {
        // Draw asteroid rugged circle
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, obj.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // Distance checking
      const dist = Math.hypot(obj.x - playerXRef.current, obj.y - playerY);
      if (dist < obj.size + PLAYER_SIZE * 0.8) {
        if (obj.type === 'star') {
          // Point collection
          audio.playCoin();
          createSparkParticles(obj.x, obj.y, '#eab308');
          obj.y = CANVAS_HEIGHT + 100; // mark for deletion
          setScore(prev => {
            const next = prev + 15;
            onScoreUpdate(next);
            return next;
          });
        } else {
          // Crash explosion!
          audio.playExplosion();
          setGameOver(true);
          setIsPlaying(false);
          createSparkParticles(playerXRef.current, playerY, '#ef4444');
          onGameOver(scoreRef.current);
        }
      }
    });

    // Cleanup offscreen objects
    objectsRef.current = objectsRef.current.filter(o => o.y < CANVAS_HEIGHT + 20);

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

    // Draw Player triangular Jet ship
    const pX = playerXRef.current;
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#06b6d4';
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.moveTo(pX, playerY - PLAYER_SIZE);
    ctx.lineTo(pX + PLAYER_SIZE, playerY + PLAYER_SIZE);
    ctx.lineTo(pX - PLAYER_SIZE, playerY + PLAYER_SIZE);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Thruster back flames
    ctx.fillStyle = '#f97316';
    ctx.fillRect(pX - 6, playerY + PLAYER_SIZE + 1, 4, 4 + Math.random() * 8);
    ctx.fillRect(pX + 2, playerY + PLAYER_SIZE + 1, 4, 4 + Math.random() * 8);

    // Dashboard HUD
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 11px 'JetBrains Mono', monospace";
    ctx.textAlign = 'left';
    ctx.fillText(`WARPING: ${(scoreRef.current * 0.1).toFixed(1)} LY`, 15, 30);
    ctx.textAlign = 'right';
    ctx.fillText(`SKOR: ${score}`, CANVAS_WIDTH - 15, 30);

    gameLoopRef.current = requestAnimationFrame(update);
  };

  const toggleMute = () => {
    const nextMuted = audio.toggleMute();
    setMuted(nextMuted);
  };

  const getGameState = () => {
    if (!isPlaying && score === 0) return 'ready';
    if (!isPlaying) return 'gameover';
    return 'playing';
  };

  return (
    <GameContainer aspect="portrait" maxWidth="sm">
      {isPlaying && (
        <GameHUD 
          stats={[
            { id: 'score', label: 'WARP SKOR', value: score, emphasized: true }
          ]} 
        />
      )}

      <GameOverlay
        gameState={getGameState()}
        score={scoreRef.current}
        onStart={startNewGame}
        onRestart={startNewGame}
        instructions="AMBIL BINTANG, HINDARI METEOR MERAH"
      />

      <div className="relative border-4 border-zinc-900 bg-black rounded-2xl overflow-hidden shadow-2xl w-full aspect-[4/5] mx-auto">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full display-block bg-zinc-950"
        />
      </div>

      {isPlaying && (
        <MobileControls
          onLeft={() => keysPressedRef.current['ArrowLeft'] = true}
          onLeftRelease={() => keysPressedRef.current['ArrowLeft'] = false}
          onRight={() => keysPressedRef.current['ArrowRight'] = true}
          onRightRelease={() => keysPressedRef.current['ArrowRight'] = false}
        />
      )}
    </GameContainer>
  );
}

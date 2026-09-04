import React, { useRef, useCallback, useEffect } from 'react';
import { GameComponentProps } from '../../types';
import { audio } from '../../utils/audio';
import { useGameEngine } from '../../hooks/useGameEngine';
import { GameContainer } from '../gameplay/GameContainer';
import { GameHUD } from '../gameplay/GameHUD';
import { GameOverlay } from '../gameplay/GameOverlay';
import { MobileControls } from '../gameplay/MobileControls';

const CANVAS_WIDTH = 360;
const CANVAS_HEIGHT = 450;
const PLAYER_SIZE = 14;

interface GameObject {
  id: number;
  x: number;
  y: number;
  speed: number;
  type: 'asteroid' | 'star';
  size: number;
  color: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
  alpha: number;
  decay: number;
}

export default function CosmicDodgeGame({ onScoreUpdate, onGameOver, highScore }: GameComponentProps) {
  const playerXRef = useRef<number>(180);
  const playerY = CANVAS_HEIGHT - 60;
  const objectsRef = useRef<GameObject[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const spawnTimerRef = useRef(0);
  const keysPressedRef = useRef<{ [key: string]: boolean }>({});
  const localScoreRef = useRef(0);
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);

  const {
    gameState,
    startLoop,
    triggerGameOver,
    updateScore,
    setupCanvasContext
  } = useGameEngine({
    onScoreUpdate,
    onGameOver
  });

  const createSparkParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 10; i++) {
      particlesRef.current.push({
        x, y,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        color,
        radius: Math.random() * 2 + 1,
        alpha: 1,
        decay: Math.random() * 0.05 + 0.03,
      });
    }
  };

  const gameStep = useCallback((timestamp: number, deltaRaw: number) => {
    const canvas = internalCanvasRef.current;
    if (!canvas) return;
    const ctx = setupCanvasContext(canvas, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (!ctx) return;

    // Assuming deltaRaw is from requestAnimationFrame, we divide by 16.666 to get standard ~60fps delta
    const delta = deltaRaw / 16.666;
    const fallSpeed = 3.5 + localScoreRef.current * 0.006;

    // Player inputs
    if (keysPressedRef.current['ArrowLeft'] || keysPressedRef.current['a']) {
      playerXRef.current = Math.max(PLAYER_SIZE, playerXRef.current - 5.5 * delta);
    }
    if (keysPressedRef.current['ArrowRight'] || keysPressedRef.current['d']) {
      playerXRef.current = Math.min(CANVAS_WIDTH - PLAYER_SIZE, playerXRef.current + 5.5 * delta);
    }

    // Spawn falling objects
    spawnTimerRef.current += delta;
    if (spawnTimerRef.current > Math.max(12, 30 - localScoreRef.current * 0.04)) {
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
        ctx.beginPath();
        ctx.moveTo(obj.x, obj.y - obj.size);
        ctx.lineTo(obj.x + obj.size, obj.y);
        ctx.lineTo(obj.x, obj.y + obj.size);
        ctx.lineTo(obj.x - obj.size, obj.y);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, obj.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // Distance checking
      const dist = Math.hypot(obj.x - playerXRef.current, obj.y - playerY);
      if (dist < obj.size + PLAYER_SIZE * 0.8) {
        if (obj.type === 'star') {
          audio.playCoin();
          createSparkParticles(obj.x, obj.y, '#eab308');
          obj.y = CANVAS_HEIGHT + 100; // mark for deletion
          localScoreRef.current += 15;
          updateScore(localScoreRef.current);
        } else {
          audio.playExplosion();
          createSparkParticles(playerXRef.current, playerY, '#ef4444');
          triggerGameOver();
        }
      }
    });

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
    ctx.fillText(`WARPING: ${(localScoreRef.current * 0.1).toFixed(1)} LY`, 15, 30);
    ctx.textAlign = 'right';
    ctx.fillText(`SKOR: ${localScoreRef.current}`, CANVAS_WIDTH - 15, 30);

  }, [setupCanvasContext, triggerGameOver, updateScore, playerY]);

  const handleStart = () => {
    playerXRef.current = 180;
    objectsRef.current = [];
    particlesRef.current = [];
    spawnTimerRef.current = 0;
    keysPressedRef.current = {};
    localScoreRef.current = 0;
    startLoop(gameStep);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) {
        e.preventDefault();
        keysPressedRef.current[e.key] = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) {
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

  // Draw static screen once on ready
  useEffect(() => {
    if (gameState === 'ready' && internalCanvasRef.current) {
      const ctx = setupCanvasContext(internalCanvasRef.current, CANVAS_WIDTH, CANVAS_HEIGHT);
      if (ctx) {
        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
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
      }
    }
  }, [gameState, setupCanvasContext]);

  return (
    <GameContainer aspect="portrait" maxWidth="sm">
      {gameState === 'playing' && (
        <GameHUD 
          stats={[
            { id: 'score', label: 'WARP SKOR', value: localScoreRef.current, emphasized: true }
          ]} 
        />
      )}
      
      <GameOverlay
        gameState={gameState}
        score={localScoreRef.current}
        onStart={handleStart}
        onRestart={handleStart}
        instructions="AMBIL BINTANG, HINDARI METEOR MERAH"
      />
      
      <div className="relative border-4 border-zinc-900 bg-black rounded-2xl overflow-hidden shadow-2xl w-full aspect-[4/5] mx-auto">
        <canvas
          ref={internalCanvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full display-block bg-zinc-950 touch-none"
        />
      </div>

      {gameState === 'playing' && (
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

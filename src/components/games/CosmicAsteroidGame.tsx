import React, { useEffect, useRef, useState } from 'react';
import { useGameEngine } from '../../hooks/useGameEngine';
import { audio } from '../../utils/audio';
import { Particle } from '../../types';
import { GameContainer } from '../gameplay/GameContainer';
import { GameHUD } from '../gameplay/GameHUD';
import { GameOverlay } from '../gameplay/GameOverlay';
import { MobileControls } from '../gameplay/MobileControls';

interface CosmicAsteroidGameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

interface AsteroidItem {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

interface BulletItem {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export default function CosmicAsteroidGame({ onGameOver, onScoreUpdate, highScore }: CosmicAsteroidGameProps) {
  const { gameState, score, updateScore, startLoop, stopLoop, startWithCountdown, setupCanvasContext, triggerGameOver } = useGameEngine({ onScoreUpdate, onGameOver, maxDpr: 2 });
  const gameLoopRef = useRef<number | null>(null);
  const scoreRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);



  const [muted, setMuted] = useState(audio.getMuteState());

  const CANVAS_WIDTH = 400;
  const CANVAS_HEIGHT = 500;

  // Ship State
  const shipAngleRef = useRef(-Math.PI / 2); // default facing up
  const shipX = CANVAS_WIDTH / 2;
  const shipY = CANVAS_HEIGHT / 2;

  const asteroidsRef = useRef<AsteroidItem[]>([]);
  const bulletsRef = useRef<BulletItem[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const shakeRef = useRef<number>(0);
  const floatingTextsRef = useRef<{ x: number; y: number; text: string; color: string; alpha: number; vy: number }[]>([]);
  const lastFpsTimeRef = useRef(0);
  const spawnTimerRef = useRef(0);

  const keysPressedRef = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    drawStatic();
    return () => {
      if (gameLoopRef?.current) cancelAnimationFrame(gameLoopRef.current);
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
    ctx.fillText('360° COSMIC ASTEROID', CANVAS_WIDTH / 2, 180);

    ctx.fillStyle = '#6366f1';
    ctx.font = "12px 'JetBrains Mono', monospace";
    ctx.fillText('PUTAR KAPAL DAN TEMBAK METEOR DRIFTING', CANVAS_WIDTH / 2, 205);

    ctx.fillStyle = '#71717a';
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.fillText('Gunakan PANAH KIRI / KANAN untuk memutar, SPASI tembak', CANVAS_WIDTH / 2, 230);
  };

  const startNewGame = () => {
    audio.playCoin();
    
    
    updateScore(0);
    onScoreUpdate(0);

    shipAngleRef.current = -Math.PI / 2;
    asteroidsRef.current = [];
    bulletsRef.current = [];
    particlesRef.current = [];
    shakeRef.current = 0;
    floatingTextsRef.current = [];
    spawnTimerRef.current = 0;
    

    if (gameLoopRef?.current) cancelAnimationFrame(gameLoopRef.current);
  };

  // Keyboard controls
  useEffect(() => {
    if (gameState !== 'playing') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'a' || e.key === 'd') {
        e.preventDefault();
        keysPressedRef.current[e.key] = true;
      }
      if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault();
        shootBullet();
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
  }, [gameState]);

  const rotateLeft = () => {
    shipAngleRef.current -= 0.28;
  };

  const rotateRight = () => {
    shipAngleRef.current += 0.28;
  };

  const shootBullet = () => {
    if (gameState !== 'playing') return;

    audio.playJump(); // Laser chirp sound

    const speed = 7.0;
    const vx = Math.cos(shipAngleRef.current) * speed;
    const vy = Math.sin(shipAngleRef.current) * speed;

    bulletsRef.current.push({
      x: shipX + Math.cos(shipAngleRef.current) * 15,
      y: shipY + Math.sin(shipAngleRef.current) * 15,
      vx,
      vy,
    });
  };

  const createExplosion = (x: number, y: number, color: string) => {
    for (let i = 0; i < 15; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        color,
        radius: Math.random() * 2.5 + 1,
        alpha: 1,
        decay: Math.random() * 0.05 + 0.02,
      });
    }
  };

  const update = (timestamp: number, dtMs: number) => {
    const canvas = canvasRef.current;
    if (!canvas || gameState !== 'playing') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // FPS Limiter implementation
    const fpsPref = localStorage.getItem('zigame-fps') || 'auto';
    if (fpsPref !== 'auto') {
      const targetFps = parseInt(fpsPref, 10);
      const interval = 1000 / targetFps;
      const elapsed = timestamp - lastFpsTimeRef.current;
      
      if (elapsed < interval - 1) {
        startLoop(update);
        return;
      }
      
      lastFpsTimeRef.current = timestamp - (elapsed % interval);
    } else {
      lastFpsTimeRef.current = timestamp;
    }

    const delta = dtMs / 16.666;

    // HD Canvas scale and shadow setting based on graphics setting
    const graphicsQuality = localStorage.getItem('zigame-graphics') || 'high';
    const dpr = graphicsQuality === 'low' ? 1.0 : graphicsQuality === 'medium' ? 1.5 : Math.max(window.devicePixelRatio || 2, 2.5);

    const targetWidth = Math.round(CANVAS_WIDTH * dpr);
    const targetHeight = Math.round(CANVAS_HEIGHT * dpr);
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    if (shakeRef.current > 0) {
      const dx = (Math.random() - 0.5) * shakeRef.current;
      const dy = (Math.random() - 0.5) * shakeRef.current;
      ctx.translate(dx, dy);
      shakeRef.current *= 0.88;
      if (shakeRef.current < 0.5) shakeRef.current = 0;
    }

    const enableShadows = graphicsQuality !== 'low';
    const shadowScale = graphicsQuality === 'medium' ? 0.4 : 1.0;

    const setShadow = (blur: number, color: string) => {
      if (!enableShadows) {
        ctx.shadowBlur = 0;
        return;
      }
      ctx.shadowBlur = blur * shadowScale;
      ctx.shadowColor = color;
    };

    const asteroidSpeed = 1.0 + score * 0.002;

    // Rotate Ship
    if (keysPressedRef.current['ArrowLeft'] || keysPressedRef.current['a']) {
      shipAngleRef.current -= 0.07 * delta;
    }
    if (keysPressedRef.current['ArrowRight'] || keysPressedRef.current['d']) {
      shipAngleRef.current += 0.07 * delta;
    }

    // Spawn drifting asteroids from outer screen boundaries
    spawnTimerRef.current += delta;
    if (spawnTimerRef.current > Math.max(25, 55 - score * 0.05)) {
      spawnTimerRef.current = 0;

      // Pick random outer wall edge
      let startX = 0;
      let startY = 0;
      const edge = Math.floor(Math.random() * 4);
      if (edge === 0) { // Top
        startX = Math.random() * CANVAS_WIDTH;
        startY = -20;
      } else if (edge === 1) { // Bottom
        startX = Math.random() * CANVAS_WIDTH;
        startY = CANVAS_HEIGHT + 20;
      } else if (edge === 2) { // Left
        startX = -20;
        startY = Math.random() * CANVAS_HEIGHT;
      } else { // Right
        startX = CANVAS_WIDTH + 20;
        startY = Math.random() * CANVAS_HEIGHT;
      }

      // Angle towards center ship
      const angleToCenter = Math.atan2(shipY - startY, shipX - startX) + (Math.random() - 0.5) * 0.4;
      const speed = asteroidSpeed * (0.6 + Math.random() * 0.8);

      asteroidsRef.current.push({
        id: Math.random(),
        x: startX,
        y: startY,
        vx: Math.cos(angleToCenter) * speed,
        vy: Math.sin(angleToCenter) * speed,
        radius: 12 + Math.random() * 12,
        color: '#6366f1',
      });
    }

    // Move bullets
    bulletsRef.current.forEach(bullet => {
      bullet.x += bullet.vx * delta;
      bullet.y += bullet.vy * delta;
    });

    // Cleanup offscreen bullets
    bulletsRef.current = bulletsRef.current.filter(b => b.x > -10 && b.x < CANVAS_WIDTH + 10 && b.y > -10 && b.y < CANVAS_HEIGHT + 10);

    // Move and test asteroid collisions
    asteroidsRef.current.forEach(ast => {
      ast.x += ast.vx * delta;
      ast.y += ast.vy * delta;

      // Bullet Hit Asteroid Check
      bulletsRef.current.forEach(bullet => {
        const dist = Math.hypot(bullet.x - ast.x, bullet.y - ast.y);
        if (dist < ast.radius + 3) {
          // Destory!
          audio.playExplosion();
          createExplosion(ast.x, ast.y, '#818cf8');
          shakeRef.current = Math.max(shakeRef.current, 6);
          floatingTextsRef.current.push({
            x: ast.x,
            y: ast.y - 10,
            text: "+20",
            color: '#818cf8',
            alpha: 1.0,
            vy: -0.8
          });
          
          // Delete bullet and asteroid by pushing away
          bullet.x = -1000;
          ast.x = -1000;

          updateScore(score + 20);
        }
      });

      // Ship Collision Check
      const shipDist = Math.hypot(shipX - ast.x, shipY - ast.y);
      if (shipDist < ast.radius + 12) {
        audio.playExplosion();
        triggerGameOver();
      }
    });

    // Cleanup destroyed asteroids
    asteroidsRef.current = asteroidsRef.current.filter(a => a.x > -30 && a.x < CANVAS_WIDTH + 30 && a.y > -30 && a.y < CANVAS_HEIGHT + 30);

    // DRAW Frame
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Vectors background grids
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 0.5;
    for (let c = 0; c <= CANVAS_WIDTH; c += 40) {
      ctx.beginPath();
      ctx.moveTo(c, 0);
      ctx.lineTo(c, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let r = 0; r <= CANVAS_HEIGHT; r += 40) {
      ctx.beginPath();
      ctx.moveTo(0, r);
      ctx.lineTo(CANVAS_WIDTH, r);
      ctx.stroke();
    }

    // Draw Asteroids
    asteroidsRef.current.forEach(ast => {
      setShadow(10, ast.color);
      ctx.fillStyle = ast.color;
      ctx.beginPath();
      ctx.arc(ast.x, ast.y, ast.radius, 0, Math.PI * 2);
      ctx.fill();
      setShadow(0, '');

      // rugged detail lines
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ast.x, ast.y, ast.radius * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Draw Bullets (glow streaks)
    bulletsRef.current.forEach(b => {
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });

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

    // Spawn engine propulsion tail sparks
    const tailX = shipX - Math.cos(shipAngleRef.current) * 10;
    const tailY = shipY - Math.sin(shipAngleRef.current) * 10;
    if (Math.random() < 0.6) {
      particlesRef.current.push({
        x: tailX,
        y: tailY,
        vx: -Math.cos(shipAngleRef.current) * (Math.random() * 2 + 1) + (Math.random() - 0.5) * 1.5,
        vy: -Math.sin(shipAngleRef.current) * (Math.random() * 2 + 1) + (Math.random() - 0.5) * 1.5,
        color: Math.random() < 0.6 ? '#f43f5e' : '#fbbf24', // pink/orange engine exhaust
        radius: Math.random() * 2 + 1,
        alpha: 0.8,
        decay: 0.04
      });
    }

    // Draw Triangular Ship rotated
    ctx.save();
    ctx.translate(shipX, shipY);
    ctx.rotate(shipAngleRef.current);

    // Glow
    setShadow(15, '#fb7185');
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(-12, -10);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, 10);
    ctx.closePath();
    ctx.fill();
    setShadow(0, '');

    // Thruster sparks behind ship
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-14, -3, 6, 6);

    ctx.restore();

    // Draw floating multiplier score/impact texts
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

    // Top stats
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 11px 'JetBrains Mono', monospace";
    ctx.textAlign = 'left';
    ctx.fillText(`ANGLE: ${(shipAngleRef.current * (180 / Math.PI)).toFixed(0)}°`, 15, 30);
    ctx.textAlign = 'right';
    ctx.fillText(`SKOR: ${score}`, CANVAS_WIDTH - 15, 30);

  };

  const toggleMute = () => {
    const nextMuted = audio.toggleMute();
    setMuted(nextMuted);
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
        onStart={startNewGame}
        onRestart={startNewGame}
        instructions="PUTAR KAPAL DAN TEMBAK METEOR DRIFTING"
      />

      <div className="relative border-4 border-zinc-900 bg-black rounded-2xl overflow-hidden shadow-2xl w-full aspect-[4/5] mx-auto">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full display-block bg-zinc-950"
        />
      </div>

      {gameState === 'playing' && (
        <MobileControls
          onLeft={() => keysPressedRef.current['ArrowLeft'] = true}
          onLeftRelease={() => keysPressedRef.current['ArrowLeft'] = false}
          onRight={() => keysPressedRef.current['ArrowRight'] = true}
          onRightRelease={() => keysPressedRef.current['ArrowRight'] = false}
          onA={shootBullet}
          labelA="TEMBAK"
        />
      )}
    </GameContainer>
  );
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { audio } from '../../utils/audio';
import { useGameEngine } from '../../hooks/useGameEngine';
import { GameContainer } from '../gameplay/GameContainer';
import { GameHUD } from '../gameplay/GameHUD';
import { GameOverlay } from '../gameplay/GameOverlay';

interface GameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

interface Orb {
  id: string;
  x: number;
  y: number;
  radius: number;
  speedY: number;
  color: string;
  glow: string;
}

interface LaserArrow {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export default function ArcheryNeoGame({ onGameOver, onScoreUpdate, highScore }: GameProps) {
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
    scoreRef,
  } = useGameEngine({
    gameId: 'archeryneo',
    onGameOver,
    onScoreUpdate,
  });

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const [arrows, setArrows] = useState(15);
  const [stage, setStage] = useState(1);
  const arrowsRef = useRef(15);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    scoreRef.current = score;
    arrowsRef.current = arrows;
  }, [score, arrows]);

  // Turret (aimer) angle (in radians)
  const turretAngle = useRef(-Math.PI / 2); // points straight up by default
  const activeOrbs = useRef<Orb[]>([]);
  const activeLasers = useRef<LaserArrow[]>([]);
  const lastSpawn = useRef(0);

  // Canvas bounds
  const width = 300;
  const height = 300;


  const fireLaser = () => {
    if (gameStateRef.current !== 'playing' || arrowsRef.current <= 0) return;

    audio.playLaser();
    setArrows(prev => {
      const next = prev - 1;
      if (next <= 0 && activeLasers.current.length === 0) {
        // Delay end game slightly to allow active shots to finish
        setTimeout(() => {
          if (activeLasers.current.length === 0) {
            triggerGameOver();
          }
        }, 1500);
      }
      return next;
    });

    // Spawn laser arrow in turret direction
    const speed = 7;
    activeLasers.current.push({
      id: `${Date.now()}-${Math.random()}`,
      x: width / 2,
      y: height - 15,
      vx: Math.cos(turretAngle.current) * speed,
      vy: Math.sin(turretAngle.current) * speed,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameStateRef.current !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate angle from turret center (bottom center) to mouse
    const turretX = width / 2;
    const turretY = height - 15;
    const dx = x - turretX;
    const dy = y - turretY;

    // Cap angle so player can't shoot backwards (underground)
    let angle = Math.atan2(dy, dx);
    if (angle > -0.15 && angle < Math.PI / 2) angle = -0.15;
    if (angle < -Math.PI - 0.15 || angle > Math.PI / 2) angle = -Math.PI + 0.15;

    turretAngle.current = angle;
  };

  // Support mobile touch aiming
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (gameStateRef.current !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    const turretX = width / 2;
    const turretY = height - 15;
    const dx = x - turretX;
    const dy = y - turretY;

    let angle = Math.atan2(dy, dx);
    if (angle > -0.15 && angle < Math.PI / 2) angle = -0.15;
    if (angle < -Math.PI - 0.15 || angle > Math.PI / 2) angle = -Math.PI + 0.15;

    turretAngle.current = angle;
  };

  // Main canvas animation and game logic (60fps)
  const gameStep = useCallback((timestamp: number, dt: number) => {
    if (gameStateRef.current !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const delta = dt / 16.666;

    // Clear
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, width, height);

    // Network lines background
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    // 1. Spawning floating neon orbs
    const now = Date.now();
    if (now - lastSpawn.current > Math.max(1200 - stage * 80, 500)) {
      lastSpawn.current = now;
      const isPurple = Math.random() > 0.5;
      activeOrbs.current.push({
        id: `${now}-${Math.random()}`,
        x: 20 + Math.random() * (width - 40),
        y: height,
        radius: Math.random() * 5 + 11,
        speedY: -(Math.random() * 1.2 + 0.5 + stage * 0.1),
        color: isPurple ? '#d946ef' : '#ec4899',
        glow: isPurple ? '#f472b6' : '#ec4899',
      });
    }

    // 2. Update and Draw active orbs
    const orbs = [...activeOrbs.current];
    const nextOrbs: Orb[] = [];

    for (const orb of orbs) {
      orb.y += orb.speedY * delta; // rise upwards

      ctx.shadowColor = orb.glow;
      ctx.shadowBlur = 10;
      ctx.fillStyle = orb.color;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.shadowBlur = 0; // reset

      // Retain if still inside screen
      if (orb.y + orb.radius > 0) {
        nextOrbs.push(orb);
      }
    }
    activeOrbs.current = nextOrbs;

    // 3. Update and Draw active arrows
    const lasers = [...activeLasers.current];
    const nextLasers: LaserArrow[] = [];

    for (const laser of lasers) {
      laser.x += laser.vx * delta;
      laser.y += laser.vy * delta;

      // Render neon laser projectile line
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(laser.x, laser.y);
      ctx.lineTo(laser.x - laser.vx * 1.5, laser.y - laser.vy * 1.5);
      ctx.stroke();
      ctx.shadowBlur = 0; // reset

      // Collisions check with active orbs
      let collided = false;
      const hitOrbs = activeOrbs.current;
          const survivingOrbs: Orb[] = [];

          for (const orb of hitOrbs) {
            const dist = Math.hypot(laser.x - orb.x, laser.y - orb.y);
            if (dist < orb.radius + 4) {
              collided = true;
              audio.playScore(); // pop bubble sound cue
              const next = score + 50;
              addScore(50);
              // Stage completed checks as level rises
              if (next % 500 === 0) {
                setStage(s => s + 1);
                setArrows(a => a + 5); // Ammo bonus
                audio.playLevelUp();
              }
            } else {
              survivingOrbs.push(orb);
            }
          }

          if (collided) {
            activeOrbs.current = survivingOrbs;
            // Laser is consumed
          } else if (laser.x > 0 && laser.x < width && laser.y > 0 && laser.y < height) {
            nextLasers.push(laser); // Keep moving if in-bounds
          }
        }
        activeLasers.current = nextLasers;

        // Check empty arrows and empty lasers end trigger
        if (arrowsRef.current <= 0 && activeLasers.current.length === 0) {
          triggerGameOver();
          return;
        }

        // 4. Draw Turret aimer launcher (Bottom center)
        const turretX = width / 2;
        const turretY = height - 15;

        // Base circle
        ctx.fillStyle = '#1f2937';
        ctx.beginPath();
        ctx.arc(turretX, turretY, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#4b5563';
        ctx.stroke();

        // Cannon barrel line pointer
        const barrelLength = 25;
        const bx = turretX + Math.cos(turretAngle.current) * barrelLength;
        const by = turretY + Math.sin(turretAngle.current) * barrelLength;

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 4.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(turretX, turretY);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.lineCap = 'butt'; // reset

        // Draw laser pointer line dots
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 5]);
        ctx.beginPath();
        ctx.moveTo(turretX, turretY);
        ctx.lineTo(turretX + Math.cos(turretAngle.current) * 120, turretY + Math.sin(turretAngle.current) * 120);
        ctx.stroke();
        ctx.setLineDash([]);
  }, [addScore, triggerGameOver, stage]);

  const startGame = useCallback(() => {
    audio.playCoin();
    updateScore(0);
    setArrows(15);
    setStage(1);
    activeOrbs.current = [];
    activeLasers.current = [];
    turretAngle.current = -Math.PI / 2;
    
    startWithCountdown(() => {
      startLoop((t, d) => gameStep(t, d));
    });
  }, [updateScore, startWithCountdown, startLoop, gameStep]);

  return (
    <GameContainer aspect="square" maxWidth="sm">
      {gameState === 'playing' && (
        <GameHUD 
          stats={[
            { id: 'arrows', label: 'AMUNISI', value: `${arrows}`, emphasized: arrows <= 3 },
            { id: 'stage', label: 'STAGE', value: stage },
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
        instructions="Arahkan turret laser lalu tembak gelembung neon!"
      />

      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
        onClick={fireLaser}
        className="w-full h-auto object-contain block bg-zinc-950 cursor-crosshair"
      />

      {gameState === "playing" && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[80%] max-w-[200px]">
          <button
            onClick={fireLaser}
            className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-mono font-black text-xs uppercase tracking-wider rounded-xl shadow-lg cursor-pointer active:scale-95 transition select-none"
          >
            🔥 TEMBAK LASER
          </button>
        </div>
      )}
    </GameContainer>
  );
}

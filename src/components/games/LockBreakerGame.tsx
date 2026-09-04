import React, { useEffect, useRef, useState } from 'react';
import { audio } from '../../utils/audio';
import { Particle } from '../../types';
import { GameContainer } from '../gameplay/GameContainer';
import { GameHUD } from '../gameplay/GameHUD';
import { GameOverlay } from '../gameplay/GameOverlay';
import { MobileControls } from '../gameplay/MobileControls';

interface LockBreakerGameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

export default function LockBreakerGame({ onGameOver, onScoreUpdate, highScore }: LockBreakerGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
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

  // Lock State
  const angleRef = useRef(0); // Current scanning hand position (radians)
  const targetAngleRef = useRef(Math.PI / 4); // Target dot position (radians)
  const dirRef = useRef(1); // 1 = clockwise, -1 = counter-clockwise
  const speedRef = useRef(0.04); // Angle velocity per tick
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

    // Render static Lock visual
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 10, 80, 0, Math.PI * 2);
    ctx.stroke();

    // Lock handle
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 90, 35, Math.PI, 0);
    ctx.stroke();

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 20px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('NEON LOCK BREAKER', CANVAS_WIDTH / 2, 80);

    ctx.fillStyle = '#f59e0b';
    ctx.font = "12px 'JetBrains Mono', monospace";
    ctx.fillText('KLIK TEPAT PADA BULATAN ORANGE', CANVAS_WIDTH / 2, 105);

    ctx.fillStyle = '#71717a';
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.fillText('Kecepatan meningkat setiap gembok terbuka', CANVAS_WIDTH / 2, 130);
  };

  const spawnNewTarget = () => {
    // Spawn dot at a reasonable distance from current angle, at least Math.PI / 2
    const minDistance = Math.PI / 1.8;
    const offset = minDistance + Math.random() * (Math.PI - 0.3);
    targetAngleRef.current = (angleRef.current + dirRef.current * offset) % (Math.PI * 2);
    if (targetAngleRef.current < 0) {
      targetAngleRef.current += Math.PI * 2;
    }
  };

  const startNewGame = () => {
    audio.playCoin();
    setIsPlaying(true);
    setGameOver(false);
    setScore(0);
    onScoreUpdate(0);

    angleRef.current = 0;
    dirRef.current = 1;
    speedRef.current = 0.045;
    particlesRef.current = [];
    spawnNewTarget();

    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    gameLoopRef.current = requestAnimationFrame(update);
  };

  const createSuccessParticles = (x: number, y: number) => {
    for (let i = 0; i < 15; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        color: '#f59e0b',
        radius: Math.random() * 2 + 1,
        alpha: 1,
        decay: Math.random() * 0.04 + 0.02,
      });
    }
  };

  const handleTrigger = () => {
    if (!isPlayingRef.current || gameOverRef.current ) return;

    // Normalize angles to 0 to 2*PI
    let normAngle = angleRef.current % (Math.PI * 2);
    if (normAngle < 0) normAngle += Math.PI * 2;

    let normTarget = targetAngleRef.current % (Math.PI * 2);
    if (normTarget < 0) normTarget += Math.PI * 2;

    // Check angular difference
    let diff = Math.abs(normAngle - normTarget);
    if (diff > Math.PI) {
      diff = Math.PI * 2 - diff;
    }

    // Tolerance range in radians (approx 12-14 degrees)
    const tolerance = 0.22;

    if (diff <= tolerance) {
      // SUCCESS!
      audio.playScore();
      
      const centerX = CANVAS_WIDTH / 2;
      const centerY = CANVAS_HEIGHT / 2 - 10;
      const radius = 80;
      const sparkX = centerX + Math.cos(targetAngleRef.current) * radius;
      const sparkY = centerY + Math.sin(targetAngleRef.current) * radius;

      createSuccessParticles(sparkX, sparkY);

      setScore(prev => {
        const next = prev + 10;
        onScoreUpdate(next);
        return next;
      });

      // Reverse direction and make it slightly faster!
      dirRef.current *= -1;
      speedRef.current = Math.min(0.12, speedRef.current + 0.003);
      spawnNewTarget();
    } else {
      // MISSED!
      audio.playExplosion();
      setGameOver(true);
      setIsPlaying(false);
      onGameOver(scoreRef.current);
    }
  };

  const update = () => {
    const canvas = canvasRef.current;
    if (!canvas || !isPlayingRef.current || gameOverRef.current ) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Update scanner hand position
    angleRef.current += dirRef.current * speedRef.current;

    // Draw background
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2 - 10;
    const radius = 80;

    // Draw Lock Shackle (moving if game active)
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(centerX, centerY - 80, 35, Math.PI, 0);
    ctx.stroke();

    // Lock main body ring
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw Target Bulatan Orange
    const targetX = centerX + Math.cos(targetAngleRef.current) * radius;
    const targetY = centerY + Math.sin(targetAngleRef.current) * radius;

    ctx.shadowBlur = 15;
    ctx.shadowColor = '#f59e0b';
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(targetX, targetY, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw Scanning Hand
    const handX = centerX + Math.cos(angleRef.current) * radius;
    const handY = centerY + Math.sin(angleRef.current) * radius;

    ctx.shadowBlur = 12;
    ctx.shadowColor = '#3b82f6';
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(handX, handY, 12, 0, Math.PI * 2);
    ctx.fill();

    // Draw pointer trail inside hand
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(handX, handY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw Lock Score in center
    ctx.fillStyle = '#ffffff';
    ctx.font = "black 32px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${score / 10}`, centerX, centerY);

    // Particle render
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

    // Top HUD
    ctx.fillStyle = '#52525b';
    ctx.font = "bold 11px 'JetBrains Mono', monospace";
    ctx.fillText(`KUNCI TERPECAH: ${score / 10}`, 60, 30);

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
        instructions="KLIK TEPAT PADA BULATAN ORANGE. Kecepatan meningkat setiap gembok terbuka."
      />

      <div 
        className="relative w-full aspect-[4/5] mx-auto bg-zinc-950 rounded-xl border-4 border-zinc-900 shadow-2xl overflow-hidden cursor-pointer"
        onPointerDown={(e) => {
          if (isPlaying) handleTrigger();
        }}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full display-block bg-zinc-950"
        />
      </div>

      {isPlaying && (
        <MobileControls
          onA={handleTrigger}
          labelA="BUKA!"
        />
      )}
    </GameContainer>
  );
}

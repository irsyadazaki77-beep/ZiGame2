import React, { useEffect, useRef, useState } from 'react';
import { audio } from '../../utils/audio';
import { Particle } from '../../types';
import { GameContainer } from '../gameplay/GameContainer';
import { GameHUD } from '../gameplay/GameHUD';
import { GameOverlay } from '../gameplay/GameOverlay';

interface CyberSlasherGameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

interface SlasherItem {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  type: 'sphere' | 'star' | 'bomb';
  color: string;
  sliced: boolean;
  sliceAngle: number;
}

interface TrailPoint {
  x: number;
  y: number;
  time: number;
}

export default function CyberSlasherGame({ onGameOver, onScoreUpdate, highScore }: CyberSlasherGameProps) {
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

  const itemsRef = useRef<SlasherItem[]>([]);
  const trailRef = useRef<TrailPoint[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const spawnTimerRef = useRef(0);
  const shakeRef = useRef<number>(0);
  const floatingTextsRef = useRef<{ x: number; y: number; text: string; color: string; alpha: number; vy: number }[]>([]);

  const isMouseDownRef = useRef(false);

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

    // Grid details
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
    ctx.fillText('CYBER SLASHER', CANVAS_WIDTH / 2, 180);

    ctx.fillStyle = '#d946ef';
    ctx.font = "12px 'JetBrains Mono', monospace";
    ctx.fillText('GESER KURSOR/JARI UNTUK TEBAS NEON', CANVAS_WIDTH / 2, 205);

    ctx.fillStyle = '#71717a';
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.fillText('Hati-hati jangan sampai menebas BOMB MERAH!', CANVAS_WIDTH / 2, 230);
  };

  const startNewGame = () => {
    audio.playCoin();
    setIsPlaying(true);
    setGameOver(false);
    setScore(0);
    onScoreUpdate(0);

    itemsRef.current = [];
    trailRef.current = [];
    particlesRef.current = [];
    spawnTimerRef.current = 0;
    lastTimeRef.current = performance.now();

    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    gameLoopRef.current = requestAnimationFrame(update);
  };

  const spawnFruitItem = () => {
    const isBomb = Math.random() < 0.22;
    const isStar = !isBomb && Math.random() < 0.25;

    const startX = 60 + Math.random() * (CANVAS_WIDTH - 120);
    const startY = CANVAS_HEIGHT + 20;

    // Arch velocities
    const vy = -11.5 - Math.random() * 4.2;
    const vx = (CANVAS_WIDTH / 2 - startX) * 0.02 + (Math.random() - 0.5) * 2;

    itemsRef.current.push({
      id: Math.random(),
      x: startX,
      y: startY,
      vx,
      vy,
      radius: isBomb ? 18 : isStar ? 14 : 20,
      type: isBomb ? 'bomb' : isStar ? 'star' : 'sphere',
      color: isBomb ? '#ef4444' : isStar ? '#eab308' : '#14b8a6',
      sliced: false,
      sliceAngle: 0,
    });
  };

  const createSliceSparks = (x: number, y: number, color: string) => {
    for (let i = 0; i < 15; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        color,
        radius: Math.random() * 2.5 + 1.5,
        alpha: 1,
        decay: Math.random() * 0.05 + 0.02,
      });
    }
  };

  // Drag trail calculation and slicing check
  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isPlayingRef.current || gameOverRef.current ) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = ((clientX - rect.left) / rect.width) * CANVAS_WIDTH;
    const y = ((clientY - rect.top) / rect.height) * CANVAS_HEIGHT;

    trailRef.current.push({ x, y, time: performance.now() });

    // Limit trail length
    if (trailRef.current.length > 12) {
      trailRef.current.shift();
    }

    // Check slicing intersections
    if (trailRef.current.length > 2) {
      const p1 = trailRef.current[trailRef.current.length - 2];
      const p2 = trailRef.current[trailRef.current.length - 1];

      itemsRef.current.forEach(item => {
        if (item.sliced) return;

        // Intersection checking from line segment (p1 -> p2) to circle (item.x, item.y)
        const dX = p2.x - p1.x;
        const dY = p2.y - p1.y;
        const len = Math.hypot(dX, dY);
        if (len === 0) return;

        const u = ((item.x - p1.x) * dX + (item.y - p1.y) * dY) / (len * len);
        const clampU = Math.max(0, Math.min(1, u));
        
        const closestX = p1.x + clampU * dX;
        const closestY = p1.y + clampU * dY;

        const dist = Math.hypot(item.x - closestX, item.y - closestY);

        if (dist < item.radius + 5) {
          // SLICED!
          item.sliced = true;
          item.sliceAngle = Math.atan2(dY, dX);

          if (item.type === 'bomb') {
            audio.playExplosion();
            shakeRef.current = 24;
            floatingTextsRef.current.push({
              x: item.x,
              y: item.y - 12,
              text: "BOOM!!",
              color: '#ef4444',
              alpha: 1.0,
              vy: -1.2
            });
            setGameOver(true);
            setIsPlaying(false);
            // Create massive burst of bomb spark particles
            for (let i = 0; i < 25; i++) {
              particlesRef.current.push({
                x: item.x,
                y: item.y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                color: i % 2 === 0 ? '#ef4444' : '#f97316',
                radius: Math.random() * 3 + 1,
                alpha: 1.0,
                decay: Math.random() * 0.04 + 0.02
              });
            }
            onGameOver(scoreRef.current);
          } else {
            audio.playScore();
            shakeRef.current = 5;
            const points = item.type === 'star' ? 30 : 10;
            floatingTextsRef.current.push({
              x: item.x,
              y: item.y - 12,
              text: `+${points}`,
              color: item.color,
              alpha: 1.0,
              vy: -0.8
            });
            createSliceSparks(item.x, item.y, item.color);
            
            setScore(prev => {
              const next = prev + points;
              onScoreUpdate(next);
              return next;
            });
          }
        }
      });
    }
  };

  const update = (timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !isPlayingRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const delta = (timestamp - lastTimeRef.current) / 16.666;
    lastTimeRef.current = timestamp;

    const gravity = 0.28;

    // Spawn waves
    spawnTimerRef.current += delta;
    if (spawnTimerRef.current > Math.max(25, 60 - scoreRef.current * 0.05)) {
      spawnTimerRef.current = 0;
      spawnFruitItem();
      if (Math.random() < 0.4) spawnFruitItem(); // Double spawns
    }

    // Move items
    itemsRef.current.forEach(item => {
      item.vy += gravity * delta;
      item.x += item.vx * delta;
      item.y += item.vy * delta;
    });

    // Cleanup fallen offscreen items
    itemsRef.current = itemsRef.current.filter(i => i.y < CANVAS_HEIGHT + 40);

    // Clean old trail slices
    trailRef.current = trailRef.current.filter(p => performance.now() - p.time < 180);

    // DRAW Frame
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
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 0.5;
    for (let c = 0; c <= CANVAS_WIDTH; c += 40) {
      ctx.beginPath();
      ctx.moveTo(c, 0);
      ctx.lineTo(c, CANVAS_HEIGHT);
      ctx.stroke();
    }

    // Render Slasher Items
    itemsRef.current.forEach(item => {
      ctx.shadowBlur = 10;
      ctx.shadowColor = item.color;
      ctx.fillStyle = item.color;

      if (item.sliced) {
        // Draw split slices flying apart
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.rotate(item.sliceAngle);

        // Slice half A (left/top)
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(-5, -3, item.radius, Math.PI / 2, (3 * Math.PI) / 2);
        ctx.closePath();
        ctx.fill();

        // Slice half B (right/bottom)
        ctx.beginPath();
        ctx.arc(5, 3, item.radius, (3 * Math.PI) / 2, Math.PI / 2);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      } else {
        if (item.type === 'bomb') {
          // Glow red bomb sphere with sparks
          ctx.beginPath();
          ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
          ctx.fill();

          // draw inner black core
          ctx.fillStyle = '#18181b';
          ctx.beginPath();
          ctx.arc(item.x, item.y, item.radius * 0.6, 0, Math.PI * 2);
          ctx.fill();
        } else if (item.type === 'star') {
          // Yellow star polygon
          ctx.beginPath();
          ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Standard turquoise target sphere
          ctx.beginPath();
          ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(item.x - 5, item.y - 5, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.shadowBlur = 0;
    });

    // Draw particle explosions
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

    // Draw glowing sword trail lines
    if (trailRef.current.length > 1) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#d946ef';

      ctx.beginPath();
      ctx.moveTo(trailRef.current[0].x, trailRef.current[0].y);
      for (let i = 1; i < trailRef.current.length; i++) {
        ctx.lineTo(trailRef.current[i].x, trailRef.current[i].y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Render floating texts
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

    // Stats
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 11px 'JetBrains Mono', monospace";
    ctx.textAlign = 'left';
    ctx.fillText(`TEBASAN BERUNTUN: ${Math.floor(scoreRef.current / 10)}`, 15, 30);
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
            { id: 'combo', label: 'TEBASAN BERUNTUN', value: Math.floor(score / 10) },
            { id: 'score', label: 'SKOR', value: score, emphasized: true }
          ]} 
        />
      )}

      <GameOverlay
        gameState={getGameState()}
        score={score}
        onStart={startNewGame}
        onRestart={startNewGame}
        instructions="GESER KURSOR/JARI UNTUK TEBAS NEON. Hati-hati jangan sampai menebas BOMB MERAH!"
      />

      <div className="relative w-full aspect-[4/5] mx-auto bg-zinc-950 rounded-xl border-4 border-zinc-900 shadow-2xl overflow-hidden cursor-crosshair">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onMouseMove={handlePointerMove}
          onTouchMove={handlePointerMove}
          className="w-full h-full display-block bg-zinc-950 cursor-crosshair"
        />
      </div>
    </GameContainer>
  );
}

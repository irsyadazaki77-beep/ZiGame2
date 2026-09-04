import React, { useEffect, useRef, useState } from 'react';
import { audio } from '../../utils/audio';
import { Particle } from '../../types';
import { GameOverlay } from '../gameplay/GameOverlay';

interface VaporwaveRacerGameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

interface ObstacleCar {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  color: string;
}

interface RacerCoin {
  x: number;
  y: number;
  size: number;
  collected: boolean;
}

export default function VaporwaveRacerGame({ onGameOver, onScoreUpdate, highScore }: VaporwaveRacerGameProps) {
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

  const playerXRef = useRef(180);
  const CAR_WIDTH = 34;
  const CAR_HEIGHT = 55;

  const obstaclesRef = useRef<ObstacleCar[]>([]);
  const coinsRef = useRef<RacerCoin[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const shakeRef = useRef<number>(0);
  const floatingTextsRef = useRef<{ x: number; y: number; text: string; color: string; alpha: number; vy: number }[]>([]);
  const lastTimeRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(0);
  const obstacleTimerRef = useRef(0);
  const coinTimerRef = useRef(0);
  const roadOffsetRef = useRef(0);
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

    // Vaporwave sky sunset background
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    grad.addColorStop(0, '#701a75');
    grad.addColorStop(0.5, '#4a044e');
    grad.addColorStop(1, '#09090b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Grid wires
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -100; i <= CANVAS_WIDTH + 100; i += 40) {
      ctx.moveTo(CANVAS_WIDTH / 2, 120);
      ctx.lineTo(i, CANVAS_HEIGHT);
    }
    ctx.stroke();

    // Outrun sun in center
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH / 2, 120, 45, Math.PI, 0);
    ctx.fill();

    // Title text
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 20px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('VAPORWAVE RACER', CANVAS_WIDTH / 2, 230);

    ctx.fillStyle = '#f43f5e';
    ctx.font = "12px 'JetBrains Mono', monospace";
    ctx.fillText('HINDARI TABRAKAN MOBIL NEON', CANVAS_WIDTH / 2, 255);

    ctx.fillStyle = '#71717a';
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.fillText('Gunakan PANAH KIRI / KANAN untuk menyetir', CANVAS_WIDTH / 2, 290);
  };

  const startNewGame = () => {
    audio.playCoin();
    
    // Explicitly update ref states to guarantee synchronous start
    isPlayingRef.current = true;
    gameOverRef.current = false;
    
    setIsPlaying(true);
    setGameOver(false);
    setScore(0);
    onScoreUpdate(0);

    playerXRef.current = 180;
    obstaclesRef.current = [];
    coinsRef.current = [];
    particlesRef.current = [];
    obstacleTimerRef.current = 0;
    coinTimerRef.current = 0;
    roadOffsetRef.current = 0;
    lastTimeRef.current = performance.now();

    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    gameLoopRef.current = requestAnimationFrame(update);
  };

  // Keyboard events
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
    playerXRef.current = Math.max(50, playerXRef.current - 18);
  };

  const moveRight = () => {
    playerXRef.current = Math.min(CANVAS_WIDTH - 50 - CAR_WIDTH, playerXRef.current + 18);
  };

  const createSparkParticles = (x: number, y: number, color: string) => {
    const quality = localStorage.getItem('zigame-graphics') || 'high';
    const pCount = quality === 'low' ? 3 : quality === 'medium' ? 6 : 12;
    for (let i = 0; i < pCount; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
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

    // FPS Limiter implementation
    const fpsPref = localStorage.getItem('zigame-fps') || 'auto';
    if (fpsPref !== 'auto') {
      const targetFps = parseInt(fpsPref, 10);
      const interval = 1000 / targetFps;
      const elapsed = timestamp - lastFpsTimeRef.current;
      
      if (elapsed < interval - 1) {
        gameLoopRef.current = requestAnimationFrame(update);
        return;
      }
      
      lastFpsTimeRef.current = timestamp - (elapsed % interval);
    } else {
      lastFpsTimeRef.current = timestamp;
    }

    const delta = (timestamp - lastTimeRef.current) / 16.666;
    lastTimeRef.current = timestamp;

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

    ctx.save();
    if (shakeRef.current > 0) {
      const dx = (Math.random() - 0.5) * shakeRef.current;
      const dy = (Math.random() - 0.5) * shakeRef.current;
      ctx.translate(dx, dy);
      shakeRef.current *= 0.85;
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

    const gameSpeed = 5 + scoreRef.current * 0.01;

    // Movement Physics
    if (keysPressedRef.current['ArrowLeft'] || keysPressedRef.current['a']) {
      playerXRef.current = Math.max(50, playerXRef.current - 4 * delta);
    }
    if (keysPressedRef.current['ArrowRight'] || keysPressedRef.current['d']) {
      playerXRef.current = Math.min(CANVAS_WIDTH - 50 - CAR_WIDTH, playerXRef.current + 4 * delta);
    }

    // Scroll road texture offset
    roadOffsetRef.current = (roadOffsetRef.current + gameSpeed * delta) % 60;

    // Spawn Obstacle Cars
    obstacleTimerRef.current += delta;
    if (obstacleTimerRef.current > Math.max(35, 60 - scoreRef.current * 0.05)) {
      obstacleTimerRef.current = 0;
      
      const lanesX = [60, 140, 220, 300];
      const randomLane = lanesX[Math.floor(Math.random() * lanesX.length)];
      
      obstaclesRef.current.push({
        id: Math.random(),
        x: randomLane - CAR_WIDTH / 2,
        y: -CAR_HEIGHT,
        width: CAR_WIDTH,
        height: CAR_HEIGHT,
        speed: gameSpeed * 0.4 + Math.random() * 1.5,
        color: Math.random() < 0.5 ? '#f43f5e' : '#e0f2fe',
      });
    }

    // Spawn Coins
    coinTimerRef.current += delta;
    if (coinTimerRef.current > 30) {
      coinTimerRef.current = 0;
      if (Math.random() < 0.5) {
        const lanesX = [70, 150, 230, 310];
        coinsRef.current.push({
          x: lanesX[Math.floor(Math.random() * lanesX.length)],
          y: -15,
          size: 6,
          collected: false,
        });
      }
    }

    // 1. Draw Sky background
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 180);
    skyGrad.addColorStop(0, '#120024');
    skyGrad.addColorStop(0.5, '#2e1065');
    skyGrad.addColorStop(0.85, '#701a75');
    skyGrad.addColorStop(1, '#db2777');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, 180);

    // Neon Outrun Sun with neon glow
    ctx.shadowBlur = 25;
    ctx.shadowColor = '#f43f5e';
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH / 2, 120, 38, Math.PI, 0);
    ctx.fill();
    ctx.shadowBlur = 0; // reset

    // Draw Sun stripes (outrun style)
    ctx.fillStyle = '#2e1065';
    for (let sy = 90; sy < 125; sy += 7) {
      ctx.fillRect(CANVAS_WIDTH / 2 - 42, sy, 84, 2.5);
    }

    // Distant Synthwave Vector Mountains Outline
    ctx.fillStyle = '#0f051d';
    ctx.strokeStyle = '#db2777';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#db2777';
    ctx.beginPath();
    ctx.moveTo(0, 180);
    ctx.lineTo(35, 145);
    ctx.lineTo(75, 180);
    ctx.lineTo(120, 135);
    ctx.lineTo(165, 180);
    ctx.lineTo(205, 148);
    ctx.lineTo(245, 180);
    ctx.lineTo(285, 130);
    ctx.lineTo(330, 180);
    ctx.lineTo(370, 140);
    ctx.lineTo(400, 180);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0; // reset

    // Horizon glowing line
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#f43f5e';
    ctx.beginPath();
    ctx.moveTo(0, 180);
    ctx.lineTo(CANVAS_WIDTH, 180);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 2. Draw Road
    ctx.fillStyle = '#08070d';
    ctx.beginPath();
    ctx.moveTo(40, CANVAS_HEIGHT);
    ctx.lineTo(150, 180);
    ctx.lineTo(250, 180);
    ctx.lineTo(360, CANVAS_HEIGHT);
    ctx.closePath();
    ctx.fill();

    // 3D Scrolling Perspective Grid Lines on Road
    ctx.strokeStyle = 'rgba(217, 70, 239, 0.45)';
    ctx.lineWidth = 1.5;
    setShadow(4, '#d946ef');
    const numHorizontalLines = 9;
    for (let i = 0; i < numHorizontalLines; i++) {
      // Perspective progress using an exponential scaling mapping
      const progress = ((i + (roadOffsetRef.current / 60)) / numHorizontalLines) % 1;
      const y = 180 + Math.pow(progress, 2.2) * (CANVAS_HEIGHT - 180);

      // Interpolate horizontal width for 3D perspective trapezoid
      const ratio = (y - 180) / (CANVAS_HEIGHT - 180);
      const xLeft = 150 + ratio * (40 - 150);
      const xRight = 250 + ratio * (360 - 250);

      ctx.beginPath();
      ctx.moveTo(xLeft, y);
      ctx.lineTo(xRight, y);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Side Neon barriers (fuchsia)
    ctx.strokeStyle = '#d946ef';
    ctx.lineWidth = 4;
    setShadow(12, '#d946ef');
    ctx.beginPath();
    ctx.moveTo(40, CANVAS_HEIGHT);
    ctx.lineTo(150, 180);
    ctx.moveTo(360, CANVAS_HEIGHT);
    ctx.lineTo(250, 180);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Center divider lines moving down (perspective aligned)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2;
    setShadow(5, '#ffffff');
    ctx.setLineDash([12, 18]);
    ctx.lineDashOffset = -roadOffsetRef.current * 1.8;
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2, 180);
    ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]); // reset
    ctx.shadowBlur = 0;

    // 3. Move & Draw Coins
    coinsRef.current.forEach(coin => {
      coin.y += gameSpeed * delta;

      // Draw neon gold coin
      setShadow(8, '#eab308');
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, coin.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Collect Check
      const playerCenterX = playerXRef.current + CAR_WIDTH / 2;
      const playerCenterY = CANVAS_HEIGHT - 80 + CAR_HEIGHT / 2;
      const dist = Math.hypot(coin.x - playerCenterX, coin.y - playerCenterY);
      if (dist < coin.size + 16 && !coin.collected) {
        coin.collected = true;
        audio.playCoin();
        shakeRef.current = 4;
        floatingTextsRef.current.push({
          x: coin.x,
          y: coin.y - 10,
          text: "+30",
          color: '#fbbf24',
          alpha: 1.0,
          vy: -0.8
        });
        createSparkParticles(coin.x, coin.y, '#eab308');
        setScore(prev => {
          const next = prev + 30;
          onScoreUpdate(next);
          return next;
        });
      }
    });
    coinsRef.current = coinsRef.current.filter(c => c.y < CANVAS_HEIGHT + 10 && !c.collected);

    // 4. Move & Draw Obstacle Cars
    obstaclesRef.current.forEach(car => {
      car.y += car.speed * delta;

      // Neon sports car styling
      setShadow(10, car.color);
      ctx.fillStyle = car.color;
      ctx.fillRect(car.x, car.y, car.width, car.height);
      ctx.shadowBlur = 0;

      // Headlights / taillights
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(car.x + 3, car.y + 2, 5, 3);
      ctx.fillRect(car.x + car.width - 8, car.y + 2, 5, 3);

      // Windows
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(car.x + 4, car.y + 12, car.width - 8, 14);

      // Collision check
      const playerX = playerXRef.current;
      const playerY = CANVAS_HEIGHT - 80;
      const collided = (
        playerX < car.x + car.width &&
        playerX + CAR_WIDTH > car.x &&
        playerY < car.y + car.height &&
        playerY + CAR_HEIGHT > car.y
      );

      if (collided) {
        audio.playExplosion();
        shakeRef.current = 24;
        floatingTextsRef.current.push({
          x: playerX + CAR_WIDTH / 2,
          y: playerY,
          text: "CRASH!!",
          color: '#ef4444',
          alpha: 1.0,
          vy: -1.2
        });
        // Create massive burst of cyber explosion sparks
        for (let i = 0; i < 30; i++) {
          particlesRef.current.push({
            x: playerX + CAR_WIDTH / 2,
            y: playerY + CAR_HEIGHT / 2,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            color: i % 2 === 0 ? '#ef4444' : '#f97316',
            radius: Math.random() * 3 + 1,
            alpha: 1.0,
            decay: Math.random() * 0.04 + 0.02
          });
        }
        setGameOver(true);
        setIsPlaying(false);
        onGameOver(scoreRef.current);
      }
    });
    obstaclesRef.current = obstaclesRef.current.filter(c => c.y < CANVAS_HEIGHT + 20);

    // 5. Render Player's Neon Blue Sports Car
    const pX = playerXRef.current;
    const pY = CANVAS_HEIGHT - 80;

    // Glow
    setShadow(12, '#06b6d4');
    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(pX, pY, CAR_WIDTH, CAR_HEIGHT);
    ctx.shadowBlur = 0;

    // Glowing front cyan highlights
    ctx.fillStyle = '#a5f3fc';
    ctx.fillRect(pX + 3, pY + CAR_HEIGHT - 5, 6, 4);
    ctx.fillRect(pX + CAR_WIDTH - 9, pY + CAR_HEIGHT - 5, 6, 4);

    // Windshield
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(pX + 4, pY + 15, CAR_WIDTH - 8, 15);

    // Thruster fire behind player car
    const fireHeight = 5 + Math.random() * 8;
    ctx.fillStyle = '#d946ef';
    ctx.fillRect(pX + 10, pY - fireHeight, 4, fireHeight);
    ctx.fillRect(pX + CAR_WIDTH - 14, pY - fireHeight, 4, fireHeight);

    // Emit tire smoke trailing behind
    if (Math.random() < 0.3) {
      particlesRef.current.push({
        x: pX + 5,
        y: pY,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -Math.random() * 2 - 1,
        color: '#d946ef',
        radius: Math.random() * 2 + 1,
        alpha: 0.7,
        decay: 0.04
      });
      particlesRef.current.push({
        x: pX + CAR_WIDTH - 9,
        y: pY,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -Math.random() * 2 - 1,
        color: '#06b6d4',
        radius: Math.random() * 2 + 1,
        alpha: 0.7,
        decay: 0.04
      });
    }

    // 6. Draw particles
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

    // HUD Text
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 11px 'JetBrains Mono', monospace";
    ctx.textAlign = 'left';
    ctx.fillText(`MPH: ${Math.floor(100 + scoreRef.current * 0.5)}`, 15, 30);
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
    <div className="relative flex flex-col h-full w-full min-h-0 items-center justify-center overflow-hidden p-2 bg-zinc-950">
      {/* HUD Bar inside the flex layout to prevent overlap */}
      <div className="w-full flex-none flex justify-between items-center mb-2 px-2 font-mono text-xs">
        <div className="text-pink-500 font-bold uppercase tracking-wider">
          KECEPATAN: <span className="text-white">{Math.floor(100 + score * 0.5)} MPH</span>
        </div>
        <div className="text-purple-400 font-bold uppercase tracking-wider">
          STATUS: <span className="text-white">OUTRUN</span>
        </div>
        <div className="text-yellow-400 font-bold uppercase tracking-wider">
          SKOR: <span className="text-white">{score}</span>
        </div>
      </div>

      {/* Canvas Wrapper */}
      <div className="relative flex-1 min-h-0 w-full flex items-center justify-center bg-[#08070d] rounded-xl border border-zinc-800 shadow-[0_0_20px_rgba(0,0,0,0.5)] overflow-hidden">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="max-w-full max-h-full object-contain block bg-[#08070d]"
        />

        {/* Interactive touch zones for mobile */}
        {isPlaying && (
          <div className="absolute inset-0 flex select-none touch-none">
            <div 
              className="flex-1 h-full cursor-pointer active:bg-white/[0.01]"
              onTouchStart={(e) => { e.preventDefault(); keysPressedRef.current['ArrowLeft'] = true; }} 
              onTouchEnd={(e) => { e.preventDefault(); keysPressedRef.current['ArrowLeft'] = false; }}
              onMouseDown={() => { keysPressedRef.current['ArrowLeft'] = true; }}
              onMouseUp={() => { keysPressedRef.current['ArrowLeft'] = false; }}
              onMouseLeave={() => { keysPressedRef.current['ArrowLeft'] = false; }}
            />
            <div 
              className="flex-1 h-full cursor-pointer active:bg-white/[0.01]"
              onTouchStart={(e) => { e.preventDefault(); keysPressedRef.current['ArrowRight'] = true; }} 
              onTouchEnd={(e) => { e.preventDefault(); keysPressedRef.current['ArrowRight'] = false; }}
              onMouseDown={() => { keysPressedRef.current['ArrowRight'] = true; }}
              onMouseUp={() => { keysPressedRef.current['ArrowRight'] = false; }}
              onMouseLeave={() => { keysPressedRef.current['ArrowRight'] = false; }}
            />
          </div>
        )}

        <GameOverlay
          gameState={getGameState()}
          score={score}
          onStart={startNewGame}
          onRestart={startNewGame}
          instructions="Tekan PANAH KIRI / KANAN atau ketuk sisi kiri/kanan layar untuk menyetir mobil neon dan mengumpulkan koin!"
        />
      </div>

      {/* Visual touch indicators for accessibility on mobile */}
      {isPlaying && (
        <div className="flex-none mt-2 w-full max-w-xs flex gap-4 md:hidden">
          <button
            onTouchStart={(e) => { e.preventDefault(); keysPressedRef.current['ArrowLeft'] = true; }} 
            onTouchEnd={(e) => { e.preventDefault(); keysPressedRef.current['ArrowLeft'] = false; }}
            onMouseDown={() => { keysPressedRef.current['ArrowLeft'] = true; }}
            onMouseUp={() => { keysPressedRef.current['ArrowLeft'] = false; }}
            onMouseLeave={() => { keysPressedRef.current['ArrowLeft'] = false; }}
            className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded-xl flex justify-center items-center text-white select-none touch-none text-xs font-mono font-bold"
          >
            KIRI
          </button>
          <button
            onTouchStart={(e) => { e.preventDefault(); keysPressedRef.current['ArrowRight'] = true; }} 
            onTouchEnd={(e) => { e.preventDefault(); keysPressedRef.current['ArrowRight'] = false; }}
            onMouseDown={() => { keysPressedRef.current['ArrowRight'] = true; }}
            onMouseUp={() => { keysPressedRef.current['ArrowRight'] = false; }}
            onMouseLeave={() => { keysPressedRef.current['ArrowRight'] = false; }}
            className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded-xl flex justify-center items-center text-white select-none touch-none text-xs font-mono font-bold"
          >
            KANAN
          </button>
        </div>
      )}
    </div>
  );
}

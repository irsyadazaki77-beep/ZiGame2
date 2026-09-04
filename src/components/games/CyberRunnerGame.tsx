import React, { useEffect, useRef, useState } from 'react';
import { audio } from '../../utils/audio';
import { Particle } from '../../types';
import { GameOverlay } from '../gameplay/GameOverlay';
import { MobileControls } from '../gameplay/MobileControls';

interface CyberRunnerGameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

interface RunnerObstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'spike' | 'drone';
  speed: number;
  passed: boolean;
}

interface RunnerCoin {
  x: number;
  y: number;
  radius: number;
  value: number;
  collected: boolean;
}

export default function CyberRunnerGame({ onGameOver, onScoreUpdate, highScore }: CyberRunnerGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  // Game configuration & variables
  const playerRef = useRef({
    x: 50,
    y: 190,
    width: 20,
    height: 35,
    vy: 0,
    gravity: 0.6,
    jumpForce: -10,
    isGrounded: true,
    isDucking: false,
    duckHeight: 20,
    normalHeight: 35,
    doubleJumpAvailable: true,
  });

  const obstaclesRef = useRef<RunnerObstacle[]>([]);
  const coinsRef = useRef<RunnerCoin[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const starfieldRef = useRef<{ x: number; y: number; size: number; speed: number }[]>([]);
  const lastTimeRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(0);
  const obstacleTimerRef = useRef<number>(0);
  const coinTimerRef = useRef<number>(0);
  const speedMultiplierRef = useRef<number>(1);
  const shakeRef = useRef<number>(0);
  const floatingTextsRef = useRef<{ x: number; y: number; text: string; color: string; alpha: number; vy: number }[]>([]);

  const GROUND_Y = 220;
  const CANVAS_WIDTH = 600;
  const CANVAS_HEIGHT = 300;

  // Initialize particles/starfield
  useEffect(() => {
    // Generate initial starfield for parallax background
    const stars = [];
    for (let i = 0; i < 40; i++) {
      stars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * (CANVAS_HEIGHT - 100),
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.5 + 0.1,
      });
    }
    starfieldRef.current = stars;
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

    // Clear Canvas with rich neon dark grid look
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw grid floor lines
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 1;
    for (let i = 0; i < CANVAS_WIDTH; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, GROUND_Y);
      ctx.lineTo(i - 40, CANVAS_HEIGHT);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
    ctx.strokeStyle = '#312e81';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Title / Instructions
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 20px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('CYBER RUNNER', CANVAS_WIDTH / 2, 110);

    ctx.fillStyle = '#6366f1';
    ctx.font = "12px 'JetBrains Mono', monospace";
    ctx.fillText('HINDARI RINTANGAN & KUMPULKAN KOIN NEON', CANVAS_WIDTH / 2, 135);

    ctx.fillStyle = '#71717a';
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.fillText('Tekan PANAH ATAS (Spasi) untuk Lompat, PANAH BAWAH untuk Tunduk', CANVAS_WIDTH / 2, 165);
    ctx.fillText('Mendukung Lompatan Ganda (Double Jump)!', CANVAS_WIDTH / 2, 185);
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

    // Reset Player
    playerRef.current = {
      x: 60,
      y: GROUND_Y - 35,
      width: 20,
      height: 35,
      vy: 0,
      gravity: 0.55,
      jumpForce: -10,
      isGrounded: true,
      isDucking: false,
      duckHeight: 20,
      normalHeight: 35,
      doubleJumpAvailable: true,
    };

    obstaclesRef.current = [];
    coinsRef.current = [];
    particlesRef.current = [];
    speedMultiplierRef.current = 1;
    obstacleTimerRef.current = 0;
    coinTimerRef.current = 0;
    lastTimeRef.current = performance.now();

    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    gameLoopRef.current = requestAnimationFrame(update);
  };

  const createJumpParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 10; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: -Math.random() * 3 - 1,
        color,
        radius: Math.random() * 2 + 1,
        alpha: 1,
        decay: Math.random() * 0.04 + 0.02,
      });
    }
  };

  const handleJump = () => {
    if (!isPlayingRef.current || gameOverRef.current ) return;
    const player = playerRef.current;

    if (player.isGrounded) {
      player.vy = player.jumpForce;
      player.isGrounded = false;
      player.doubleJumpAvailable = true;
      audio.playJump();
      createJumpParticles(player.x + player.width / 2, player.y + player.height, '#f97316');
    } else if (player.doubleJumpAvailable) {
      player.vy = player.jumpForce * 0.85; // Slightly lower double jump
      player.doubleJumpAvailable = false;
      audio.playJump();
      createJumpParticles(player.x + player.width / 2, player.y, '#e11d48');
    }
  };

  const handleDuck = (isDucking: boolean) => {
    if (!isPlayingRef.current || gameOverRef.current ) return;
    const player = playerRef.current;
    
    player.isDucking = isDucking;
    if (isDucking) {
      player.height = player.duckHeight;
      // If grounding, push down slightly
      if (!player.isGrounded) {
        player.vy += 3; // Fast fall
      } else {
        player.y = GROUND_Y - player.duckHeight;
      }
    } else {
      player.height = player.normalHeight;
      if (player.isGrounded) {
        player.y = GROUND_Y - player.normalHeight;
      }
    }
  };

  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        handleJump();
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleDuck(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleDuck(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPlaying, gameOver]);

  // Game engine update & animation
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

    const delta = (timestamp - lastTimeRef.current) / 16.666; // Normalized to ~60fps
    lastTimeRef.current = timestamp;

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

    // Increase game speed scale gradually
    speedMultiplierRef.current += 0.0003 * delta;
    const baseSpeed = 4 * speedMultiplierRef.current;

    // Spawn Obstacles
    obstacleTimerRef.current += delta;
    if (obstacleTimerRef.current > Math.max(50, 100 - speedMultiplierRef.current * 10)) {
      obstacleTimerRef.current = 0;
      const type = Math.random() < 0.4 ? 'drone' : 'spike';
      
      if (type === 'spike') {
        obstaclesRef.current.push({
          x: CANVAS_WIDTH,
          y: GROUND_Y - 22,
          width: 15,
          height: 22,
          type: 'spike',
          speed: baseSpeed,
          passed: false,
        });
      } else {
        // High Flying Drone - Player needs to slide/duck
        obstaclesRef.current.push({
          x: CANVAS_WIDTH,
          y: GROUND_Y - 45,
          width: 22,
          height: 15,
          type: 'drone',
          speed: baseSpeed,
          passed: false,
        });
      }
    }

    // Spawn Coins
    coinTimerRef.current += delta;
    if (coinTimerRef.current > 40) {
      coinTimerRef.current = 0;
      // Spawn standard path coins
      if (Math.random() < 0.6) {
        const coinY = Math.random() < 0.5 ? GROUND_Y - 15 : GROUND_Y - 55;
        coinsRef.current.push({
          x: CANVAS_WIDTH,
          y: coinY,
          radius: 5,
          value: 10,
          collected: false,
        });
      }
    }

    // 1. Clear Screen
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

    // 2. Parallax Starfield Background
    ctx.fillStyle = '#4f46e5';
    starfieldRef.current.forEach(star => {
      star.x -= star.speed * baseSpeed * 0.2 * delta;
      if (star.x < 0) star.x = CANVAS_WIDTH;
      ctx.globalAlpha = star.speed * 1.5;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // Distant neon glowing mountains silhouettes
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(100, GROUND_Y - 60);
    ctx.lineTo(220, GROUND_Y);
    ctx.lineTo(340, GROUND_Y - 40);
    ctx.lineTo(440, GROUND_Y);
    ctx.lineTo(550, GROUND_Y - 70);
    ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
    ctx.closePath();
    ctx.fill();

    // 3. Draw Grid Floor
    ctx.strokeStyle = '#312e81';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
    ctx.stroke();

    // Animate grid stripes moving left
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 1.5;
    const gridOffset = (timestamp * (baseSpeed * 0.2)) % 40;
    for (let x = -gridOffset; x < CANVAS_WIDTH; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x + 20, GROUND_Y);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }

    // 4. Update & Draw Player
    const player = playerRef.current;
    
    // Physics
    if (!player.isGrounded) {
      player.vy += player.gravity * delta;
      player.y += player.vy * delta;

      if (player.y >= GROUND_Y - player.height) {
        player.y = GROUND_Y - player.height;
        player.vy = 0;
        player.isGrounded = true;
        player.doubleJumpAvailable = true;
      }
    }

    // Draw Character trail
    if (Math.random() < 0.4) {
      particlesRef.current.push({
        x: player.x,
        y: player.y + Math.random() * player.height,
        vx: -baseSpeed * 0.5,
        vy: (Math.random() - 0.5) * 2,
        color: player.isDucking ? '#f43f5e' : '#f97316',
        radius: Math.random() * 2 + 1,
        alpha: 0.8,
        decay: 0.05,
      });
    }

    // Draw Player Neon Box
    setShadow(10, player.isDucking ? '#f43f5e' : '#f97316');
    ctx.fillStyle = player.isDucking ? '#f43f5e' : '#f97316';
    ctx.fillRect(player.x, player.y, player.width, player.height);
    setShadow(0, '');

    // Player Eye visor
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(player.x + player.width - 6, player.y + 4, 6, 3);

    // 5. Update & Draw Obstacles
    obstaclesRef.current.forEach((obs, index) => {
      obs.x -= obs.speed * delta;

      // Draw obstacle
      if (obs.type === 'spike') {
        setShadow(12, '#06b6d4');
        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y + obs.height);
        ctx.lineTo(obs.x + obs.width / 2, obs.y);
        ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
        ctx.closePath();
        ctx.fill();
      } else {
        // Drone
        setShadow(12, '#e11d48');
        ctx.fillStyle = '#e11d48';
        // Body
        ctx.fillRect(obs.x, obs.y + 3, obs.width, obs.height - 6);
        // Spinning red wings
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(obs.x - 2, obs.y, 4, 3);
        ctx.fillRect(obs.x + obs.width - 2, obs.y, 4, 3);
      }
      setShadow(0, '');

      // Score increment & point trigger
      if (obs.x + obs.width < player.x && !obs.passed) {
        obs.passed = true;
        shakeRef.current = 4;
        floatingTextsRef.current.push({
          x: player.x + player.width / 2,
          y: player.y - 10,
          text: "+10",
          color: '#06b6d4',
          alpha: 1.0,
          vy: -0.8
        });
        setScore(prev => {
          const next = prev + 10;
          onScoreUpdate(next);
          audio.playScore();
          return next;
        });
      }

      // Collision check
      const collided = (
        player.x < obs.x + obs.width &&
        player.x + player.width > obs.x &&
        player.y < obs.y + obs.height &&
        player.y + player.height > obs.y
      );

      if (collided) {
        audio.playExplosion();
        shakeRef.current = 24;
        floatingTextsRef.current.push({
          x: player.x + player.width / 2,
          y: player.y + player.height / 2,
          text: "WRECKED!!",
          color: '#ef4444',
          alpha: 1.0,
          vy: -1.2
        });
        // Massive debris explosion
        for (let i = 0; i < 30; i++) {
          particlesRef.current.push({
            x: player.x + player.width / 2,
            y: player.y + player.height / 2,
            vx: (Math.random() - 0.5) * 8 - 2,
            vy: (Math.random() - 0.5) * 8 - 3,
            color: i % 2 === 0 ? '#ef4444' : '#f97316',
            radius: Math.random() * 3 + 1,
            alpha: 1.0,
            decay: Math.random() * 0.04 + 0.02
          });
        }
        triggerGameOver();
      }
    });

    // Remove offscreen obstacles
    obstaclesRef.current = obstaclesRef.current.filter(obs => obs.x > -obs.width);

    // 6. Update & Draw Coins
    coinsRef.current.forEach(coin => {
      coin.x -= baseSpeed * delta;

      // Draw glowing gold coin
      setShadow(10, '#fbbf24');
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
      ctx.fill();
      setShadow(0, '');

      // Inside coin detail
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 5px monospace';
      ctx.fillText('$', coin.x - 1.5, coin.y + 2);

      // Collision check with Coin
      const dist = Math.hypot((player.x + player.width / 2) - coin.x, (player.y + player.height / 2) - coin.y);
      if (dist < coin.radius + player.width / 2 && !coin.collected) {
        coin.collected = true;
        audio.playCoin();
        shakeRef.current = 3;
        floatingTextsRef.current.push({
          x: coin.x,
          y: coin.y - 10,
          text: "+25",
          color: '#fbbf24',
          alpha: 1.0,
          vy: -0.8
        });
        
        // Spawn coin particles
        for (let i = 0; i < 8; i++) {
          particlesRef.current.push({
            x: coin.x,
            y: coin.y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            color: '#fbbf24',
            radius: Math.random() * 2 + 1,
            alpha: 1,
            decay: 0.05,
          });
        }

        setScore(prev => {
          const next = prev + 25;
          onScoreUpdate(next);
          return next;
        });
      }
    });

    // Remove collected or offscreen coins
    coinsRef.current = coinsRef.current.filter(c => c.x > -10 && !c.collected);

    // Ground Friction dust for running character
    if (player.isGrounded && Math.random() < 0.25) {
      particlesRef.current.push({
        x: player.x + Math.random() * player.width,
        y: GROUND_Y,
        vx: -baseSpeed * 0.4 - Math.random() * 2,
        vy: -Math.random() * 1.5,
        color: '#6366f1',
        radius: Math.random() * 2 + 1,
        alpha: 0.6,
        decay: 0.05
      });
    }

    // 7. Update & Draw Particles
    particlesRef.current.forEach((p, index) => {
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

    // 8. HUD Info Panel Inside Canvas - Removed for clean overlay rendering
    ctx.restore();

    // Game loops
    gameLoopRef.current = requestAnimationFrame(update);
  };

  const triggerGameOver = () => {
    audio.playGameOver();
    setIsPlaying(false);
    setGameOver(true);
    onGameOver(scoreRef.current);
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
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
          STATUS: <span className="text-white">ONLINE</span>
        </div>
        <div className="text-zinc-400 font-bold uppercase tracking-wider">
          TERBAIK: <span className="text-white">{highScore}</span>
        </div>
        <div className="text-yellow-400 font-bold uppercase tracking-wider">
          SKOR: <span className="text-white">{score}</span>
        </div>
      </div>

      {/* Canvas Wrapper */}
      <div 
        ref={containerRef}
        className="relative flex-1 min-h-0 w-full flex items-center justify-center bg-[#05050c] rounded-xl border border-zinc-800 shadow-[0_0_20px_rgba(0,0,0,0.5)] overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="max-w-full max-h-full object-contain block bg-zinc-950"
        />

        {/* CRT scanlines effect */}
        <div className="pointer-events-none absolute inset-0 bg-scanlines mix-blend-overlay opacity-15"></div>

        {/* Touch tap zones for mobile */}
        {isPlaying && (
          <div className="absolute inset-0 flex">
            <div 
              className="flex-1 h-full cursor-pointer select-none active:bg-white/[0.01] touch-none"
              onTouchStart={(e) => { e.preventDefault(); handleDuck(true); }}
              onTouchEnd={(e) => { e.preventDefault(); handleDuck(false); }}
              onMouseDown={() => { handleDuck(true); }}
              onMouseUp={() => { handleDuck(false); }}
              onMouseLeave={() => { handleDuck(false); }}
            />
            <div 
              className="flex-1 h-full cursor-pointer select-none active:bg-white/[0.01] touch-none"
              onTouchStart={(e) => { e.preventDefault(); handleJump(); }}
              onMouseDown={() => { handleJump(); }}
            />
          </div>
        )}

        <GameOverlay
          gameState={getGameState()}
          score={scoreRef.current}
          onStart={startNewGame}
          onRestart={startNewGame}
          instructions="Hindari drone & paku neon! Tekan LOMPAT/TUNDUK, atau ketuk sisi kiri layar untuk TUNDUK dan sisi kanan layar untuk LOMPAT."
        />
      </div>

      {/* Mobile Controls outside the canvas wrapper so it doesn't overlap */}
      {isPlaying && (
        <div className="flex-none mt-2 w-full">
          <MobileControls
            onLeft={() => handleDuck(true)}
            onLeftRelease={() => handleDuck(false)}
            onRight={handleJump}
            labelLeft="TUNDUK"
            labelRight="LOMPAT"
          />
        </div>
      )}
    </div>
  );
}

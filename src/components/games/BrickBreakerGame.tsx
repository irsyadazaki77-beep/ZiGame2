import React, { useEffect, useRef, useState } from 'react';
import { audio } from '../../utils/audio';
import { Particle } from '../../types';
import { GameOverlay } from '../gameplay/GameOverlay';

interface BrickBreakerProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  points: number;
  hits: number;
  maxHits: number;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  active: boolean;
}

interface PowerUp {
  x: number;
  y: number;
  type: 'expand' | 'multiball' | 'slow' | 'shield';
  w: number;
  h: number;
  color: string;
}

export default function BrickBreakerGame({ onGameOver, onScoreUpdate, highScore }: BrickBreakerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // States
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const gameLoopRef = useRef<number | null>(null);
  const scoreRef = useRef(0);
  const [level, setLevel] = useState(1);
  const levelRef = useRef(1);
  const [lives, setLives] = useState(3);
  const livesRef = useRef(3);
  const [gameOver, setGameOver] = useState(false);
  const isPlayingRef = useRef(false);
  const gameOverRef = useRef(false);


  useEffect(() => {
    isPlayingRef.current = isPlaying;
    gameOverRef.current = gameOver;
    scoreRef.current = score;
    levelRef.current = level;
    livesRef.current = lives;
  }, [isPlaying, gameOver, score, level, lives]);
  const [gameWon, setGameWon] = useState(false);
  const [muted, setMuted] = useState(audio.getMuteState());

  // Game assets / dynamic references
  const paddleRef = useRef<{ x: number; y: number; w: number; h: number; speed: number }>({
    x: 160,
    y: 375,
    w: 80,
    h: 12,
    speed: 8,
  });
  const ballsRef = useRef<Ball[]>([
    { x: 200, y: 300, vx: 3, vy: -3, radius: 6, active: true },
  ]);
  const bricksRef = useRef<Brick[]>([]);
  const powerupsRef = useRef<PowerUp[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const activeKeysRef = useRef<{ [key: string]: boolean }>({});
  const shieldActiveRef = useRef<boolean>(false);
  const shieldTimerRef = useRef<number>(0);
  const shakeRef = useRef<number>(0);
  const floatingTextsRef = useRef<{ x: number; y: number; text: string; color: string; alpha: number; vy: number }[]>([]);
  const trailsRef = useRef<{ x: number; y: number; color: string }[]>([]);
  const shockwavesRef = useRef<{ x: number; y: number; radius: number; maxRadius: number; color: string; alpha: number }[]>([]);
  const comboRef = useRef<number>(0);

  // Initialization & cleanup
  useEffect(() => {
    buildLevel(1);
    drawStatic();
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, []);

  const buildLevel = (lvl: number) => {
    const columns = 8;
    let rows = 4;
    if (lvl === 2) rows = 5;
    if (lvl >= 3) rows = 6;

    const brickWidth = 44;
    const brickHeight = 15;
    const padding = 5;
    const offsetTop = 40;
    const offsetLeft = 7;

    const colors = ['#f43f5e', '#ec4899', '#a855f7', '#6366f1', '#3b82f6', '#06b6d4'];
    const tempBricks: Brick[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const x = c * (brickWidth + padding) + offsetLeft;
        const y = r * (brickHeight + padding) + offsetTop;
        const colorIdx = (r + lvl) % colors.length;
        
        // Multi-hit bricks in higher levels
        const maxHits = lvl > 1 && r === 0 ? 2 : 1;

        tempBricks.push({
          x,
          y,
          w: brickWidth,
          h: brickHeight,
          color: colors[colorIdx],
          points: maxHits * 10,
          hits: 0,
          maxHits,
        });
      }
    }
    bricksRef.current = tempBricks;
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space'].includes(e.code)) {
        e.preventDefault();
        activeKeysRef.current[e.code] = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space'].includes(e.code)) {
        e.preventDefault();
        activeKeysRef.current[e.code] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Frame processing loop
  const gameStep = () => {
    if (!isPlayingRef.current || gameOverRef.current  || gameWon) return;

    updatePaddle();
    updateBalls();
    updatePowerUps();
    updateParticles();
    checkLevelCompletion();

    render();

    gameLoopRef.current = requestAnimationFrame(gameStep);
  };

  const updatePaddle = () => {
    const paddle = paddleRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (activeKeysRef.current['ArrowLeft'] || activeKeysRef.current['KeyA']) {
      paddle.x = Math.max(0, paddle.x - paddle.speed);
    }
    if (activeKeysRef.current['ArrowRight'] || activeKeysRef.current['KeyD']) {
      paddle.x = Math.min(canvas.width - paddle.w, paddle.x + paddle.speed);
    }
  };

  const movePaddleTouch = (dir: 'left' | 'right') => {
    const paddle = paddleRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (dir === 'left') {
      paddle.x = Math.max(0, paddle.x - 22);
    } else {
      paddle.x = Math.min(canvas.width - paddle.w, paddle.x + 22);
    }
  };

  const createParticles = (x: number, y: number, color: string) => {
    const pCount = 10;
    for (let i = 0; i < pCount; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        color,
        radius: Math.random() * 2.5 + 1,
        alpha: 1.0,
        decay: Math.random() * 0.04 + 0.03,
      });
    }
  };

  const updateBalls = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const paddle = paddleRef.current;
    let activeBalls = ballsRef.current.filter(b => b.active);

    if (activeBalls.length === 0) {
      handleLifeLoss();
      return;
    }

    activeBalls.forEach(ball => {
      ball.x += ball.vx;
      ball.y += ball.vy;

      // Pushing to ball trails for motion blur
      trailsRef.current.push({ x: ball.x, y: ball.y, color: '#ec4899' });
      if (trailsRef.current.length > 15) {
        trailsRef.current.shift();
      }

      // Wall Bounce (Horizontal)
      if (ball.x - ball.radius <= 0) {
        ball.x = ball.radius;
        ball.vx = -ball.vx;
        shakeRef.current = 2;
        audio.playHit();
      } else if (ball.x + ball.radius >= canvas.width) {
        ball.x = canvas.width - ball.radius;
        ball.vx = -ball.vx;
        shakeRef.current = 2;
        audio.playHit();
      }

      // Ceiling Bounce
      if (ball.y - ball.radius <= 0) {
        ball.y = ball.radius;
        ball.vy = -ball.vy;
        shakeRef.current = 2;
        audio.playHit();
      }

      // Bottom Wall Collision
      if (ball.y + ball.radius >= canvas.height) {
        if (shieldActiveRef.current) {
          // Bounce off bottom shield
          ball.vy = -ball.vy;
          shieldActiveRef.current = false; // consume shield
          audio.playLevelUp();
          shakeRef.current = 6;
          createParticles(ball.x, canvas.height - 4, '#3b82f6');
        } else {
          ball.active = false; // lose ball
          shakeRef.current = 8;
          return;
        }
      }

      // Paddle Collision
      if (
        ball.y + ball.radius >= paddle.y &&
        ball.y - ball.radius <= paddle.y + paddle.h &&
        ball.x + ball.radius >= paddle.x &&
        ball.x - ball.radius <= paddle.x + paddle.w
      ) {
        audio.playScore();
        shakeRef.current = 3;
        comboRef.current = 0; // Reset combo

        // Redirect angle depending on where ball hits paddle
        const hitPos = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
        const maxAngle = Math.PI / 3; // 60 degrees max
        const angle = hitPos * maxAngle;
        const currentSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);

        ball.vx = currentSpeed * Math.sin(angle);
        ball.vy = -currentSpeed * Math.cos(angle);
        ball.y = paddle.y - ball.radius; // reset to top of paddle
        
        // Safety lock vertical lock
        if (Math.abs(ball.vy) < 1.5) {
          ball.vy = ball.vy < 0 ? -2 : 2;
        }
      }

      // Brick Collision
      const bricks = bricksRef.current;
      for (let i = 0; i < bricks.length; i++) {
        const brick = bricks[i];
        if (
          ball.x + ball.radius >= brick.x &&
          ball.x - ball.radius <= brick.x + brick.w &&
          ball.y + ball.radius >= brick.y &&
          ball.y - ball.radius <= brick.y + brick.h
        ) {
          brick.hits++;
          comboRef.current++; // Increase combo
          createParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, brick.color);
          
          const comboMultiplier = Math.min(5, 1 + (comboRef.current - 1) * 0.5); // Max 5x

          if (brick.hits >= brick.maxHits) {
            audio.playHit();
            shakeRef.current = 7 + (comboRef.current > 2 ? 3 : 0); // Bigger shake for combo
            
            const comboPoints = Math.floor(brick.points * comboMultiplier);
            
            floatingTextsRef.current.push({
              x: brick.x + brick.w / 2,
              y: brick.y,
              text: comboRef.current > 1 ? `+${comboPoints} (${comboRef.current}x)` : `+${comboPoints}`,
              color: comboRef.current > 1 ? '#eab308' : brick.color,
              alpha: 1.0,
              vy: -1.2
            });
            shockwavesRef.current.push({
              x: brick.x + brick.w / 2,
              y: brick.y + brick.h / 2,
              radius: 2,
              maxRadius: 25 + (comboRef.current * 5),
              color: brick.color,
              alpha: 0.8
            });
            // Award score
            setScore(prev => {
              const next = prev + comboPoints;
              onScoreUpdate(next);
              return next;
            });
            // Spawn PowerUp chance (18%)
            if (Math.random() < 0.18) {
              spawnPowerUp(brick.x + brick.w / 2, brick.y + brick.h);
            }
            bricks.splice(i, 1);
          } else {
            audio.playScore();
            shakeRef.current = 4;
            floatingTextsRef.current.push({
              x: brick.x + brick.w / 2,
              y: brick.y,
              text: "HIT!",
              color: '#ffffff',
              alpha: 0.8,
              vy: -0.6
            });
          }

          // Bounce ball
          ball.vy = -ball.vy;
          break; // break to avoid multiple brick hits at once
        }
      }
    });

    // Check lives & ball count again
    const surviving = activeBalls.filter(b => b.active);
    ballsRef.current = surviving;
    if (surviving.length === 0) {
      handleLifeLoss();
    }
  };

  const spawnPowerUp = (x: number, y: number) => {
    const types: PowerUp['type'][] = ['expand', 'multiball', 'slow', 'shield'];
    const type = types[Math.floor(Math.random() * types.length)];
    const colors = {
      expand: '#ec4899', // pink
      multiball: '#eab308', // yellow
      slow: '#a855f7', // purple
      shield: '#3b82f6', // blue
    };

    powerupsRef.current.push({
      x,
      y,
      type,
      w: 16,
      h: 16,
      color: colors[type],
    });
  };

  const updatePowerUps = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const paddle = paddleRef.current;
    const powerups = powerupsRef.current;

    for (let i = powerups.length - 1; i >= 0; i--) {
      const pu = powerups[i];
      pu.y += 2.5; // slow drift down

      // Check boundary
      if (pu.y > canvas.height) {
        powerups.splice(i, 1);
        continue;
      }

      // Check Paddle collision
      if (
        pu.y + pu.h >= paddle.y &&
        pu.y <= paddle.y + paddle.h &&
        pu.x + pu.w >= paddle.x &&
        pu.x <= paddle.x + paddle.w
      ) {
        audio.playLevelUp();
        applyPowerUp(pu.type);
        powerups.splice(i, 1);
      }
    }
  };

  const applyPowerUp = (type: PowerUp['type']) => {
    const paddle = paddleRef.current;

    if (type === 'expand') {
      paddle.w = 120; // make wide
      setTimeout(() => {
        paddle.w = 80; // revert
      }, 10000);
    } 
    else if (type === 'multiball') {
      // Add 2 extra balls
      const baseBall = ballsRef.current[0] || { x: 200, y: 300, vx: 3, vy: -3, radius: 6, active: true };
      ballsRef.current.push(
        { x: baseBall.x, y: baseBall.y, vx: baseBall.vx + 1.5, vy: -Math.abs(baseBall.vy), radius: 6, active: true },
        { x: baseBall.x, y: baseBall.y, vx: baseBall.vx - 1.5, vy: -Math.abs(baseBall.vy), radius: 6, active: true }
      );
    } 
    else if (type === 'slow') {
      ballsRef.current.forEach(b => {
        b.vx *= 0.65;
        b.vy *= 0.65;
      });
      setTimeout(() => {
        ballsRef.current.forEach(b => {
          b.vx /= 0.65;
          b.vy /= 0.65;
        });
      }, 8000);
    } 
    else if (type === 'shield') {
      shieldActiveRef.current = true;
      shieldTimerRef.current = 15000; // 15 seconds shield
    }
  };

  const updateParticles = () => {
    particlesRef.current = particlesRef.current
      .map(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        return p;
      })
      .filter(p => p.alpha > 0);

    floatingTextsRef.current = floatingTextsRef.current
      .map(t => {
        t.y += t.vy;
        t.alpha -= 0.025;
        return t;
      })
      .filter(t => t.alpha > 0);

    shockwavesRef.current = shockwavesRef.current
      .map(s => {
        s.radius += 1.8;
        s.alpha -= 0.04;
        return s;
      })
      .filter(s => s.alpha > 0);
  };

  const checkLevelCompletion = () => {
    if (bricksRef.current.length === 0) {
      if (levelRef.current < 3) {
        audio.playLevelUp();
        const nextLevel = levelRef.current + 1;
        setLevel(nextLevel);
        buildLevel(nextLevel);
        resetBallAndPaddle();
      } else {
        setIsPlaying(false);
        setGameWon(true);
        audio.playLevelUp();
        onGameOver(score + 100); // 100 bonus for beating all levels
      }
    }
  };

  const handleLifeLoss = () => {
    audio.playHit();
    const nextLives = livesRef.current - 1;
    setLives(nextLives);
    
    if (nextLives <= 0) {
      setIsPlaying(false);
      setGameOver(true);
      audio.playGameOver();
      onGameOver(scoreRef.current);
    } else {
      resetBallAndPaddle();
    }
  };

  const resetBallAndPaddle = () => {
    paddleRef.current = {
      x: 160,
      y: 375,
      w: 80,
      h: 12,
      speed: 8,
    };
    ballsRef.current = [
      { x: 200, y: 300, vx: 3, vy: -3, radius: 6, active: true },
    ];
    powerupsRef.current = [];
    shieldActiveRef.current = false;
  };

  const startGame = () => {
    audio.playCoin();
    setScore(0);
    setLevel(1);
    setLives(3);
    setGameOver(false);
    setGameWon(false);
    resetBallAndPaddle();
    buildLevel(1);
    
    // Explicitly update ref states to guarantee synchronous start
    isPlayingRef.current = true;
    gameOverRef.current = false;
    
    setIsPlaying(true);

    // Run animator loop
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    gameLoopRef.current = requestAnimationFrame(gameStep);
  };

;

  const toggleSound = () => {
    audio.toggleMute();
    setMuted(audio.getMuteState());
  };

  // Canvas Drawing
  const drawStatic = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ec4899';
    ctx.font = '14px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ec4899';
    ctx.fillText('TEKAN MULAI UNTUK MAIN', canvas.width / 2, canvas.height / 2);
    ctx.shadowBlur = 0;
  };

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    if (shakeRef.current > 0) {
      const dx = (Math.random() - 0.5) * shakeRef.current;
      const dy = (Math.random() - 0.5) * shakeRef.current;
      ctx.translate(dx, dy);
      shakeRef.current *= 0.85;
      if (shakeRef.current < 0.5) shakeRef.current = 0;
    }

    // Background
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Decorative side glow
    ctx.strokeStyle = 'rgba(236, 72, 153, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    // Draw bottom shield if active
    if (shieldActiveRef.current) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#3b82f6';
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height - 2);
      ctx.lineTo(canvas.width, canvas.height - 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Draw bricks
    bricksRef.current.forEach(brick => {
      ctx.fillStyle = brick.color;
      ctx.shadowBlur = 4;
      ctx.shadowColor = brick.color;
      ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
      
      // Highlight borders for pixel feel
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(brick.x, brick.y, brick.w, brick.h);

      // Hit cracks on multi-hits
      if (brick.hits > 0) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.moveTo(brick.x + 5, brick.y + 2);
        ctx.lineTo(brick.x + brick.w - 5, brick.y + brick.h - 2);
        ctx.stroke();
      }
    });

    // Draw Paddle
    const paddle = paddleRef.current;
    ctx.fillStyle = '#ec4899';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ec4899';
    ctx.beginPath();
    // Rounded paddle
    ctx.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 6);
    ctx.fill();

    // Draw active balls
    ballsRef.current.forEach(ball => {
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ffffff';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw PowerUps
    powerupsRef.current.forEach(pu => {
      ctx.fillStyle = pu.color;
      ctx.shadowBlur = 12;
      ctx.shadowColor = pu.color;
      ctx.beginPath();
      // Retro falling gem style (diamond)
      ctx.moveTo(pu.x + pu.w / 2, pu.y);
      ctx.lineTo(pu.x + pu.w, pu.y + pu.h / 2);
      ctx.lineTo(pu.x + pu.w / 2, pu.y + pu.h);
      ctx.lineTo(pu.x, pu.y + pu.h / 2);
      ctx.closePath();
      ctx.fill();

      // Text icon in center of power-up
      ctx.fillStyle = '#000';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let sym = 'P';
      if (pu.type === 'expand') sym = '+';
      if (pu.type === 'multiball') sym = '3';
      if (pu.type === 'slow') sym = 'S';
      if (pu.type === 'shield') sym = 'Ω';
      ctx.fillText(sym, pu.x + pu.w / 2, pu.y + pu.h / 2 + 0.5);
    });

    // Draw ball trails for glowing speed effect
    ctx.shadowBlur = 0;
    trailsRef.current.forEach((t, index) => {
      const alpha = (index / trailsRef.current.length) * 0.35;
      ctx.fillStyle = t.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // Draw shockwaves
    shockwavesRef.current.forEach(s => {
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = s.alpha;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.globalAlpha = 1.0;

    // Particles
    particlesRef.current.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // Draw floating texts
    floatingTextsRef.current.forEach(t => {
      ctx.fillStyle = t.color;
      ctx.globalAlpha = t.alpha;
      ctx.font = 'bold 9px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);
    });
    ctx.globalAlpha = 1.0;

    ctx.restore();
  };

  const getGameState = () => {
    if (gameWon) return 'gameover'; // Uses the same game over overlay but we could customize it if we want
    if (!isPlaying && !gameOver && !gameWon) return 'ready';
    if (!isPlaying) return 'gameover';
    return 'playing';
  };

  return (
    <div className="relative flex flex-col h-full w-full min-h-0 items-center justify-center overflow-hidden p-2 bg-[#090b10]">
      {/* Clean HUD Bar */}
      <div className="w-full flex-none flex justify-between items-center mb-2 px-3 text-xs">
        <div className="text-zinc-400 font-medium">
          Level: <span className="text-indigo-400 font-semibold">{level}</span>
        </div>
        <div className="text-zinc-400 font-medium">
          Nyawa: <span className="text-rose-400 font-semibold">{'❤️'.repeat(Math.max(0, lives))}</span>
        </div>
        <div className="text-zinc-400 font-medium">
          Skor: <span className="text-white font-bold">{score}</span>
        </div>
      </div>

      {/* Canvas Wrapper */}
      <div className="relative flex-1 min-h-0 w-full flex items-center justify-center bg-[#090b10] rounded-2xl border border-white/[0.08] shadow-inner overflow-hidden">
        <canvas
          ref={canvasRef}
          width={400}
          height={400}
          className="max-w-full max-h-full object-contain"
        />
        
        <GameOverlay
          gameState={getGameState()}
          score={scoreRef.current}
          highScore={highScore}
          onStart={startGame}
          onRestart={startGame}
          instructions="Pantulkan bola menggunakan papan untuk menghancurkan barisan balok. Tangkap permata kekuatan yang jatuh!"
        />

        {/* Interactive touch zones on canvas sides for mobile controls */}
        {isPlaying && (
          <div className="absolute inset-0 flex">
            <div 
              className="flex-1 h-full cursor-pointer select-none active:bg-white/[0.01] touch-none"
              onTouchStart={(e) => { e.preventDefault(); activeKeysRef.current['ArrowLeft'] = true; }}
              onTouchEnd={(e) => { e.preventDefault(); activeKeysRef.current['ArrowLeft'] = false; }}
              onMouseDown={() => { activeKeysRef.current['ArrowLeft'] = true; }}
              onMouseUp={() => { activeKeysRef.current['ArrowLeft'] = false; }}
              onMouseLeave={() => { activeKeysRef.current['ArrowLeft'] = false; }}
            />
            <div 
              className="flex-1 h-full cursor-pointer select-none active:bg-white/[0.01] touch-none"
              onTouchStart={(e) => { e.preventDefault(); activeKeysRef.current['ArrowRight'] = true; }}
              onTouchEnd={(e) => { e.preventDefault(); activeKeysRef.current['ArrowRight'] = false; }}
              onMouseDown={() => { activeKeysRef.current['ArrowRight'] = true; }}
              onMouseUp={() => { activeKeysRef.current['ArrowRight'] = false; }}
              onMouseLeave={() => { activeKeysRef.current['ArrowRight'] = false; }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { audio } from '../../utils/audio';
import { GameContainer } from '../gameplay/GameContainer';
import { GameHUD } from '../gameplay/GameHUD';
import { GameOverlay } from '../gameplay/GameOverlay';

interface GameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

interface Obstacle {
  id: string;
  x: number;
  width: number;
  height: number;
  type: 'cactus' | 'drone';
}

export default function PixelDinoGame({ onGameOver, onScoreUpdate, highScore }: GameProps) {
  const gameLoopRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPlayingRef = useRef(false);
  const scoreRef = useRef(0);

  // Physics state
  const dinoY = useRef(0);
  const dinoVelY = useRef(0);
  const isDucking = useRef(false);
  const isGrounded = useRef(true);
  const obstacles = useRef<Obstacle[]>([]);
  const gameSpeed = useRef(4);
  const frameCount = useRef(0);
  const shakeRef = useRef(0);
  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number; color: string; radius: number; alpha: number; decay: number }[]>([]);
  const floatingTextsRef = useRef<{ x: number; y: number; text: string; color: string; alpha: number; vy: number }[]>([]);

  // Game dimensions
  const width = 450;
  const height = 180;
  const gravity = 0.5;
  const groundY = 145;
  const dinoHeight = 30;
  const dinoWidth = 24;

  useEffect(() => {
    scoreRef.current = score;
    onScoreUpdate(score);
  }, [score, onScoreUpdate]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const startNewGame = () => {
    audio.playCoin();
    setScore(0);
    dinoY.current = groundY - dinoHeight;
    dinoVelY.current = 0;
    isDucking.current = false;
    isGrounded.current = true;
    obstacles.current = [];
    gameSpeed.current = 4;
    frameCount.current = 0;
    setIsPlaying(true);
  };

  const jump = () => {
    if (!isPlaying) return;
    if (isGrounded.current && !isDucking.current) {
      audio.playJump();
      dinoVelY.current = -8.5; // Jump strength
      isGrounded.current = false;
    }
  };

  const duck = (ducking: boolean) => {
    if (!isPlaying) return;
    if (isGrounded.current) {
      isDucking.current = ducking;
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying) return;
      if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        jump();
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        duck(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!isPlaying) return;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        duck(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPlaying]);

  // Main game tick (60fps animation)
  useEffect(() => {
    let animId: number;

    if (isPlaying) {
      const render = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Save context and apply screen shake
        ctx.save();
        if (shakeRef.current > 0) {
          const dx = (Math.random() - 0.5) * shakeRef.current;
          const dy = (Math.random() - 0.5) * shakeRef.current;
          ctx.translate(dx, dy);
          shakeRef.current *= 0.85;
          if (shakeRef.current < 0.5) shakeRef.current = 0;
        }

        // Clear canvas
        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, 0, width, height);

        // Grid scan lines
        ctx.fillStyle = '#18181b';
        ctx.fillRect(0, groundY, width, 2);

        frameCount.current += 1;
        // Increase score steadily
        if (frameCount.current % 5 === 0) {
          setScore(prev => {
            const next = prev + 1;
            // Gradually speed up
            if (next % 100 === 0) {
              gameSpeed.current += 0.5;
              audio.playLevelUp();
              shakeRef.current = 8;
              floatingTextsRef.current.push({
                x: width / 2,
                y: height / 2 - 20,
                text: "SPEED UP!",
                color: '#eab308',
                alpha: 1.0,
                vy: -0.8
              });
            }
            return next;
          });
        }

        // Dino running ground smoke sparks
        if (isGrounded.current && frameCount.current % 8 === 0) {
          particlesRef.current.push({
            x: 40 + 2,
            y: groundY,
            vx: -gameSpeed.current * 0.3 - Math.random() * 1.5,
            vy: -Math.random() * 1.0,
            color: '#22c55e',
            radius: Math.random() * 2 + 1,
            alpha: 0.6,
            decay: 0.05
          });
        }

        // 1. Spawning Obstacles
        if (frameCount.current % 120 === 0 || (frameCount.current % 75 === 0 && Math.random() > 0.7)) {
          const type = Math.random() > 0.4 ? 'cactus' : 'drone';
          const obsHeight = type === 'cactus' ? (Math.random() * 15 + 20) : 18;
          const obsWidth = type === 'cactus' ? 14 : 20;
          const obsY = type === 'cactus' ? groundY - obsHeight : groundY - 55; // flying high

          obstacles.current.push({
            id: `${Date.now()}-${Math.random()}`,
            x: width,
            width: obsWidth,
            height: obsHeight,
            type,
          });
        }

        // 2. Update Dino Physics
        if (!isGrounded.current) {
          dinoVelY.current += gravity;
          dinoY.current += dinoVelY.current;

          // Ground check
          if (dinoY.current >= groundY - dinoHeight) {
            dinoY.current = groundY - dinoHeight;
            dinoVelY.current = 0;
            isGrounded.current = true;
          }
        }

        // 3. Render Dino (Green Neon)
        const currentDinoHeight = isDucking.current ? dinoHeight / 1.6 : dinoHeight;
        const currentDinoY = isDucking.current ? groundY - currentDinoHeight : dinoY.current;

        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(40, currentDinoY, dinoWidth, currentDinoHeight);
        
        // Draw eyes
        ctx.fillStyle = '#000000';
        ctx.fillRect(52, currentDinoY + 5, 3, 3);
        ctx.shadowBlur = 0; // reset

        // 4. Update & Render Obstacles (Red Neon)
        const currentObstacles = [...obstacles.current];
        const nextObstacles: Obstacle[] = [];

        for (const obs of currentObstacles) {
          obs.x -= gameSpeed.current;

          // Draw obstacle
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 8;
          ctx.fillStyle = '#ef4444';
          
          const yPos = obs.type === 'cactus' ? groundY - obs.height : groundY - 48;
          ctx.fillRect(obs.x, yPos, obs.width, obs.height);
          
          ctx.shadowBlur = 0; // reset

          // Collision check
          const dinoLeft = 40;
          const dinoRight = 40 + dinoWidth;
          const dinoTop = currentDinoY;
          const dinoBottom = groundY;

          const obsLeft = obs.x;
          const obsRight = obs.x + obs.width;
          const obsTop = yPos;
          const obsBottom = yPos + obs.height;

          const isColliding = (
            dinoRight > obsLeft &&
            dinoLeft < obsRight &&
            dinoBottom > obsTop &&
            dinoTop < obsBottom
          );

          if (isColliding) {
            audio.playExplosion();
            shakeRef.current = 24;
            
            // Create debris explosion particles on crash
            for (let i = 0; i < 20; i++) {
              particlesRef.current.push({
                x: 40 + dinoWidth / 2,
                y: currentDinoY + currentDinoHeight / 2,
                vx: (Math.random() - 0.5) * 8 - 1,
                vy: (Math.random() - 0.5) * 8 - 2,
                color: i % 2 === 0 ? '#22c55e' : '#ef4444',
                radius: Math.random() * 2.5 + 1,
                alpha: 1.0,
                decay: Math.random() * 0.05 + 0.02
              });
            }

            floatingTextsRef.current.push({
              x: 40 + dinoWidth / 2,
              y: currentDinoY - 10,
              text: "CRASH!!",
              color: '#ef4444',
              alpha: 1.0,
              vy: -1.0
            });

            // Draw a final frame with particles and text before ending
            // Render particles
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

            // Render floating texts
            floatingTextsRef.current.forEach(t => {
              t.y += t.vy;
              t.alpha -= 0.025;
              ctx.fillStyle = t.color;
              ctx.globalAlpha = Math.max(0, t.alpha);
              ctx.font = 'bold 9px "Press Start 2P", monospace';
              ctx.textAlign = 'center';
              ctx.fillText(t.text, t.x, t.y);
            });
            ctx.globalAlpha = 1.0;

            ctx.restore();
            endGame();
            return;
          }

          if (obs.x + obs.width > 0) {
            nextObstacles.push(obs);
          }
        }
        obstacles.current = nextObstacles;

        // Update & Render standard particles
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

        // Update & Render floating texts
        floatingTextsRef.current.forEach(t => {
          t.y += t.vy;
          t.alpha -= 0.025;

          ctx.fillStyle = t.color;
          ctx.globalAlpha = Math.max(0, t.alpha);
          ctx.font = 'bold 9px "Press Start 2P", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(t.text, t.x, t.y);
        });
        ctx.globalAlpha = 1.0;
        floatingTextsRef.current = floatingTextsRef.current.filter(t => t.alpha > 0);

        ctx.restore();

        if (isPlayingRef.current) {
          animId = requestAnimationFrame(render);
        }
      };

      animId = requestAnimationFrame(render);
    }

    return () => cancelAnimationFrame(animId);
  }, [isPlaying]);

  const endGame = () => {
    setIsPlaying(false);
    audio.playGameOver();
    onGameOver(scoreRef.current);
  };

  const getGameState = () => {
    if (!isPlaying && score === 0) return 'ready';
    if (!isPlaying) return 'gameover';
    return 'playing';
  };

  return (
    <GameContainer aspect="video" maxWidth="md">
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
        instructions="Hindari palang pertahanan merah yang bergerak cepat! Gunakan panah Atas/Bawah atau tombol untuk melompat/tunduk."
      />

      <div className="w-full aspect-video border-4 border-zinc-800 bg-zinc-950 rounded-2xl overflow-hidden shadow-2xl relative">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full h-full block"
        />
      </div>

      {isPlaying && (
        <div className="mt-4 flex gap-4 w-full md:hidden">
          <button
            onTouchStart={(e) => { e.preventDefault(); jump(); }}
            onClick={jump}
            className="flex-1 py-4 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded-xl text-white font-bold select-none touch-none"
          >
            ⬆️ LOMPAT
          </button>
          <button
            onTouchStart={(e) => { e.preventDefault(); duck(true); }}
            onTouchEnd={(e) => { e.preventDefault(); duck(false); }}
            onMouseDown={() => duck(true)}
            onMouseUp={() => duck(false)}
            className="flex-1 py-4 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded-xl text-white font-bold select-none touch-none"
          >
            ⬇️ TUNDUK
          </button>
        </div>
      )}
    </GameContainer>
  );
}

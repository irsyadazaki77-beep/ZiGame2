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

interface Vector2D {
  x: number;
  y: number;
}

export default function PixelGolfGame({ onGameOver, onScoreUpdate, highScore }: GameProps) {
  const gameLoopRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [strokes, setStrokes] = useState(0);
  const [level, setLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(60);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPlayingRef = useRef(false);
  const scoreRef = useRef(0);

  // Physics state
  const ballPos = useRef<Vector2D>({ x: 50, y: 150 });
  const ballVel = useRef<Vector2D>({ x: 0, y: 0 });
  const holePos = useRef<Vector2D>({ x: 250, y: 150 });
  const isDragging = useRef(false);
  const dragStart = useRef<Vector2D>({ x: 0, y: 0 });
  const dragCurrent = useRef<Vector2D>({ x: 0, y: 0 });

  // Canvas bounds
  const width = 300;
  const height = 300;
  const ballRadius = 8;
  const holeRadius = 15;

  useEffect(() => {
    scoreRef.current = score;
    onScoreUpdate(score);
  }, [score, onScoreUpdate]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const initLevel = (lvl: number) => {
    // Spawn hole in a random position away from start
    ballPos.current = { x: 50, y: 150 };
    ballVel.current = { x: 0, y: 0 };
    
    // Choose hole position on the right side
    holePos.current = {
      x: 220 + Math.random() * 50,
      y: 50 + Math.random() * 200,
    };
  };

  const startNewGame = () => {
    audio.playCoin();
    setScore(0);
    setStrokes(0);
    setLevel(1);
    setTimeLeft(60);
    initLevel(1);
    setIsPlaying(true);
  };

  const endGame = () => {
    setIsPlaying(false);
    audio.playGameOver();
    onGameOver(scoreRef.current);
  };

  // Drag interaction
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPlaying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Check if clicked near ball
    const dist = Math.hypot(clickX - ballPos.current.x, clickY - ballPos.current.y);
    if (dist < 30 && Math.hypot(ballVel.current.x, ballVel.current.y) < 0.2) {
      isDragging.current = true;
      dragStart.current = { x: ballPos.current.x, y: ballPos.current.y };
      dragCurrent.current = { x: clickX, y: clickY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    dragCurrent.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    // Launch ball! (Velocity proportional to reverse drag length)
    const dx = dragStart.current.x - dragCurrent.current.x;
    const dy = dragStart.current.y - dragCurrent.current.y;
    
    ballVel.current = {
      x: dx * 0.15,
      y: dy * 0.15,
    };

    audio.playJump();
    setStrokes(prev => prev + 1);
  };

  // Support mobile touch gestures as well
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isPlaying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const clickX = touch.clientX - rect.left;
    const clickY = touch.clientY - rect.top;

    const dist = Math.hypot(clickX - ballPos.current.x, clickY - ballPos.current.y);
    if (dist < 40 && Math.hypot(ballVel.current.x, ballVel.current.y) < 0.2) {
      isDragging.current = true;
      dragStart.current = { x: ballPos.current.x, y: ballPos.current.y };
      dragCurrent.current = { x: clickX, y: clickY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDragging.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    dragCurrent.current = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  };

  // Game physical logic loops (60fps)
  useEffect(() => {
    let animId: number;
    let timerId: NodeJS.Timeout;

    if (isPlaying) {
      // Countdown Timer
      timerId = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            endGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Rendering & Physics Updates
      const render = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear
        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, 0, width, height);

        // Grid Lines
        ctx.strokeStyle = '#18181b';
        ctx.lineWidth = 1;
        for (let i = 0; i < width; i += 30) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i, height);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, i);
          ctx.lineTo(width, i);
          ctx.stroke();
        }

        // Draw hole (Target Cup)
        const gradient = ctx.createRadialGradient(
          holePos.current.x, holePos.current.y, 2,
          holePos.current.x, holePos.current.y, holeRadius
        );
        gradient.addColorStop(0, '#a855f7');
        gradient.addColorStop(1, '#000000');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(holePos.current.x, holePos.current.y, holeRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Update Ball Physics
        const ball = ballPos.current;
        const vel = ballVel.current;

        ball.x += vel.x;
        ball.y += vel.y;

        // Apply friction
        vel.x *= 0.98;
        vel.y *= 0.98;

        // Bounce walls
        if (ball.x - ballRadius < 0) {
          ball.x = ballRadius;
          vel.x *= -0.8;
          audio.playHit();
        } else if (ball.x + ballRadius > width) {
          ball.x = width - ballRadius;
          vel.x *= -0.8;
          audio.playHit();
        }

        if (ball.y - ballRadius < 0) {
          ball.y = ballRadius;
          vel.y *= -0.8;
          audio.playHit();
        } else if (ball.y + ballRadius > height) {
          ball.y = height - ballRadius;
          vel.y *= -0.8;
          audio.playHit();
        }

        // Check if ball fell into hole
        const distToHole = Math.hypot(ball.x - holePos.current.x, ball.y - holePos.current.y);
        if (distToHole < holeRadius - 2) {
          // Success!
          audio.playLevelUp();
          const pointsEarned = Math.max(150 - strokes * 20, 50);
          setScore(prev => prev + pointsEarned);
          setStrokes(0);
          setLevel(l => l + 1);
          setTimeLeft(t => Math.min(t + 8, 60)); // extra time
          initLevel(level + 1);
        }

        // Slingshot guide lines
        if (isDragging.current) {
          ctx.beginPath();
          ctx.moveTo(dragStart.current.x, dragStart.current.y);
          // Reverse guide vector
          const gx = dragStart.current.x + (dragStart.current.x - dragCurrent.current.x);
          const gy = dragStart.current.y + (dragStart.current.y - dragCurrent.current.y);
          ctx.lineTo(gx, gy);
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = 3;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Drag center pull line
          ctx.beginPath();
          ctx.moveTo(dragStart.current.x, dragStart.current.y);
          ctx.lineTo(dragCurrent.current.x, dragCurrent.current.y);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Draw Ball
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // reset

        // Next frame
        if (isPlayingRef.current) {
          animId = requestAnimationFrame(render);
        }
      };

      animId = requestAnimationFrame(render);
    }

    return () => {
      cancelAnimationFrame(animId);
      if (timerId) clearInterval(timerId);
    };
  }, [isPlaying, level]);

  const getGameState = () => {
    if (!isPlaying && score === 0 && strokes === 0) return 'ready';
    if (!isPlaying) return 'gameover';
    return 'playing';
  };

  return (
    <GameContainer aspect="square" maxWidth="sm">
      {isPlaying && (
        <GameHUD 
          stats={[
            { id: 'score', label: 'SKOR', value: score, emphasized: true },
            { id: 'strokes', label: 'PUKULAN', value: strokes },
            { id: 'time', label: 'WAKTU', value: timeLeft }
          ]} 
        />
      )}

      <GameOverlay
        gameState={getGameState()}
        score={score}
        onStart={startNewGame}
        onRestart={startNewGame}
        instructions="Tarik dan lepaskan bola untuk memasukkannya ke lubang. Pantulkan di dinding jika perlu!"
      />

      <div className="w-full aspect-square border-4 border-zinc-800 bg-zinc-950 rounded-2xl overflow-hidden shadow-2xl relative">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUp}
          className="w-full h-full block bg-zinc-950 cursor-crosshair touch-none"
        />
      </div>
    </GameContainer>
  );
}

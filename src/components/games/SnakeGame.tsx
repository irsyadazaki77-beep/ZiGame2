import React, { useState, useEffect, useRef, useCallback } from 'react';
import { audio } from '../../utils/audio';
import { GameOverlay } from '../gameplay/GameOverlay';
import { MobileControls } from '../gameplay/MobileControls';
import { useGameEngine } from '../../hooks/useGameEngine';

interface SnakeGameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

type Point = { x: number; y: number };

const GRID_SIZE = 20;
const INITIAL_SNAKE = [
  { x: 10, y: 10 },
  { x: 10, y: 11 },
  { x: 10, y: 12 },
];
const INITIAL_DIRECTION = { x: 0, y: -1 };
const BASE_SPEED = 150; // ms per move

export default function SnakeGame({ onGameOver, onScoreUpdate, highScore }: SnakeGameProps) {
  const {
    gameState,
    setGameState,
    gameStateRef,
    score,
    updateScore,
    triggerGameOver,
    startWithCountdown,
    startLoop,
    stopLoop,
  } = useGameEngine({ onScoreUpdate, onGameOver });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snakeRef = useRef<Point[]>(INITIAL_SNAKE);
  const directionRef = useRef<Point>(INITIAL_DIRECTION);
  const nextDirectionRef = useRef<Point>(INITIAL_DIRECTION);
  const foodRef = useRef<Point>({ x: 5, y: 5 });
  
  const moveTimerRef = useRef<number>(0);
  const scoreRef = useRef<number>(0);

  const generateFood = useCallback((currentSnake: Point[]) => {
    let newFood: Point;
    let isOccupied = true;
    while (isOccupied) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      // eslint-disable-next-line no-loop-func
      isOccupied = currentSnake.some(segment => segment.x === newFood.x && segment.y === newFood.y);
    }
    return newFood!;
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cellSize = canvas.width / GRID_SIZE;

    // Draw Grid (optional, for cyber look)
    ctx.strokeStyle = '#18181b'; // zinc-900
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(canvas.width, i * cellSize);
      ctx.stroke();
    }

    // Draw Food
    const cx = foodRef.current.x * cellSize + cellSize / 2;
    const cy = foodRef.current.y * cellSize + cellSize / 2;
    const radius = cellSize / 2.5;
    
    // Food Glow
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#f43f5e';
    ctx.fillStyle = '#f43f5e'; // rose-500
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Food core
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff1f2'; // rose-50
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Draw Snake
    snakeRef.current.forEach((segment, index) => {
      const isHead = index === 0;
      const x = segment.x * cellSize + 2;
      const y = segment.y * cellSize + 2;
      const w = cellSize - 4;
      const h = cellSize - 4;

      if (isHead) {
        ctx.fillStyle = '#a3e635'; // lime-400
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#a3e635';
      } else {
        // Gradient for body based on position
        const opacity = Math.max(0.3, 1 - (index / snakeRef.current.length));
        ctx.fillStyle = `rgba(101, 163, 13, ${opacity})`; // lime-600 with opacity
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#65a30d';
      }
      
      // Draw rounded rectangle for snake segments
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, isHead ? 6 : 4);
      ctx.fill();

      // Draw eyes for head
      if (isHead) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#000000';
        
        // Determine eye positions based on direction
        let eye1X, eye1Y, eye2X, eye2Y;
        const dir = directionRef.current;
        
        if (dir.x === 1) { // Right
          eye1X = x + w - 4; eye1Y = y + 4;
          eye2X = x + w - 4; eye2Y = y + h - 6;
        } else if (dir.x === -1) { // Left
          eye1X = x + 4; eye1Y = y + 4;
          eye2X = x + 4; eye2Y = y + h - 6;
        } else if (dir.y === -1) { // Up
          eye1X = x + 4; eye1Y = y + 4;
          eye2X = x + w - 6; eye2Y = y + 4;
        } else { // Down
          eye1X = x + 4; eye1Y = y + h - 6;
          eye2X = x + w - 6; eye2Y = y + h - 6;
        }

        ctx.fillRect(eye1X, eye1Y, 3, 3);
        ctx.fillRect(eye2X, eye2Y, 3, 3);
      }
    });
  }, []);

  const updateGameLogic = useCallback(() => {
    const head = snakeRef.current[0];
    directionRef.current = nextDirectionRef.current;
    const newHead = {
      x: head.x + directionRef.current.x,
      y: head.y + directionRef.current.y,
    };

    // Wall collision
    if (
      newHead.x < 0 ||
      newHead.x >= GRID_SIZE ||
      newHead.y < 0 ||
      newHead.y >= GRID_SIZE
    ) {
      audio.playExplosion();
      triggerGameOver();
      return;
    }

    // Self collision
    if (snakeRef.current.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
      audio.playExplosion();
      triggerGameOver();
      return;
    }

    const newSnake = [newHead, ...snakeRef.current];

    // Food collision
    if (newHead.x === foodRef.current.x && newHead.y === foodRef.current.y) {
      audio.playCoin();
      foodRef.current = generateFood(newSnake);
      const newScore = scoreRef.current + 10;
      scoreRef.current = newScore;
      updateScore(newScore);
    } else {
      newSnake.pop();
    }

    snakeRef.current = newSnake;
  }, [generateFood, triggerGameOver, updateScore]);

  const gameStep = useCallback((timestamp: number, deltaTime: number) => {
    moveTimerRef.current += deltaTime;

    // Speed increases slightly as score goes up
    const currentSpeed = Math.max(50, BASE_SPEED - (scoreRef.current * 2));

    if (moveTimerRef.current >= currentSpeed) {
      moveTimerRef.current = 0;
      updateGameLogic();
    }

    draw();
  }, [draw, updateGameLogic]);

  const resetGame = useCallback(() => {
    snakeRef.current = [...INITIAL_SNAKE];
    directionRef.current = { ...INITIAL_DIRECTION };
    nextDirectionRef.current = { ...INITIAL_DIRECTION };
    foodRef.current = generateFood(snakeRef.current);
    scoreRef.current = 0;
    updateScore(0);
    draw();
  }, [draw, generateFood, updateScore]);

  const startGame = useCallback(() => {
    resetGame();
    startWithCountdown(() => {
      startLoop(gameStep);
    });
  }, [resetGame, startWithCountdown, startLoop, gameStep]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStateRef.current !== 'playing') return;
      
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (directionRef.current.y !== 1) nextDirectionRef.current = { x: 0, y: -1 };
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (directionRef.current.y !== -1) nextDirectionRef.current = { x: 0, y: 1 };
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (directionRef.current.x !== 1) nextDirectionRef.current = { x: -1, y: 0 };
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (directionRef.current.x !== -1) nextDirectionRef.current = { x: 1, y: 0 };
          break;
        case 'Escape':
          if (gameStateRef.current === 'playing') setGameState('paused');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameStateRef, setGameState]);

  // Initial draw
  useEffect(() => {
    draw();
  }, [draw]);

  const handleDirection = useCallback((dir: 'up' | 'down' | 'left' | 'right') => {
    switch (dir) {
      case 'up':
        if (directionRef.current.y !== 1) nextDirectionRef.current = { x: 0, y: -1 };
        break;
      case 'down':
        if (directionRef.current.y !== -1) nextDirectionRef.current = { x: 0, y: 1 };
        break;
      case 'left':
        if (directionRef.current.x !== 1) nextDirectionRef.current = { x: -1, y: 0 };
        break;
      case 'right':
        if (directionRef.current.x !== -1) nextDirectionRef.current = { x: 1, y: 0 };
        break;
    }
  }, []);

  return (
    <div className="relative flex flex-col h-full w-full min-h-0 items-center justify-center overflow-hidden p-2 bg-zinc-950">
      {/* HUD Bar inside the flex layout to prevent overlap */}
      <div className="w-full flex-none flex justify-between items-center mb-2 px-2 font-mono text-xs">
        <div className="text-lime-400 font-bold uppercase tracking-wider">
          STATUS: <span className="text-white">ONLINE</span>
        </div>
        <div className="text-yellow-400 font-bold uppercase tracking-wider">
          SKOR: <span className="text-white">{score}</span>
        </div>
      </div>

      {/* Canvas Wrapper */}
      <div className="relative flex-1 min-h-0 w-full flex items-center justify-center bg-black rounded-xl border border-zinc-800 shadow-[0_0_20px_rgba(0,0,0,0.5)] overflow-hidden">
        <canvas
          ref={canvasRef}
          width={500}
          height={500}
          className="max-w-full max-h-full object-contain"
        />
        
        <GameOverlay
          gameState={gameState}
          score={score}
          onStart={startGame}
          onRestart={startGame}
          instructions="Gunakan Arrow Keys, WASD, atau D-Pad untuk bergerak. Makan titik merah untuk tumbuh. Jangan tabrak dinding atau ekor sendiri!"
        />
      </div>

      {/* Mobile Controls outside the canvas wrapper so it doesn't overlap */}
      {gameState === 'playing' && (
        <div className="flex-none mt-2">
          <MobileControls onDirection={handleDirection} />
        </div>
      )}
    </div>
  );
}

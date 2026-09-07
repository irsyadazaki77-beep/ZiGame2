import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGameEngine } from '../../hooks/useGameEngine';
import { audio } from '../../utils/audio';
import { inputManager } from '../../services/inputService';
import { GameOverlay } from '../gameplay/GameOverlay';
import { Sparkles, Terminal } from 'lucide-react';

interface GameProps {
  onScoreUpdate: (score: number) => void;
  onGameOver: (score: number) => void;
  highScore: number;
}

interface FallingWord {
  id: number;
  text: string;
  typed: string;
  x: number;
  y: number;
  speed: number;
  color: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
}

const WORD_BANK = [
  'CYBER', 'NEON', 'LASER', 'PIXEL', 'MATRIX', 'NODE', 'QUANTUM', 'FIREWALL',
  'ROBOT', 'CHIP', 'BYTE', 'PACKET', 'SYNTH', 'HACK', 'CIRCUIT', 'PLASMA',
  'CORE', 'PORT', 'SYSTEM', 'GRID', 'RADAR', 'DRONE', 'ORBIT', 'SIGNAL',
  'ENCRYPT', 'TOKEN', 'VECTOR', 'MODEM', 'SPARK', 'LOGIC', 'BINARY', 'ROUTER'
];

const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 420;
const FIREWALL_Y = 370;

export default function CyberTyperGame({ onScoreUpdate, onGameOver, highScore }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [inputVal, setInputVal] = useState('');
  const [combo, setCombo] = useState(0);

  const {
    gameState,
    score,
    updateScore,
    startLoop,
    triggerGameOver,
    startWithCountdown,
    countdown,
    setupCanvasContext
  } = useGameEngine({
    gameId: 'cyber-typer',
    onGameOver,
    onScoreUpdate
  });

  // Mutable Game Loop State
  const wordsRef = useRef<FallingWord[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const spawnTimerRef = useRef(0);
  const nextWordIdRef = useRef(1);
  const baseSpeedRef = useRef(0.85);
  const shakeRef = useRef(0);
  const comboRef = useRef(0);

  // Spawn new falling word
  const spawnWord = () => {
    const wordText = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
    const x = Math.floor(Math.random() * (CANVAS_WIDTH - 120)) + 60;
    const colors = ['#38bdf8', '#34d399', '#f472b6', '#a78bfa', '#fbbf24'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    wordsRef.current.push({
      id: nextWordIdRef.current++,
      text: wordText,
      typed: '',
      x,
      y: 20,
      speed: baseSpeedRef.current + (Math.random() - 0.5) * 0.2,
      color
    });
  };

  // Keyboard typing handler
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (gameState !== 'playing') return;
    const val = e.target.value.toUpperCase().trim();
    setInputVal(val);

    if (!val) return;

    // Check matching words
    const matchingWord = wordsRef.current.find(w => w.text === val);

    if (matchingWord) {
      // Word Completed!
      audio.playScore();
      inputManager.vibrateGamepad(60, 0.4);

      // Explosive particles
      for (let i = 0; i < 16; i++) {
        particlesRef.current.push({
          x: matchingWord.x,
          y: matchingWord.y,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6,
          size: Math.random() * 3 + 2,
          color: matchingWord.color,
          alpha: 1.0,
          decay: 0.04
        });
      }

      // Remove word
      wordsRef.current = wordsRef.current.filter(w => w.id !== matchingWord.id);
      setInputVal('');

      // Update Combo & Score
      comboRef.current += 1;
      setCombo(comboRef.current);
      const earned = matchingWord.text.length * 10 * Math.min(4, Math.floor(comboRef.current / 3) + 1);
      updateScore((score || 0) + earned);

      // Increase speed slightly
      baseSpeedRef.current = Math.min(2.5, 0.85 + (score || 0) / 400);
    }
  };

  // Render Frame
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();

    // Screen shake
    if (shakeRef.current > 0) {
      const sx = (Math.random() - 0.5) * shakeRef.current;
      const sy = (Math.random() - 0.5) * shakeRef.current;
      ctx.translate(sx, sy);
      shakeRef.current = Math.max(0, shakeRef.current - 0.4);
    }

    // Background Cyber Terminal
    ctx.fillStyle = '#080a14';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Matrix scanlines
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.06)';
    ctx.lineWidth = 1;
    for (let y = 0; y < CANVAS_HEIGHT; y += 8) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    // Firewall line at bottom
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#f43f5e';
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, FIREWALL_Y);
    ctx.lineTo(CANVAS_WIDTH, FIREWALL_Y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(244, 63, 94, 0.15)';
    ctx.fillRect(0, FIREWALL_Y, CANVAS_WIDTH, CANVAS_HEIGHT - FIREWALL_Y);

    ctx.fillStyle = '#f43f5e';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FIREWALL DEFENSE PERIMETER', CANVAS_WIDTH / 2, FIREWALL_Y + 22);

    // Render Falling Words
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';

    for (const word of wordsRef.current) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = word.color;

      // Word background pill
      const textWidth = ctx.measureText(word.text).width;
      ctx.fillStyle = 'rgba(17, 24, 39, 0.85)';
      ctx.beginPath();
      ctx.roundRect(word.x - textWidth / 2 - 8, word.y - 14, textWidth + 16, 22, 6);
      ctx.fill();

      // Word text
      ctx.fillStyle = word.color;
      ctx.fillText(word.text, word.x, word.y + 2);
      ctx.shadowBlur = 0;
    }

    // Particles
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      if (p.alpha <= 0) {
        particlesRef.current.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    ctx.restore();
  }, []);

  // Main Delta-Time Loop
  const gameStep = useCallback((timestamp: number, deltaTime: number) => {
    const dt = Math.min(deltaTime / 16.666, 3.0); // normalized 60fps units

    // 1. Word Spawning based on accumulator
    spawnTimerRef.current += dt;
    const spawnThreshold = Math.max(60, 130 - (score || 0) / 25);
    if (spawnTimerRef.current >= spawnThreshold) {
      spawnTimerRef.current = 0;
      if (wordsRef.current.length < 6) {
        spawnWord();
      }
    }

    // 2. Move Falling Words
    for (let i = wordsRef.current.length - 1; i >= 0; i--) {
      const word = wordsRef.current[i];
      word.y += word.speed * dt;

      // Breach Firewall Check
      if (word.y >= FIREWALL_Y) {
        audio.playExplosion();
        shakeRef.current = 20;
        inputManager.vibrateGamepad(300, 0.9);

        // Spawn breach blast
        for (let j = 0; j < 24; j++) {
          particlesRef.current.push({
            x: word.x,
            y: FIREWALL_Y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            size: Math.random() * 3 + 2,
            color: '#f43f5e',
            alpha: 1.0,
            decay: 0.04
          });
        }

        draw();
        triggerGameOver();
        return;
      }
    }

    draw();
  }, [draw, score, triggerGameOver]);

  // Lifecycle Start
  const startGame = useCallback(() => {
    wordsRef.current = [];
    particlesRef.current = [];
    spawnTimerRef.current = 0;
    baseSpeedRef.current = 0.85;
    comboRef.current = 0;
    setCombo(0);
    setInputVal('');
    updateScore(0);

    // Initial words
    spawnWord();

    startWithCountdown(() => {
      startLoop(gameStep);
      setTimeout(() => inputRef.current?.focus(), 50);
    });
  }, [startWithCountdown, startLoop, gameStep, updateScore]);

  // DPR setup
  useEffect(() => {
    setupCanvasContext(canvasRef.current, CANVAS_WIDTH, CANVAS_HEIGHT);
    draw();
  }, [setupCanvasContext, draw]);

  return (
    <div className="relative flex flex-col h-full w-full min-h-0 items-center justify-center overflow-hidden p-2 bg-[#080a14]">
      {/* HUD */}
      <div className="w-full max-w-[500px] flex-none flex justify-between items-center mb-2 px-3 py-1 bg-[#121622]/80 border border-white/[0.06] rounded-xl text-xs font-mono">
        <div className="flex items-center gap-1.5">
          <Terminal size={14} className="text-sky-400" />
          <span className="text-zinc-400">TARGET:</span>
          <span className="text-sky-400 font-bold">{wordsRef.current.length} KATA</span>
        </div>

        {combo > 2 && (
          <div className="flex items-center gap-1 text-amber-400 font-bold animate-pulse">
            <Sparkles size={12} />
            <span>KOMBO {combo}x</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-zinc-400">SKOR:</span>
          <span className="text-white font-bold">{score}</span>
        </div>
      </div>

      {/* Canvas container */}
      <div 
        className="relative flex-1 min-h-0 w-full max-w-[500px] max-h-[420px] flex items-center justify-center bg-[#080a14] rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden cursor-pointer"
        onClick={() => inputRef.current?.focus()}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%' }}
          className="object-contain block touch-none"
        />

        <GameOverlay
          gameState={gameState}
          score={score}
          highScore={highScore}
          countdown={countdown}
          onStart={startGame}
          onRestart={startGame}
          instructions="Ketik kata-kata neon yang meluncur turun sebelum menyentuh Firewall! Gunakan keyboard untuk mengetik."
        />
      </div>

      {/* Input box */}
      {gameState === 'playing' && (
        <div className="flex-none mt-2.5 w-full max-w-[500px] flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={handleInputChange}
            placeholder="KETIK DI SINI..."
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck="false"
            className="w-full px-4 py-2.5 bg-[#101424] border border-sky-500/50 rounded-xl text-white font-mono font-bold text-center tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-sky-400 text-base"
          />
        </div>
      )}
    </div>
  );
}

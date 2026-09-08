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

interface BeatNote {
  id: string;
  lane: number; // 0, 1, 2, 3
  y: number; // 0 to 100
}

const LANES_KEYS = ['D', 'F', 'J', 'K'];
const LANE_COLORS = [
  'border-pink-500/30 text-pink-500 shadow-pink-500/20 bg-pink-950/25',
  'border-cyan-500/30 text-cyan-500 shadow-cyan-500/20 bg-cyan-950/25',
  'border-yellow-500/30 text-yellow-500 shadow-yellow-500/20 bg-yellow-950/25',
  'border-purple-500/30 text-purple-500 shadow-purple-500/20 bg-purple-950/25'
];
const NOTE_GLOWS = [
  'bg-pink-500 shadow-[0_0_12px_rgba(236,72,153,0.8)] border-pink-300',
  'bg-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.8)] border-cyan-300',
  'bg-yellow-500 shadow-[0_0_12px_rgba(234,179,8,0.8)] border-yellow-300',
  'bg-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.8)] border-purple-300'
];

export default function RhythmTapGame({ onGameOver, onScoreUpdate, highScore }: GameProps) {
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
    gameId: 'rhythmtap',
    onGameOver,
    onScoreUpdate,
  });

  const gameStateRef = useRef(gameState);
  
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
  const [notes, setNotes] = useState<BeatNote[]>([]);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(45);
  const [feedback, setFeedback] = useState<{ text: string; color: string } | null>(null);
  const [keyStates, setKeyStates] = useState<boolean[]>([false, false, false, false]);

  const notesRef = useRef<BeatNote[]>([]);
  const spawnTimerRef = useRef(0);
  const gameTimerRef = useRef(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cabinetRef = useRef<HTMLDivElement | null>(null);
  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number; color: string; radius: number; alpha: number; decay: number }[]>([]);
  const floatingTextsRef = useRef<{ x: number; y: number; text: string; color: string; alpha: number; vy: number }[]>([]);
  const shakeRef = useRef<number>(0);

  const lastTimeRef = useRef(0);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const startGame = useCallback(() => {
    updateScore(0);
    setCombo(0);
    setMaxCombo(0);
    setTimeLeft(45);
    setNotes([]);
    setFeedback(null);
    particlesRef.current = [];
    floatingTextsRef.current = [];

    startWithCountdown(() => {
      lastTimeRef.current = performance.now();
      startLoop(gameStep);
    });
  }, [startWithCountdown, startLoop, updateScore]);

  const triggerFeedback = (text: string, isGood: boolean) => {
    if (isGood) {
      setFeedback({ text, color: 'text-emerald-400 font-black scale-110' });
    } else {
      setFeedback({ text, color: 'text-red-500 font-bold scale-95' });
    }
    setTimeout(() => setFeedback(null), 300);
  };

  const triggerHitEffects = (laneIdx: number, type: 'perfect' | 'good' | 'bad' | 'miss', earnedText: string) => {
    const x = (laneIdx + 0.5) * 96;
    const y = 240; // target line zone
    
    let color = '#9ca3af'; // gray default
    let particleCount = 6;
    let shakeAmt = 2;

    if (type === 'perfect') {
      color = '#fbbf24'; // beautiful glowing gold
      particleCount = 20;
      shakeAmt = 15;
    } else if (type === 'good') {
      const colors = ['#ec4899', '#06b6d4', '#eab308', '#a855f7'];
      color = colors[laneIdx] || '#06b6d4';
      particleCount = 12;
      shakeAmt = 7;
    } else if (type === 'bad' || type === 'miss') {
      color = '#ef4444'; // red timing error
      particleCount = 8;
      shakeAmt = 9;
    }

    shakeRef.current = Math.max(shakeRef.current, shakeAmt);

    // Spawn floating text
    floatingTextsRef.current.push({
      x,
      y: y - 10,
      text: earnedText,
      color,
      alpha: 1.0,
      vy: -1.2
    });

    // Spawn particles
    for (let i = 0; i < particleCount; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: type === 'perfect' ? -Math.random() * 5 - 2 : -Math.random() * 4 - 1,
        color: type === 'perfect' && i % 2 === 0 ? '#ffffff' : color,
        radius: Math.random() * 2.5 + 1.5,
        alpha: 1.0,
        decay: Math.random() * 0.04 + 0.02
      });
    }
  };

  const triggerLaneHit = (laneIdx: number) => {
    if (gameStateRef.current !== 'playing') return;

    // Flash key state for visual feedback
    setKeyStates(prev => {
      const copy = [...prev];
      copy[laneIdx] = true;
      return copy;
    });
    setTimeout(() => {
      setKeyStates(prev => {
        const copy = [...prev];
        copy[laneIdx] = false;
        return copy;
      });
    }, 100);

    // Look for matching note in the target zone (y from 80 to 95 is standard target slot)
    const currentNotes = notesRef.current;
    const laneNotes = currentNotes.filter(n => n.lane === laneIdx);

    if (laneNotes.length === 0) {
      // Misclick / Empty lane tap penalty
      audio.playHit();
      setCombo(0);
      triggerHitEffects(laneIdx, 'bad', 'TAP!');
      return;
    }

    // Find the closest note to target bar center (y = 88)
    let closestNote: BeatNote | null = null;
    let minDistance = 999;

    for (const note of laneNotes) {
      const distance = Math.abs(note.y - 88);
      if (distance < minDistance) {
        minDistance = distance;
        closestNote = note;
      }
    }

    if (closestNote && minDistance < 15) {
      // HIT SUCCESS
      audio.playScore();
      let earned = 0;
      if (minDistance <= 5) {
        earned = 50 + combo * 2;
        triggerFeedback('🔥 PERFECT! 🔥', true);
        triggerHitEffects(laneIdx, 'perfect', `PERFECT +${earned}`);
      } else {
        earned = 25 + combo;
        triggerFeedback('👍 GOOD! 👍', true);
        triggerHitEffects(laneIdx, 'good', `GOOD +${earned}`);
      }

      addScore(earned);
      setCombo(prev => {
        const next = prev + 1;
        if (next > maxCombo) setMaxCombo(next);
        return next;
      });

      // Blast/Remove note
      const noteIdToKill = closestNote.id;
      setNotes(prev => prev.filter(n => n.id !== noteIdToKill));
    } else {
      // Too early or too late
      audio.playHit();
      setCombo(0);
      triggerFeedback('❌ BAD TIMING ❌', false);
      triggerHitEffects(laneIdx, 'bad', 'MISS!');
    }
  };

  // Keyboard controls listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStateRef.current !== 'playing') return;
      const key = e.key.toUpperCase();
      const laneIdx = LANES_KEYS.indexOf(key);
      if (laneIdx !== -1) {
        e.preventDefault();
        triggerLaneHit(laneIdx);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const gameStep = useCallback((timestamp: number, dt: number) => {
    if (gameStateRef.current !== 'playing') return;

    const delta = dt / 16.666;
    gameTimerRef.current += delta;
    spawnTimerRef.current += delta;

    // Time limit (45 seconds = 2700 frames at 60fps)
    if (gameTimerRef.current > 2700) {
      triggerGameOver();
      return;
    }
    
    setTimeLeft(Math.max(0, Math.ceil(45 - gameTimerRef.current / 60)));

    // Cascading notes downwards (Runs at ~60fps)
    setNotes(prev => {
      let missedAny = false;
      const updated = prev.map(n => {
        const nextY = n.y + 1.25 * delta; // standard fall velocity
        if (nextY > 100) {
          missedAny = true;
          return null; // Note missed (went past screen edge)
        }
        return { ...n, y: nextY };
      }).filter(Boolean) as BeatNote[];

      if (missedAny) {
        setCombo(0);
        triggerFeedback('⚠️ MISS ⚠️', false);
        shakeRef.current = Math.max(shakeRef.current, 6);
      }

      return updated;
    });

    // Periodic random note spawning (synchronized to standard beats rhythm)
    if (spawnTimerRef.current > 37) { // roughly 620ms
      spawnTimerRef.current = 0;
      const targetLane = Math.floor(Math.random() * 4);
      const newNote: BeatNote = {
        id: `${Date.now()}-${Math.random()}`,
        lane: targetLane,
        y: 0,
      };
      setNotes(prev => [...prev, newNote]);
    }
  }, [triggerGameOver]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 384, 280);

    // Apply direct DOM transformation for camera shake on the cabinet element
    const cabinet = cabinetRef.current;
    if (cabinet) {
      if (shakeRef.current > 0) {
        const dx = (Math.random() - 0.5) * shakeRef.current;
        const dy = (Math.random() - 0.5) * shakeRef.current;
        cabinet.style.transform = `translate(${dx}px, ${dy}px)`;
        // decay shake
        shakeRef.current *= 0.88;
        if (shakeRef.current < 0.5) {
          shakeRef.current = 0;
          cabinet.style.transform = 'none';
        }
      } else {
        cabinet.style.transform = 'none';
      }
    }

    // Update & Render standard particle sparks
    particlesRef.current.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;

      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 4;
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;
    particlesRef.current = particlesRef.current.filter(p => p.alpha > 0);

    // Update & Render arcade-style floating score text popups
    floatingTextsRef.current.forEach(t => {
      t.y += t.vy;
      t.alpha -= 0.025;

      ctx.fillStyle = t.color;
      ctx.globalAlpha = Math.max(0, t.alpha);
      ctx.font = 'bold 8px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);
    });
    ctx.globalAlpha = 1.0;
    floatingTextsRef.current = floatingTextsRef.current.filter(t => t.alpha > 0);
  };

  useEffect(() => {
    if (gameStateRef.current === 'playing') draw();
  }, [notes, draw]);

  return (
    <GameContainer aspect="square" maxWidth="sm">
      {gameState === 'playing' && (
        <GameHUD 
          stats={[
            { id: 'score', label: 'SKOR', value: score, emphasized: true },
            { id: 'combo', label: 'KOMBO', value: combo },
            { id: 'time', label: 'WAKTU', value: timeLeft }
          ]} 
        />
      )}

      <GameOverlay
        gameState={gameState}
        score={score}
        countdown={countdown}
        onStart={startGame}
        onRestart={startGame}
        instructions="Ikuti ritme musik siber! Tekan tombol D, F, J, K atau tap pada layar saat not berada di garis target."
      />

      {gameState === 'playing' && (
        <div ref={cabinetRef} className="w-full aspect-video md:aspect-square bg-zinc-950 border-4 border-zinc-900 rounded-2xl relative overflow-hidden flex mb-4 transition-transform duration-75">
          {/* Transparent particle overlay canvas */}
          <canvas ref={canvasRef} width={384} height={280} className="absolute inset-0 pointer-events-none w-full h-full object-fill z-20" />
          {/* Split tracks divisions */}
          {[0, 1, 2, 3].map((track) => (
            <div key={track} className="flex-1 h-full border-r border-zinc-900/50 relative last:border-r-0">
              {/* Track Target hit line slots */}
              <div className={`absolute bottom-[12%] inset-x-1.5 h-[10px] rounded border-2 z-10 transition-colors ${
                keyStates[track] ? 'bg-white/30 border-white' : 'bg-transparent border-zinc-800/40'
              }`} />
            </div>
          ))}

          {/* Falling Beat Notes */}
          {notes.map((note) => {
            const lanePercent = 25 * note.lane;
            return (
              <div
                key={note.id}
                className={`absolute w-8 h-8 rounded-full border-2 transform -translate-x-1/2 flex items-center justify-center text-xs font-bold text-white select-none ${NOTE_GLOWS[note.lane]}`}
                style={{
                  left: `${lanePercent + 12.5}%`,
                  top: `${note.y}%`,
                  transition: 'top 16ms linear',
                }}
              >
                🎵
              </div>
            );
          })}

          {/* Float combo text overlay inside cabinet */}
          {feedback && (
            <div className="absolute inset-x-0 top-1/3 flex items-center justify-center pointer-events-none z-30">
              <span className={`font-mono text-xs uppercase tracking-wider text-center transition-all duration-300 transform scale-125 select-none ${feedback.color}`}>
                {feedback.text}
              </span>
            </div>
          )}
        </div>
      )}

      {gameState === 'playing' && (
        <div className="grid grid-cols-4 gap-2 w-full">
          {LANES_KEYS.map((k, idx) => (
            <button
              key={k}
              onPointerDown={(e) => { 
                e.preventDefault(); 
                triggerLaneHit(idx);
                if (navigator.vibrate) navigator.vibrate(10);
              }}
              className={`py-4 rounded-xl border-2 font-mono font-black text-sm text-center cursor-pointer transition select-none active:scale-90 touch-none no-tap-highlight ${
                keyStates[idx]
                  ? 'bg-white border-white text-black shadow-[0_0_15px_rgba(255,255,255,0.5)]'
                  : LANE_COLORS[idx]
              }`}
            >
              <span>{k}</span>
            </button>
          ))}
        </div>
      )}
    </GameContainer>
  );
}

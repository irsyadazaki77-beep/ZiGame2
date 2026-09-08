import React, { useEffect, useState, useRef } from 'react';
import { audio } from '../../utils/audio';
import { Gamepad } from 'lucide-react';
import { GameOverlay } from '../gameplay/GameOverlay';

interface MemoryGridProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

interface Card {
  id: number;
  symbol: string;
  isFlipped: boolean;
  isMatched: boolean;
  color: string;
}

// Retro Symbols for Card matching
const CARDS_SYMBOLS = [
  { symbol: '🎮', color: 'text-pink-500' },     // Gamepad
  { symbol: '👾', color: 'text-indigo-500' },   // Alien
  { symbol: '🍒', color: 'text-red-500' },      // Cherry
  { symbol: '👻', color: 'text-blue-500' },     // Ghost
  { symbol: '💎', color: 'text-cyan-500' },     // Gem
  { symbol: '👑', color: 'text-yellow-500' },   // Crown
  { symbol: '🚀', color: 'text-purple-500' },   // Rocket
  { symbol: '🕹️', color: 'text-green-500' },    // Joystick
];

export default function MemoryGridGame({ onGameOver, onScoreUpdate, highScore }: MemoryGridProps) {
  const scoreRef = useRef(0);
  // State variables
  const [isPlaying, setIsPlaying] = useState(false);
  const [cards, setCards] = useState<Card[]>(() => {
    return [...CARDS_SYMBOLS, ...CARDS_SYMBOLS].map((item, idx) => ({
      id: idx,
      symbol: item.symbol,
      isFlipped: false,
      isMatched: false,
      color: item.color,
    }));
  });
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(0);
  const [combo, setCombo] = useState(1);
  const [timeLeft, setTimeLeft] = useState(90); // 1.5 minutes limit
  const [gameOver, setGameOver] = useState(false);
  const isPlayingRef = useRef(false);
  const gameOverRef = useRef(false);


  useEffect(() => {
    isPlayingRef.current = isPlaying;
    gameOverRef.current = gameOver;
    scoreRef.current = score;
  }, [isPlaying, gameOver, score]);
  const [gameWon, setGameWon] = useState(false);
  const [muted, setMuted] = useState(audio.getMuteState());

  // Countdown clock interval
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && !gameOver && !gameWon) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            triggerGameOver();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, gameOver, gameWon]);

  const initGame = () => {
    audio.playCoin();
    // Reset state
    setScore(0);
    setMoves(0);
    setCombo(1);
    setTimeLeft(90);
    setGameOver(false);
    setGameWon(false);
    setSelectedIndices([]);

    // Double the symbols and shuffle them
    const doubled = [...CARDS_SYMBOLS, ...CARDS_SYMBOLS].map((item, idx) => ({
      id: idx,
      symbol: item.symbol,
      isFlipped: false,
      isMatched: false,
      color: item.color,
    }));

    // Knuth shuffle algorithm
    for (let i = doubled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [doubled[i], doubled[j]] = [doubled[j], doubled[i]];
    }

    setCards(doubled);
    setIsPlaying(true);
  };

  const handleCardClick = (idx: number) => {
    if (!isPlaying || cards[idx].isFlipped || cards[idx].isMatched || selectedIndices.length >= 2) return;

    audio.playHit();
    const updated = [...cards];
    updated[idx].isFlipped = true;
    setCards(updated);

    const nextSelected = [...selectedIndices, idx];
    setSelectedIndices(nextSelected);

    if (nextSelected.length === 2) {
      setMoves(prev => prev + 1);
      setTimeout(() => {
        checkMatch(nextSelected);
      }, 650);
    }
  };

  const checkMatch = (indices: number[]) => {
    const [first, second] = indices;
    const card1 = cards[first];
    const card2 = cards[second];
    const updated = [...cards];

    if (card1.symbol === card2.symbol) {
      // It's a match!
      audio.playLevelUp();
      updated[first].isMatched = true;
      updated[second].isMatched = true;

      // Score = combo reward
      const matchPoints = 15 * combo;
      setScore(prev => {
        const next = prev + matchPoints;
        onScoreUpdate(next);
        return next;
      });

      // Increase combo
      setCombo(prev => Math.min(5, prev + 1));
    } else {
      // No match
      audio.playHit();
      updated[first].isFlipped = false;
      updated[second].isFlipped = false;
      // Reset combo
      setCombo(1);
    }

    setCards(updated);
    setSelectedIndices([]);

    // Check Win
    const allMatched = updated.every(c => c.isMatched);
    if (allMatched) {
      triggerGameWon();
    }
  };

  const triggerGameOver = () => {
    setIsPlaying(false);
    setGameOver(true);
    audio.playGameOver();
    onGameOver(score);
  };

  const triggerGameWon = () => {
    setIsPlaying(false);
    setGameWon(true);
    audio.playLevelUp();
    // Time remaining bonus
    const finalBonus = Math.floor(timeLeft * 1.5);
    const finalScore = score + finalBonus;
    setScore(finalScore);
    onGameOver(finalScore);
  };

  const toggleSound = () => {
    audio.toggleMute();
    setMuted(audio.getMuteState());
  };

  // Convert seconds to digital clock output
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getGameState = () => {
    if (!isPlaying && score === 0 && !gameOver && !gameWon) return 'ready';
    if (!isPlaying) return 'gameover'; // Game won is also gameover
    return 'playing';
  };

  return (
    <div className="relative flex flex-col h-full w-full min-h-0 items-center justify-center overflow-hidden p-2 bg-zinc-950">
      {/* HUD Bar inside the flex layout to prevent overlap */}
      <div className="w-full flex-none flex justify-between items-center mb-2 px-2 font-mono text-xs">
        <div className="text-purple-400 font-bold uppercase tracking-wider">
          WAKTU: <span className={timeLeft < 20 ? "text-red-500 animate-pulse font-bold" : "text-white"}>{formatTime(timeLeft)}</span>
        </div>
        <div className="text-zinc-400 font-bold uppercase tracking-wider">
          LANGKAH: <span className="text-white">{moves}</span>
        </div>
        <div className="text-emerald-400 font-bold uppercase tracking-wider">
          COMBO: <span className="text-white">x{combo}</span>
        </div>
        <div className="text-yellow-400 font-bold uppercase tracking-wider">
          SKOR: <span className="text-white">{score}</span>
        </div>
      </div>

      {/* Board Wrapper */}
      <div className="relative flex-1 min-h-0 w-full flex items-center justify-center bg-black rounded-xl border border-zinc-800 shadow-[0_0_20px_rgba(0,0,0,0.5)] p-4 overflow-hidden">
        <div className="w-full h-full max-w-full max-h-full aspect-square flex items-center justify-center">
          <div className="grid grid-cols-4 gap-2 sm:gap-3 w-full h-full max-h-full max-w-full">
            {cards.map((card, idx) => (
              <button
                key={card.id}
                onClick={() => handleCardClick(idx)}
                className={`perspective-500 relative rounded-xl transition-all duration-300 transform select-none cursor-pointer overflow-hidden ${
                  card.isMatched
                    ? 'border border-purple-500/40 bg-zinc-900/40 shadow-[0_0_10px_rgba(168,85,247,0.15)] opacity-60 animate-pulse'
                    : card.isFlipped
                    ? 'border border-purple-400 bg-zinc-900 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                    : 'border border-zinc-800 bg-zinc-950 hover:border-zinc-700 hover:shadow-[0_0_12px_rgba(255,255,255,0.05)] active:scale-95'
                }`}
                style={{ aspectRatio: '1/1' }}
                title="Selesaikan kartu"
              >
                {/* 3D Flip style content */}
                <div className="absolute inset-0 flex items-center justify-center transition-all duration-300">
                  {card.isFlipped || card.isMatched ? (
                    <span className="text-2xl sm:text-4xl filter drop-shadow-[0_0_6px_rgba(255,255,255,0.4)]">
                      {card.symbol}
                    </span>
                  ) : (
                    <div className="flex flex-col items-center gap-0.5 opacity-30 text-zinc-500 hover:opacity-50">
                      <Gamepad size={20} className="text-zinc-500 sm:w-[24px] sm:h-[24px]" />
                      <span className="text-[7px] font-mono tracking-wider hidden sm:inline">RETRO</span>
                    </div>
                  )}
                </div>

                {/* Corner details */}
                {!card.isFlipped && !card.isMatched && (
                  <div className="absolute top-1 right-1 w-1 h-1 sm:w-1.5 sm:h-1.5 bg-purple-500/30 rounded-full"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        <GameOverlay
          gameState={getGameState()}
          score={score}
          onStart={initGame}
          onRestart={initGame}
          instructions="Temukan pasangan kartu hologram retro yang sama dalam batas waktu. Selesaikan secara beruntun untuk melipatgandakan combo skor Anda!"
        />
      </div>
    </div>
  );
}

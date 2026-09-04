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

interface FallingWord {
  id: string;
  text: string;
  x: number; // percentage width
  y: number; // percentage height
  speed: number;
}

const ARCADE_WORDS = [
  'NEON', 'CYBER', 'LASER', 'MATRIX', 'GRID', 'MODEM', 'PLASMA', 'VECTOR', 'arcade', 'SYNTH',
  'CHIP', 'PIXEL', 'PROXY', 'KINETIC', 'NODE', 'TURBO', 'RETRO', 'GLITCH', 'SYSTEM', 'ROBOT',
  'DASH', 'FLOW', 'WAVE', 'STATIC', 'PHANTOM', 'QUASAR', 'ECHO', 'QUANTUM', 'SHIELD', 'BINARY'
];

export default function CyberTyperGame({ onGameOver, onScoreUpdate, highScore }: GameProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [words, setWords] = useState<FallingWord[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [score, setScore] = useState(0);
  const [shields, setShields] = useState(3);
  const [gameSpeed, setGameSpeed] = useState(1);
  
  const scoreRef = useRef(0);
  const isPlayingRef = useRef(false);
  const wordsLoopRef = useRef<NodeJS.Timeout | null>(null);
  const spawnLoopRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    scoreRef.current = score;
    onScoreUpdate(score);
  }, [score, onScoreUpdate]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Handle typing input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isPlaying) return;
    const value = e.target.value;
    setInputValue(value);

    // Dynamic matched text highlight or trigger immediate blast
    const matchedIndex = words.findIndex(w => w.text.toLowerCase() === value.trim().toLowerCase());
    if (matchedIndex !== -1) {
      audio.playLaser();
      setScore(prev => prev + words[matchedIndex].text.length * 10);
      setWords(prev => prev.filter((_, idx) => idx !== matchedIndex));
      setInputValue('');
      
      // Speed up slightly as score rises
      setGameSpeed(prev => Math.min(prev + 0.04, 2.5));
    }
  };

  const spawnWord = () => {
    if (!isPlayingRef.current) return;
    const randomText = ARCADE_WORDS[Math.floor(Math.random() * ARCADE_WORDS.length)];
    const newWord: FallingWord = {
      id: `${Date.now()}-${Math.random()}`,
      text: randomText,
      x: Math.floor(Math.random() * 70) + 10, // 10% to 80% to stay in bounds
      y: 0,
      speed: (Math.random() * 0.8 + 0.4) * gameSpeed,
    };
    setWords(prev => [...prev, newWord]);
  };

  // Main Loop Game State
  useEffect(() => {
    if (isPlaying) {
      // Update words position loop (runs at ~60fps)
      wordsLoopRef.current = setInterval(() => {
        setWords(prev => {
          let hitBaseline = false;
          const updated = prev.map(w => {
            const nextY = w.y + w.speed * 0.5;
            if (nextY >= 100) {
              hitBaseline = true;
              return null;
            }
            return { ...w, y: nextY };
          }).filter(Boolean) as FallingWord[];

          if (hitBaseline) {
            audio.playHit();
            setShields(s => {
              const nextShields = s - 1;
              if (nextShields <= 0) {
                endGame();
              }
              return nextShields;
            });
          }

          return updated;
        });
      }, 50);

      // Spawn words loop
      spawnLoopRef.current = setInterval(() => {
        spawnWord();
      }, 2000 / gameSpeed);
    }

    return () => {
      if (wordsLoopRef.current) clearInterval(wordsLoopRef.current);
      if (spawnLoopRef.current) clearInterval(spawnLoopRef.current);
    };
  }, [isPlaying, gameSpeed]);

  const startNewGame = () => {
    audio.playCoin();
    setScore(0);
    setShields(3);
    setGameSpeed(1);
    setWords([]);
    setInputValue('');
    setIsPlaying(true);
  };

  const endGame = () => {
    setIsPlaying(false);
    audio.playGameOver();
    onGameOver(scoreRef.current);
  };

  const getGameState = () => {
    if (!isPlaying && score === 0 && shields === 3) return 'ready';
    if (!isPlaying) return 'gameover';
    return 'playing';
  };

  return (
    <GameContainer aspect="video" maxWidth="md">
      {isPlaying && (
        <GameHUD 
          stats={[
            { id: 'shields', label: 'PERTAHANAN', value: Array(shields).fill('❤️').join('') },
            { id: 'score', label: 'SKOR', value: score, emphasized: true }
          ]} 
        />
      )}

      <GameOverlay
        gameState={getGameState()}
        score={score}
        onStart={startNewGame}
        onRestart={startNewGame}
        instructions="Ketik kata-kata neon yang berjatuhan secepat kilat untuk meledakkannya sebelum mereka menembus dinding pertahanan!"
      />

      <div className="w-full aspect-video bg-zinc-950 border-4 border-zinc-900 rounded-xl relative overflow-hidden mb-4 shadow-2xl">
        {/* Grid network lines */}
        <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
        
        {/* Falling Words */}
        {words.map((w) => (
          <div
            key={w.id}
            className="absolute font-mono text-xs sm:text-sm font-black px-3 py-1.5 bg-zinc-900/80 border border-indigo-500/30 text-indigo-400 rounded-md shadow-md transform -translate-x-1/2 uppercase tracking-wider"
            style={{
              left: `${w.x}%`,
              top: `${w.y}%`,
              transition: 'top 50ms linear',
            }}
          >
            {w.text}
          </div>
        ))}

        {/* Firewall line at the bottom */}
        <div className="absolute bottom-4 inset-x-0 h-[2px] bg-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.5)] border-t border-red-500 pointer-events-none">
          <span className="absolute right-3 top-1 text-[8px] font-mono font-black text-red-500 tracking-wider">FIREWALL SECTOR</span>
        </div>
      </div>

      {isPlaying && (
        <div className="w-full relative mt-4">
          <input
            type="text"
            autoFocus
            value={inputValue}
            onChange={handleInputChange}
            placeholder="KETIK KATA-KATA DI SINI..."
            className="w-full py-4 px-4 bg-zinc-900 border-2 border-zinc-800 rounded-xl outline-none focus:border-indigo-500 text-center font-mono font-black text-sm text-indigo-300 uppercase tracking-wider shadow-inner"
          />
        </div>
      )}
    </GameContainer>
  );
}

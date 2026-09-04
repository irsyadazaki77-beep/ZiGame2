import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Send, Bot, Sparkles } from 'lucide-react';
import { audio } from '../utils/audio';

interface Message {
  id: string;
  sender: string;
  avatar: string;
  text: string;
  timestamp: string;
  isPlayer?: boolean;
  isSystem?: boolean;
}

const RETRO_BOTS = [
  { name: 'NeonDrifter', avatar: '👾', color: 'text-red-400' },
  { name: 'CyberQueen', avatar: '👑', color: 'text-fuchsia-400' },
  { name: 'VaporWave95', avatar: '🌴', color: 'text-cyan-400' },
  { name: 'RetroDino', avatar: '🦖', color: 'text-emerald-400' },
  { name: 'GlitchMaster', avatar: '⚡', color: 'text-yellow-400' },
  { name: 'VoidWalker', avatar: '🌌', color: 'text-purple-400' },
  { name: 'SpeedDemon', avatar: '🏎️', color: 'text-orange-400' },
];

const BOT_QUOTES = [
  "Baru saja rekor baru di Brick Neon pecah!",
  "Ada yang bisa ngalahin skor Flappy Pixel gue gak?",
  "Cyber Runner makin lama makin cepet gilaaaa 🏃‍♂️",
  "Gacha tadi dapet avatar Retro King! Hoki parah 🔥",
  "Pencapaian ULAR RAKUS susah banget didapet sih",
  "Lagi dengerin soundtrack synthwave sambil nge-game 🎵",
  "Jangan lupa klaim Misi Harian buat dapet Koin gratis!",
  "Beli tema Neon Ruby di toko deh, keren bgt lobi jd merah membara ❤️",
  "Siapa yang suka main 360° Cosmic Asteroid? Refleksnya harus dewa 🚀",
  "Duh dikit lagi dapet skor 200 di Neon Pong malah kalah 😭",
];

const BOT_RESPONSES_TO_PLAYER = [
  "Wih mantap bang!",
  "GG WP! 🔥",
  "Boleh juga tuh refleksnya, mabar yuk kapan-kapan!",
  "Ah masa sih? Coba buktiin di papan peringkat dong 👀",
  "Wkwk halo! Salam kenal sesama gamer arkade!",
  "Mantap! Koin lu udah kekumpul berapa nih?",
  "Ayo kejar skor NeonDrifter, dia lagi memimpin di lobi!",
];

export default function Shoutbox({ playerName, playerAvatar, playerThemeColor }: { playerName: string, playerAvatar: string, playerThemeColor: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Initialize with some historical chats
  useEffect(() => {
    const now = new Date();
    const initialChats: Message[] = Array.from({ length: 4 }).map((_, i) => {
      const bot = RETRO_BOTS[Math.floor(Math.random() * RETRO_BOTS.length)];
      const msgTime = new Date(now.getTime() - (4 - i) * 120000);
      return {
        id: `init-${i}`,
        sender: bot.name,
        avatar: bot.avatar,
        text: BOT_QUOTES[Math.floor(Math.random() * BOT_QUOTES.length)],
        timestamp: msgTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      };
    });
    setMessages(initialChats);
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Periodically generate simulated bot chats
  useEffect(() => {
    const interval = setInterval(() => {
      const bot = RETRO_BOTS[Math.floor(Math.random() * RETRO_BOTS.length)];
      const text = BOT_QUOTES[Math.floor(Math.random() * BOT_QUOTES.length)];
      const timeString = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      const newMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: bot.name,
        avatar: bot.avatar,
        text,
        timestamp: timeString,
      };

      setMessages(prev => [...prev.slice(-30), newMsg]);
    }, 18000 + Math.random() * 12000); // 18-30 seconds

    return () => clearInterval(interval);
  }, []);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    audio.playCoin();
    const timeString = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const playerMsg: Message = {
      id: `player-${Date.now()}`,
      sender: playerName,
      avatar: playerAvatar,
      text: inputText,
      timestamp: timeString,
      isPlayer: true,
    };

    setMessages(prev => [...prev, playerMsg]);
    setInputText('');

    // Bot reacts after a small delay
    setTimeout(() => {
      const bot = RETRO_BOTS[Math.floor(Math.random() * RETRO_BOTS.length)];
      const text = BOT_RESPONSES_TO_PLAYER[Math.floor(Math.random() * BOT_RESPONSES_TO_PLAYER.length)];
      const replyMsg: Message = {
        id: `reply-${Date.now()}`,
        sender: bot.name,
        avatar: bot.avatar,
        text: `@${playerName} ${text}`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, replyMsg]);
      audio.playScore(); // play soft blip sound for bot reaction
    }, 1000 + Math.random() * 1500);
  };

  const handleQuickSend = (quickText: string) => {
    audio.playCoin();
    const timeString = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const playerMsg: Message = {
      id: `player-${Date.now()}`,
      sender: playerName,
      avatar: playerAvatar,
      text: quickText,
      timestamp: timeString,
      isPlayer: true,
    };

    setMessages(prev => [...prev, playerMsg]);

    setTimeout(() => {
      const bot = RETRO_BOTS[Math.floor(Math.random() * RETRO_BOTS.length)];
      const text = BOT_RESPONSES_TO_PLAYER[Math.floor(Math.random() * BOT_RESPONSES_TO_PLAYER.length)];
      const replyMsg: Message = {
        id: `reply-${Date.now()}`,
        sender: bot.name,
        avatar: bot.avatar,
        text: `@${playerName} ${text}`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, replyMsg]);
      audio.playScore();
    }, 1000 + Math.random() * 1500);
  };

  const QUICK_REACTIONS = ["GG WP! 🎮", "EZ 🔥", "HI-SCORE! 🏆", "HOKI REK 😂", "NICE COBO! ⚡"];

  return (
    <div className="glass-panel rounded-3xl p-4 w-full flex flex-col h-[340px] relative overflow-hidden shadow-2xl">
      {/* Glow decorative background */}
      <div className="absolute inset-0 bg-grid-zinc-900/10 pointer-events-none z-0"></div>

      {/* Title */}
      <div className="flex items-center justify-between mb-2 border-b border-zinc-800/80 pb-2 relative z-10 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="text-red-500 " size={14} />
          <h3 className="font-display font-black text-xs tracking-wider text-zinc-100 uppercase">
            CHAT LOBI ARKADE
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 "></span>
          <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">7 ONLINE</span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-2 relative z-10 scrollbar-thin">
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const botInfo = RETRO_BOTS.find(b => b.name === msg.sender);
            const nameColor = msg.isPlayer ? 'text-red-400 font-bold' : (botInfo?.color || 'text-zinc-300');

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-2 items-start text-xs font-mono leading-relaxed p-1.5 rounded-lg border border-transparent ${
                  msg.isPlayer ? 'bg-red-500/5 border-red-500/10' : ''
                }`}
              >
                <span className="text-sm shrink-0 select-none">{msg.avatar}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className={`font-black tracking-wider hover:underline cursor-pointer ${nameColor}`}>
                      {msg.sender}
                    </span>
                    <span className="text-[7px] text-zinc-600 shrink-0">{msg.timestamp}</span>
                  </div>
                  <p className="text-zinc-400 mt-0.5 break-words select-text selection:bg-red-600">{msg.text}</p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={chatEndRef} />
      </div>

      {/* Quick Reactions Bar */}
      <div className="mt-2 flex gap-1 overflow-x-auto pb-1 shrink-0 scrollbar-none relative z-10">
        {QUICK_REACTIONS.map((react, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleQuickSend(react)}
            className="px-2 py-1 bg-zinc-800/60 hover:bg-zinc-700/80 border border-zinc-700/50 text-[10px] text-zinc-300 rounded-md font-mono transition shrink-0 cursor-pointer"
          >
            {react}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <form onSubmit={handleSend} className="mt-1.5 pt-2 border-t border-white/10 flex gap-2 shrink-0 relative z-10">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ketik obrolan lobi..."
          maxLength={80}
          className="flex-1 glass-panel rounded-xl px-4 py-2.5 text-xs sm:text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-red-500/70 font-mono transition"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white rounded-xl transition cursor-pointer flex items-center justify-center border border-red-500/20 shadow-lg shadow-red-500/20"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}

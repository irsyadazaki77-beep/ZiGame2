import React, { useState } from 'react';
import { Swords, Copy, Check, Users, Bot, X, ArrowRight } from 'lucide-react';
import { GameStats, PlayerProfile } from '../../types';
import { MultiplayerRoom, multiplayerService } from '../../services/multiplayerService';
import { audioController } from '../../sdk/audioController';
import { useToast } from '../../utils/ToastContext';

interface MatchmakingModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeGame: GameStats;
  profile: PlayerProfile;
  onRoomJoined: (room: MultiplayerRoom, role: 'host' | 'guest') => void;
}

export const MatchmakingModal: React.FC<MatchmakingModalProps> = ({
  isOpen,
  onClose,
  activeGame,
  profile,
  onRoomJoined,
}) => {
  const { showToast } = useToast();
  const [createdRoom, setCreatedRoom] = useState<MultiplayerRoom | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleCreateRoom = async () => {
    setLoading(true);
    audioController.playCoin();
    const room = await multiplayerService.createRoom(activeGame.id, profile.name, profile.avatar);
    setCreatedRoom(room);
    setLoading(false);
  };

  const handleJoinRoom = async () => {
    if (!joinCode.trim()) return;
    setLoading(true);
    audioController.playClick();
    const room = await multiplayerService.joinRoom(joinCode.trim(), profile.name, profile.avatar);
    setLoading(false);
    if (!room) {
      audioController.playHit();
      showToast('Room Tidak Ditemukan', 'Periksa kembali 6 digit kode room teman Anda.', 'error');
      return;
    }
    audioController.playPowerup();
    showToast('Terhubung ke Room 1v1!', `Melawan ${room.host.name} di ${activeGame.title}`, 'success', '⚔️');
    onRoomJoined(room, 'guest');
    onClose();
  };

  const handleStartBotMatch = () => {
    audioController.playPowerup();
    const room = multiplayerService.createBotMatch(activeGame.id, profile.name, profile.avatar);
    showToast('Duel 1v1 Dimulai!', 'Melawan NEON-AI v2 secara real-time!', 'info', '🤖');
    onRoomJoined(room, 'host');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none"
      onClick={onClose}
      data-testid="matchmaking-modal"
    >
      <div
        className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Swords size={18} />
            </div>
            <div>
              <div className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider">
                REAL-TIME 1V1 LOBBY
              </div>
              <h3 className="text-sm sm:text-base font-display font-black text-white uppercase">
                Duel: {activeGame.title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Option 1: Create Room */}
        <div className="p-4 rounded-2xl bg-zinc-950/80 border border-white/[0.06] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Users size={14} className="text-indigo-400" /> Buat Room 1v1 (Kode 6-Digit)
            </span>
          </div>

          {createdRoom ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30">
                <div>
                  <span className="text-[10px] font-mono text-indigo-300 block">KODE ROOM ANDA:</span>
                  <span className="text-xl font-mono font-black tracking-widest text-white">
                    {createdRoom.code}
                  </span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(createdRoom.code);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copied ? 'Disalin' : 'Salin'}</span>
                </button>
              </div>
              <button
                onClick={() => {
                  onRoomJoined(createdRoom, 'host');
                  onClose();
                }}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold uppercase flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Masuk Arena sebagai Host</span>
                <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <button
              disabled={loading}
              onClick={handleCreateRoom}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold uppercase transition cursor-pointer"
            >
              Buat Kode Room Baru
            </button>
          )}
        </div>

        {/* Option 2: Join Room */}
        <div className="p-4 rounded-2xl bg-zinc-950/80 border border-white/[0.06] space-y-2.5">
          <span className="text-xs font-bold text-white block">Gabung ke Room Teman</span>
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={8}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="MASUKKAN KODE"
              className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs font-mono font-bold uppercase text-white placeholder:text-zinc-600 focus:outline-hidden focus:border-indigo-500"
            />
            <button
              disabled={loading || !joinCode.trim()}
              onClick={handleJoinRoom}
              className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-indigo-600 text-white text-xs font-mono font-bold uppercase transition cursor-pointer disabled:opacity-40"
            >
              Gabung
            </button>
          </div>
        </div>

        {/* Option 3: Instant Bot Duel */}
        <button
          onClick={handleStartBotMatch}
          className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-rose-500/15 to-indigo-500/15 hover:from-rose-500/25 hover:to-indigo-500/25 border border-rose-500/30 flex items-center justify-between text-left transition cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-400">
              <Bot size={18} />
            </div>
            <div>
              <div className="text-xs font-bold text-white uppercase">Simulasi Duel 1v1 vs NEON-AI</div>
              <div className="text-[10px] text-zinc-400">Balapan skor real-time melawan bot siber adaptif</div>
            </div>
          </div>
          <ArrowRight size={15} className="text-rose-400" />
        </button>
      </div>
    </div>
  );
};

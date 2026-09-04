import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, UserPlus, Check, X, Shield, Activity, Lock, Search, Trash2, Ban } from 'lucide-react';
import { FriendProfile, ActivityFeedItem, SocialPrivacySettings } from '../types';
import { socialService } from '../services/socialService';
import { audio } from '../utils/audio';

interface FriendsModalProps {
  currentUsername: string;
  onClose: () => void;
}

export default function FriendsModal({ currentUsername, onClose }: FriendsModalProps) {
  const [tab, setTab] = useState<'list' | 'requests' | 'activity' | 'privacy'>('list');
  const [friends, setFriends] = useState<FriendProfile[]>(socialService.getFriends());
  const [activities, setActivities] = useState<ActivityFeedItem[]>(socialService.getActivities());
  const [privacy, setPrivacy] = useState<SocialPrivacySettings>(socialService.getPrivacySettings());
  const [searchName, setSearchName] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const activeFriends = friends.filter(f => f.status === 'FRIENDS');
  const pendingReceived = friends.filter(f => f.status === 'PENDING_RECEIVED');
  const pendingSent = friends.filter(f => f.status === 'PENDING_SENT');
  const blockedUsers = friends.filter(f => f.status === 'BLOCKED');

  const handleSendRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchName.trim()) return;

    const res = socialService.sendFriendRequest(searchName, currentUsername);
    setStatusMsg({ text: res.message, isError: !res.success });
    if (res.success) {
      audio.playCoin();
      setSearchName('');
      setFriends(socialService.getFriends());
    } else {
      audio.playHit();
    }
  };

  const handleAccept = (uid: string) => {
    audio.playLevelUp();
    socialService.acceptFriendRequest(uid);
    setFriends(socialService.getFriends());
  };

  const handleReject = (uid: string) => {
    audio.playHit();
    socialService.rejectFriendRequest(uid);
    setFriends(socialService.getFriends());
  };

  const handleRemove = (uid: string) => {
    audio.playHit();
    socialService.removeFriend(uid);
    setFriends(socialService.getFriends());
  };

  const handleBlock = (uid: string) => {
    audio.playHit();
    socialService.blockUser(uid);
    setFriends(socialService.getFriends());
  };

  const handleUnblock = (uid: string) => {
    audio.playCoin();
    socialService.unblockUser(uid);
    setFriends(socialService.getFriends());
  };

  const handleUpdatePrivacy = (updates: Partial<SocialPrivacySettings>) => {
    audio.playCoin();
    const updated = { ...privacy, ...updates };
    setPrivacy(updated);
    socialService.savePrivacySettings(updated);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-sans select-none">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
        onClick={onClose}
      />

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden z-10"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Users size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-display font-black text-white tracking-wider uppercase">
                TEMAN & SOSIAL SIBER
              </h2>
              <p className="text-xs text-zinc-400 font-mono">
                {activeFriends.length} Teman Terhubung
              </p>
            </div>
          </div>
          <button
            onClick={() => { audio.playCoin(); onClose(); }}
            className="w-9 h-9 hover:bg-zinc-800 rounded-full transition flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 py-2 bg-zinc-950/80 border-b border-zinc-800 flex gap-2 overflow-x-auto">
          <button
            onClick={() => { audio.playHit(); setTab('list'); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              tab === 'list' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Users size={14} /> Daftar Teman ({activeFriends.length})
          </button>
          <button
            onClick={() => { audio.playHit(); setTab('requests'); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 relative ${
              tab === 'requests' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <UserPlus size={14} /> Permintaan
            {pendingReceived.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            )}
          </button>
          <button
            onClick={() => { audio.playHit(); setTab('activity'); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              tab === 'activity' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Activity size={14} /> Feed Aktivitas
          </button>
          <button
            onClick={() => { audio.playHit(); setTab('privacy'); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              tab === 'privacy' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Lock size={14} /> Privasi
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: LIST & ADD */}
          {tab === 'list' && (
            <div className="space-y-5">
              {/* Add Friend Form */}
              <form onSubmit={handleSendRequest} className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    placeholder="Masukkan username teman (cth: RAKA_NEO)..."
                    className="w-full pl-9 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white uppercase font-mono placeholder:normal-case placeholder:text-zinc-600 focus:border-indigo-500 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <UserPlus size={15} /> Tambah
                </button>
              </form>

              {statusMsg && (
                <div className={`p-3 rounded-xl text-xs font-mono ${statusMsg.isError ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                  {statusMsg.text}
                </div>
              )}

              {/* Friends List */}
              <div className="space-y-2.5">
                {activeFriends.length > 0 ? (
                  activeFriends.map((friend) => (
                    <div
                      key={friend.uid}
                      className="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800 hover:border-zinc-700 transition flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <span className="text-2xl p-1.5 bg-zinc-900 rounded-xl border border-zinc-800 block">
                            {friend.avatar}
                          </span>
                          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-950 ${
                            friend.isOnline ? 'bg-emerald-500' : 'bg-zinc-600'
                          }`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-white uppercase">{friend.name}</span>
                            {friend.masteryTitle && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 rounded">
                                {friend.masteryTitle}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                            {friend.isOnline ? (
                              <span className="text-emerald-400 font-bold">Online di Lobi</span>
                            ) : (
                              <span>Terakhir aktif baru saja</span>
                            )}
                            {friend.highestScoreGame && (
                              <span> • Best: {friend.highestScoreGame.gameTitle} ({friend.highestScoreGame.score})</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleRemove(friend.uid)}
                          title="Hapus Teman"
                          className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-900 transition cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                        <button
                          onClick={() => handleBlock(friend.uid)}
                          title="Blokir User"
                          className="p-2 rounded-lg text-zinc-500 hover:text-amber-400 hover:bg-zinc-900 transition cursor-pointer"
                        >
                          <Ban size={15} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-zinc-500 text-xs font-sans italic bg-zinc-950/40 rounded-2xl border border-zinc-800 p-4">
                    Belum ada teman. Tambahkan teman untuk bersaing di papan skor teman dan melihat aktivitas mereka!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: REQUESTS */}
          {tab === 'requests' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-mono font-bold text-zinc-400 uppercase mb-2">Permintaan Masuk ({pendingReceived.length})</h3>
                {pendingReceived.length > 0 ? (
                  <div className="space-y-2">
                    {pendingReceived.map((req) => (
                      <div key={req.uid} className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl">{req.avatar}</span>
                          <div>
                            <div className="text-xs font-bold text-white uppercase">{req.name}</div>
                            <div className="text-[10px] text-zinc-400">Ingin berteman dengan Anda</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAccept(req.uid)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                          >
                            <Check size={14} /> Terima
                          </button>
                          <button
                            onClick={() => handleReject(req.uid)}
                            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                          >
                            <X size={14} /> Tolak
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 italic">Tidak ada permintaan pertemanan masuk.</p>
                )}
              </div>

              <div className="pt-3 border-t border-zinc-800">
                <h3 className="text-xs font-mono font-bold text-zinc-400 uppercase mb-2">Permintaan Terkirim ({pendingSent.length})</h3>
                {pendingSent.length > 0 ? (
                  <div className="space-y-2">
                    {pendingSent.map((req) => (
                      <div key={req.uid} className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800 flex items-center justify-between text-xs">
                        <span className="text-zinc-300 font-bold uppercase">{req.name}</span>
                        <span className="text-[10px] font-mono text-amber-400">Menunggu Respon...</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 italic">Tidak ada permintaan terkirim.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ACTIVITY FEED */}
          {tab === 'activity' && (
            <div className="space-y-3">
              {activities.map((act) => (
                <div key={act.id} className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800 flex items-start gap-3">
                  <span className="text-2xl p-1 bg-zinc-900 rounded-lg">{act.userAvatar}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white uppercase">{act.userName}</span>
                      <span className="text-[10px] font-mono text-zinc-500">Baru saja</span>
                    </div>
                    <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed">{act.details}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: PRIVACY SETTINGS */}
          {tab === 'privacy' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold text-zinc-400 uppercase">Siapa yang dapat mengirim permintaan teman?</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleUpdatePrivacy({ allowFriendRequests: 'everyone' })}
                    className={`p-3 rounded-xl border text-left text-xs font-bold transition cursor-pointer ${
                      privacy.allowFriendRequests === 'everyone' ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-zinc-800 text-zinc-400'
                    }`}
                  >
                    Semua Pemain
                  </button>
                  <button
                    onClick={() => handleUpdatePrivacy({ allowFriendRequests: 'none' })}
                    className={`p-3 rounded-xl border text-left text-xs font-bold transition cursor-pointer ${
                      privacy.allowFriendRequests === 'none' ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-zinc-800 text-zinc-400'
                    }`}
                  >
                    Tutup (Tidak Ada)
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-mono font-bold text-zinc-400 uppercase">Tampilan Feed Aktivitas</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['public', 'friends_only', 'private'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => handleUpdatePrivacy({ showActivityFeed: mode })}
                      className={`p-2.5 rounded-xl border text-center text-xs font-bold capitalize transition cursor-pointer ${
                        privacy.showActivityFeed === mode ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-zinc-800 text-zinc-400'
                      }`}
                    >
                      {mode.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {blockedUsers.length > 0 && (
                <div className="pt-4 border-t border-zinc-800">
                  <h4 className="text-xs font-mono font-bold text-zinc-400 uppercase mb-2">Daftar Blokir ({blockedUsers.length})</h4>
                  <div className="space-y-2">
                    {blockedUsers.map(b => (
                      <div key={b.uid} className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs">
                        <span className="text-zinc-400 uppercase font-bold">{b.name}</span>
                        <button
                          onClick={() => handleUnblock(b.uid)}
                          className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-bold cursor-pointer"
                        >
                          Buka Blokir
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

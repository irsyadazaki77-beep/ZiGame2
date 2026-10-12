import React, { useState } from 'react';
import { FriendProfile, ActivityFeedItem, SocialPrivacySettings } from '../../types';
import { Users, UserPlus, Search, Check, X, Shield, Activity } from 'lucide-react';

interface ProfileFriendsProps {
  friends: FriendProfile[];
  activities: ActivityFeedItem[];
  privacy: SocialPrivacySettings;
  friendSearchName: string;
  setFriendSearchName: (val: string) => void;
  friendStatusMsg: { text: string; isError: boolean } | null;
  onSendFriendRequest: (e: React.FormEvent) => void;
  onAcceptFriend: (uid: string) => void;
  onRejectFriend: (uid: string) => void;
  onRemoveFriend: (uid: string) => void;
}

export const ProfileFriends: React.FC<ProfileFriendsProps> = ({
  friends,
  activities,
  privacy,
  friendSearchName,
  setFriendSearchName,
  friendStatusMsg,
  onSendFriendRequest,
  onAcceptFriend,
  onRejectFriend,
  onRemoveFriend
}) => {
  const [subTab, setSubTab] = useState<'list' | 'activity'>('list');

  const pendingRequests = friends.filter(f => f.status === 'PENDING_RECEIVED');
  const acceptedFriends = friends.filter(f => f.status === 'FRIENDS');

  return (
    <div className="space-y-6">
      {/* Subtab navigation */}
      <div className="flex items-center justify-between bg-surface-card border border-border-subtle rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSubTab('list')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold uppercase transition cursor-pointer ${
              subTab === 'list' ? 'bg-indigo-600 text-white' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Daftar Teman ({acceptedFriends.length})
          </button>
          <button
            onClick={() => setSubTab('activity')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold uppercase transition cursor-pointer ${
              subTab === 'activity' ? 'bg-indigo-600 text-white' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Aktivitas ({activities.length})
          </button>
        </div>
      </div>

      {subTab === 'list' ? (
        <div className="space-y-6">
          {/* Add Friend Form */}
          <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <h3 className="font-display font-black text-sm uppercase text-text-primary tracking-wide flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-indigo-500" />
              TAMBAH TEMAN SIBER
            </h3>
            <form onSubmit={onSendFriendRequest} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={friendSearchName}
                  onChange={(e) => setFriendSearchName(e.target.value)}
                  placeholder="Masukkan username teman..."
                  className="w-full bg-surface-subtle border border-border-medium rounded-xl pl-10 pr-4 py-2 text-xs font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                KIRIM
              </button>
            </form>
            {friendStatusMsg && (
              <p className={`text-xs font-mono ${friendStatusMsg.isError ? 'text-rose-400' : 'text-emerald-400'}`}>
                {friendStatusMsg.text}
              </p>
            )}
          </div>

          {/* Pending Requests */}
          {pendingRequests.length > 0 && (
            <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
              <h3 className="font-display font-black text-sm uppercase text-amber-400 tracking-wide">
                PERMINTAAN PERTEMANAN MASUK ({pendingRequests.length})
              </h3>
              <div className="space-y-2">
                {pendingRequests.map((req) => (
                  <div key={req.uid} className="flex items-center justify-between p-3 bg-surface-subtle border border-border-subtle rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{req.avatar}</div>
                      <div>
                        <span className="font-bold text-xs text-text-primary block">{req.name}</span>
                        <span className="text-[10px] font-mono text-text-secondary">{req.uid}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onAcceptFriend(req.uid)}
                        className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition cursor-pointer"
                        title="Terima"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => onRejectFriend(req.uid)}
                        className="p-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition cursor-pointer"
                        title="Tolak"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Friends List */}
          <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <h3 className="font-display font-black text-sm uppercase text-text-primary tracking-wide">
              DAFTAR TEMAN ({acceptedFriends.length})
            </h3>
            {acceptedFriends.length === 0 ? (
              <p className="text-xs font-mono text-text-secondary py-6 text-center">
                Belum memiliki teman. Tambahkan teman menggunakan form di atas!
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {acceptedFriends.map((f) => (
                  <div key={f.uid} className="flex items-center justify-between p-3 bg-surface-subtle border border-border-subtle rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{f.avatar}</div>
                      <div>
                        <span className="font-bold text-xs text-text-primary block">{f.name}</span>
                        <span className="text-[10px] font-mono text-text-secondary">{f.masteryTitle || 'Pemain Tamu'}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => onRemoveFriend(f.uid)}
                      className="p-1.5 text-text-muted hover:text-rose-400 rounded-lg transition cursor-pointer"
                      title="Hapus Teman"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Activity Feed */
        <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <h3 className="font-display font-black text-sm uppercase text-text-primary tracking-wide flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-500" />
            AKTIVITAS TERBARU
          </h3>
          {activities.length === 0 ? (
            <p className="text-xs font-mono text-text-secondary py-6 text-center">
              Belum ada aktivitas terekam.
            </p>
          ) : (
            <div className="space-y-3">
              {activities.map((act) => (
                <div key={act.id} className="p-3 bg-surface-subtle border border-border-subtle rounded-xl flex items-center gap-3 text-xs">
                  <div className="text-xl">{act.userAvatar}</div>
                  <div className="flex-1">
                    <span className="font-bold text-text-primary">{act.userName} </span>
                    <span className="text-text-secondary">{act.details}</span>
                  </div>
                  <span className="text-[10px] font-mono text-text-muted">
                    {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

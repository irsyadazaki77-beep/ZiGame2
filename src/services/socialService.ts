import { FriendProfile, RelationshipStatus, ActivityFeedItem, SocialPrivacySettings } from '../types';

const INITIAL_BOT_FRIENDS: FriendProfile[] = [];

const INITIAL_ACTIVITIES: ActivityFeedItem[] = [];

export const socialService = {
  getFriends(): FriendProfile[] {
    try {
      const raw = localStorage.getItem('zigame_friends_list_v2');
      return raw ? JSON.parse(raw) : INITIAL_BOT_FRIENDS;
    } catch {
      return INITIAL_BOT_FRIENDS;
    }
  },

  saveFriends(friends: FriendProfile[]) {
    try {
      localStorage.setItem('zigame_friends_list_v2', JSON.stringify(friends));
    } catch {
      // Storage safe
    }
  },

  getActivities(): ActivityFeedItem[] {
    try {
      const raw = localStorage.getItem('zigame_activity_feed_v2');
      return raw ? JSON.parse(raw) : INITIAL_ACTIVITIES;
    } catch {
      return INITIAL_ACTIVITIES;
    }
  },

  saveActivities(activities: ActivityFeedItem[]) {
    try {
      localStorage.setItem('zigame_activity_feed_v2', JSON.stringify(activities.slice(-50)));
    } catch {
      // Storage safe
    }
  },

  getPrivacySettings(): SocialPrivacySettings {
    try {
      const raw = localStorage.getItem('zigame_social_privacy_v2');
      return raw ? JSON.parse(raw) : { allowFriendRequests: 'everyone', showActivityFeed: 'public' };
    } catch {
      return { allowFriendRequests: 'everyone', showActivityFeed: 'public' };
    }
  },

  savePrivacySettings(settings: SocialPrivacySettings) {
    try {
      localStorage.setItem('zigame_social_privacy_v2', JSON.stringify(settings));
    } catch {
      // Storage safe
    }
  },

  sendFriendRequest(targetUsername: string, currentUserName: string): { success: boolean; message: string; friend?: FriendProfile } {
    const cleanTarget = targetUsername.trim().toUpperCase();
    const cleanCurrent = currentUserName.trim().toUpperCase();

    if (!cleanTarget) {
      return { success: false, message: 'Nama pemain tidak boleh kosong.' };
    }

    // 1. Prevent self request
    if (cleanTarget === cleanCurrent) {
      return { success: false, message: 'Tidak dapat mengirim permintaan pertemanan ke diri sendiri.' };
    }

    const friends = this.getFriends();
    const existing = friends.find(f => f.name.toUpperCase() === cleanTarget);

    if (existing) {
      if (existing.status === 'BLOCKED') {
        return { success: false, message: 'Pemain ini diblokir.' };
      }
      if (existing.status === 'FRIENDS') {
        return { success: false, message: 'Anda sudah berteman dengan pemain ini.' };
      }
      if (existing.status === 'PENDING_SENT') {
        return { success: false, message: 'Permintaan pertemanan sudah dikirim sebelumnya.' };
      }
      if (existing.status === 'PENDING_RECEIVED') {
        // Auto accept if other party already requested
        existing.status = 'FRIENDS';
        this.saveFriends(friends);
        return { success: true, message: `Permintaan diterima! Anda dan ${existing.name} sekarang berteman.`, friend: existing };
      }
    }

    // Create pending sent request
    const newFriend: FriendProfile = {
      uid: 'user_' + Math.random().toString(36).substring(2, 9),
      name: cleanTarget,
      avatar: '👾',
      colorTheme: '#6366f1',
      status: 'PENDING_SENT',
      isOnline: false,
      lastActive: Date.now()
    };

    friends.push(newFriend);
    this.saveFriends(friends);

    return {
      success: true,
      message: `Permintaan pertemanan terkirim ke ${cleanTarget}!`,
      friend: newFriend
    };
  },

  acceptFriendRequest(uid: string): boolean {
    const friends = this.getFriends();
    const target = friends.find(f => f.uid === uid);
    if (target && target.status === 'PENDING_RECEIVED') {
      target.status = 'FRIENDS';
      target.isOnline = true;
      this.saveFriends(friends);
      return true;
    }
    return false;
  },

  rejectFriendRequest(uid: string): boolean {
    const friends = this.getFriends();
    const filtered = friends.filter(f => f.uid !== uid);
    this.saveFriends(filtered);
    return true;
  },

  removeFriend(uid: string): boolean {
    const friends = this.getFriends();
    const filtered = friends.filter(f => f.uid !== uid);
    this.saveFriends(filtered);
    return true;
  },

  blockUser(uid: string, name?: string): boolean {
    const friends = this.getFriends();
    const target = friends.find(f => f.uid === uid);
    if (target) {
      target.status = 'BLOCKED';
    } else if (name) {
      friends.push({
        uid,
        name: name.toUpperCase(),
        avatar: '🚫',
        colorTheme: '#71717a',
        status: 'BLOCKED',
        isOnline: false
      });
    }
    this.saveFriends(friends);
    return true;
  },

  unblockUser(uid: string): boolean {
    const friends = this.getFriends();
    const filtered = friends.filter(f => f.uid !== uid);
    this.saveFriends(filtered);
    return true;
  },

  publishActivity(item: Omit<ActivityFeedItem, 'id' | 'timestamp'>) {
    const privacy = this.getPrivacySettings();
    if (privacy.showActivityFeed === 'private') return;

    const activities = this.getActivities();
    const newAct: ActivityFeedItem = {
      ...item,
      id: 'act_' + Date.now().toString(36),
      timestamp: Date.now()
    };
    activities.unshift(newAct);
    this.saveActivities(activities);
  }
};

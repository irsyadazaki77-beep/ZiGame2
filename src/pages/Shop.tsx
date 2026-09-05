import React, { useState, useEffect } from 'react';
import { PlayerProfile as ProfileType, ShopItem } from '../types';
import { useConfirm } from '../utils/ConfirmContext';
import { useToast } from '../utils/ToastContext';
import { audio } from '../utils/audio';
import { Check, Sparkles } from 'lucide-react';

import { ShopBanner } from '../components/shop/ShopBanner';
import { GachaMachineWidget } from '../components/shop/GachaMachineWidget';
import { CoinGambleWidget } from '../components/shop/CoinGambleWidget';
import { storageService } from '../services/storageService';
import { economyService } from '../services/economyService';

interface ShopProps {
  profile: ProfileType;
  onUpdateProfile: (profile: ProfileType) => void;
}

const PREMIUM_AVATARS: ShopItem[] = [
  { id: 'av_phoenix', name: '🔥 Phoenix Core', type: 'avatar', value: '🔥', cost: 300, description: 'Avatar berapi legendaris dengan partikel energi termal menyala berkilauan.' },
  { id: 'av_spacetime', name: '🌌 Space Time', type: 'avatar', value: '🌌', cost: 250, description: 'Pengendali realitas siber dengan partikel komet bintang futuristik berkilau.' },
  { id: 'av_invader', name: '👾 Cyber Invader', type: 'avatar', value: '👾', cost: 100, description: 'Sebuah piksel alien penyerang legendaris dari masa lalu.' },
  { id: 'av_king', name: '👑 Retro King', type: 'avatar', value: '👑', cost: 150, description: 'Tunjukkan kedaulatan Anda atas semua permainan lobi arkade.' },
  { id: 'av_astro', name: '🪐 Astro Explorer', type: 'avatar', value: '🪐', cost: 120, description: 'Penjelajah nebula kosmis dengan baju pelindung holografis.' },
  { id: 'av_dino', name: '🦖 Pixel Dino', type: 'avatar', value: '🦖', cost: 90, description: 'Dino pelari legendaris pelindung koneksi offline.' },
  { id: 'av_unicorn', name: '🦄 Neon Unicorn', type: 'avatar', value: '🦄', cost: 110, description: 'Keajaiban mistis berkilau dengan radiasi warna fuchsia.' },
  { id: 'av_fox', name: '🦊 Cyber Fox', type: 'avatar', value: '🦊', cost: 130, description: 'Rubah mekanis cerdas dengan implan siber canggih.' },
  { id: 'av_ufo', name: '🛸 UFO Alien', type: 'avatar', value: '🛸', cost: 160, description: 'Kapal piring terbang luar angkasa penculik koin-koin arkade.' },
  { id: 'av_wizard', name: '🧙‍♂️ Retro Wizard', type: 'avatar', value: '🧙‍♂️', cost: 200, description: 'Penyihir legendaris pemanipulasi bit dan gerbang logika.' },
];

const PREMIUM_THEMES: ShopItem[] = [
  { id: 'th_crimson', name: '🔴 Neon Crimson', type: 'theme', value: '#dc2626', cost: 150, description: 'Tema merah neon crimson membara yang memancarkan aura estetika retro dinamis.', themePreviewBg: 'from-red-600 via-red-800 to-zinc-950' },
  { id: 'th_ruby', name: '💎 Neon Ruby', type: 'theme', value: '#e11d48', cost: 150, description: 'Tema merah ruby siber futuristik terinspirasi dari permata laser cyberpunk.', themePreviewBg: 'from-rose-500 via-rose-700 to-zinc-950' },
  { id: 'th_amber', name: '🔥 Flare Amber', type: 'theme', value: '#ea580c', cost: 150, description: 'Tema merah oranye flare berenergi tinggi yang memanaskan lobi arkade.', themePreviewBg: 'from-orange-600 via-red-800 to-zinc-950' },
  { id: 'th_rose', name: '🌹 Neon Rose', type: 'theme', value: '#f43f5e', cost: 150, description: 'Tema mawar neon elektrik yang membawa energi warna merah lembut bergaya.', themePreviewBg: 'from-rose-400 via-pink-700 to-zinc-950' },
];

export default function Shop({ profile, onUpdateProfile }: ShopProps) {
  const [unlockedAvatars, setUnlockedAvatars] = useState<string[]>(() => storageService.getUnlockedAvatars());
  const [unlockedThemes, setUnlockedThemes] = useState<string[]>(() => storageService.getUnlockedThemes());

  const [tab, setTab] = useState<'all' | 'avatars' | 'themes'>('all');
  const [gachaState, setGachaState] = useState<'idle' | 'spinning' | 'revealed'>('idle');
  const [gachaReward, setGachaReward] = useState<ShopItem | null>(null);
  const [gachaPreviewItem, setGachaPreviewItem] = useState<ShopItem | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const { showToast } = useToast();
  const { confirm } = useConfirm();

  useEffect(() => {
    storageService.saveUnlockedAvatars(unlockedAvatars);
  }, [unlockedAvatars]);

  useEffect(() => {
    storageService.saveUnlockedThemes(unlockedThemes);
  }, [unlockedThemes]);

  const handleBuyItem = async (item: ShopItem) => {
    if (profile.coins < item.cost) {
      audio.playHit();
      showToast('Koin Kurang', 'Koin Anda tidak mencukupi untuk membeli item ini!', 'error');
      return;
    }

    const isConfirmed = await confirm({
      title: 'Konfirmasi Pembelian',
      message: `Apakah Anda yakin ingin membeli "${item.name}" seharga ${item.cost}🪙?`,
      confirmText: 'Beli Sekarang',
      cancelText: 'Batal',
    });

    if (!isConfirmed) return;

    audio.playCoin();
    
    // Server-authoritative purchase
    const result = await economyService.buyItem(item.id);
    if (!result.success) {
      audio.playHit();
      showToast('Pembelian Gagal', result.message || 'Gagal memproses transaksi di server', 'error');
      return;
    }

    const updatedProfile = {
      ...profile,
      coins: result.remainingCoins ?? profile.coins - item.cost,
    };

    if (item.type === 'avatar') {
      const newAvatars = unlockedAvatars.includes(item.value) ? unlockedAvatars : [...unlockedAvatars, item.value];
      setUnlockedAvatars(newAvatars);
      updatedProfile.unlockedAvatars = newAvatars;
      updatedProfile.avatar = item.value;
    } else {
      const newThemes = unlockedThemes.includes(item.value) ? unlockedThemes : [...unlockedThemes, item.value];
      setUnlockedThemes(newThemes);
      updatedProfile.unlockedThemes = newThemes;
      updatedProfile.colorTheme = item.value;
    }

    onUpdateProfile(updatedProfile);
    showToast('Pembelian Berhasil', `${item.name} berhasil dibeli dan dipasang ke profil Anda!`, 'success');
  };

  const handleSpinGacha = async () => {
    if (profile.coins < 50 || gachaState !== 'idle') return;

    audio.playCoin();
    setGachaState('spinning');
    const allPool = [...PREMIUM_AVATARS, ...PREMIUM_THEMES];

    const result = await economyService.gacha(profile.name); // Server authoritative

    if (!result.success) {
      setGachaState('idle');
      audio.playHit();
      showToast('Gacha Gagal', result.message || 'Gagal memproses transaksi gacha.', 'error');
      return;
    }

    // Deduct 50 coins immediately in UI state
    onUpdateProfile({
      ...profile,
      coins: result.remainingCoins ?? profile.coins - 50,
    });

    const finalReward = allPool.find(item => item.id === result.rewardId);
    
    let rolls = 0;
    const interval = setInterval(() => {
      const rand = allPool[Math.floor(Math.random() * allPool.length)];
      setGachaPreviewItem(rand);
      audio.playClick();
      rolls++;

      if (rolls >= 15) {
        clearInterval(interval);
        
        if (!finalReward) {
          setGachaState('idle');
          return;
        }

        setGachaReward(finalReward);
        setGachaState('revealed');
        audio.playScore();

        // Unlock reward
        if (finalReward.type === 'avatar' && !unlockedAvatars.includes(finalReward.value)) {
          const newAvatars = [...unlockedAvatars, finalReward.value];
          setUnlockedAvatars(newAvatars);
          onUpdateProfile({ ...profile, coins: result.remainingCoins ?? profile.coins - 50, unlockedAvatars: newAvatars });
        } else if (finalReward.type === 'theme' && !unlockedThemes.includes(finalReward.value)) {
          const newThemes = [...unlockedThemes, finalReward.value];
          setUnlockedThemes(newThemes);
          onUpdateProfile({ ...profile, coins: result.remainingCoins ?? profile.coins - 50, unlockedThemes: newThemes });
        }
      }
    }, 120);
  };

  const handleCloseGachaReward = () => {
    if (gachaReward) {
      if (gachaReward.type === 'avatar') {
        onUpdateProfile({ ...profile, avatar: gachaReward.value });
      } else {
        onUpdateProfile({ ...profile, colorTheme: gachaReward.value });
      }
    }
    setGachaState('idle');
    setGachaReward(null);
  };

  const handleGamble = async (bet: number, choice: 'heads' | 'tails') => {
    const res = await economyService.gamble(bet, choice, profile.name);
    
    if (res.success && typeof res.changeCoins === 'number') {
      onUpdateProfile({
        ...profile,
        coins: res.remainingCoins ?? profile.coins + res.changeCoins,
      });
      const msg = res.won 
        ? `BERHASIL! Koin melayang di sisi ${res.outcomeSide?.toUpperCase()}! Anda menang +${bet}🪙!`
        : `SAYANG! Koin mendarat di sisi ${res.outcomeSide?.toUpperCase()}. Anda kehilangan ${bet}🪙.`;
      
      setTimeout(() => {
        showToast(res.won ? 'Menang Pertaruhan!' : 'Kalah Pertaruhan', msg, res.won ? 'success' : 'error');
      }, 1200);
    } else {
      setTimeout(() => {
        showToast('Gagal', res.message || 'Gagal terhubung ke server', 'error');
      }, 1200);
    }
    
    return res;
  };

  const visibleItems = tab === 'avatars' ? PREMIUM_AVATARS : tab === 'themes' ? PREMIUM_THEMES : [...PREMIUM_AVATARS, ...PREMIUM_THEMES];

  return (
    <div className="max-w-7xl mx-auto space-y-8 select-none font-sans" id="shop-page-root">
      {/* Banner */}
      <ShopBanner
        profile={profile}
        tab={tab}
        setTab={setTab}
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      {/* Gacha & Gamble Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GachaMachineWidget
          coins={profile.coins}
          unlockedAvatars={unlockedAvatars}
          unlockedThemes={unlockedThemes}
          onSpinGacha={handleSpinGacha}
          gachaState={gachaState}
          gachaReward={gachaReward}
          gachaPreviewItem={gachaPreviewItem}
          onCloseReward={handleCloseGachaReward}
        />

        <CoinGambleWidget
          coins={profile.coins}
          onGamble={handleGamble}
        />
      </div>

      {/* Items Showcase Catalog */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold font-display text-white uppercase tracking-wider flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-400" />
            Katalog Kosmetik ({visibleItems.length} Item)
          </h2>
          <span className="text-xs font-mono text-zinc-500">
            Saldo: <strong className="text-amber-400">{profile.coins}🪙</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visibleItems.map((item) => {
            const isUnlocked = item.type === 'avatar' 
              ? unlockedAvatars.includes(item.value) 
              : unlockedThemes.includes(item.value);

            const isEquipped = item.type === 'avatar'
              ? profile.avatar === item.value
              : profile.colorTheme === item.value;

            return (
              <div
                key={item.id}
                className="bg-[#0f131c] hover:bg-[#151a26] border border-white/[0.06] hover:border-indigo-500/40 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 shadow-sm relative group"
              >
                <div>
                  {/* Item Preview Icon / Palette */}
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-zinc-950 border border-white/10 flex items-center justify-center text-2xl mb-3.5 shadow-inner group-hover:scale-105 transition-transform">
                    {item.type === 'avatar' ? (
                      item.value
                    ) : (
                      <div className="w-8 h-8 rounded-full border border-white/20 shadow-md" style={{ backgroundColor: item.value }} />
                    )}
                  </div>

                  <div className="text-center space-y-1">
                    <h3 className="font-display font-bold text-xs sm:text-sm text-white uppercase tracking-wide group-hover:text-indigo-400 transition-colors">
                      {item.name}
                    </h3>
                    <p className="text-xs text-zinc-400 font-sans leading-relaxed line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Bottom Action Button */}
                <div className="mt-5">
                  {isEquipped ? (
                    <div className="w-full py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono font-bold text-xs rounded-xl flex items-center justify-center gap-1.5">
                      <Check size={14} /> DIPASANG
                    </div>
                  ) : isUnlocked ? (
                    <button
                      onClick={() => {
                        audio.playCoin();
                        if (item.type === 'avatar') {
                          onUpdateProfile({ ...profile, avatar: item.value });
                        } else {
                          onUpdateProfile({ ...profile, colorTheme: item.value });
                        }
                        showToast('Profil Diperbarui', `${item.name} berhasil dipasang!`, 'success');
                      }}
                      className="w-full py-2 bg-[#151a26] hover:bg-zinc-800 text-zinc-200 hover:text-white font-mono font-bold text-xs rounded-xl border border-white/10 transition cursor-pointer"
                    >
                      PASANG SEKARANG
                    </button>
                  ) : (
                    <button
                      onClick={() => handleBuyItem(item)}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-bold text-xs rounded-xl shadow-sm transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      BELI ({item.cost}🪙)
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Guide Modal Popup */}
      {isGuideOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f131c] border border-white/10 p-6 rounded-2xl max-w-md w-full text-zinc-300 font-sans space-y-4 shadow-2xl">
            <h3 className="text-base font-bold font-display text-white uppercase tracking-wide">PANDUAN TOKO & KOIN</h3>
            <div className="text-xs leading-relaxed text-zinc-400 space-y-2">
              <p>• Koin emas didapatkan setiap kali Anda bermain atau menyelesaikan Misi Harian.</p>
              <p>• Item kosmetik yang dibeli tersimpan permanen di cloud save profil akun Anda.</p>
              <p>• Gunakan Mesin Gacha (50 koin) untuk kesempatan mendapatkan item premium acak.</p>
            </div>
            <button
              onClick={() => setIsGuideOpen(false)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-bold text-xs rounded-xl transition cursor-pointer"
            >
              MENGERTI
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

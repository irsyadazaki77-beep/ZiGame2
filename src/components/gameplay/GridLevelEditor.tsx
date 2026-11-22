import React, { useState } from 'react';
import { Grid2X2, Copy, Check, Upload, Play, Trash2, Save, Sparkles } from 'lucide-react';
import { UgcCustomLevel, UgcTileType, ugcLevelService } from '../../services/ugcLevelService';
import { audioController } from '../../sdk/audioController';
import { useToast } from '../../utils/ToastContext';

interface GridLevelEditorProps {
  authorName: string;
  onPlayLevel?: (level: UgcCustomLevel) => void;
}

const TILE_PALETTE: Array<{ type: UgcTileType; label: string; color: string; icon: string }> = [
  { type: 0, label: 'Lantai Kosong', color: 'bg-zinc-900 border-zinc-800', icon: '·' },
  { type: 1, label: 'Dinding Siber', color: 'bg-indigo-600 border-indigo-400', icon: '🧱' },
  { type: 2, label: 'Orb Energi', color: 'bg-amber-500/30 border-amber-400', icon: '⚡' },
  { type: 3, label: 'Jebakan Laser', color: 'bg-rose-500/30 border-rose-400', icon: '🔥' },
  { type: 4, label: 'Portal Finish', color: 'bg-emerald-500/30 border-emerald-400', icon: '🌀' },
];

export const GridLevelEditor: React.FC<GridLevelEditorProps> = ({ authorName, onPlayLevel }) => {
  const { showToast } = useToast();
  const gridSize = 8;
  const [title, setTitle] = useState('Arena Siber Kustom');
  const [targetGame, setTargetGame] = useState('maze-runner');
  const [activeBrush, setActiveBrush] = useState<UgcTileType>(1);
  const [tiles, setTiles] = useState<UgcTileType[]>(() => Array(gridSize * gridSize).fill(0));
  const [savedLevels, setSavedLevels] = useState<UgcCustomLevel[]>(() => ugcLevelService.getSavedLevels());
  const [importCode, setImportCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  const handleTileClick = (index: number) => {
    audioController.playClick();
    setTiles((prev) => {
      const next = [...prev];
      next[index] = next[index] === activeBrush ? 0 : activeBrush;
      return next;
    });
  };

  const handleSaveAndShare = () => {
    audioController.playCoin();
    const newLevel: UgcCustomLevel = {
      id: `ugc_${Date.now()}`,
      title: title.trim() || 'Arena Tanpa Nama',
      author: authorName || 'Player',
      gameId: targetGame,
      gridSize,
      tiles,
      createdAt: Date.now(),
    };
    const updated = ugcLevelService.saveLevel(newLevel);
    setSavedLevels(updated);
    const code = ugcLevelService.encodeLevelCode(newLevel);
    navigator.clipboard?.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
    showToast('Level Disimpan & Kode Disalin!', 'Bagikan kode ZGLVL ke teman untuk dimainkan.', 'success', '🗺️');
  };

  const handleImportCode = () => {
    const decoded = ugcLevelService.decodeLevelCode(importCode);
    if (!decoded) {
      audioController.playHit();
      showToast('Kode Level Tidak Valid', 'Pastikan kode diawali dengan ZGLVL-.', 'error');
      return;
    }
    audioController.playPowerup();
    setTitle(decoded.title);
    setTargetGame(decoded.gameId);
    setTiles(decoded.tiles);
    const updated = ugcLevelService.saveLevel(decoded);
    setSavedLevels(updated);
    setImportCode('');
    showToast('Level Berhasil Diimpor!', `Memuat "${decoded.title}" karya ${decoded.author}`, 'success', '✨');
  };

  return (
    <div className="space-y-6" data-testid="ugc-level-editor">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive 8x8 Grid Canvas & Brush Palette */}
        <div className="lg:col-span-7 p-5 rounded-3xl bg-surface-card border border-border-subtle space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-display font-black text-text-primary uppercase flex items-center gap-2">
                <Grid2X2 size={16} className="text-indigo-400" />
                Sandbox Level Creator (8x8)
              </h3>
              <p className="text-xs text-text-secondary">
                Pilih elemen di bawah lalu ketuk sel grid untuk merancang peta tantanganmu sendiri.
              </p>
            </div>
            <button
              onClick={() => {
                audioController.playHit();
                setTiles(Array(gridSize * gridSize).fill(0));
              }}
              className="px-3 py-1.5 rounded-xl bg-surface-subtle hover:bg-rose-500/15 text-text-secondary hover:text-rose-400 border border-border-subtle text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition"
            >
              <Trash2 size={13} /> Reset Grid
            </button>
          </div>

          {/* Title & Game Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              maxLength={32}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nama Peta / Level..."
              className="px-3.5 py-2 rounded-xl bg-surface-subtle border border-border-subtle text-xs font-bold text-text-primary focus:outline-hidden focus:border-indigo-500"
            />
            <select
              value={targetGame}
              onChange={(e) => setTargetGame(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-surface-subtle border border-border-subtle text-xs font-mono font-bold text-text-primary focus:outline-hidden focus:border-indigo-500"
            >
              <option value="maze-runner">Maze Runner 3D</option>
              <option value="world-box">World Box Sandbox 3D</option>
              <option value="snake">Pixel Snake 3D</option>
            </select>
          </div>

          {/* Brush Palette */}
          <div className="flex flex-wrap gap-1.5">
            {TILE_PALETTE.map((item) => (
              <button
                key={item.type}
                onClick={() => {
                  audioController.playClick();
                  setActiveBrush(item.type);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                  activeBrush === item.type
                    ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                    : 'bg-surface-subtle text-text-secondary border-border-subtle hover:text-text-primary'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* 8x8 Interactive Grid */}
          <div className="grid grid-cols-8 gap-1.5 max-w-sm mx-auto aspect-square p-3 rounded-2xl bg-zinc-950 border border-white/10">
            {tiles.map((tile, idx) => {
              const meta = TILE_PALETTE.find((p) => p.type === tile) || TILE_PALETTE[0];
              return (
                <button
                  key={idx}
                  onClick={() => handleTileClick(idx)}
                  aria-label={`Grid sel ${idx + 1}`}
                  className={`w-full h-full rounded-lg border flex items-center justify-center text-sm transition active:scale-90 cursor-pointer ${meta.color}`}
                >
                  {meta.icon}
                </button>
              );
            })}
          </div>

          {/* Save & Share Button */}
          <button
            onClick={handleSaveAndShare}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-bold text-xs uppercase flex items-center justify-center gap-2 shadow-md cursor-pointer transition"
          >
            {copiedCode ? <Check size={14} /> : <Save size={14} />}
            <span>{copiedCode ? 'Tersimpan & Kode ZGLVL Disalin!' : 'Simpan Level & Salin Kode Share'}</span>
          </button>
        </div>

        {/* Right: Import Code & Community Levels Catalog */}
        <div className="lg:col-span-5 space-y-4">
          {/* Import Box */}
          <div className="p-5 rounded-3xl bg-surface-card border border-border-subtle space-y-3">
            <h4 className="text-xs font-display font-black text-text-primary uppercase flex items-center gap-1.5">
              <Upload size={14} className="text-emerald-400" /> Impor Kode Level Komunitas
            </h4>
            <div className="flex gap-2">
              <input
                type="text"
                value={importCode}
                onChange={(e) => setImportCode(e.target.value)}
                placeholder="Tempel kode ZGLVL-..."
                className="flex-1 px-3 py-2 rounded-xl bg-surface-subtle border border-border-subtle text-xs font-mono text-text-primary focus:outline-hidden focus:border-indigo-500"
              />
              <button
                onClick={handleImportCode}
                disabled={!importCode.trim()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-mono font-bold uppercase cursor-pointer transition"
              >
                Impor
              </button>
            </div>
          </div>

          {/* Community & Saved Levels List */}
          <div className="p-5 rounded-3xl bg-surface-card border border-border-subtle space-y-3">
            <h4 className="text-xs font-display font-black text-text-primary uppercase flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-400" /> Katalog Peta Kustom ({savedLevels.length})
            </h4>
            <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
              {savedLevels.map((lvl) => (
                <div
                  key={lvl.id}
                  className="p-3 rounded-2xl bg-surface-subtle border border-border-subtle flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-text-primary truncate">{lvl.title}</div>
                    <div className="text-[10px] font-mono text-text-muted">
                      Oleh {lvl.author} • {lvl.gameId}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        const code = ugcLevelService.encodeLevelCode(lvl);
                        navigator.clipboard?.writeText(code);
                        showToast('Kode Disalin', `Kode level "${lvl.title}" disalin ke clipboard.`, 'info');
                      }}
                      className="p-2 rounded-lg bg-surface-card hover:bg-surface-hover text-text-secondary hover:text-text-primary border border-border-subtle cursor-pointer"
                      title="Salin Kode Level"
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      onClick={() => {
                        audioController.playPowerup();
                        if (onPlayLevel) onPlayLevel(lvl);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-mono font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Play size={11} /> Main
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

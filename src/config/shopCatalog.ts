/**
 * Authoritative Server Shop Catalog
 * ZiGame 2.0 Stabilization & Production Hardening
 * 
 * Single source of truth for all purchasable items, costs, and metadata.
 * Client-submitted cost, type, or value MUST NEVER be trusted by the server.
 */

export type ShopItemType = 'avatar' | 'theme' | 'consumable';

export interface AuthoritativeCatalogItem {
  id: string;
  name: string;
  type: ShopItemType;
  value: string;
  cost: number;
  description: string;
  active: boolean;
  purchasable: boolean;
  stackable: boolean;
}

export const SERVER_SHOP_CATALOG: Record<string, AuthoritativeCatalogItem> = {
  // Avatars
  'av_phoenix': {
    id: 'av_phoenix',
    name: 'Phoenix Core',
    type: 'avatar',
    value: '🔥',
    cost: 300,
    description: 'Avatar berapi legendaris dengan partikel energi termal.',
    active: true,
    purchasable: true,
    stackable: false
  },
  'av_spacetime': {
    id: 'av_spacetime',
    name: 'Space Time',
    type: 'avatar',
    value: '🌌',
    cost: 250,
    description: 'Pengendali realitas siber dengan partikel komet bintang futuristik.',
    active: true,
    purchasable: true,
    stackable: false
  },
  'av_invader': {
    id: 'av_invader',
    name: 'Cyber Invader',
    type: 'avatar',
    value: '👾',
    cost: 100,
    description: 'Piksel alien penyerang legendaris dari masa lalu.',
    active: true,
    purchasable: true,
    stackable: false
  },
  'av_king': {
    id: 'av_king',
    name: 'Retro King',
    type: 'avatar',
    value: '👑',
    cost: 150,
    description: 'Kedaulatan atas semua arena arkade.',
    active: true,
    purchasable: true,
    stackable: false
  },
  'av_astro': {
    id: 'av_astro',
    name: 'Astro Explorer',
    type: 'avatar',
    value: '🪐',
    cost: 120,
    description: 'Penjelajah nebula kosmis dengan baju pelindung holografis.',
    active: true,
    purchasable: true,
    stackable: false
  },
  'av_dino': {
    id: 'av_dino',
    name: 'Pixel Dino',
    type: 'avatar',
    value: '🦖',
    cost: 90,
    description: 'Dino pelari legendaris pelindung koneksi offline.',
    active: true,
    purchasable: true,
    stackable: false
  },
  'av_unicorn': {
    id: 'av_unicorn',
    name: 'Neon Unicorn',
    type: 'avatar',
    value: '🦄',
    cost: 110,
    description: 'Keajaiban mistis berkilau dengan radiasi warna fuchsia.',
    active: true,
    purchasable: true,
    stackable: false
  },
  'av_fox': {
    id: 'av_fox',
    name: 'Cyber Fox',
    type: 'avatar',
    value: '🦊',
    cost: 130,
    description: 'Rubah mekanis cerdas dengan implan siber canggih.',
    active: true,
    purchasable: true,
    stackable: false
  },
  'av_ufo': {
    id: 'av_ufo',
    name: 'UFO Alien',
    type: 'avatar',
    value: '🛸',
    cost: 160,
    description: 'Kapal piring terbang luar angkasa penculik koin-koin arkade.',
    active: true,
    purchasable: true,
    stackable: false
  },
  'av_wizard': {
    id: 'av_wizard',
    name: 'Retro Wizard',
    type: 'avatar',
    value: '🧙‍♂️',
    cost: 200,
    description: 'Penyihir legendaris pemanipulasi bit dan gerbang logika.',
    active: true,
    purchasable: true,
    stackable: false
  },

  // Themes
  'th_crimson': {
    id: 'th_crimson',
    name: 'Neon Crimson',
    type: 'theme',
    value: '#dc2626',
    cost: 150,
    description: 'Tema merah neon crimson membara.',
    active: true,
    purchasable: true,
    stackable: false
  },
  'th_ruby': {
    id: 'th_ruby',
    name: 'Neon Ruby',
    type: 'theme',
    value: '#e11d48',
    cost: 150,
    description: 'Tema merah ruby siber futuristik.',
    active: true,
    purchasable: true,
    stackable: false
  },
  'th_amber': {
    id: 'th_amber',
    name: 'Flare Amber',
    type: 'theme',
    value: '#ea580c',
    cost: 150,
    description: 'Tema merah oranye flare berenergi tinggi.',
    active: true,
    purchasable: true,
    stackable: false
  },
  'th_rose': {
    id: 'th_rose',
    name: 'Neon Rose',
    type: 'theme',
    value: '#f43f5e',
    cost: 150,
    description: 'Tema mawar neon elektrik dengan aura fuchsia elegan.',
    active: true,
    purchasable: true,
    stackable: false
  }
};

/**
 * Looks up an item in the authoritative server catalog.
 * Returns null if not found or inactive.
 */
export function getAuthoritativeCatalogItem(itemId: string): AuthoritativeCatalogItem | null {
  if (!itemId || typeof itemId !== 'string') return null;
  const item = SERVER_SHOP_CATALOG[itemId.trim()];
  if (!item || !item.active || !item.purchasable) return null;
  return item;
}

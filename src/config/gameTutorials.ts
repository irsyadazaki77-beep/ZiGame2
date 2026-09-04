export interface GameTutorialConfig {
  gameId: string;
  title: string;
  icon: string;
  objective: string;
  scoring: string[];
  controls: {
    keyboard: string[];
    gamepad?: string[];
    touch: string[];
  };
  firstPlayHint: string;
  advancedMechanic?: string;
  proTips: string[];
}

export const GAME_TUTORIALS: Record<string, GameTutorialConfig> = {
  snake: {
    gameId: 'snake',
    title: 'Pixel Snake',
    icon: '🐍',
    objective: 'Arahkan ular neon untuk memakan cyber apple tanpa menabrak dinding batas arena atau ekor sendiri.',
    scoring: [
      '+10 Poin per Cyber Apple hijau',
      '+50 Poin bonus per Golden Apple langka',
      'Pengali combo meningkat setiap 5 makanan beruntun tanpa jeda'
    ],
    controls: {
      keyboard: ['Arrow Keys (↑ ↓ ← →)', 'WASD', 'Space (Turbo Boost)'],
      gamepad: ['D-Pad (Arah)', 'Left Stick', 'Tombol (A) Boost'],
      touch: ['Swipe / D-Pad Sentuh di layar']
    },
    firstPlayHint: 'Gerakkan ular perlahan membentuk pola melingkar (zigzag) agar ekor panjang tidak menjebak jalan keluar.',
    advancedMechanic: 'Gunakan Turbo Boost untuk melipatgandakan perolehan poin saat mengambil Golden Apple.',
    proTips: [
      'Gunakan batas dinding untuk berbelok lebih cepat',
      'Hindari berbalik 180° secara mendadak',
      'Fokus pada ruang terbuka di tengah arena'
    ]
  },
  brick: {
    gameId: 'brick',
    title: 'Brick Neon',
    icon: '🧱',
    objective: 'Pantulkan bola plasma berkecepatan tinggi dengan paddle siber untuk melumat seluruh susunan balok neon.',
    scoring: [
      '+10-40 Poin per balok (tergantung warna ketahanan)',
      '+100 Poin bonus pembersihan baris',
      '+200 Poin saat menangkap Power-up Laser / Multi-ball'
    ],
    controls: {
      keyboard: ['Arrow Left / Right (← →)', 'A / D', 'Space (Luncurkan bola / Tembak)'],
      gamepad: ['Left Stick / D-Pad (Geser Paddle)', 'Tombol (A) Luncurkan'],
      touch: ['Geser jari horizontal di bawah paddle']
    },
    firstPlayHint: 'Arahkan pantulan bola ke sudut tepi paddle untuk menghasilkan sudut tembakan tajam.',
    advancedMechanic: 'Tembak bola ke celah atas balok untuk membiarkan bola memantul sendiri di atap secara masif.',
    proTips: [
      'Jangan lepaskan pandangan dari posisi bola saat dekat paddle',
      'Power-up Multi-ball sangat efektif melipatgandakan skor kombo'
    ]
  },
  space: {
    gameId: 'space',
    title: 'Space Defender',
    icon: '🚀',
    objective: 'Kendalikan pesawat tempur plasma dan hancurkan gelombang armada alien penyerang galaksi.',
    scoring: [
      '+20 Poin per drone alien biasa',
      '+100 Poin per alien komandan',
      '+500 Poin per Mothership bonus'
    ],
    controls: {
      keyboard: ['Arrow Left / Right (← →)', 'Space (Tembak Laser)', 'Z (Plasma Bomb)'],
      gamepad: ['Left Stick / D-Pad (Gerak)', 'Tombol (A) Tembak', 'Tombol (B) Bom'],
      touch: ['Joystick sentuh virtual + Tombol tembak']
    },
    firstPlayHint: 'Selalu tembak sambil bergerak menyamping untuk menghindari tembakan alien yang turun ke bawah.',
    advancedMechanic: 'Simpan Plasma Bomb untuk menghapus seluruh peluru musuh saat terdesak gelombang padat.',
    proTips: [
      'Habisi barisan alien terluar terlebih dahulu untuk memperlambat laju turun armada',
      'Jangan berdiam di satu pojok'
    ]
  },
  runner: {
    gameId: 'runner',
    title: 'Cyber Runner',
    icon: '🏃‍♂️',
    objective: 'Berlari tanpa henti melompati duri laser, jurang siber, dan meluncur di bawah drone patroli kota neon.',
    scoring: [
      '+1 Poin per meter jarak tempuh',
      '+25 Poin per keping chip energi',
      'Multiplier 2x-5x saat mempertahankan status lari sempurna'
    ],
    controls: {
      keyboard: ['Space / Arrow Up (Lompat)', 'Arrow Down (Slide / Menunduk)'],
      gamepad: ['Tombol (A) Lompat', 'D-Pad Down Slide'],
      touch: ['Ketuk Kanan untuk Lompat, Geser Bawah untuk Slide']
    },
    firstPlayHint: 'Lakukan Double Jump (ketuk dua kali saat di udara) untuk melewati jurang ganda.',
    advancedMechanic: 'Meluncur tepat di bawah drone musuh memberikan bonus skor Close Call.',
    proTips: [
      'Perhatikan bayangan rintangan sebelum mendarat',
      'Kumpulkan chip magnet untuk menyedot semua koin energi otomatis'
    ]
  },
  racer: {
    gameId: 'racer',
    title: 'Vaporwave Racer',
    icon: '🏎️',
    objective: 'Kemudikan supercar siber melewati jalan tol neon berkecepatan tinggi tanpa menabrak kendaraan lain.',
    scoring: [
      '+10 Poin per detik kecepatan penuh',
      '+50 Poin bonus Near Miss (menyalip tipis)',
      '+100 Poin per Turbo Canister'
    ],
    controls: {
      keyboard: ['Arrow Left / Right (← →)', 'Arrow Up (Nitro Boost)', 'Arrow Down (Rem)'],
      gamepad: ['Left Stick (Steer)', 'Tombol (A) Nitro', 'Tombol (B) Rem'],
      touch: ['Ketuk sisi kiri / kanan layar untuk bermanuver']
    },
    firstPlayHint: 'Gunakan jalur tengah untuk fleksibilitas manuver menghindari mobil lawan yang lambat.',
    advancedMechanic: 'Menyalip kendaraan dengan jarak sangat dekat memicu Near Miss Combo pembakar skor.',
    proTips: [
      'Gunakan Nitro di trek lurus panjang',
      'Hafalkan pola lampu sein mobil lalu lintas'
    ]
  },
  pong: {
    gameId: 'pong',
    title: 'Neon Pong',
    icon: '🏓',
    objective: 'Kalahkan AI Bot siber dengan memantulkan bola neon melewati garis pertahanan lawan.',
    scoring: [
      '+1 Poin ronde per gol',
      '+100 Poin bonus reli pantulan panjang',
      'Menangkan 5 set ronde untuk kemenangan sempurna'
    ],
    controls: {
      keyboard: ['Arrow Up / Down (↑ ↓)', 'W / S'],
      gamepad: ['Left Stick / D-Pad Up / Down'],
      touch: ['Geser jari secara vertikal pada paddle']
    },
    firstPlayHint: 'Pukul bola dengan bagian tepi paddle yang sedang bergerak untuk memberikan efek putaran kecepatan (spin).',
    advancedMechanic: 'Semakin lama reli berlangsung, semakin cepat laju bola dan semakin besar nilai poin gol.',
    proTips: [
      'Pancing AI ke sudut atas lalu tembak keras ke sudut bawah'
    ]
  },
  dinorun: {
    gameId: 'dinorun',
    title: 'Cyber Dino Run',
    icon: '🦖',
    objective: 'Bantu dinosaurus siber melompati laser barrier dan merunduk di bawah drone patroli tanpa akhir.',
    scoring: [
      '+1 Poin per langkah jarak tempuh',
      '+100 Poin milestone setiap 1000m'
    ],
    controls: {
      keyboard: ['Space / Arrow Up (Lompat)', 'Arrow Down (Merunduk)'],
      gamepad: ['Tombol (A) Lompat', 'D-Pad Down Merunduk'],
      touch: ['Ketuk Layar untuk Lompat / Geser Bawah Merunduk']
    },
    firstPlayHint: 'Waktu lompatan menentukan ketinggian; tekan singkat untuk lompatan pendek.',
    advancedMechanic: 'Tekan tombol merunduk di udara untuk melakukan Fast Fall (turun instan).',
    proTips: [
      'Fast Fall sangat berguna untuk mendarat tepat sebelum rintangan berikutnya muncul'
    ]
  },
  tetris: {
    gameId: 'tetris',
    title: 'Cyber Block Puzzle',
    icon: '🧱',
    objective: 'Susun tetramino neon yang jatuh untuk membersihkan garis horizontal sebanyak mungkin.',
    scoring: [
      '+100 Poin per Single Line',
      '+300 Poin per Double Line',
      '+500 Poin per Triple Line',
      '+800 Poin per Tetris (4 Baris Bersih Sekaligus!)'
    ],
    controls: {
      keyboard: ['Arrow Left / Right (Geser)', 'Arrow Up (Putar Balok)', 'Arrow Down (Soft Drop)', 'Space (Hard Drop)'],
      gamepad: ['D-Pad (Geser)', 'Tombol (A) Putar', 'D-Pad Down (Turunkan Cepat)', 'Tombol (X) Hard Drop'],
      touch: ['Geser Kiri/Kanan, Ketuk Putar, Geser Bawah Cepat']
    },
    firstPlayHint: 'Sisakan satu kolom kosong di tepi kanan untuk mencetak 4-line Tetris menggunakan balok panjang I-Bar.',
    advancedMechanic: 'Gunakan fitur Hold (tombol C) untuk menyimpan balok cadangan untuk saat kritis.',
    proTips: [
      'Jaga tumpukan tetap rata dan hindari lubang tersembunyi di bawah'
    ]
  }
};

export const getTutorialForGame = (gameId: string, fallbackTitle: string, fallbackDesc: string): GameTutorialConfig => {
  if (GAME_TUTORIALS[gameId]) {
    return GAME_TUTORIALS[gameId];
  }

  return {
    gameId,
    title: fallbackTitle,
    icon: '🎮',
    objective: fallbackDesc || 'Raih skor setinggi mungkin dan kalahkan rekor sebelumnya.',
    scoring: [
      'Skor bertambah seiring penyelesaian objektif',
      'Hindari kesalahan untuk menjaga combo streak'
    ],
    controls: {
      keyboard: ['Arrow Keys / WASD', 'Space (Aksi)'],
      touch: ['Ketuk atau Geser Layar Sentuh'],
      gamepad: ['D-Pad / Left Stick', 'Tombol (A)']
    },
    firstPlayHint: 'Pelajari ritme permainan dan jangan terburu-buru melakukan aksi berisiko.',
    proTips: [
      'Fokus pada konsistensi daripada kecepatan agresif',
      'Gunakan Pause jika perlu istirahat sejenak'
    ]
  };
};

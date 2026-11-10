# Rencana Optimasi Web App Game ZiGame untuk Mobile (Android & iOS)

Rencana optimasi terpadu untuk memastikan seluruh web app ZiGame berjalan secara mulus, responsif, hemat baterai, dan bebas gangguan gestur browser pada perangkat smartphone modern (Android dan iOS Safari/WebAPK).

## User Review & Critical Decisions

> [!IMPORTANT]
> Ringkasan keputusan yang telah dikonfirmasi pada tahap klarifikasi:

- **Fokus Utama**: Paket lengkap performa baterai, kontrol responsif layar sentuh, dan visual adaptif 60 FPS di semua perangkat mobile.
- **Orientasi & Tampilan**: Mode adaptif otomatis dengan tombol cepat untuk kunci/panduan orientasi (Portrait/Landscape) serta toggle Layar Penuh (*Fullscreen API*).
- **Fitur Khusus Perangkat Mobile**:
  - Dukungan *Safe Area Insets* penuh (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`, `env(safe-area-inset-left)`, `env(safe-area-inset-right)`) untuk notch iPhone, Dynamic Island, dan punch-hole kamera Android.
  - Pencegahan gestur bawaan browser yang mengganggu (anti double-tap zoom, anti pull-to-refresh overscroll, dan blokir menu kontekstual sentuh panjang).
  - Mekanisme *Auto Audio Unlock* pada sentuhan pertama pengguna khusus browser iOS Safari & WebKit.

---

## 1. Overview & Core Concept

- **Apa yang Dihadirkan**: Pengalaman bermain layaknya *native mobile game* di browser mobile tanpa lag, tanpa terpotong notch/island, tanpa salah pencet akibat gestur browser, dengan kontrol sentuh yang ergonomis (D-pad & Virtual Joystick) serta hemat baterai.
- **Target Pengguna**: Pemain mobile Android (Chrome/Samsung Internet/Firefox) dan iOS (Safari/Chrome/PWA Standalone) pada berbagai rasio layar (18:9, 19.5:9, 20:9).
- **Nilai Utama**: Pemain dapat langsung menikmati game 3D WebGL secara instan dengan frame rate stabil 60 FPS, audio otomatis aktif tanpa hambatan kebijakan Safari, dan kontrol sentuh presisi di area jangkauan jempol (*natural thumb zone*).

---

## 2. User Experience & Visual Design

### Alur & Interaksi Pengguna Mobile
1. **Luncurkan & Safe Area**:
   - Web app mendeteksi *viewport* dengan `viewport-fit=cover`. Bilah status dan kontrol atas otomatis terhindar dari *notch*, *Dynamic Island*, maupun tombol navigasi bawah ponsel.
2. **First-Touch Audio Unlock**:
   - Sentuhan pertama pada tombol apa pun atau area layar langsung membuka (*resume*) `AudioContext` Web Audio API tanpa perlu interaksi berlapis.
3. **Kontrol Sentuh & Haptik Ergonomis**:
   - Tombol virtual berukuran minimal 48px memenuhi standar ergonomi jempol.
   - Pilihan instan antara D-Pad 4-arah atau Analog 360° Virtual Joystick dengan *haptic feedback* (getaran mikro di Android dan fallback audio/visual di iOS).
4. **Bilah Aksi Cepat Mobile (Game HUD)**:
   - Tombol **Layar Penuh (Fullscreen)** untuk menyembunyikan address bar browser mobile.
   - Tombol **Panduan/Kunci Orientasi** yang memberikan rekomendasi posisi terbaik (misalnya: *Landscape* untuk Space Defender/Desk Racer, *Portrait* untuk Cyber Tetris/Flappy Pixel).
5. **Pencegahan Gangguan Gestur**:
   - `overscroll-behavior: none` mencegah halaman tertarik ke bawah (reload halaman saat intens bermain).
   - `touch-action: none` pada canvas dan kontrol sentuh mencegah *pinch-to-zoom* dan *double-tap zoom* yang sering merusak tampilan di Safari.

### Desain Visual & Tata Letak
- **Ketinggian Kontrol Sticky**: Mematuhi aturan *15% Mobile Sticky Cap*, sehingga minimal 85% layar vertikal didedikasikan penuh untuk arena game 3D.
- **Mode Lanskap Dinamis**: Saat ponsel diputar ke lanskap, kontrol D-Pad/Joystick dan tombol aksi berpindah ke mode transparan melayang (*floating HUD*) di sisi kiri dan kanan bawah dengan padding `pl-safe` & `pr-safe`.

---

## 3. Key Product Decisions & Trade-Offs

- **Keputusan 1: Pembatasan Device Pixel Ratio (DPR) pada Mobile 3D**
  - *Pendekatan*: Membatasi `renderer.setPixelRatio` maksimal `Math.min(window.devicePixelRatio, 1.75)` pada perangkat mobile.
  - *Alasan*: Layar iPhone dan flagship Android sering memiliki DPR 3.0 (resolusi internal sangat tinggi). Memaksakan DPR 3.0 pada game 3D akan memicu panas berlebih (*throttling*) dan menguras baterai cepat tanpa peningkatan visual yang terlihat oleh mata manusia.
  - *Alternatif yang Ditolak*: Membiarkan DPR mentah 3.0 atau menurunkan grafis ke resolusi buram 1.0.

- **Keputusan 2: Penanganan Latar Belakang (Visibility Change & Battery Saving)**
  - *Pendekatan*: Menghentikan loop `requestAnimationFrame` dan menunda `AudioContext` saat tab disembunyikan atau saat pemain beralih aplikasi di ponsel (`document.hidden`).
  - *Alasan*: Mencegah crash WebGL context loss serta menghemat daya baterai ponsel ketika game sedang di-minimize.

- **Keputusan 3: Penanganan Khusus Safari iOS vs Android Fullscreen API**
  - *Pendekatan*: Menggunakan `requestFullscreen` standar dengan fallback WebKit (`webkitRequestFullscreen`) dan instruksi *Add to Home Screen* jika browser iOS Safari belum mengizinkan API fullscreen biasa.

---

## 4. Technical Architecture & Data Strategy

### Diagram Arsitektur Mobile Optimization

```
┌────────────────────────────────────────────────────────────────────────┐
│                        INDEX.HTML / VIEWPORT                           │
│  • viewport-fit=cover  • user-scalable=no  • black-translucent status  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┴───────────────────────────────┐
    ▼                                                               ▼
┌──────────────────────────────┐                ┌──────────────────────────────┐
│       AUDIO UNLOCKER         │                │     GESTURE & SAFE AREA      │
│  • Window touchstart listener│                │  • overscroll-behavior: none │
│  • AudioContext.resume()     │                │  • touch-action: none        │
│  • Safari WebKit compatibility│               │  • env(safe-area-inset-*)    │
└──────────────┬───────────────┘                └──────────────┬───────────────┘
               │                                               │
               └───────────────────────┬───────────────────────┘
                                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     GAMEPAGE & THREE.JS ENGINE                         │
│  • ThreeStageController DPR auto-clamp (≤ 1.75x on mobile)             │
│  • Visibility change pause/resume (Battery Saver & WebGL Safety)      │
│  • MobileTouchControls (D-Pad & Analog Joystick, ≥ 48px hitboxes)      │
│  • Quick Mobile HUD: Fullscreen toggle & Orientation hint              │
└────────────────────────────────────────────────────────────────────────┘
```

### Rincian Modifikasi File yang Direncanakan:
1. `index.html`: Update meta viewport untuk `viewport-fit=cover, user-scalable=no, maximum-scale=1.0` dan meta tag mobile web app.
2. `src/index.css`: Perkuat proteksi overscroll, styling safe-area (`pt-safe`, `pb-safe`, `pl-safe`, `pr-safe`), dan eliminasi seleksi teks/highlight sentuh.
3. `src/utils/audio.ts`: Implementasikan fungsi `unlockMobileAudio()` yang mendengarkan event sentuhan pertama di level `window` untuk mengaktifkan Web Audio API di iOS Safari secara mulus.
4. `src/utils/threeStage.ts`: Tambahkan optimasi DPR mobile (`max 1.75`), auto-pause saat `document.hidden`, dan penanganan pemulihan WebGL context (`webglcontextlost` / `webglcontextrestored`).
5. `src/components/gamepage/GameHUDBar.tsx` & `src/pages/GamePage.tsx`: Tambahkan tombol kontrol cepat mobile untuk **Layar Penuh** dan **Panduan Orientasi Layar**.
6. `src/components/gamepage/MobileTouchControls.tsx`: Pastikan target sentuh minimal 48px, ergonomi jempol di lanskap & potret, serta getaran haptik yang aman di iOS & Android.

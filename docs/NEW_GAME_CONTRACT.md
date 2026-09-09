# ZiGame Canonical New Game Architecture Contract

> **Notice**: As of ZiGame 2.0, the game catalog is currently under a strict **Feature Freeze** at **37 Canonical Games**.  
> This specification documents the strict architectural contract required whenever adding a new game post-freeze.

---

## 1. Registry Declaration
Any new game MUST be registered in `src/config/gamesRegistry.ts` within `CANONICAL_GAME_REGISTRY`:

```typescript
export interface GameDefinition {
  id: string; // Kebab-case unique identifier (e.g., 'cosmic-drift')
  title: string;
  description: string;
  category: GameCategory; // 'action' | 'arcade' | 'puzzle' | 'strategy' | 'retro'
  difficulty: 'easy' | 'medium' | 'hard';
  thumbnailUrl: string;
  tags: string[];
  controls: {
    keyboard?: string[];
    touch?: boolean;
    mouse?: boolean;
  };
}
```

---

## 2. Balance & Anti-Cheat Configuration
The new game MUST specify strict scoring bounds in `src/config/balanceConfig.ts`:

```typescript
GAME_BALANCE_CONFIG['new-game-id'] = {
  maxScoreCeiling: 10000,        // Absolute max possible in legitimate play
  minValidDurationSeconds: 5,   // Minimum duration required before score can be > 0
  maxScoreVelocityPerSecond: 100 // Maximum score points attainable per second
};
```

---

## 3. Session Lifecycle & Score Submission
The game component MUST adhere to the 3-step authoritative session lifecycle:

1. **Session Start**:
   ```typescript
   const { sessionId, nonce } = await startScoreSession('new-game-id');
   ```
2. **Gameplay Loop**:
   - Game canvas runs at capped 60 FPS using `requestAnimationFrame`.
   - Audio feedback triggered using `playSoundEffect(soundName)`.
3. **Score Submission**:
   ```typescript
   const result = await submitFinalScore({
     gameId: 'new-game-id',
     sessionId,
     score,
     durationMs
   });
   ```

---

## 4. Accessibility & Mobile Standards
- **Responsive Canvas**: Canvas dimensions MUST scale smoothly using `ResizeObserver` or CSS ratio bounding.
- **Touch Controls**: Virtual D-pad / touch targets must measure at least **44x44px**.
- **Keyboard Navigation**: Standard arrow keys / WASD / Spacebar / Escape mapped for desktop accessibility.
- **Audio Clean-up**: Any AudioContext oscillators or sound nodes MUST be disconnected on unmount.

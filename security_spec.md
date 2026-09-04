# Security Spec

## Data Invariants
1. A user document can only be accessed and modified by its owner.
2. System-managed fields like `profile.coins`, `isAdmin`, and `isBanned` CANNOT be modified by the client. Only the server (via Admin SDK) can modify `profile.coins`.
3. Client can sync their game stats, unlocked items, and achievements.

## Dirty Dozen Payloads
1. Attempt to create a user doc with another UID.
2. Attempt to create a user doc with 9999 coins.
3. Attempt to update `profile.coins` to 9999.
4. Attempt to read someone else's user doc.
5. Attempt to update `isAdmin: true`.
6. Attempt to modify `profile.coins` while syncing other profile fields.
7. Attempt to inject a 2MB string into `profile.name`.
8. Attempt to send an array for `profile` instead of a Map.
9. Attempt to create a document without required fields.
10. Attempt to delete own document.
11. Attempt to update `verifiedBalance`.
12. Attempt to write to `leaderboards` directly (forbidden, server only).

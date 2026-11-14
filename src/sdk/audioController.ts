import { IAudioController } from '../types/gameSdk';
import { audio } from '../utils/audio';

export class AudioController implements IAudioController {
  public playClick(): void {
    audio.playClick();
  }

  public playCoin(): void {
    audio.playCoin();
  }

  public playJump(): void {
    audio.playJump();
  }

  public playLaser(): void {
    audio.playLaser();
  }

  public playScore(): void {
    audio.playScore();
  }

  public playCombo(combo: number = 1): void {
    audio.playCombo(combo);
  }

  public playNearMiss(): void {
    audio.playNearMiss();
  }

  public playReflect(): void {
    audio.playReflect();
  }

  public playShield(): void {
    audio.playShield();
  }

  public playHitStop(): void {
    audio.playHitStop();
  }

  public playCountdown(step?: number): void {
    audio.playCountdown(step);
  }

  public playCountdownGo(): void {
    audio.playCountdownGo();
  }

  public playWin(): void {
    audio.playWin();
  }

  public playGameOver(): void {
    audio.playGameOver();
  }

  public playHit(): void {
    audio.playHit();
  }

  public playPowerup(): void {
    audio.playPowerup();
  }

  public playExplosion(): void {
    audio.playExplosion();
  }

  public playLevelUp(): void {
    audio.playLevelUp();
  }

  public startBgm(): void {
    audio.startBGM();
  }

  public stopBgm(): void {
    audio.stopBGM();
  }

  public isBgmPlaying(): boolean {
    return audio.getBGMState();
  }

  public toggleMute(): boolean {
    return audio.toggleMute();
  }

  public setMuted(muted: boolean): boolean {
    return audio.setMuted(muted);
  }

  public isMuted(): boolean {
    return audio.getMuteState();
  }

  public getMasterVolume(): number {
    return audio.getMasterVolume();
  }

  public setMasterVolume(vol: number): void {
    audio.setMasterVolume(vol);
  }

  public getSfxVolume(): number {
    return audio.getSfxVolume();
  }

  public setSfxVolume(vol: number): void {
    audio.setSfxVolume(vol);
  }

  public getMusicVolume(): number {
    return audio.getMusicVolume();
  }

  public setMusicVolume(vol: number): void {
    audio.setMusicVolume(vol);
  }

  public subscribe(listener: () => void): () => void {
    return audio.subscribe(listener);
  }

  public unlockAudio(): void {
    audio.unlockAudio();
  }

  public stopAll(): void {
    audio.stopAllSounds();
  }
}

export const audioController = new AudioController();

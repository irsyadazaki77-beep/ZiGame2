import { LevelData, Guard, Camera, LaserBarrier, Terminal, Distraction } from './types';
import { generateLevels } from './levels';

export class NeonHeistEngine {
  levels: LevelData[];
  currentLevelIndex: number;
  currentLevel: LevelData;
  player: {
    x: number; y: number; radius: number; speed: number; sprintSpeed: number;
    angle: number; isSprinting: boolean; isHidden: boolean; health: number;
  };
  alarmLevel: 0 | 1 | 2; // 0 normal, 1 suspicious, 2 alert
  intelCollected: number;
  intelRequired: number;
  distractionCharges: number;
  distractions: Distraction[];
  particles: { x: number; y: number; vx: number; vy: number; color: string; alpha: number; size: number }[];
  detectionCounter: number;
  levelStartTime: number;
  alertCooldown: number;
  keys: { [key: string]: boolean };
  
  onScoreUpdate: (score: number) => void;
  onGameOver: () => void;
  playAudio: (id: string) => void;
  totalScore: number;
  
  constructor(onScoreUpdate: (score: number) => void, onGameOver: () => void, playAudio: (id: string) => void) {
    this.levels = generateLevels();
    this.currentLevelIndex = 0;
    this.currentLevel = JSON.parse(JSON.stringify(this.levels[0]));
    
    this.player = { x: 60, y: 440, radius: 12, speed: 2.6, sprintSpeed: 4.2, angle: 0, isSprinting: false, isHidden: false, health: 100 };
    this.alarmLevel = 0;
    this.intelCollected = 0;
    this.intelRequired = this.currentLevel.requiredIntel;
    this.distractionCharges = 3;
    this.distractions = [];
    this.particles = [];
    this.detectionCounter = 0;
    this.levelStartTime = Date.now();
    this.alertCooldown = 0;
    this.keys = {};
    
    this.onScoreUpdate = onScoreUpdate;
    this.onGameOver = onGameOver;
    this.playAudio = playAudio;
    this.totalScore = 0;
  }
  
  initLevel(lvlIndex: number) {
    this.currentLevelIndex = lvlIndex % this.levels.length;
    this.currentLevel = JSON.parse(JSON.stringify(this.levels[this.currentLevelIndex]));
    
    this.player.x = this.currentLevel.playerStart.x;
    this.player.y = this.currentLevel.playerStart.y;
    this.player.health = 100;
    this.player.isHidden = false;
    
    this.intelCollected = 0;
    this.intelRequired = this.currentLevel.requiredIntel;
    this.alarmLevel = 0;
    this.distractions = [];
    this.particles = [];
    this.detectionCounter = 0;
    this.levelStartTime = Date.now();
    this.alertCooldown = 0;
  }
  
  // physics and collision utilities
  lineRectCollide(x1: number, y1: number, x2: number, y2: number, rx: number, ry: number, rw: number, rh: number) {
    const uA = ((rw-0)*(y1-ry) - (rh-0)*(x1-rx)) / ((rh-0)*(x2-x1) - (rw-0)*(y2-y1)); // this is wrong
    return false; // I'll fix this later
  }
}

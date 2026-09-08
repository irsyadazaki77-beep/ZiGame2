export interface NeonHeistGameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;

export interface Guard {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  targetAngle: number;
  speed: number;
  waypoints: { x: number; y: number }[];
  currentWaypoint: number;
  state: 'patrol' | 'suspicious' | 'chase' | 'search';
  investigatePos?: { x: number; y: number };
  searchTimer: number;
  visionRange: number;
  visionAngle: number;
}

export interface Camera {
  x: number;
  y: number;
  angle: number;
  minAngle: number;
  maxAngle: number;
  rotSpeed: number;
  range: number;
  fov: number;
  disabled: boolean;
  disableTimer: number;
}

export interface LaserBarrier {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  active: boolean;
  cycleTime: number;
  cycleTimer: number;
  activeDuration: number;
  switchControlled?: boolean;
}

export interface Terminal {
  x: number;
  y: number;
  type: 'intel' | 'laser_switch' | 'camera_jam';
  hacked: boolean;
  progress: number;
  label: string;
}

export interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'wall' | 'server' | 'vent';
}

export interface Distraction {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  lifetime: number;
}

export interface LevelData {
  level: number;
  name: string;
  playerStart: { x: number; y: number };
  exit: { x: number; y: number; w: number; h: number };
  obstacles: Obstacle[];
  guards: Guard[];
  cameras: Camera[];
  lasers: LaserBarrier[];
  terminals: Terminal[];
  requiredIntel: number;
}

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audio } from '../../utils/audio';
import { useGameEngine } from '../../hooks/useGameEngine';
import { useUnifiedInput } from '../../hooks/useUnifiedInput';
import { GameOverlay } from '../gameplay/GameOverlay';
import { Shield, Zap, Crosshair, Award, Radio, RotateCcw, Play, CheckCircle2, AlertTriangle, Swords } from 'lucide-react';

interface HexDominionGameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

const CANVAS_WIDTH = 860;
const CANVAS_HEIGHT = 520;
const HEX_RADIUS = 32;

export type UnitType = 'scout' | 'infantry' | 'tank' | 'support';

interface UnitDef {
  type: UnitType;
  name: string;
  cost: number;
  maxHp: number;
  atk: number;
  moveRange: number;
  attackRange: number;
  icon: string;
  description: string;
}

const UNIT_DEFS: Record<UnitType, UnitDef> = {
  scout: {
    type: 'scout',
    name: 'Scout Drone',
    cost: 40,
    maxHp: 35,
    atk: 18,
    moveRange: 3,
    attackRange: 1,
    icon: '🛸',
    description: 'Unit cepat untuk merebut node energi dan mengintai musuh.',
  },
  infantry: {
    type: 'infantry',
    name: 'Cyber Infantry',
    cost: 65,
    maxHp: 65,
    atk: 32,
    moveRange: 2,
    attackRange: 1,
    icon: '🤖',
    description: 'Petarung garis depan seimbang dengan pertahanan stabil.',
  },
  tank: {
    type: 'tank',
    name: 'Siege Tank',
    cost: 120,
    maxHp: 130,
    atk: 58,
    moveRange: 1,
    attackRange: 2,
    icon: '🚜',
    description: 'Unit lapis baja berdaya hancur dahsyat dengan jarak tembak 2 hex.',
  },
  support: {
    type: 'support',
    name: 'Support Aegis',
    cost: 80,
    maxHp: 45,
    atk: 15,
    moveRange: 2,
    attackRange: 1,
    icon: '🛡️',
    description: 'Memulihkan +20 HP unit kawan di sekitarnya setiap ronde.',
  },
};

export type HexNodeType = 'base_player' | 'base_enemy' | 'energy_well' | 'fortress' | 'relay' | 'neutral' | 'obstacle';

interface HexCell {
  q: number; // axial col
  r: number; // axial row
  x: number; // pixel center
  y: number; // pixel center
  type: HexNodeType;
  owner: 'player' | 'enemy' | 'neutral';
  hp?: number;
  maxHp?: number;
}

interface Unit {
  id: number;
  q: number;
  r: number;
  owner: 'player' | 'enemy';
  type: UnitType;
  hp: number;
  maxHp: number;
  hasMoved: boolean;
  hasAttacked: boolean;
  shield: number;
  isStunned?: boolean;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
}

export default function HexDominionGame({ onGameOver, onScoreUpdate, highScore }: HexDominionGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const {
    gameState, setGameState, gameStateRef, countdown, score, updateScore, triggerGameOver,
    startWithCountdown, startLoop, stopLoop, setupCanvasContext, perfSettings,
  scoreRef,
    gameLoopRef
  } = useGameEngine({
    onScoreUpdate, onGameOver
  });
  const [turn, setTurn] = useState<'player' | 'enemy'>('player');
  const [roundNumber, setRoundNumber] = useState(1);
  const [playerEnergy, setPlayerEnergy] = useState(120);
  const [enemyEnergy, setEnemyEnergy] = useState(120);

  const [selectedCell, setSelectedCell] = useState<HexCell | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [spawnMenuUnit, setSpawnMenuUnit] = useState<UnitType | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);

  const turnRef = useRef<'player' | 'enemy'>('player');
  const playerEnergyRef = useRef(120);
  const enemyEnergyRef = useRef(120);

  const gridRef = useRef<HexCell[]>([]);
  const unitsRef = useRef<Unit[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number; color: string; alpha: number; size: number }[]>([]);

  // Axial hex to pixel conversion
  const hexToPixel = (q: number, r: number) => {
    const x = CANVAS_WIDTH / 2 + HEX_RADIUS * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
    const y = CANVAS_HEIGHT / 2 + HEX_RADIUS * ((3 / 2) * r);
    return { x, y };
  };

  // Hex distance
  const hexDistance = (a: { q: number; r: number }, b: { q: number; r: number }) => {
    return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
  };

  // Generate tactical map
  const generateGrid = (): HexCell[] => {
    const cells: HexCell[] = [];
    const radius = 4; // grid radius

    for (let q = -radius; q <= radius; q++) {
      const r1 = Math.max(-radius, -q - radius);
      const r2 = Math.min(radius, -q + radius);

      for (let r = r1; r <= r2; r++) {
        const { x, y } = hexToPixel(q, r);
        let type: HexNodeType = 'neutral';
        let owner: 'player' | 'enemy' | 'neutral' = 'neutral';
        let hp, maxHp;

        if (q === -3 && r === 2) {
          type = 'base_player';
          owner = 'player';
          hp = 250;
          maxHp = 250;
        } else if (q === 3 && r === -2) {
          type = 'base_enemy';
          owner = 'enemy';
          hp = 250;
          maxHp = 250;
        } else if ((q === 0 && r === 0) || (q === -2 && r === 0) || (q === 2 && r === 0)) {
          type = 'energy_well';
        } else if ((q === -1 && r === 3) || (q === 1 && r === -3)) {
          type = 'fortress';
        } else if ((q === -1 && r === -2) || (q === 1 && r === 2)) {
          type = 'relay';
        } else if (Math.abs(q) === 2 && Math.abs(r) === 2) {
          type = 'obstacle';
        }

        cells.push({ q, r, x, y, type, owner, hp, maxHp });
      }
    }
    return cells;
  };

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // Tab visibility auto-pause
  const spawnParticles = (x: number, y: number, color: string, count = 10) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = Math.random() * 2.5 + 0.5;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color,
        alpha: 1,
        size: Math.random() * 3 + 1,
      });
    }
  };

  const addFloatingText = (x: number, y: number, text: string, color: string) => {
    floatingTextsRef.current.push({
      x,
      y,
      text,
      color,
      alpha: 1,
      vy: -1.0,
    });
  };

  const startGame = useCallback(() => {
    const newGrid = generateGrid();
    gridRef.current = newGrid;

    // Initial Starter Units
    unitsRef.current = [
      {
        id: 1,
        q: -3,
        r: 1,
        owner: 'player',
        type: 'scout',
        hp: 35,
        maxHp: 35,
        hasMoved: false,
        hasAttacked: false,
        shield: 0,
      },
      {
        id: 2,
        q: -2,
        r: 2,
        owner: 'player',
        type: 'infantry',
        hp: 65,
        maxHp: 65,
        hasMoved: false,
        hasAttacked: false,
        shield: 0,
      },
      {
        id: 3,
        q: 3,
        r: -1,
        owner: 'enemy',
        type: 'scout',
        hp: 35,
        maxHp: 35,
        hasMoved: false,
        hasAttacked: false,
        shield: 0,
      },
      {
        id: 4,
        q: 2,
        r: -2,
        owner: 'enemy',
        type: 'infantry',
        hp: 65,
        maxHp: 65,
        hasMoved: false,
        hasAttacked: false,
        shield: 0,
      },
    ];

    floatingTextsRef.current = [];
    particlesRef.current = [];

    playerEnergyRef.current = 120;
    setPlayerEnergy(120);
    enemyEnergyRef.current = 120;
    setEnemyEnergy(120);
    setRoundNumber(1);
    setTurn('player');
    turnRef.current = 'player';
    setSelectedCell(null);
    setSelectedUnit(null);
    updateScore(0);

    startWithCountdown();
  }, []);


  // Unified input subscription
    useUnifiedInput({
    onActionDown: (action) => {
      if (gameStateRef.current === 'ready') {
        if (action === 'PRIMARY') startGame();
        return;
      }
      if (gameStateRef.current === 'gameover') {
        if (action === 'PRIMARY' || action === 'RESTART') startGame();
        return;
      }
      if (gameStateRef.current === 'playing') {
        if (action === 'PAUSE') setGameState('paused');
      } else if (gameStateRef.current === 'paused') {
        if (action === 'PAUSE' || action === 'PRIMARY') setGameState('playing');
      }
    },
    onRawKey: (key, isDown) => {
      // no-op for now unless keyboard mapping is needed
    }
  });

  // Check Victory Condition
  const checkVictory = useCallback(() => {
    const playerBase = gridRef.current.find((c) => c.type === 'base_player');
    const enemyBase = gridRef.current.find((c) => c.type === 'base_enemy');

    if (!enemyBase || (enemyBase.hp && enemyBase.hp <= 0)) {
      // Player Victory!
      audio.playLevelUp();
      const winBonus = 2000 + Math.max(0, 500 - roundNumber * 30);
      updateScore(score + winBonus);
      triggerGameOver();
      return true;
    }

    if (!playerBase || (playerBase.hp && playerBase.hp <= 0)) {
      // Player Defeated
      audio.playGameOver();
      triggerGameOver();
      return true;
    }

    return false;
  }, [roundNumber, onGameOver, onScoreUpdate]);

  // AI Turn Execution (Intelligent heuristics)
  const executeAiTurn = useCallback(async () => {
    setIsAiThinking(true);

    // AI Energy Income
    let aiIncome = 30;
    gridRef.current.forEach((c) => {
      if (c.owner === 'enemy') {
        if (c.type === 'energy_well') aiIncome += 20;
        else if (c.type === 'relay') aiIncome += 10;
      }
    });

    enemyEnergyRef.current += aiIncome;
    setEnemyEnergy(enemyEnergyRef.current);

    // AI Spawning decision
    const enemyBase = gridRef.current.find((c) => c.type === 'base_enemy');
    if (enemyBase && enemyEnergyRef.current >= 65) {
      // Find empty adjacent hex
      const adjCells = gridRef.current.filter(
        (c) =>
          c.type !== 'obstacle' &&
          hexDistance(enemyBase, c) === 1 &&
          !unitsRef.current.some((u) => u.q === c.q && u.r === c.r)
      );

      if (adjCells.length > 0) {
        const spawnCell = adjCells[0];
        const unitType: UnitType = enemyEnergyRef.current >= 120 ? 'tank' : 'infantry';
        const def = UNIT_DEFS[unitType];

        enemyEnergyRef.current -= def.cost;
        setEnemyEnergy(enemyEnergyRef.current);

        unitsRef.current.push({
          id: Date.now() + Math.random(),
          q: spawnCell.q,
          r: spawnCell.r,
          owner: 'enemy',
          type: unitType,
          hp: def.maxHp,
          maxHp: def.maxHp,
          hasMoved: true,
          hasAttacked: false,
          shield: 0,
        });

        spawnParticles(spawnCell.x, spawnCell.y, '#f43f5e', 12);
        audio.playLaser();
      }
    }

    // AI Unit Moves & Attacks
    const aiUnits = unitsRef.current.filter((u) => u.owner === 'enemy');

    for (const unit of aiUnits) {
      const def = UNIT_DEFS[unit.type];

      // 1. Attack if enemy in range
      const playerTargets = unitsRef.current.filter(
        (u) => u.owner === 'player' && hexDistance(unit, u) <= def.attackRange
      );

      const targetBase = gridRef.current.find(
        (c) => c.type === 'base_player' && hexDistance(unit, c) <= def.attackRange
      );

      if (playerTargets.length > 0) {
        // Attack weakest player unit
        playerTargets.sort((a, b) => a.hp - b.hp);
        const target = playerTargets[0];
        target.hp -= def.atk;
        const targetPos = hexToPixel(target.q, target.r);
        addFloatingText(targetPos.x, targetPos.y, `-${def.atk}`, '#f43f5e');
        spawnParticles(targetPos.x, targetPos.y, '#f43f5e', 8);
        audio.playHit();

        if (target.hp <= 0) {
          unitsRef.current = unitsRef.current.filter((u) => u.id !== target.id);
        }
      } else if (targetBase) {
        // Attack player HQ
        targetBase.hp = Math.max(0, (targetBase.hp || 250) - def.atk);
        addFloatingText(targetBase.x, targetBase.y, `-${def.atk}`, '#f43f5e');
        spawnParticles(targetBase.x, targetBase.y, '#ef4444', 10);
        audio.playExplosion();
      } else {
        // 2. Move towards nearest player unit, neutral well, or player base
        const playerBase = gridRef.current.find((c) => c.type === 'base_player');
        if (playerBase) {
          const validMoves = gridRef.current.filter(
            (c) =>
              c.type !== 'obstacle' &&
              hexDistance(unit, c) <= def.moveRange &&
              !unitsRef.current.some((u) => u.q === c.q && u.r === c.r)
          );

          if (validMoves.length > 0) {
            // Sort by closest to player base
            validMoves.sort((a, b) => hexDistance(a, playerBase) - hexDistance(b, playerBase));
            const bestMove = validMoves[0];
            unit.q = bestMove.q;
            unit.r = bestMove.r;

            // Capture node if neutral
            if (bestMove.owner !== 'enemy' && bestMove.type !== 'base_player') {
              bestMove.owner = 'enemy';
              spawnParticles(bestMove.x, bestMove.y, '#f43f5e', 10);
            }
          }
        }
      }
    }

    if (checkVictory()) return;

    // End AI Turn -> Back to Player
    setTimeout(() => {
      // Reset player unit flags
      unitsRef.current.forEach((u) => {
        u.hasMoved = false;
        u.hasAttacked = false;

        // Support Unit Healing
        if (u.type === 'support') {
          unitsRef.current.forEach((friend) => {
            if (friend.owner === u.owner && hexDistance(u, friend) <= 1) {
              friend.hp = Math.min(friend.maxHp, friend.hp + 20);
              const pos = hexToPixel(friend.q, friend.r);
              addFloatingText(pos.x, pos.y, '+20 HP', '#10b981');
              spawnParticles(pos.x, pos.y, '#10b981', 6);
            }
          });
        }
      });

      // Player Income
      let playerIncome = 35;
      gridRef.current.forEach((c) => {
        if (c.owner === 'player') {
          if (c.type === 'energy_well') playerIncome += 25;
          else if (c.type === 'relay') playerIncome += 15;
        }
      });

      playerEnergyRef.current += playerIncome;
      setPlayerEnergy(playerEnergyRef.current);
      setRoundNumber((r) => r + 1);
      setTurn('player');
      turnRef.current = 'player';
      setIsAiThinking(false);
      audio.playCoin();
    }, 600);
  }, [checkVictory]);

  const endPlayerTurn = () => {
    if (turn !== 'player' || gameState !== 'playing') return;
    setSelectedUnit(null);
    setSelectedCell(null);
    setSpawnMenuUnit(null);
    setTurn('enemy');
    turnRef.current = 'enemy';
    executeAiTurn();
  };

  const handleSpawnUnit = (type: UnitType) => {
    const def = UNIT_DEFS[type];
    if (playerEnergyRef.current < def.cost || turn !== 'player') return;

    const playerBase = gridRef.current.find((c) => c.type === 'base_player');
    if (!playerBase) return;

    // Find valid adjacent spawn hex
    const validCells = gridRef.current.filter(
      (c) =>
        c.type !== 'obstacle' &&
        hexDistance(playerBase, c) === 1 &&
        !unitsRef.current.some((u) => u.q === c.q && u.r === c.r)
    );

    if (validCells.length === 0) {
      audio.playHit();
      return;
    }

    const spawnCell = validCells[0];
    playerEnergyRef.current -= def.cost;
    setPlayerEnergy(playerEnergyRef.current);

    unitsRef.current.push({
      id: Date.now(),
      q: spawnCell.q,
      r: spawnCell.r,
      owner: 'player',
      type,
      hp: def.maxHp,
      maxHp: def.maxHp,
      hasMoved: true, // Can't move on turn spawned
      hasAttacked: false,
      shield: 0,
    });

    spawnParticles(spawnCell.x, spawnCell.y, '#06b6d4', 15);
    audio.playPowerup();
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (turn !== 'player' || gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Find clicked hex cell
    let clickedCell: HexCell | null = null;
    let minDist = HEX_RADIUS;

    gridRef.current.forEach((cell) => {
      const dist = Math.hypot(cell.x - clickX, cell.y - clickY);
      if (dist < minDist) {
        minDist = dist;
        clickedCell = cell;
      }
    });

    if (!clickedCell) return;

    // Find unit on clicked cell
    const clickedUnit = unitsRef.current.find(
      (u) => u.q === (clickedCell as HexCell).q && u.r === (clickedCell as HexCell).r
    );

    // If already have a selected friendly unit:
    if (selectedUnit && selectedUnit.owner === 'player') {
      const def = UNIT_DEFS[selectedUnit.type];
      const dist = hexDistance(selectedUnit, clickedCell);

      // 1. Move unit
      if (!clickedUnit && (clickedCell as HexCell).type !== 'obstacle' && dist <= def.moveRange && !selectedUnit.hasMoved) {
        selectedUnit.q = (clickedCell as HexCell).q;
        selectedUnit.r = (clickedCell as HexCell).r;
        selectedUnit.hasMoved = true;

        // Capture hex node
        if ((clickedCell as HexCell).owner !== 'player' && (clickedCell as HexCell).type !== 'base_enemy') {
          (clickedCell as HexCell).owner = 'player';
          updateScore(score + 100);
          spawnParticles((clickedCell as HexCell).x, (clickedCell as HexCell).y, '#06b6d4', 12);
        }

        audio.playClick();
        setSelectedUnit({ ...selectedUnit });
        return;
      }

      // 2. Attack enemy unit
      if (clickedUnit && clickedUnit.owner === 'enemy' && dist <= def.attackRange && !selectedUnit.hasAttacked) {
        clickedUnit.hp -= def.atk;
        selectedUnit.hasAttacked = true;

        const pos = hexToPixel(clickedUnit.q, clickedUnit.r);
        addFloatingText(pos.x, pos.y, `-${def.atk}`, '#38bdf8');
        spawnParticles(pos.x, pos.y, '#38bdf8', 12);
        audio.playLaser();

        if (clickedUnit.hp <= 0) {
          unitsRef.current = unitsRef.current.filter((u) => u.id !== clickedUnit.id);
          updateScore(score + 250);
          audio.playExplosion();
        }

        setSelectedUnit({ ...selectedUnit });
        checkVictory();
        return;
      }

      // 3. Attack enemy base
      if ((clickedCell as HexCell).type === 'base_enemy' && dist <= def.attackRange && !selectedUnit.hasAttacked) {
        (clickedCell as HexCell).hp = Math.max(0, ((clickedCell as HexCell).hp || 250) - def.atk);
        selectedUnit.hasAttacked = true;

        addFloatingText((clickedCell as HexCell).x, (clickedCell as HexCell).y, `-${def.atk}`, '#38bdf8');
        spawnParticles((clickedCell as HexCell).x, (clickedCell as HexCell).y, '#ef4444', 15);
        audio.playExplosion();

        setSelectedUnit({ ...selectedUnit });
        checkVictory();
        return;
      }
    }

    // Select or deselect unit/cell
    if (clickedUnit && clickedUnit.owner === 'player') {
      setSelectedUnit(clickedUnit);
      setSelectedCell(clickedCell);
      audio.playClick();
    } else {
      setSelectedCell(clickedCell);
      setSelectedUnit(null);
    }
  };

  const needsRedrawRef = useRef(true);

  // Main game loop via useGameEngine
  const gameStep = useCallback((timestamp: number, dtMs: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let hasAnimations = floatingTextsRef.current.length > 0 || particlesRef.current.length > 0;

    if (!needsRedrawRef.current && !hasAnimations) {
      return; // Skip rendering if idle
    }

    needsRedrawRef.current = false; // Reset flag after drawing

    // UPDATE FLOATING TEXTS & PARTICLES
    floatingTextsRef.current.forEach((ft) => {
      ft.y += ft.vy;
      ft.alpha -= 0.02;
    });
    floatingTextsRef.current = floatingTextsRef.current.filter((ft) => ft.alpha > 0);

    particlesRef.current.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.025;
    });
    particlesRef.current = particlesRef.current.filter((p) => p.alpha > 0);

      // RENDER PHASE
      ctx.fillStyle = '#080a10';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Render Hex Grid
      gridRef.current.forEach((cell) => {
        const isSelected = selectedCell && selectedCell.q === cell.q && selectedCell.r === cell.r;
        let inMoveRange = false;
        let inAttackRange = false;

        if (selectedUnit && selectedUnit.owner === 'player') {
          const def = UNIT_DEFS[selectedUnit.type];
          const dist = hexDistance(selectedUnit, cell);
          if (dist <= def.moveRange && !selectedUnit.hasMoved && cell.type !== 'obstacle') {
            inMoveRange = true;
          }
          if (dist <= def.attackRange && !selectedUnit.hasAttacked) {
            inAttackRange = true;
          }
        }

        ctx.save();
        ctx.translate(cell.x, cell.y);

        // Draw Hexagon path
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          const hx = HEX_RADIUS * Math.cos(angle);
          const hy = HEX_RADIUS * Math.sin(angle);
          if (i === 0) ctx.moveTo(hx, hy);
          else ctx.lineTo(hx, hy);
        }
        ctx.closePath();

        // Fill color based on owner / type
        if (cell.type === 'obstacle') {
          ctx.fillStyle = '#1e293b';
        } else if (cell.type === 'base_player') {
          ctx.fillStyle = 'rgba(6, 182, 212, 0.25)';
        } else if (cell.type === 'base_enemy') {
          ctx.fillStyle = 'rgba(244, 63, 94, 0.25)';
        } else if (cell.owner === 'player') {
          ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
        } else if (cell.owner === 'enemy') {
          ctx.fillStyle = 'rgba(244, 63, 94, 0.15)';
        } else {
          ctx.fillStyle = '#0f172a';
        }
        ctx.fill();

        // Hex Border
        if (isSelected) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2.5;
        } else if (inMoveRange) {
          ctx.strokeStyle = 'rgba(34, 197, 94, 0.7)';
          ctx.lineWidth = 2;
        } else if (inAttackRange) {
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
          ctx.lineWidth = 2;
        } else if (cell.owner === 'player') {
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 1.5;
        } else if (cell.owner === 'enemy') {
          ctx.strokeStyle = '#f43f5e';
          ctx.lineWidth = 1.5;
        } else {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.lineWidth = 1;
        }
        ctx.stroke();

        // Hex Icons
        if (cell.type === 'energy_well') {
          ctx.fillStyle = '#eab308';
          ctx.font = '14px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('⚡', 0, 5);
        } else if (cell.type === 'fortress') {
          ctx.fillStyle = '#818cf8';
          ctx.font = '14px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('🛡️', 0, 5);
        } else if (cell.type === 'relay') {
          ctx.fillStyle = '#34d399';
          ctx.font = '14px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('📡', 0, 5);
        } else if (cell.type === 'base_player' || cell.type === 'base_enemy') {
          ctx.fillStyle = cell.type === 'base_player' ? '#06b6d4' : '#f43f5e';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('HQ', 0, -6);
          ctx.font = 'bold 8px monospace';
          ctx.fillText(`${cell.hp}/${cell.maxHp}`, 0, 6);
        }

        ctx.restore();
      });

      // Render Units
      unitsRef.current.forEach((unit) => {
        const { x, y } = hexToPixel(unit.q, unit.r);
        const def = UNIT_DEFS[unit.type];
        const isSelected = selectedUnit && selectedUnit.id === unit.id;

        ctx.save();
        ctx.translate(x, y);

        // Unit Token Circle
        ctx.fillStyle = unit.owner === 'player' ? '#0284c7' : '#e11d48';
        ctx.shadowColor = unit.owner === 'player' ? '#06b6d4' : '#f43f5e';
        ctx.shadowBlur = isSelected ? 14 : 6;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Selection highlight ring
        if (isSelected) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, 22, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Unit Emoji Icon
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(def.icon, 0, 5);

        // Health bar
        const hpPct = Math.max(0, unit.hp / unit.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(-14, 18, 28, 4);
        ctx.fillStyle = unit.owner === 'player' ? '#38bdf8' : '#f43f5e';
        ctx.fillRect(-14, 18, 28 * hpPct, 4);

        ctx.restore();
      });

      // Particles
      particlesRef.current.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // Floating Texts
      floatingTextsRef.current.forEach((ft) => {
        ctx.fillStyle = ft.color;
        ctx.globalAlpha = ft.alpha;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.globalAlpha = 1;
      });
    }, [selectedCell, selectedUnit]);

    useEffect(() => {
      needsRedrawRef.current = true;
    }, [selectedCell, selectedUnit, turn, roundNumber, playerEnergy, enemyEnergy, gameState]);

    useEffect(() => {
      if (gameState === 'playing') {
        startLoop(gameStep);
      } else {
        if (gameLoopRef?.current) cancelAnimationFrame(gameLoopRef.current);
      }
    }, [gameState, startLoop, stopLoop, gameStep]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between select-none bg-[#080a10] font-sans">
      {/* Top Turn & Resource Bar */}
      <div className="w-full flex items-center justify-between px-4 py-2 z-10 text-xs font-mono bg-zinc-950/90 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-zinc-900/90 border border-white/10 rounded-xl flex items-center gap-2">
            <span className="text-zinc-400">RONDE:</span>
            <span className="text-white font-bold">{roundNumber}</span>
          </div>

          <div className="px-3 py-1 bg-zinc-900/90 border border-white/10 rounded-xl flex items-center gap-2">
            <Zap size={13} className="text-cyan-400" />
            <span className="text-zinc-400">PLAYER ENERGI:</span>
            <span className="text-cyan-400 font-bold">{playerEnergy}⚡</span>
          </div>

          <div className="px-3 py-1 bg-zinc-900/90 border border-white/10 rounded-xl flex items-center gap-2">
            <Zap size={13} className="text-rose-400" />
            <span className="text-zinc-400">AI ENERGI:</span>
            <span className="text-rose-400 font-bold">{enemyEnergy}⚡</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`px-4 py-1 rounded-xl font-bold flex items-center gap-2 border ${
            turn === 'player'
              ? 'bg-indigo-950/80 border-cyan-400 text-cyan-400'
              : 'bg-rose-950/80 border-rose-500 text-rose-400 animate-pulse'
          }`}>
            <Swords size={14} />
            <span>{turn === 'player' ? 'GILIRAN PEMAIN' : 'AI SEDANG BERPIKIR...'}</span>
          </div>

          {turn === 'player' && (
            <button
              onClick={endPlayerTurn}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-indigo-600/30 active:scale-95"
            >
              <CheckCircle2 size={13} /> Selesai Giliran
            </button>
          )}

          <div className="px-3 py-1 bg-zinc-900/90 border border-white/10 rounded-xl flex items-center gap-2">
            <span className="text-zinc-400">SKOR:</span>
            <span className="text-yellow-400 font-bold">{score}</span>
          </div>
        </div>
      </div>

      {/* Main Tactical Hex Canvas */}
      <div className="flex-1 w-full relative min-h-0 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onClick={handleCanvasClick}
          className="w-full h-full max-w-full max-h-full object-contain cursor-pointer rounded-xl"
        />
      </div>

      {/* Bottom Production Command Bar */}
      <div className="w-full p-2 bg-zinc-950/90 border-t border-white/[0.06] flex items-center justify-center gap-3 z-10">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-zinc-400 mr-2">REKRUT UNIT (HQ):</span>
          {Object.values(UNIT_DEFS).map((def) => {
            const canAfford = playerEnergy >= def.cost && turn === 'player';

            return (
              <button
                key={def.type}
                onClick={() => handleSpawnUnit(def.type)}
                disabled={!canAfford}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  canAfford
                    ? 'bg-zinc-900/80 hover:bg-zinc-800 border-white/10 hover:border-cyan-500/50 text-white'
                    : 'bg-zinc-950 border-white/5 text-zinc-600'
                }`}
              >
                <span className="text-base">{def.icon}</span>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold leading-tight">{def.name}</span>
                  <span className="text-[10px] font-mono text-cyan-400 font-bold">{def.cost}⚡</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <GameOverlay
        gameState={gameState}
        countdown={countdown}
        score={score}
        highScore={highScore}
        onStart={startGame}
        onResume={() => setGameState('playing')}
        onRestart={startGame}
        instructions="Klik unit untuk memilih dan gerakkan ke hex dalam jangkauan (hijau) atau serang unit musuh (merah). Rekrut unit baru di HQ dan hancurkan HQ musuh untuk memenangkan pertempuran!"
      />
    </div>
  );
}

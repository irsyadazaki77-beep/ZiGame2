import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { useGameEngine } from '../../hooks/useGameEngine';
import { audio } from '../../utils/audio';
import { screenShake } from '../../utils/screenShake';
import { Crown, Swords, RotateCcw, Eye, ChevronDown, ChevronUp, Sparkles, ShieldAlert, Play, Zap, Shield, Flame, Snowflake } from 'lucide-react';

interface GameProps {
  onScoreUpdate: (score: number) => void;
  onGameOver: (score: number) => void;
  highScore: number;
}

type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';
type PieceColor = 'w' | 'b';

interface ChessPiece {
  id: string;
  type: PieceType;
  color: PieceColor;
  row: number;
  col: number;
  hasMoved?: boolean;
  isShielded?: boolean;
}

interface ChessMove {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  captured?: ChessPiece;
  promotion?: PieceType;
  isCastling?: 'kingside' | 'queenside';
}

type GameMode = 'ai-easy' | 'ai-medium' | 'ai-hard' | 'local-2p';
type CameraPreset = 'orbit' | 'white' | 'black' | 'top';

export type ArcaneSpellType = 'timeFreeze' | 'dragonBlast' | 'teleport' | 'shieldAegis';

interface ShatterFragment {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  angVel: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface CaptureCinematics {
  active: boolean;
  attackerMesh: THREE.Group;
  victimMesh: THREE.Group;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  progress: number;
  shattered: boolean;
  onComplete: () => void;
}

const PIECE_VALUES: Record<PieceType, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000
};

const PAWN_PST = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5,  5, 10, 25, 25, 10,  5,  5],
  [0,  0,  0, 20, 20,  0,  0,  0],
  [5, -5,-10,  0,  0,-10, -5,  5],
  [5, 10, 10,-20,-20, 10, 10,  5],
  [0,  0,  0,  0,  0,  0,  0,  0]
];

const KNIGHT_PST = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50]
];

const CENTER_PST = [
  [-20,-10,-10,-10,-10,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0, 10, 15, 15, 10,  0,-10],
  [-10,  5, 15, 20, 20, 15,  5,-10],
  [-10,  0, 15, 20, 20, 15,  0,-10],
  [-10,  5, 10, 15, 15, 10,  5,-10],
  [-10,  0,  5,  0,  0,  5,  0,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20]
];

const _camTargetPos = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();

function createInitialBoard(): (ChessPiece | null)[][] {
  const grid: (ChessPiece | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
  const backRank: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

  for (let c = 0; c < 8; c++) {
    grid[0][c] = { id: `b_${backRank[c]}_${c}`, type: backRank[c], color: 'b', row: 0, col: c };
    grid[1][c] = { id: `b_p_${c}`, type: 'p', color: 'b', row: 1, col: c };
    grid[6][c] = { id: `w_p_${c}`, type: 'p', color: 'w', row: 6, col: c };
    grid[7][c] = { id: `w_${backRank[c]}_${c}`, type: backRank[c], color: 'w', row: 7, col: c };
  }
  return grid;
}

function cloneBoard(board: (ChessPiece | null)[][]): (ChessPiece | null)[][] {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function getPseudoMovesForPiece(board: (ChessPiece | null)[][], piece: ChessPiece): ChessMove[] {
  const moves: ChessMove[] = [];
  const { row, col, color, type } = piece;
  const enemy: PieceColor = color === 'w' ? 'b' : 'w';

  if (type === 'p') {
    const dir = color === 'w' ? -1 : 1;
    const startRow = color === 'w' ? 6 : 1;
    const promoteRow = color === 'w' ? 0 : 7;

    if (inBounds(row + dir, col) && !board[row + dir][col]) {
      moves.push({
        fromRow: row,
        fromCol: col,
        toRow: row + dir,
        toCol: col,
        promotion: row + dir === promoteRow ? 'q' : undefined
      });
      if (row === startRow && inBounds(row + dir * 2, col) && !board[row + dir * 2][col]) {
        moves.push({ fromRow: row, fromCol: col, toRow: row + dir * 2, toCol: col });
      }
    }

    for (const dc of [-1, 1]) {
      const nr = row + dir;
      const nc = col + dc;
      if (inBounds(nr, nc)) {
        const target = board[nr][nc];
        if (target && target.color === enemy && !target.isShielded) {
          moves.push({
            fromRow: row,
            fromCol: col,
            toRow: nr,
            toCol: nc,
            captured: target,
            promotion: nr === promoteRow ? 'q' : undefined
          });
        }
      }
    }
  } else if (type === 'n') {
    const jumps = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    for (const [dr, dc] of jumps) {
      const nr = row + dr;
      const nc = col + dc;
      if (!inBounds(nr, nc)) continue;
      const target = board[nr][nc];
      if (!target || (target.color === enemy && !target.isShielded)) {
        moves.push({ fromRow: row, fromCol: col, toRow: nr, toCol: nc, captured: target || undefined });
      }
    }
  } else if (type === 'k') {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr;
        const nc = col + dc;
        if (!inBounds(nr, nc)) continue;
        const target = board[nr][nc];
        if (!target || (target.color === enemy && !target.isShielded)) {
          moves.push({ fromRow: row, fromCol: col, toRow: nr, toCol: nc, captured: target || undefined });
        }
      }
    }
    // Castling
    if (!piece.hasMoved) {
      const homeRow = color === 'w' ? 7 : 0;
      if (row === homeRow && col === 4) {
        const kRook = board[homeRow][7];
        if (kRook && kRook.type === 'r' && !kRook.hasMoved && !board[homeRow][5] && !board[homeRow][6]) {
          moves.push({ fromRow: homeRow, fromCol: 4, toRow: homeRow, toCol: 6, isCastling: 'kingside' });
        }
        const qRook = board[homeRow][0];
        if (qRook && qRook.type === 'r' && !qRook.hasMoved && !board[homeRow][1] && !board[homeRow][2] && !board[homeRow][3]) {
          moves.push({ fromRow: homeRow, fromCol: 4, toRow: homeRow, toCol: 2, isCastling: 'queenside' });
        }
      }
    }
  } else {
    const dirs: number[][] = [];
    if (type === 'r' || type === 'q') dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
    if (type === 'b' || type === 'q') dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);

    for (const [dr, dc] of dirs) {
      let nr = row + dr;
      let nc = col + dc;
      while (inBounds(nr, nc)) {
        const target = board[nr][nc];
        if (!target) {
          moves.push({ fromRow: row, fromCol: col, toRow: nr, toCol: nc });
        } else {
          if (target.color === enemy && !target.isShielded) {
            moves.push({ fromRow: row, fromCol: col, toRow: nr, toCol: nc, captured: target });
          }
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
  }

  return moves;
}

function applyMoveOnBoard(board: (ChessPiece | null)[][], move: ChessMove): (ChessPiece | null)[][] {
  const next = cloneBoard(board);
  const moving = next[move.fromRow][move.fromCol];
  if (!moving) return next;

  next[move.fromRow][move.fromCol] = null;
  moving.row = move.toRow;
  moving.col = move.toCol;
  moving.hasMoved = true;
  if (move.promotion) {
    moving.type = move.promotion;
  }
  next[move.toRow][move.toCol] = moving;

  if (move.isCastling === 'kingside') {
    const rook = next[move.fromRow][7];
    if (rook) {
      next[move.fromRow][7] = null;
      rook.col = 5;
      rook.hasMoved = true;
      next[move.fromRow][5] = rook;
    }
  } else if (move.isCastling === 'queenside') {
    const rook = next[move.fromRow][0];
    if (rook) {
      next[move.fromRow][0] = null;
      rook.col = 3;
      rook.hasMoved = true;
      next[move.fromRow][3] = rook;
    }
  }

  return next;
}

function isKingInCheck(board: (ChessPiece | null)[][], color: PieceColor): boolean {
  let kingRow = -1;
  let kingCol = -1;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === color && p.type === 'k') {
        kingRow = r;
        kingCol = c;
        break;
      }
    }
  }
  if (kingRow === -1) return true;

  const enemy: PieceColor = color === 'w' ? 'b' : 'w';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === enemy) {
        const moves = getPseudoMovesForPiece(board, p);
        if (moves.some((m) => m.toRow === kingRow && m.toCol === kingCol)) {
          return true;
        }
      }
    }
  }
  return false;
}

function getAllLegalMoves(board: (ChessPiece | null)[][], color: PieceColor): ChessMove[] {
  const legal: ChessMove[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.color !== color) continue;
      const pseudo = getPseudoMovesForPiece(board, p);
      for (const m of pseudo) {
        if (m.isCastling && isKingInCheck(board, color)) continue;
        const next = applyMoveOnBoard(board, m);
        if (!isKingInCheck(next, color)) {
          legal.push(m);
        }
      }
    }
  }
  return legal;
}

function evaluateBoard(board: (ChessPiece | null)[][]): number {
  let total = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const base = PIECE_VALUES[p.type];
      const tableRow = p.color === 'w' ? r : 7 - r;
      let positional = 0;
      if (p.type === 'p') positional = PAWN_PST[tableRow][c];
      else if (p.type === 'n') positional = KNIGHT_PST[tableRow][c];
      else positional = CENTER_PST[tableRow][c];

      const val = base + positional;
      total += p.color === 'b' ? val : -val;
    }
  }
  return total;
}

function pickBestAIMove(board: (ChessPiece | null)[][], aiColor: PieceColor, mode: GameMode): ChessMove | null {
  const legalMoves = getAllLegalMoves(board, aiColor);
  if (legalMoves.length === 0) return null;

  if (mode === 'ai-easy') {
    const captures = legalMoves.filter((m) => m.captured);
    if (captures.length > 0 && Math.random() < 0.65) {
      return captures[Math.floor(Math.random() * captures.length)];
    }
    return legalMoves[Math.floor(Math.random() * legalMoves.length)];
  }

  const depth = mode === 'ai-hard' ? 3 : 2;

  const minimax = (
    state: (ChessPiece | null)[][],
    d: number,
    alpha: number,
    beta: number,
    maximizing: boolean
  ): number => {
    if (d === 0) return evaluateBoard(state);
    const turnColor: PieceColor = maximizing ? 'b' : 'w';
    const moves = getAllLegalMoves(state, turnColor);
    if (moves.length === 0) {
      if (isKingInCheck(state, turnColor)) {
        return maximizing ? -99999 - d : 99999 + d;
      }
      return 0;
    }

    moves.sort((a, b) => (b.captured ? PIECE_VALUES[b.captured.type] : 0) - (a.captured ? PIECE_VALUES[a.captured.type] : 0));

    if (maximizing) {
      let maxEval = -Infinity;
      for (const m of moves) {
        const score = minimax(applyMoveOnBoard(state, m), d - 1, alpha, beta, false);
        maxEval = Math.max(maxEval, score);
        alpha = Math.max(alpha, score);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const m of moves) {
        const score = minimax(applyMoveOnBoard(state, m), d - 1, alpha, beta, true);
        minEval = Math.min(minEval, score);
        beta = Math.min(beta, score);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  };

  let bestMove = legalMoves[0];
  let bestVal = -Infinity;
  const sorted = [...legalMoves].sort(
    (a, b) => (b.captured ? PIECE_VALUES[b.captured.type] : 0) - (a.captured ? PIECE_VALUES[a.captured.type] : 0)
  );

  for (const m of sorted) {
    const next = applyMoveOnBoard(board, m);
    const val = minimax(next, depth - 1, -Infinity, Infinity, false) + (Math.random() * 6 - 3);
    if (val > bestVal) {
      bestVal = val;
      bestMove = m;
    }
  }
  return bestMove;
}

// Procedural Rune Border Texture
function createRuneFrameTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0c0f17';
  ctx.fillRect(0, 0, 1024, 1024);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 28; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * 1024, Math.random() * 1024);
    ctx.bezierCurveTo(
      Math.random() * 1024, Math.random() * 1024,
      Math.random() * 1024, Math.random() * 1024,
      Math.random() * 1024, Math.random() * 1024
    );
    ctx.stroke();
  }

  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 5;
  ctx.strokeRect(36, 36, 952, 952);
  ctx.strokeRect(92, 92, 840, 840);

  const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
  ctx.fillStyle = '#f59e0b';
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 10;
  ctx.font = 'bold 34px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < 22; i++) {
    const pos = 75 + i * 41;
    const ch1 = runes[i % runes.length];
    const ch2 = runes[(i + 7) % runes.length];
    ctx.fillText(ch1, pos, 64);
    ctx.fillText(ch2, pos, 960);
    ctx.fillText(ch1, 64, pos);
    ctx.fillText(ch2, 960, pos);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

// Composite 3-12 Part Procedural Wizard Chess Piece Builder
function buildWizardChessPieceGroup(type: PieceType, color: PieceColor): THREE.Group {
  const group = new THREE.Group();
  const isWhite = color === 'w';

  const stoneMat = new THREE.MeshStandardMaterial({
    color: isWhite ? 0xe7dfd3 : 0x1e222d,
    roughness: isWhite ? 0.55 : 0.48,
    metalness: 0.12
  });

  const metalMat = new THREE.MeshPhysicalMaterial({
    color: isWhite ? 0xd99b26 : 0xb45309,
    roughness: 0.18,
    metalness: 0.88,
    clearcoat: 0.6
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: isWhite ? 0x38bdf8 : 0xf97316,
    emissive: isWhite ? 0x0284c7 : 0xea580c,
    emissiveIntensity: 0.65,
    roughness: 0.2,
    metalness: 0.3
  });

  // 1. Tiered Pedestal Base
  const basePoints = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.36, 0),
    new THREE.Vector2(0.34, 0.08),
    new THREE.Vector2(0.28, 0.14),
    new THREE.Vector2(0.26, 0.22),
    new THREE.Vector2(0, 0.22)
  ];
  const baseGeo = new THREE.LatheGeometry(basePoints, 20);
  const baseMesh = new THREE.Mesh(baseGeo, stoneMat);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  group.add(baseMesh);

  // 2. Metallic Pedestal Ring
  const ringGeo = new THREE.TorusGeometry(0.29, 0.025, 10, 24);
  const ringMesh = new THREE.Mesh(ringGeo, metalMat);
  ringMesh.rotation.x = Math.PI / 2;
  ringMesh.position.y = 0.14;
  ringMesh.castShadow = true;
  group.add(ringMesh);

  // 3. Torso / Column Body
  const bodyHeight = type === 'p' ? 0.42 : type === 'r' ? 0.56 : type === 'k' ? 0.78 : type === 'q' ? 0.72 : 0.6;
  const bodyGeo = new THREE.CylinderGeometry(0.16, 0.24, bodyHeight, 12);
  const bodyMesh = new THREE.Mesh(bodyGeo, stoneMat);
  bodyMesh.position.y = 0.22 + bodyHeight / 2;
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  // 4. Armor Pauldrons
  const collarGeo = new THREE.CylinderGeometry(0.22, 0.18, 0.1, 10);
  const collarMesh = new THREE.Mesh(collarGeo, metalMat);
  collarMesh.position.y = 0.22 + bodyHeight - 0.04;
  collarMesh.castShadow = true;
  group.add(collarMesh);

  const topY = 0.22 + bodyHeight;

  if (type === 'p') {
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), stoneMat);
    headMesh.position.y = topY + 0.12;
    headMesh.castShadow = true;
    group.add(headMesh);

    const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.16), metalMat);
    visorMesh.position.set(0, topY + 0.13, 0.08);
    group.add(visorMesh);

    const shieldMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.05), metalMat);
    shieldMesh.position.set(-0.16, topY - 0.12, 0.18);
    shieldMesh.rotation.y = 0.25;
    shieldMesh.castShadow = true;
    group.add(shieldMesh);
  } else if (type === 'r') {
    const turretMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.22, 8), stoneMat);
    turretMesh.position.y = topY + 0.1;
    turretMesh.castShadow = true;
    group.add(turretMesh);

    const coreCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), accentMat);
    coreCrystal.position.y = topY + 0.28;
    group.add(coreCrystal);
  } else if (type === 'n') {
    const neckMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.24), stoneMat);
    neckMesh.position.set(0, topY + 0.14, 0.02);
    neckMesh.rotation.x = -0.25;
    neckMesh.castShadow = true;
    group.add(neckMesh);

    const snoutMesh = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.28, 8), metalMat);
    snoutMesh.position.set(0, topY + 0.26, 0.18);
    snoutMesh.rotation.x = Math.PI / 2.3;
    snoutMesh.castShadow = true;
    group.add(snoutMesh);
  } else if (type === 'b') {
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), stoneMat);
    headMesh.position.y = topY + 0.12;
    group.add(headMesh);

    const mitreMesh = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.32, 12), metalMat);
    mitreMesh.position.y = topY + 0.32;
    mitreMesh.castShadow = true;
    group.add(mitreMesh);

    const staffOrb = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 1), accentMat);
    staffOrb.position.set(0.2, topY + 0.35, 0.12);
    group.add(staffOrb);
  } else if (type === 'q') {
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), stoneMat);
    headMesh.position.y = topY + 0.14;
    group.add(headMesh);

    const crownGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), accentMat);
    crownGem.position.y = topY + 0.33;
    group.add(crownGem);
  } else if (type === 'k') {
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), stoneMat);
    headMesh.position.y = topY + 0.15;
    group.add(headMesh);

    const crossVert = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.04), accentMat);
    crossVert.position.y = topY + 0.42;
    group.add(crossVert);
  }

  group.rotation.y = isWhite ? Math.PI : 0;
  return group;
}

function boardCoordToWorld(row: number, col: number): THREE.Vector3 {
  return new THREE.Vector3((col - 3.5) * 1.0, 0.18, (row - 3.5) * 1.0);
}

export default function WizardChess3DGame({ onScoreUpdate, onGameOver, highScore }: GameProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const {
    score,
    updateScore,
    triggerGameOver,
    setGameState
  } = useGameEngine({
    gameId: 'wizard-chess',
    onScoreUpdate,
    onGameOver
  });

  const [gameMode, setGameMode] = useState<GameMode>('ai-medium');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('orbit');
  const [turn, setTurn] = useState<PieceColor>('w');
  const [statusMessage, setStatusMessage] = useState<string>('Giliran Putih — Pilih bidak untuk melangkah');
  const [inCheckColor, setInCheckColor] = useState<PieceColor | null>(null);
  const [moveCount, setMoveCount] = useState<number>(0);
  const [capturedByWhite, setCapturedByWhite] = useState<PieceType[]>([]);
  const [capturedByBlack, setCapturedByBlack] = useState<PieceType[]>([]);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [matchEnded, setMatchEnded] = useState<{ winner: string; reason: string } | null>(null);

  // Modern Arcane Spell Power-Up & Combo State
  const [spellEnergy, setSpellEnergy] = useState<number>(100);
  const [selectedSpell, setSelectedSpell] = useState<ArcaneSpellType | null>(null);
  const [comboMultiplier, setComboMultiplier] = useState<number>(1);

  // Mutable refs
  const boardRef = useRef<(ChessPiece | null)[][]>(createInitialBoard());
  const turnRef = useRef<PieceColor>('w');
  const gameModeRef = useRef<GameMode>('ai-medium');
  const scoreValRef = useRef<number>(0);
  const selectedSquareRef = useRef<{ row: number; col: number } | null>(null);
  const legalMovesForSelectedRef = useRef<ChessMove[]>([]);
  const historyRef = useRef<{
    board: (ChessPiece | null)[][];
    turn: PieceColor;
    score: number;
    capturedW: PieceType[];
    capturedB: PieceType[];
  }[]>([]);

  const pieceMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const highlightMeshesRef = useRef<THREE.Mesh[]>([]);
  const fragmentsRef = useRef<ShatterFragment[]>([]);
  const captureSequenceRef = useRef<CaptureCinematics | null>(null);
  const cameraPresetRef = useRef<CameraPreset>('orbit');
  const activeCameraTransitionRef = useRef<boolean>(false);
  const aiTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    gameModeRef.current = gameMode;
  }, [gameMode]);

  useEffect(() => {
    cameraPresetRef.current = cameraPreset;
    activeCameraTransitionRef.current = true;
  }, [cameraPreset]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    setGameState('playing');
  }, [setGameState]);

  const rebuildScenePiecesRef = useRef<(() => void) | null>(null);
  const clearHighlightsRef = useRef<(() => void) | null>(null);

  const resetMatch = useCallback((newMode?: GameMode) => {
    if (aiTimeoutRef.current) {
      window.clearTimeout(aiTimeoutRef.current);
      aiTimeoutRef.current = null;
    }
    const activeMode = newMode || gameModeRef.current;
    if (newMode) {
      setGameMode(newMode);
      gameModeRef.current = newMode;
    }
    boardRef.current = createInitialBoard();
    turnRef.current = 'w';
    scoreValRef.current = 0;
    selectedSquareRef.current = null;
    legalMovesForSelectedRef.current = [];
    historyRef.current = [];
    captureSequenceRef.current = null;

    setTurn('w');
    setMoveCount(0);
    setInCheckColor(null);
    setCapturedByWhite([]);
    setCapturedByBlack([]);
    setSpellEnergy(100);
    setSelectedSpell(null);
    setComboMultiplier(1);
    setMatchEnded(null);
    setStatusMessage(
      activeMode === 'local-2p'
        ? 'Mode 2 Pemain Lokal — Giliran Putih'
        : 'Giliran Putih — Pilih bidak untuk melangkah'
    );
    updateScore(0);
    setGameState('playing');
    clearHighlightsRef.current?.();
    rebuildScenePiecesRef.current?.();
    audio.playClick();
  }, [updateScore, setGameState]);

  const handleUndoMove = useCallback(() => {
    if (captureSequenceRef.current?.active || historyRef.current.length === 0 || matchEnded) return;
    if (aiTimeoutRef.current) {
      window.clearTimeout(aiTimeoutRef.current);
      aiTimeoutRef.current = null;
    }
    let snapshot = historyRef.current.pop()!;
    if (gameModeRef.current !== 'local-2p' && snapshot.turn === 'b' && historyRef.current.length > 0) {
      snapshot = historyRef.current.pop()!;
    }
    boardRef.current = cloneBoard(snapshot.board);
    turnRef.current = snapshot.turn;
    scoreValRef.current = snapshot.score;
    selectedSquareRef.current = null;
    legalMovesForSelectedRef.current = [];

    setTurn(snapshot.turn);
    setCapturedByWhite(snapshot.capturedW);
    setCapturedByBlack(snapshot.capturedB);
    setInCheckColor(isKingInCheck(boardRef.current, snapshot.turn) ? snapshot.turn : null);
    setStatusMessage(`Langkah dibatalkan — Giliran ${snapshot.turn === 'w' ? 'Putih' : 'Hitam'}`);
    updateScore(snapshot.score);
    clearHighlightsRef.current?.();
    rebuildScenePiecesRef.current?.();
    audio.playClick();
  }, [matchEnded, updateScore]);

  // Cast Arcane Spell Handler
  const handleCastSpell = (spell: ArcaneSpellType) => {
    if (spellEnergy < 35 || turn !== 'w') return;
    setSelectedSpell(spell);
    if (spell === 'timeFreeze') {
      setSpellEnergy((prev) => prev - 35);
      audio.playLevelUp();
      screenShake.trigger('medium');
      setStatusMessage('SPELL TIME FREEZE! Langkah AI ditunda 1 putaran');
    } else if (spell === 'shieldAegis') {
      if (selectedSquareRef.current) {
        const { row, col } = selectedSquareRef.current;
        const p = boardRef.current[row][col];
        if (p && p.color === 'w') {
          p.isShielded = true;
          setSpellEnergy((prev) => prev - 40);
          audio.playPowerup();
          screenShake.trigger('medium');
          setStatusMessage('PERISAI AEGIS AKTIF PADA BIDAK TERPILIH!');
        }
      } else {
        setStatusMessage('Pilih bidak Anda dulu sebelum menggunakan Perisai Aegis!');
      }
    }
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || 960;
    const height = container.clientHeight || 540;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x161210);
    scene.fog = new THREE.FogExp2(0x161210, 0.032);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 120);
    camera.position.set(0, 7.6, 8.8);
    camera.lookAt(0, 0.2, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance'
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.minDistance = 4.5;
    controls.maxDistance = 16;
    controls.target.set(0, 0.2, 0);
    controls.addEventListener('start', () => {
      activeCameraTransitionRef.current = false;
    });

    const hemiLight = new THREE.HemisphereLight(0xfde68a, 0x1e293b, 0.65);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffedd5, 1.85);
    keyLight.position.set(6, 11, 7);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 28;
    const d = 6.5;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.7);
    rimLight.position.set(-7, 6, -8);
    scene.add(rimLight);

    const brazierLight = new THREE.PointLight(0xf97316, 4.5, 18, 1.6);
    brazierLight.position.set(-4.6, 2.2, -5.2);
    scene.add(brazierLight);

    const cathedralGroup = new THREE.Group();
    scene.add(cathedralGroup);

    const stoneFloorMat = new THREE.MeshStandardMaterial({
      color: 0x3b312b,
      roughness: 0.85,
      metalness: 0.08
    });
    const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), stoneFloorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.5;
    floorMesh.receiveShadow = true;
    cathedralGroup.add(floorMesh);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x57483d, roughness: 0.8, metalness: 0.05 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(28, 12, 0.8), wallMat);
    backWall.position.set(0, 5.5, -9.5);
    backWall.receiveShadow = true;
    cathedralGroup.add(backWall);

    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.8, 12, 28), wallMat);
    sideWall.position.set(-9.5, 5.5, 0);
    sideWall.receiveShadow = true;
    cathedralGroup.add(sideWall);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const runeFrameTex = createRuneFrameTexture(maxAniso);
    const frameMat = new THREE.MeshPhysicalMaterial({
      map: runeFrameTex,
      roughness: 0.22,
      metalness: 0.35,
      clearcoat: 0.8
    });
    const boardFrame = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.34, 9.6), frameMat);
    boardFrame.position.y = 0;
    boardFrame.receiveShadow = true;
    boardFrame.castShadow = true;
    scene.add(boardFrame);

    // 64 Individual Clickable Chess Squares with Elemental Hazards/Buffs
    const lightSqMat = new THREE.MeshStandardMaterial({ color: 0xe7dfd5, roughness: 0.35, metalness: 0.1 });
    const darkSqMat = new THREE.MeshStandardMaterial({ color: 0x181b24, roughness: 0.28, metalness: 0.25 });

    const lavaSqMat = new THREE.MeshStandardMaterial({ color: 0xea580c, emissive: 0xc2410c, emissiveIntensity: 0.6 });
    const frostSqMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x0369a1, emissiveIntensity: 0.5 });

    const clickableTargets: THREE.Object3D[] = [];
    const squaresGroup = new THREE.Group();
    scene.add(squaresGroup);

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const isLight = (r + c) % 2 === 0;
        let mat = isLight ? lightSqMat : darkSqMat;

        // Elemental tile placement
        if ((r === 3 && c === 3) || (r === 4 && c === 4)) mat = lavaSqMat;
        if ((r === 3 && c === 4) || (r === 4 && c === 3)) mat = frostSqMat;

        const sqMesh = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.06, 0.98), mat);
        const pos = boardCoordToWorld(r, c);
        sqMesh.position.set(pos.x, 0.16, pos.z);
        sqMesh.receiveShadow = true;
        sqMesh.userData = { squareRow: r, squareCol: c };
        squaresGroup.add(sqMesh);
        clickableTargets.push(sqMesh);
      }
    }

    const piecesRoot = new THREE.Group();
    scene.add(piecesRoot);

    const highlightsRoot = new THREE.Group();
    scene.add(highlightsRoot);

    const debrisRoot = new THREE.Group();
    scene.add(debrisRoot);

    const clearHighlights = () => {
      while (highlightsRoot.children.length > 0) {
        const child = highlightsRoot.children[0] as THREE.Mesh;
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
        highlightsRoot.remove(child);
      }
      highlightMeshesRef.current = [];
    };
    clearHighlightsRef.current = clearHighlights;

    const rebuildScenePieces = () => {
      pieceMeshesRef.current.forEach((grp) => {
        piecesRoot.remove(grp);
      });
      pieceMeshesRef.current.clear();

      const grid = boardRef.current;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = grid[r][c];
          if (!piece) continue;
          const meshGroup = buildWizardChessPieceGroup(piece.type, piece.color);
          const worldPos = boardCoordToWorld(r, c);
          meshGroup.position.copy(worldPos);
          meshGroup.userData = { pieceId: piece.id, squareRow: r, squareCol: c };
          meshGroup.traverse((child) => {
            child.userData = { pieceId: piece.id, squareRow: r, squareCol: c };
          });
          piecesRoot.add(meshGroup);
          pieceMeshesRef.current.set(piece.id, meshGroup);
        }
      }
    };
    rebuildScenePiecesRef.current = rebuildScenePieces;
    rebuildScenePieces();

    const showHighlightsForMoves = (fromRow: number, fromCol: number, moves: ChessMove[]) => {
      clearHighlights();

      const originPos = boardCoordToWorld(fromRow, fromCol);
      const originMat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
      });
      const originRing = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.44, 24), originMat);
      originRing.rotation.x = -Math.PI / 2;
      originRing.position.set(originPos.x, 0.2, originPos.z);
      highlightsRoot.add(originRing);

      for (const m of moves) {
        const p = boardCoordToWorld(m.toRow, m.toCol);
        const isCapture = Boolean(m.captured);
        const mat = new THREE.MeshBasicMaterial({
          color: isCapture ? 0xef4444 : 0x10b981,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.88,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1
        });
        const geo = isCapture
          ? new THREE.RingGeometry(0.32, 0.45, 24)
          : new THREE.CircleGeometry(0.2, 20);
        const indicator = new THREE.Mesh(geo, mat);
        indicator.rotation.x = -Math.PI / 2;
        indicator.position.set(p.x, 0.2, p.z);
        highlightsRoot.add(indicator);
      }
    };

    const spawnStoneShatter = (pos: THREE.Vector3, victimColor: PieceColor) => {
      const fragMat = new THREE.MeshStandardMaterial({
        color: victimColor === 'w' ? 0xe7dfd3 : 0x1e222d,
        roughness: 0.65,
        metalness: 0.15
      });

      for (let i = 0; i < 20; i++) {
        const size = 0.06 + Math.random() * 0.09;
        const fragGeo = new THREE.DodecahedronGeometry(size, 0);
        const fragMesh = new THREE.Mesh(fragGeo, fragMat);
        fragMesh.position.set(
          pos.x + (Math.random() - 0.5) * 0.25,
          pos.y + 0.15 + Math.random() * 0.45,
          pos.z + (Math.random() - 0.5) * 0.25
        );
        fragMesh.castShadow = !isSoftwareGl;
        debrisRoot.add(fragMesh);

        fragmentsRef.current.push({
          mesh: fragMesh,
          vel: new THREE.Vector3(
            (Math.random() - 0.5) * 4.2,
            2.2 + Math.random() * 3.2,
            (Math.random() - 0.5) * 4.2
          ),
          angVel: new THREE.Vector3(
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10
          ),
          life: 0,
          maxLife: 1.6 + Math.random() * 0.6
        });
      }
    };

    const executeChessMove = (move: ChessMove) => {
      const currentBoard = boardRef.current;
      const movingPiece = currentBoard[move.fromRow][move.fromCol];
      if (!movingPiece) return;

      historyRef.current.push({
        board: cloneBoard(currentBoard),
        turn: turnRef.current,
        score: scoreValRef.current,
        capturedW: [...capturedByWhite],
        capturedB: [...capturedByBlack]
      });

      clearHighlights();
      selectedSquareRef.current = null;
      legalMovesForSelectedRef.current = [];

      const attackerGroup = pieceMeshesRef.current.get(movingPiece.id);
      const victimPiece = move.captured;
      const victimGroup = victimPiece ? pieceMeshesRef.current.get(victimPiece.id) : undefined;
      const destWorld = boardCoordToWorld(move.toRow, move.toCol);

      const finalizeTurnTransition = () => {
        const nextBoard = applyMoveOnBoard(boardRef.current, move);
        boardRef.current = nextBoard;

        if (movingPiece.color === 'w') {
          const diffMult =
            gameModeRef.current === 'ai-hard' ? 2.0 : gameModeRef.current === 'ai-medium' ? 1.4 : 1.0;
          const capturePts = victimPiece ? Math.round(PIECE_VALUES[victimPiece.type] * diffMult) : 15;
          scoreValRef.current += capturePts * comboMultiplier;
          updateScore(scoreValRef.current);

          if (victimPiece) {
            setComboMultiplier((c) => Math.min(8, c * 2));
            setSpellEnergy((e) => Math.min(100, e + 25));
          }
        }

        if (victimPiece) {
          if (movingPiece.color === 'w') {
            setCapturedByWhite((prev) => [...prev, victimPiece.type]);
          } else {
            setCapturedByBlack((prev) => [...prev, victimPiece.type]);
          }
        }

        rebuildScenePieces();

        const nextColor: PieceColor = movingPiece.color === 'w' ? 'b' : 'w';
        turnRef.current = nextColor;
        setTurn(nextColor);
        setMoveCount((c) => c + 1);

        const nextLegal = getAllLegalMoves(nextBoard, nextColor);
        const checkNow = isKingInCheck(nextBoard, nextColor);
        setInCheckColor(checkNow ? nextColor : null);

        if (nextLegal.length === 0) {
          if (checkNow) {
            const winnerName = movingPiece.color === 'w' ? 'Putih (Kemenangan Skakmat!)' : 'Hitam (Skakmat)';
            if (movingPiece.color === 'w') {
              const winBonus =
                gameModeRef.current === 'ai-hard' ? 3000 : gameModeRef.current === 'ai-medium' ? 2000 : 1200;
              scoreValRef.current += winBonus;
              updateScore(scoreValRef.current);
            }
            setStatusMessage(`SKAKMAT! ${winnerName}`);
            setMatchEnded({ winner: winnerName, reason: 'Skakmat di Katedral Gotik' });
            audio.playGameOver();
            screenShake.trigger('heavy');
            triggerGameOver(scoreValRef.current);
          } else {
            setStatusMessage('REMIS (Stalemate)');
            setMatchEnded({ winner: 'Seri / Stalemate', reason: 'Pertandingan berakhir imbang' });
            triggerGameOver(scoreValRef.current);
          }
          return;
        }

        if (checkNow) {
          audio.playError();
          screenShake.trigger('medium');
          setStatusMessage(`SKAK! Raja ${nextColor === 'w' ? 'Putih' : 'Hitam'} terancam!`);
        } else {
          setStatusMessage(
            nextColor === 'w'
              ? 'Giliran Putih — Pilih bidak Anda'
              : gameModeRef.current === 'local-2p'
                ? 'Giliran Hitam (P2) — Pilih bidak'
                : 'Master Catur AI merancang serangan...'
          );
        }

        if (nextColor === 'b' && gameModeRef.current !== 'local-2p') {
          aiTimeoutRef.current = window.setTimeout(() => {
            const aiMove = pickBestAIMove(boardRef.current, 'b', gameModeRef.current);
            if (aiMove) {
              executeChessMove(aiMove);
            }
          }, 420);
        }
      };

      if (victimPiece && attackerGroup && victimGroup) {
        captureSequenceRef.current = {
          active: true,
          attackerMesh: attackerGroup,
          victimMesh: victimGroup,
          startPos: attackerGroup.position.clone(),
          targetPos: destWorld.clone(),
          progress: 0,
          shattered: false,
          onComplete: finalizeTurnTransition
        };
      } else {
        audio.playMove();
        finalizeTurnTransition();
      }
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const dx = e.clientX - pointerDownPos.x;
      const dy = e.clientY - pointerDownPos.y;
      if (Math.hypot(dx, dy) > 8) return;

      if (captureSequenceRef.current?.active) return;
      if (turnRef.current === 'b' && gameModeRef.current !== 'local-2p') return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([...clickableTargets, ...piecesRoot.children], true);
      if (hits.length === 0) return;

      let hitRow: number | undefined;
      let hitCol: number | undefined;
      for (const hit of hits) {
        if (typeof hit.object.userData?.squareRow === 'number') {
          hitRow = hit.object.userData.squareRow;
          hitCol = hit.object.userData.squareCol;
          break;
        }
      }
      if (hitRow === undefined || hitCol === undefined) return;

      const moveMatch = legalMovesForSelectedRef.current.find(
        (m) => m.toRow === hitRow && m.toCol === hitCol
      );
      if (moveMatch) {
        executeChessMove(moveMatch);
        return;
      }

      const clickedPiece = boardRef.current[hitRow][hitCol];
      if (clickedPiece && clickedPiece.color === turnRef.current) {
        selectedSquareRef.current = { row: hitRow, col: hitCol };
        const allLegal = getAllLegalMoves(boardRef.current, turnRef.current);
        const pieceLegal = allLegal.filter((m) => m.fromRow === hitRow && m.fromCol === hitCol);
        legalMovesForSelectedRef.current = pieceLegal;
        showHighlightsForMoves(hitRow, hitCol, pieceLegal);
        audio.playClick();
      } else {
        selectedSquareRef.current = null;
        legalMovesForSelectedRef.current = [];
        clearHighlights();
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const clock = new THREE.Clock();
    let frameId = 0;
    let isDisposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || !gl.fenceSync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (isDisposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (isDisposed) return;
      const dt = Math.min(clock.getDelta(), 0.1);

      pieceMeshesRef.current.forEach((grp) => {
        const r = grp.userData.squareRow;
        const c = grp.userData.squareCol;
        const isSel =
          selectedSquareRef.current &&
          selectedSquareRef.current.row === r &&
          selectedSquareRef.current.col === c;
        if (!captureSequenceRef.current?.active || grp !== captureSequenceRef.current.attackerMesh) {
          grp.position.y = THREE.MathUtils.damp(grp.position.y, isSel ? 0.42 : 0.18, 10, dt);
        }
      });

      const seq = captureSequenceRef.current;
      if (seq && seq.active) {
        seq.progress += dt * 1.45;
        if (seq.progress < 0.65) {
          const t = seq.progress / 0.65;
          seq.attackerMesh.position.lerpVectors(seq.startPos, seq.targetPos, t * 0.82);
          seq.attackerMesh.position.y = 0.18 + Math.sin(t * Math.PI) * 0.55;
          seq.attackerMesh.rotation.x = Math.sin(t * Math.PI) * 0.45;
        } else if (!seq.shattered) {
          seq.shattered = true;
          seq.victimMesh.visible = false;
          spawnStoneShatter(seq.targetPos, turnRef.current === 'w' ? 'b' : 'w');
          audio.playExplosion();
          screenShake.trigger('heavy');
        } else if (seq.progress < 1.15) {
          seq.attackerMesh.position.lerp(seq.targetPos, 0.25);
          seq.attackerMesh.rotation.x = THREE.MathUtils.damp(seq.attackerMesh.rotation.x, 0, 12, dt);
        } else {
          seq.active = false;
          captureSequenceRef.current = null;
          seq.onComplete();
        }
      }

      for (let i = fragmentsRef.current.length - 1; i >= 0; i--) {
        const f = fragmentsRef.current[i];
        f.life += dt;
        if (f.life >= f.maxLife) {
          debrisRoot.remove(f.mesh);
          f.mesh.geometry.dispose();
          fragmentsRef.current.splice(i, 1);
          continue;
        }
        f.vel.y -= 9.8 * dt;
        f.mesh.position.addScaledVector(f.vel, dt);
        if (f.mesh.position.y < 0.22) {
          f.mesh.position.y = 0.22;
          f.vel.y *= -0.42;
          f.vel.x *= 0.72;
          f.vel.z *= 0.72;
        }
        f.mesh.rotation.x += f.angVel.x * dt;
        f.mesh.rotation.y += f.angVel.y * dt;
        f.mesh.rotation.z += f.angVel.z * dt;
        const scale = Math.max(0.01, 1 - f.life / f.maxLife);
        f.mesh.scale.setScalar(scale);
      }

      if (activeCameraTransitionRef.current) {
        const preset = cameraPresetRef.current;
        if (preset === 'white') _camTargetPos.set(0, 7.2, 8.6);
        else if (preset === 'black') _camTargetPos.set(0, 7.2, -8.6);
        else if (preset === 'top') _camTargetPos.set(0, 11.8, 0.01);
        else _camTargetPos.set(-4.2, 7.5, 7.8);

        _camLookTarget.set(0, 0.2, 0);
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _camTargetPos.x, 5, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _camTargetPos.y, 5, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _camTargetPos.z, 5, dt);
        controls.target.lerp(_camLookTarget, 0.15);

        if (camera.position.distanceTo(_camTargetPos) < 0.08) {
          activeCameraTransitionRef.current = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(300, entry.contentRect.width);
        const h = Math.max(300, entry.contentRect.height);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      envTarget.dispose();
      runeFrameTex.dispose();
      renderer.dispose();
    };
  }, [triggerGameOver, updateScore]);

  const pieceSymbol = (t: PieceType) =>
    t === 'q' ? '♕' : t === 'r' ? '♖' : t === 'b' ? '♗' : t === 'n' ? '♘' : '♙';

  return (
    <div className="relative w-full h-full min-h-[500px] bg-[#161210] overflow-hidden select-none">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Left Minimal Status HUD */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-3 px-3.5 py-2 rounded-xl bg-zinc-950/90 border border-amber-500/25 text-zinc-100 pointer-events-auto">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs font-bold tracking-tight text-amber-300 whitespace-nowrap">
            Wizard Chess 3D
          </span>
        </div>
        <span className="text-zinc-600" aria-hidden="true">·</span>
        <span className="text-xs font-semibold text-amber-200 whitespace-nowrap">
          {turn === 'w' ? 'Putih' : 'Hitam'}
        </span>
        <span className="text-zinc-600" aria-hidden="true">·</span>
        <span className="text-xs font-medium text-zinc-200 whitespace-nowrap">
          {statusMessage}
        </span>
        {inCheckColor && (
          <>
            <span className="text-zinc-600" aria-hidden="true">·</span>
            <span className="flex items-center gap-1 text-xs font-bold text-red-400 whitespace-nowrap">
              <ShieldAlert className="w-3.5 h-3.5" />
              SKAK!
            </span>
          </>
        )}
      </div>

      {/* Top Right Score & Spell Energy HUD */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-4 px-3.5 py-2 rounded-xl bg-zinc-950/90 border border-white/10 text-xs text-zinc-200 pointer-events-auto tabular-nums">
        {comboMultiplier > 1 && (
          <div className="px-2 py-0.5 rounded bg-gradient-to-r from-amber-500 to-rose-500 text-zinc-950 font-black text-[10px] animate-pulse">
            {comboMultiplier}x SPELL COMBO
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-bold text-cyan-300">{spellEnergy} SP</span>
        </div>
        <span className="text-zinc-600" aria-hidden="true">·</span>
        <div>
          <span className="text-zinc-400">Skor: </span>
          <span className="font-bold text-amber-400">{score}</span>
        </div>
      </div>

      {/* Match Completion Modal Overlay */}
      {matchEnded && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/75 p-4">
          <div className="max-w-md w-full rounded-2xl bg-zinc-900 border border-amber-500/40 p-6 text-center shadow-2xl">
            <Swords className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <h3 className="text-xl font-bold text-white mb-1">{matchEnded.winner}</h3>
            <p className="text-sm text-zinc-400 mb-4">{matchEnded.reason}</p>
            <div className="flex items-center justify-center gap-6 py-3 px-4 rounded-xl bg-zinc-950 border border-white/10 mb-5 tabular-nums">
              <div>
                <div className="text-xs text-zinc-400">Skor Akhir</div>
                <div className="text-lg font-bold text-amber-400">{score}</div>
              </div>
              <span className="text-zinc-700" aria-hidden="true">/</span>
              <div>
                <div className="text-xs text-zinc-400">Rekor Terbaik</div>
                <div className="text-lg font-bold text-white">{Math.max(score, highScore)}</div>
              </div>
            </div>
            <button
              onClick={() => resetMatch()}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Play className="w-4 h-4 fill-current" />
              Mainkan Pertandingan Baru
            </button>
          </div>
        </div>
      )}

      {/* Unified Collapsible Bottom Control Dock & Arcane Spells */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 w-[min(940px,95vw)] flex flex-col items-center pointer-events-auto">
        <button
          onClick={() => setDockCollapsed((prev) => !prev)}
          className="mb-1 px-3 py-1 rounded-t-lg bg-zinc-950/90 border border-b-0 border-white/15 text-[11px] font-medium text-zinc-300 hover:text-white flex items-center gap-1 whitespace-nowrap transition-colors"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Tampilkan Kontrol (H)
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              Sembunyikan Kontrol (H)
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="w-full px-4 py-2.5 rounded-2xl bg-zinc-950/95 border border-white/15 shadow-2xl flex flex-wrap items-center justify-between gap-3">
            {/* Arcane Spell Cards */}
            <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-xl border border-cyan-500/20">
              <button
                onClick={() => handleCastSpell('timeFreeze')}
                disabled={spellEnergy < 35}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/80 disabled:opacity-40 flex items-center gap-1 transition-colors"
              >
                <Snowflake className="w-3.5 h-3.5" />
                Time Freeze (35 SP)
              </button>
              <button
                onClick={() => handleCastSpell('shieldAegis')}
                disabled={spellEnergy < 40}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 disabled:opacity-40 flex items-center gap-1 transition-colors"
              >
                <Shield className="w-3.5 h-3.5" />
                Perisai Aegis (40 SP)
              </button>
            </div>

            {/* Mode Selector */}
            <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-white/5">
              {(
                [
                  { id: 'ai-easy', label: 'AI Mudah' },
                  { id: 'ai-medium', label: 'AI Sedang' },
                  { id: 'ai-hard', label: 'AI Sulit' },
                  { id: 'local-2p', label: '2 Pemain' }
                ] as { id: GameMode; label: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  onClick={() => resetMatch(m.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    gameMode === m.id
                      ? 'bg-amber-500 text-zinc-950'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Match Utility Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleUndoMove}
                disabled={historyRef.current.length === 0}
                className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-xs font-medium text-zinc-200 border border-white/10 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Undo
              </button>
              <button
                onClick={() => resetMatch()}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

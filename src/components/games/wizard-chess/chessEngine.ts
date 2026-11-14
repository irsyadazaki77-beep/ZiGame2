export type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';
export type PieceColor = 'w' | 'b';

export interface ChessPiece {
  id: string;
  type: PieceType;
  color: PieceColor;
  row: number;
  col: number;
  hasMoved?: boolean;
  isShielded?: boolean;
}

export interface ChessMove {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  captured?: ChessPiece;
  promotion?: PieceType;
  isCastling?: 'kingside' | 'queenside';
}

export type GameMode = 'ai-easy' | 'ai-medium' | 'ai-hard' | 'local-2p';
export type CameraPreset = 'orbit' | 'white' | 'black' | 'top';
export type ArcaneSpellType = 'timeFreeze' | 'dragonBlast' | 'teleport' | 'shieldAegis';

export const PIECE_VALUES: Record<PieceType, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000
};

const PAWN_PST = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5, 5, 10, 25, 25, 10, 5, 5],
  [0, 0, 0, 20, 20, 0, 0, 0],
  [5, -5, -10, 0, 0, -10, -5, 5],
  [5, 10, 10, -20, -20, 10, 10, 5],
  [0, 0, 0, 0, 0, 0, 0, 0]
];

const KNIGHT_PST = [
  [-50, -40, -30, -30, -30, -30, -40, -50],
  [-40, -20, 0, 0, 0, 0, -20, -40],
  [-30, 0, 10, 15, 15, 10, 0, -30],
  [-30, 5, 15, 20, 20, 15, 5, -30],
  [-30, 0, 15, 20, 20, 15, 0, -30],
  [-30, 5, 10, 15, 15, 10, 5, -30],
  [-40, -20, 0, 5, 5, 0, -20, -40],
  [-50, -40, -30, -30, -30, -30, -40, -50]
];

const CENTER_PST = [
  [-20, -10, -10, -10, -10, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 10, 15, 15, 10, 0, -10],
  [-10, 5, 15, 20, 20, 15, 5, -10],
  [-10, 0, 15, 20, 20, 15, 0, -10],
  [-10, 5, 10, 15, 15, 10, 5, -10],
  [-10, 0, 5, 0, 0, 5, 0, -10],
  [-20, -10, -10, -10, -10, -10, -10, -20]
];

export function createInitialBoard(): (ChessPiece | null)[][] {
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

export function cloneBoard(board: (ChessPiece | null)[][]): (ChessPiece | null)[][] {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

export function getPseudoMovesForPiece(board: (ChessPiece | null)[][], piece: ChessPiece): ChessMove[] {
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

export function applyMoveOnBoard(board: (ChessPiece | null)[][], move: ChessMove): (ChessPiece | null)[][] {
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

export function isKingInCheck(board: (ChessPiece | null)[][], color: PieceColor): boolean {
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

export function getAllLegalMoves(board: (ChessPiece | null)[][], color: PieceColor): ChessMove[] {
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

export function pickBestAIMove(board: (ChessPiece | null)[][], aiColor: PieceColor, mode: GameMode): ChessMove | null {
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

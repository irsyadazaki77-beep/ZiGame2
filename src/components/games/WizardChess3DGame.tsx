import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { useGameEngine } from '../../sdk';
import {
  ThreeStageController,
  CameraPreset3D,
  QualityLevel3D,
  createStoneCathedralMaps
} from '../../utils/threeStage';
import { audioController } from '../../sdk/audioController';
import { screenShake } from '../../utils/screenShake';
import { haptics } from '../../utils/haptics';
import { ThreeDockOverlay } from '../gameplay/ThreeDockOverlay';
import { performanceService } from '../../services/performanceService';
import {
  ArcaneSpellType,
  ChessMove,
  ChessPiece,
  GameMode,
  PIECE_VALUES,
  PieceColor,
  PieceType,
  applyMoveOnBoard,
  cloneBoard,
  createInitialBoard,
  getAllLegalMoves,
  isKingInCheck,
  pickBestAIMove
} from './wizard-chess/chessEngine';
import {
  BuiltChessPiece,
  boardCoordToWorld,
  buildWizardChessPieceGroup,
  createBrazierWithEmbers,
  createRuneFrameTexture,
  disposePieceGroupTree
} from './wizard-chess/chessModels';
import {
  Crown,
  Swords,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  Play,
  Zap,
  Shield,
  Snowflake
} from 'lucide-react';

interface GameProps {
  onScoreUpdate: (score: number) => void;
  onGameOver: (score: number) => void;
  highScore: number;
}

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

const _camTargetPos = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();

export default function WizardChess3DGame({ onScoreUpdate, onGameOver, highScore }: GameProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const {
    score,
    updateScore,
    triggerGameOver,
    setGameState,
    gameStateRef
  } = useGameEngine({
    gameId: 'wizard-chess',
    onScoreUpdate,
    onGameOver
  });

  const [gameMode, setGameMode] = useState<GameMode>('ai-medium');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('isometric');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');
  const [turn, setTurn] = useState<PieceColor>('w');
  const [statusMessage, setStatusMessage] = useState<string>('Giliran Putih — Pilih bidak untuk melangkah');
  const [inCheckColor, setInCheckColor] = useState<PieceColor | null>(null);
  const [, setMoveCount] = useState<number>(0);
  const [capturedByWhite, setCapturedByWhite] = useState<PieceType[]>([]);
  const [capturedByBlack, setCapturedByBlack] = useState<PieceType[]>([]);
  const [matchEnded, setMatchEnded] = useState<{ winner: string; reason: string } | null>(null);

  const [spellEnergy, setSpellEnergy] = useState<number>(100);
  const [, setSelectedSpell] = useState<ArcaneSpellType | null>(null);
  const [comboMultiplier, setComboMultiplier] = useState<number>(1);

  const boardRef = useRef<(ChessPiece | null)[][]>(createInitialBoard());
  const turnRef = useRef<PieceColor>('w');
  const gameModeRef = useRef<GameMode>('ai-medium');
  const scoreValRef = useRef<number>(0);
  const selectedSquareRef = useRef<{ row: number; col: number } | null>(null);
  const hoveredSquareRef = useRef<{ row: number; col: number } | null>(null);
  const legalMovesForSelectedRef = useRef<ChessMove[]>([]);
  const historyRef = useRef<{
    board: (ChessPiece | null)[][];
    turn: PieceColor;
    score: number;
    capturedW: PieceType[];
    capturedB: PieceType[];
  }[]>([]);

  const pieceMeshesRef = useRef<Map<string, BuiltChessPiece>>(new Map());
  const highlightMeshesRef = useRef<THREE.Mesh[]>([]);
  const fragmentsRef = useRef<ShatterFragment[]>([]);
  const captureSequenceRef = useRef<CaptureCinematics | null>(null);
  const stageRef = useRef<ThreeStageController | null>(null);
  const cameraPresetRef = useRef<CameraPreset3D>('isometric');
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
    setGameState('playing');
  }, [setGameState]);

  const rebuildScenePiecesRef = useRef<(() => void) | null>(null);
  const clearHighlightsRef = useRef<(() => void) | null>(null);

  const cycleQuality = useCallback(() => {
    setQuality((prev) => {
      const next: QualityLevel3D = prev === 'ultra' ? 'balanced' : prev === 'balanced' ? 'performance' : 'ultra';
      stageRef.current?.setQualityLevel(next);
      return next;
    });
  }, []);

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
    hoveredSquareRef.current = null;
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
    audioController.playClick();
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
    audioController.playClick();
  }, [matchEnded, updateScore]);

  const handleCastSpell = (spell: ArcaneSpellType) => {
    if (spellEnergy < 35 || turn !== 'w') return;
    setSelectedSpell(spell);
    if (spell === 'timeFreeze') {
      setSpellEnergy((prev) => prev - 35);
      audioController.playLevelUp();
      screenShake.trigger('medium');
      setStatusMessage('SPELL TIME FREEZE! Langkah AI ditunda 1 putaran');
    } else if (spell === 'shieldAegis') {
      if (selectedSquareRef.current) {
        const { row, col } = selectedSquareRef.current;
        const p = boardRef.current[row][col];
        if (p && p.color === 'w') {
          p.isShielded = true;
          setSpellEnergy((prev) => prev - 40);
          audioController.playPowerup();
          screenShake.trigger('medium');
          rebuildScenePiecesRef.current?.();
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

    let stage: ThreeStageController;
    try {
      stage = new ThreeStageController({
        container,
        backgroundColor: 0x161210,
        fogColor: 0x161210,
        fogDensity: 0.03,
        fov: 45,
        near: 0.1,
        far: 120,
        manualCamera: true,
        enableGridFloor: false,
        shadowBounds: 7,
        toneMappingExposure: 1.12,
        bloom: {
          enabled: true,
          strength: 0.45,
          radius: 0.35,
          threshold: 0.85
        }
      });
      stageRef.current = stage;
    } catch {
      return;
    }

    const { scene, camera, renderer, isSoftwareGl } = stage;
    camera.position.set(0, 7.6, 8.8);
    camera.lookAt(0, 0.2, 0);

    // Tune Three-Point Cathedral Lighting
    stage.hemiLight.color.setHex(0xfde68a);
    stage.hemiLight.groundColor.setHex(0x1e293b);
    stage.hemiLight.intensity = 0.65;

    stage.keyLight.color.setHex(0xffedd5);
    stage.keyLight.intensity = 1.85;
    stage.keyLight.position.set(6, 11, 7);
    stage.keyLight.shadow.camera.near = 1;
    stage.keyLight.shadow.camera.far = 28;

    stage.rimLight.color.setHex(0x38bdf8);
    stage.rimLight.intensity = 0.72;
    stage.rimLight.position.set(-7, 6, -8);

    const brazierLight = new THREE.PointLight(0xf97316, 5.2, 18, 1.5);
    brazierLight.position.set(-4.6, 2.2, -5.2);
    scene.add(brazierLight);

    const brazierLightR = new THREE.PointLight(0xf97316, 4.2, 16, 1.5);
    brazierLightR.position.set(4.6, 2.2, -5.2);
    scene.add(brazierLightR);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.minDistance = 4.5;
    controls.maxDistance = 16;
    controls.target.set(0, 0.2, 0);
    const onControlsStart = () => {
      activeCameraTransitionRef.current = false;
    };
    controls.addEventListener('start', onControlsStart);

    // Gothic Cathedral Stone Floor with Procedural PBR Maps
    const cathedralGroup = new THREE.Group();
    scene.add(cathedralGroup);

    const stoneMaps = createStoneCathedralMaps(renderer, {
      baseColor: '#3b312b',
      mortarColor: '#120e0c',
      repeatX: 6,
      repeatY: 6
    });
    const stoneFloorMat = new THREE.MeshStandardMaterial({
      map: stoneMaps.map,
      roughnessMap: stoneMaps.roughnessMap,
      bumpMap: stoneMaps.bumpMap,
      bumpScale: 0.05,
      roughness: 0.9,
      metalness: 0.08
    });
    const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), stoneFloorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.5;
    floorMesh.receiveShadow = true;
    cathedralGroup.add(floorMesh);

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x4b3f36,
      roughnessMap: stoneMaps.roughnessMap,
      bumpMap: stoneMaps.bumpMap,
      bumpScale: 0.04,
      roughness: 0.85,
      metalness: 0.06
    });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(28, 12, 0.8), wallMat);
    backWall.position.set(0, 5.5, -9.5);
    backWall.receiveShadow = true;
    cathedralGroup.add(backWall);

    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.8, 12, 28), wallMat);
    sideWall.position.set(-9.5, 5.5, 0);
    sideWall.receiveShadow = true;
    cathedralGroup.add(sideWall);

    // Braziers with Instanced Rising Embers
    const emberCount = isSoftwareGl ? 18 : 48;
    const brazierLeft = createBrazierWithEmbers(scene, -4.6, 1.45, -5.2, emberCount);
    const brazierRight = createBrazierWithEmbers(scene, 4.6, 1.45, -5.2, emberCount);

    // Glowing Rune Chessboard Frame
    const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);
    const runeFrameTex = createRuneFrameTexture(maxAniso);
    const frameMat = new THREE.MeshPhysicalMaterial({
      map: runeFrameTex,
      emissiveMap: runeFrameTex,
      emissive: new THREE.Color(0xf59e0b),
      emissiveIntensity: 0.72,
      roughness: 0.24,
      metalness: 0.35,
      clearcoat: 0.8
    });
    const boardFrame = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.34, 9.6), frameMat);
    boardFrame.position.y = 0;
    boardFrame.receiveShadow = true;
    boardFrame.castShadow = true;
    scene.add(boardFrame);

    // 64 Individual Clickable Chess Squares
    const lightSqMat = new THREE.MeshStandardMaterial({ color: 0xe7dfd5, roughness: 0.34, metalness: 0.1 });
    const darkSqMat = new THREE.MeshStandardMaterial({ color: 0x181b24, roughness: 0.28, metalness: 0.25 });

    const lavaSqMat = new THREE.MeshStandardMaterial({
      color: 0xea580c,
      emissive: 0xea580c,
      emissiveIntensity: 1.15,
      roughness: 0.3
    });
    const frostSqMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.05,
      roughness: 0.25
    });

    const clickableTargets: THREE.Object3D[] = [];
    const squaresGroup = new THREE.Group();
    scene.add(squaresGroup);

    const squareGeo = new THREE.BoxGeometry(0.98, 0.06, 0.98);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const isLight = (r + c) % 2 === 0;
        let mat = isLight ? lightSqMat : darkSqMat;
        if ((r === 3 && c === 3) || (r === 4 && c === 4)) mat = lavaSqMat;
        if ((r === 3 && c === 4) || (r === 4 && c === 3)) mat = frostSqMat;

        const sqMesh = new THREE.Mesh(squareGeo, mat);
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

    const fragGeos = [
      new THREE.DodecahedronGeometry(0.08, 0),
      new THREE.DodecahedronGeometry(0.11, 0),
      new THREE.DodecahedronGeometry(0.06, 0)
    ];

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
      pieceMeshesRef.current.forEach((built) => {
        piecesRoot.remove(built.group);
        disposePieceGroupTree(built.group);
      });
      pieceMeshesRef.current.clear();

      const grid = boardRef.current;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = grid[r][c];
          if (!piece) continue;
          const built = buildWizardChessPieceGroup(piece.type, piece.color, piece.isShielded);
          const worldPos = boardCoordToWorld(r, c);
          built.group.position.copy(worldPos);
          built.group.userData = { pieceId: piece.id, squareRow: r, squareCol: c };
          built.group.traverse((child) => {
            child.userData = { pieceId: piece.id, squareRow: r, squareCol: c };
          });
          piecesRoot.add(built.group);
          pieceMeshesRef.current.set(piece.id, built);
        }
      }
    };
    rebuildScenePiecesRef.current = rebuildScenePieces;
    rebuildScenePieces();

    const showHighlightsForMoves = (fromRow: number, fromCol: number, moves: ChessMove[]) => {
      clearHighlights();

      const originPos = boardCoordToWorld(fromRow, fromCol);
      const originMat = new THREE.MeshBasicMaterial({
        color: 0xfde047,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
      });
      const originRing = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.44, 24), originMat);
      originRing.rotation.x = -Math.PI / 2;
      originRing.position.set(originPos.x, 0.2, originPos.z);
      highlightsRoot.add(originRing);
      highlightMeshesRef.current.push(originRing);

      for (const m of moves) {
        const p = boardCoordToWorld(m.toRow, m.toCol);
        const isCapture = Boolean(m.captured);
        const mat = new THREE.MeshStandardMaterial({
          color: isCapture ? 0xf87171 : 0x34d399,
          emissive: isCapture ? 0xef4444 : 0x10b981,
          emissiveIntensity: 1.35,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.92,
          roughness: 0.2,
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
        highlightMeshesRef.current.push(indicator);
      }
    };

    const spawnStoneShatter = (pos: THREE.Vector3, victimColor: PieceColor) => {
      const fragMat = new THREE.MeshStandardMaterial({
        color: victimColor === 'w' ? 0xe7dfd3 : 0x1e222d,
        roughness: 0.65,
        metalness: 0.15
      });

      const mult = performanceService.getFastSettings().particlesMultiplier ?? 1.0;
      const fragCount = Math.max(5, Math.round(18 * mult));

      for (let i = 0; i < fragCount; i++) {
        const fragGeo = fragGeos[i % fragGeos.length];
        const fragMesh = new THREE.Mesh(fragGeo, fragMat);
        fragMesh.position.set(
          pos.x + (Math.random() - 0.5) * 0.25,
          pos.y + 0.15 + Math.random() * 0.45,
          pos.z + (Math.random() - 0.5) * 0.25
        );
        fragMesh.castShadow = !isSoftwareGl && performanceService.getFastSettings().enableShadows;
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
          maxLife: 1.4 + Math.random() * 0.5
        });
      }

      stage.particles.burst(
        pos.x,
        pos.y + 0.35,
        pos.z,
        isSoftwareGl ? 10 : 24,
        victimColor === 'w' ? 0x38bdf8 : 0xf97316,
        5.5,
        1.1,
        9.8
      );
      stage.cameraRig.addTrauma(0.55);
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

      const attackerBuilt = pieceMeshesRef.current.get(movingPiece.id);
      const victimPiece = move.captured;
      const victimBuilt = victimPiece ? pieceMeshesRef.current.get(victimPiece.id) : undefined;
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
            audioController.playGameOver();
            screenShake.trigger('heavy');
            stage.cameraRig.addTrauma(0.8);
            triggerGameOver(scoreValRef.current);
          } else {
            setStatusMessage('REMIS (Stalemate)');
            setMatchEnded({ winner: 'Seri / Stalemate', reason: 'Pertandingan berakhir imbang' });
            audioController.playWin();
            triggerGameOver(scoreValRef.current);
          }
          return;
        }

        if (checkNow) {
          audioController.playHit();
          screenShake.trigger('medium');
          stage.cameraRig.addTrauma(0.35);
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

      if (victimPiece && attackerBuilt && victimBuilt) {
        captureSequenceRef.current = {
          active: true,
          attackerMesh: attackerBuilt.group,
          victimMesh: victimBuilt.group,
          startPos: attackerBuilt.group.position.clone(),
          targetPos: destWorld.clone(),
          progress: 0,
          shattered: false,
          onComplete: finalizeTurnTransition
        };
      } else {
        audioController.playClick();
        finalizeTurnTransition();
      }
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoverCheck = 0;

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 45) return;
      lastHoverCheck = now;

      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(piecesRoot.children, true);
      if (hits.length > 0 && typeof hits[0].object.userData?.squareRow === 'number') {
        hoveredSquareRef.current = {
          row: hits[0].object.userData.squareRow,
          col: hits[0].object.userData.squareCol
        };
      } else {
        hoveredSquareRef.current = null;
      }
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
        audioController.playClick();
      } else {
        selectedSquareRef.current = null;
        legalMovesForSelectedRef.current = [];
        clearHighlights();
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    stage.startLoop((dt, elapsed) => {
      const isPlaying = (gameStateRef.current as string)?.toLowerCase() === 'playing';

      // Flicker cathedral braziers and animate rising instanced embers
      const flicker = 4.6 + Math.sin(elapsed * 11.2) * 0.55 + Math.cos(elapsed * 17.7) * 0.35;
      brazierLight.intensity = flicker;
      brazierLightR.intensity = 3.9 + Math.cos(elapsed * 10.5) * 0.45;
      brazierLeft.update(dt, elapsed);
      brazierRight.update(dt, elapsed);

      if (isPlaying) {
        const pulse = 0.5 + 0.5 * Math.sin(elapsed * 5.2);
        pieceMeshesRef.current.forEach((built) => {
          const grp = built.group;
          const r = grp.userData.squareRow;
          const c = grp.userData.squareCol;
          const isSel =
            selectedSquareRef.current &&
            selectedSquareRef.current.row === r &&
            selectedSquareRef.current.col === c;
          const isHovered =
            hoveredSquareRef.current &&
            hoveredSquareRef.current.row === r &&
            hoveredSquareRef.current.col === c;

          if (!captureSequenceRef.current?.active || grp !== captureSequenceRef.current.attackerMesh) {
            grp.position.y = THREE.MathUtils.damp(grp.position.y, isSel ? 0.42 : isHovered ? 0.25 : 0.18, 10, dt);
          }

          const targetRim = isSel ? 1.5 + pulse * 0.65 : isHovered ? 0.9 + pulse * 0.35 : 0.35;
          const targetAccent = isSel ? built.baseAccentEmissive + 0.75 + pulse * 0.45 : isHovered ? built.baseAccentEmissive + 0.4 : built.baseAccentEmissive;
          built.rimMat.emissiveIntensity = THREE.MathUtils.damp(built.rimMat.emissiveIntensity, targetRim, 12, dt);
          built.accentMat.emissiveIntensity = THREE.MathUtils.damp(built.accentMat.emissiveIntensity, targetAccent, 12, dt);
        });

        for (let i = 0; i < highlightMeshesRef.current.length; i++) {
          const hMesh = highlightMeshesRef.current[i];
          const s = 1 + Math.sin(elapsed * 4.5 + i * 0.4) * 0.06;
          hMesh.scale.set(s, s, 1);
        }

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
            audioController.playExplosion();
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
      }

      if (activeCameraTransitionRef.current) {
        const preset = cameraPresetRef.current;
        if (preset === 'chase') _camTargetPos.set(0, 7.2, 8.6);
        else if (preset === 'diorama') _camTargetPos.set(0, 11.8, 0.01);
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
      stage.cameraRig.applyAdditiveShake(camera, dt, 0.34);
    });

    return () => {
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
      controls.removeEventListener('start', onControlsStart);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      brazierLeft.dispose();
      brazierRight.dispose();
      stoneMaps.dispose();
      runeFrameTex.dispose();
      fragGeos.forEach((g) => g.dispose());
      stage.dispose();
      stageRef.current = null;
    };
  }, [gameStateRef, triggerGameOver, updateScore]);

  return (
    <div className="relative w-full h-full min-h-[340px] sm:min-h-[440px] lg:min-h-[500px] bg-[#161210] overflow-hidden select-none">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing touch-none" />

      {/* Top Wrapping Status & Score HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-2 p-3">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 sm:gap-3 px-3 py-2 rounded-xl bg-zinc-950/90 border border-amber-500/25 text-zinc-100 max-w-full">
          <div className="flex items-center gap-2 shrink-0">
            <Crown className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs font-bold tracking-tight text-amber-300 whitespace-nowrap">
              Wizard Chess 3D
            </span>
          </div>
          <span className="text-zinc-600" aria-hidden="true">·</span>
          <span className="text-xs font-semibold text-amber-200 whitespace-nowrap">
            {turn === 'w' ? 'Putih' : 'Hitam'}
          </span>
          <span className="text-zinc-600 hidden sm:inline" aria-hidden="true">·</span>
          <span className="text-xs font-medium text-zinc-200 truncate max-w-[200px] sm:max-w-none">
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

        <div className="pointer-events-auto flex items-center gap-3 px-3 py-2 rounded-xl bg-zinc-950/90 border border-white/10 text-xs text-zinc-200 tabular-nums shrink-0">
          {comboMultiplier > 1 && (
            <div className="px-2 py-0.5 rounded bg-gradient-to-r from-amber-500 to-rose-500 text-zinc-950 font-black text-[10px] font-mono tracking-wider shadow-xs">
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
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Play className="w-4 h-4 fill-current" />
              Mainkan Pertandingan Baru
            </button>
          </div>
        </div>
      )}

      <ThreeDockOverlay
        cameraPreset={cameraPreset}
        onSelectPreset={setCameraPreset}
        quality={quality}
        onCycleQuality={cycleQuality}
        presetLabels={{ chase: 'Putih', isometric: 'Orbit', diorama: 'Atas' }}
        extraControls={
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => {
                haptics.trigger('light');
                handleCastSpell('timeFreeze');
              }}
              disabled={spellEnergy < 35}
              className="min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-bold text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/80 disabled:opacity-40 flex items-center gap-1 transition-colors"
            >
              <Snowflake className="w-3.5 h-3.5" />
              Freeze (35)
            </button>
            <button
              onClick={() => {
                haptics.trigger('light');
                handleCastSpell('shieldAegis');
              }}
              disabled={spellEnergy < 40}
              className="min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 disabled:opacity-40 flex items-center gap-1 transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              Aegis (40)
            </button>
            <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-white/5">
              {(
                [
                  { id: 'ai-easy', label: 'Mudah' },
                  { id: 'ai-medium', label: 'Sedang' },
                  { id: 'ai-hard', label: 'Sulit' },
                  { id: 'local-2p', label: '2P' }
                ] as { id: GameMode; label: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  onClick={() => resetMatch(m.id)}
                  className={`min-h-[32px] px-2 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    gameMode === m.id
                      ? 'bg-amber-500 text-zinc-950'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                haptics.trigger('light');
                handleUndoMove();
              }}
              disabled={historyRef.current.length === 0}
              className="min-h-[36px] px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-xs font-medium text-zinc-200 border border-white/10 flex items-center gap-1 whitespace-nowrap transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Undo
            </button>
            <button
              onClick={() => {
                haptics.trigger('light');
                resetMatch();
              }}
              className="min-h-[36px] px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1 whitespace-nowrap transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
        }
      />
    </div>
  );
}

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import * as THREE from 'three';
import { useGameEngine } from '../../hooks/useGameEngine';
import { disposeThreeScene, disposeMaterial } from '../../utils/threeCleanup';
import { CANONICAL_GAME_IDS } from '../../config/canonicalGames';
import { GAME_REGISTRY } from '../../config/gameRegistry';
import { GAME_BALANCE_CONFIG } from '../../config/balanceConfig';

describe('Game Engine Hardening & 3D Cleanup (Fase 2)', () => {
  describe('useGameEngine lifecycle & canvas transform', () => {
    let mockCanvas: HTMLCanvasElement;
    let mockCtx: any;

    beforeEach(() => {
      mockCtx = {
        setTransform: vi.fn(),
        scale: vi.fn(),
        clearRect: vi.fn(),
        fillRect: vi.fn()
      };

      mockCanvas = {
        width: 0,
        height: 0,
        clientWidth: 800,
        clientHeight: 600,
        getContext: vi.fn(() => mockCtx),
        getBoundingClientRect: vi.fn(() => ({
          left: 0,
          top: 0,
          right: 800,
          bottom: 600,
          width: 800,
          height: 600,
          x: 0,
          y: 0,
          toJSON: () => {}
        }))
      } as unknown as HTMLCanvasElement;
    });

    it('setupCanvasContext applies deterministic ctx.setTransform without accumulating scale', () => {
      const { result } = renderHook(() => useGameEngine({ gameId: 'snake', maxDpr: 2 }));

      // First setup
      const ctx1 = result.current.setupCanvasContext(mockCanvas, 800, 600);
      expect(ctx1).toBe(mockCtx);
      expect(mockCtx.setTransform).toHaveBeenCalled();
      const firstCallArgs = mockCtx.setTransform.mock.calls[0];

      // Second setup (e.g. restart or re-render)
      mockCtx.setTransform.mockClear();
      const ctx2 = result.current.setupCanvasContext(mockCanvas, 800, 600);
      expect(ctx2).toBe(mockCtx);
      expect(mockCtx.setTransform).toHaveBeenCalledWith(...firstCallArgs);
    });

    it('startWithCountdown and alias startsWithCountdown resets score and cancels pending animation loop', () => {
      const onScoreUpdate = vi.fn();
      const { result } = renderHook(() => useGameEngine({ gameId: 'snake', onScoreUpdate }));

      act(() => {
        result.current.addScore(500);
      });
      expect(result.current.score).toBe(500);

      // Simulate an active gameLoopRef
      result.current.gameLoopRef.current = 12345;

      act(() => {
        result.current.startWithCountdown();
      });

      expect(result.current.score).toBe(0);
      expect(result.current.countdown).toBe(3);
      expect(result.current.gameLoopRef.current).toBeNull();
      expect(result.current.startsWithCountdown).toBe(result.current.startWithCountdown);
    });

    it('triggerRestart clears gameLoopRef and resets score to 0', () => {
      const { result } = renderHook(() => useGameEngine({ gameId: 'snake' }));

      act(() => {
        result.current.addScore(250);
      });
      expect(result.current.score).toBe(250);

      result.current.gameLoopRef.current = 999;
      act(() => {
        result.current.triggerRestart();
      });

      expect(result.current.score).toBe(0);
      expect(result.current.gameLoopRef.current).toBeNull();
      expect(result.current.gameState).toBe('ready');
    });

    it('auto-pauses when tab visibility changes to hidden while playing', () => {
      const { result } = renderHook(() => useGameEngine({ gameId: 'snake' }));

      act(() => {
        result.current.setGameState('playing');
      });
      expect(result.current.gameState).toBe('playing');

      // Simulate visibility change to hidden
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(result.current.gameState).toBe('paused');

      // Restore document.hidden
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    });
  });

  describe('Three.js Deep Cleanup (disposeThreeScene & disposeMaterial)', () => {
    it('disposes all geometries, materials, textures, and clears scene children', () => {
      const scene = new THREE.Scene();

      // Create geometries and materials
      const geo1 = new THREE.BoxGeometry(1, 1, 1);
      const geo1DisposeSpy = vi.spyOn(geo1, 'dispose');

      const tex1 = new THREE.Texture();
      const tex1DisposeSpy = vi.spyOn(tex1, 'dispose');

      const mat1 = new THREE.MeshBasicMaterial({ map: tex1 });
      const mat1DisposeSpy = vi.spyOn(mat1, 'dispose');

      const mesh1 = new THREE.Mesh(geo1, mat1);
      scene.add(mesh1);

      // Create group with child mesh with array of materials
      const group = new THREE.Group();
      const geo2 = new THREE.SphereGeometry(1);
      const geo2DisposeSpy = vi.spyOn(geo2, 'dispose');

      const mat2A = new THREE.MeshStandardMaterial();
      const mat2ADisposeSpy = vi.spyOn(mat2A, 'dispose');
      const mat2B = new THREE.MeshStandardMaterial();
      const mat2BDisposeSpy = vi.spyOn(mat2B, 'dispose');

      const mesh2 = new THREE.Mesh(geo2, [mat2A, mat2B]);
      group.add(mesh2);
      scene.add(group);

      expect(scene.children.length).toBe(2);

      // Mock renderer
      const mockDomElement = document.createElement('canvas');
      document.body.appendChild(mockDomElement);
      const mockRenderer = {
        dispose: vi.fn(),
        forceContextLoss: vi.fn(),
        domElement: mockDomElement
      } as unknown as THREE.WebGLRenderer;

      // Execute deep disposal
      disposeThreeScene(scene, mockRenderer);

      // Assertions
      expect(geo1DisposeSpy).toHaveBeenCalled();
      expect(tex1DisposeSpy).toHaveBeenCalled();
      expect(mat1DisposeSpy).toHaveBeenCalled();

      expect(geo2DisposeSpy).toHaveBeenCalled();
      expect(mat2ADisposeSpy).toHaveBeenCalled();
      expect(mat2BDisposeSpy).toHaveBeenCalled();

      expect(scene.children.length).toBe(0);
      expect(mockRenderer.dispose).toHaveBeenCalled();
      expect(mockRenderer.forceContextLoss).toHaveBeenCalled();
      expect(mockDomElement.parentNode).toBeNull();
    });

    it('safely handles null, undefined, or empty scenes without throwing', () => {
      expect(() => disposeThreeScene(null)).not.toThrow();
      expect(() => disposeThreeScene(undefined)).not.toThrow();
      expect(() => disposeMaterial(null)).not.toThrow();
      expect(() => disposeMaterial(undefined)).not.toThrow();
    });
  });

  describe('39 Canonical Games Catalog Consistency', () => {
    it('has exactly 39 canonical games in CANONICAL_GAME_IDS', () => {
      expect(CANONICAL_GAME_IDS.length).toBe(39);
      expect(CANONICAL_GAME_IDS).toContain('wizard-chess');
      expect(CANONICAL_GAME_IDS).toContain('desk-racer');
    });

    it('every canonical game ID is registered in GAME_REGISTRY', () => {
      CANONICAL_GAME_IDS.forEach((gameId) => {
        expect(GAME_REGISTRY[gameId]).toBeDefined();
        expect(GAME_REGISTRY[gameId].id).toBe(gameId);
        expect(typeof GAME_REGISTRY[gameId].title).toBe('string');
      });
    });

    it('every canonical game ID has a balance configuration in GAME_BALANCE_CONFIG', () => {
      CANONICAL_GAME_IDS.forEach((gameId) => {
        expect(GAME_BALANCE_CONFIG[gameId]).toBeDefined();
        expect(GAME_BALANCE_CONFIG[gameId].maxScoreCeiling).toBeGreaterThan(0);
        expect(GAME_BALANCE_CONFIG[gameId].maxScorePerSec).toBeGreaterThan(0);
      });
    });
  });
});

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audio } from '../../utils/audio';
import { useGameEngine } from '../../hooks/useGameEngine';
import { useUnifiedInput } from '../../hooks/useUnifiedInput';
import { GameOverlay } from '../gameplay/GameOverlay';
import { Shield, Radio, Key, Zap, Flame, Eye, Lock, Unlock, AlertTriangle } from 'lucide-react';
import { LevelData, Distraction, Terminal } from './neon-heist/types';
import { generateLevels } from './neon-heist/levels';

interface NeonHeistGameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;



export default function NeonHeistGame({ onGameOver, onScoreUpdate, highScore }: NeonHeistGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const {
    gameState, setGameState, gameStateRef, countdown, score, updateScore, triggerGameOver,
    startWithCountdown, startLoop, stopLoop, setupCanvasContext, perfSettings
  } = useGameEngine({
    onScoreUpdate, onGameOver
  });
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [alarmLevel, setAlarmLevel] = useState<0 | 1 | 2>(0); // 0: normal, 1: suspicious, 2: alert
  const [intelCollected, setIntelCollected] = useState(0);
  const [intelRequired, setIntelRequired] = useState(2);
  const [distractionCharges, setDistractionCharges] = useState(3);
  const [stealthRank, setStealthRank] = useState<'Ghost' | 'Shadow' | 'Phantom' | 'Detected'>('Ghost');

  const alarmLevelRef = useRef<0 | 1 | 2>(0);
  const levelsRef = useRef<LevelData[]>(generateLevels());
  const currentLevelRef = useRef<LevelData>(levelsRef.current[0]);

  // Player state
  const playerRef = useRef({
    x: 60,
    y: 440,
    radius: 12,
    speed: 2.6,
    sprintSpeed: 4.2,
    angle: 0,
    isSprinting: false,
    isHidden: false,
    hackingTerminal: null as Terminal | null,
    hackTimer: 0,
    health: 100,
    maxHealth: 100,
  });

  const distractionsRef = useRef<Distraction[]>([]);
  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number; color: string; alpha: number; size: number }[]>([]);
  const detectionCounterRef = useRef(0);
  const levelStartTimeRef = useRef(Date.now());
  const alertCooldownRef = useRef(0);

  // Active keys
  const keysRef = useRef<{ [key: string]: boolean }>({});



  const initLevel = useCallback((lvlIndex: number) => {
    const lvl = JSON.parse(JSON.stringify(levelsRef.current[lvlIndex % levelsRef.current.length])) as LevelData;
    currentLevelRef.current = lvl;
    setCurrentLevelIndex(lvlIndex);

    playerRef.current.x = lvl.playerStart.x;
    playerRef.current.y = lvl.playerStart.y;
    playerRef.current.health = 100;
    playerRef.current.isHidden = false;
    playerRef.current.hackingTerminal = null;

    setIntelCollected(0);
    setIntelRequired(lvl.requiredIntel);
    setAlarmLevel(0);
    alarmLevelRef.current = 0;
    distractionsRef.current = [];
    particlesRef.current = [];
    detectionCounterRef.current = 0;
    levelStartTimeRef.current = Date.now();
  }, []);

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

  const throwDistraction = useCallback((targetX: number, targetY: number) => {
    if (distractionCharges <= 0 || gameStateRef.current !== 'playing') return;

    setDistractionCharges((c) => Math.max(0, c - 1));
    audio.playLaser();

    distractionsRef.current.push({
      x: targetX,
      y: targetY,
      radius: 0,
      maxRadius: 180,
      alpha: 1,
      lifetime: 120,
    });

    // Alert guards in range to investigate
    currentLevelRef.current.guards.forEach((guard) => {
      const dist = Math.hypot(guard.x - targetX, guard.y - targetY);
      if (dist < 220) {
        guard.state = 'suspicious';
        guard.investigatePos = { x: targetX, y: targetY };
        guard.searchTimer = 180;
      }
    });
  }, [distractionCharges]);

  const startGame = useCallback(() => {
    levelsRef.current = generateLevels();
    initLevel(0);
    updateScore(0);
    setDistractionCharges(3);
    setStealthRank('Ghost');
    startWithCountdown();
  }, [initLevel]);

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
        if (action === 'SECONDARY') {
          const angle = playerRef.current.angle;
          const targetX = playerRef.current.x + Math.cos(angle) * 120;
          const targetY = playerRef.current.y + Math.sin(angle) * 120;
          throwDistraction(targetX, targetY);
        }
      } else if (gameStateRef.current === 'paused') {
        if (action === 'PAUSE' || action === 'PRIMARY') setGameState('playing');
      }
    },
    onRawKey: (key, isDown) => {
      keysRef.current[key.toLowerCase()] = isDown;
      keysRef.current[key] = isDown;
    }
  });

  // Handle canvas click for distraction
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;
    throwDistraction(clickX, clickY);
  };

  // Main game loop
  useEffect(() => {
    if (gameState === 'playing') {
      startLoop((timestamp, dtMs) => {
        const dt = Math.min(dtMs / 1000, 0.1);
        const ctx = setupCanvasContext(canvasRef.current, CANVAS_WIDTH, CANVAS_HEIGHT);
        if (!ctx) return;

      const lvl = currentLevelRef.current;
      const player = playerRef.current;

      // UPDATE PHASE
      if (gameStateRef.current === 'playing') {
        // Player Movement
        let dx = 0;
        let dy = 0;
        const keys = keysRef.current;
        if (keys['w'] || keys['arrowup']) dy -= 1;
        if (keys['s'] || keys['arrowdown']) dy += 1;
        if (keys['a'] || keys['arrowleft']) dx -= 1;
        if (keys['d'] || keys['arrowright']) dx += 1;

        const isShift = keys['shift'] || keys['shiftleft'] || keys['shiftright'];
        player.isSprinting = isShift && (dx !== 0 || dy !== 0);
        const currentSpeed = player.isSprinting ? player.sprintSpeed : player.speed;

        if (dx !== 0 && dy !== 0) {
          dx *= 0.7071;
          dy *= 0.7071;
        }

        if (dx !== 0 || dy !== 0) {
          player.angle = Math.atan2(dy, dx);
        }

        const dtScale = dt * 60; // Assuming 60fps baseline for old speed values

        let newX = player.x + dx * currentSpeed * dtScale;
        let newY = player.y + dy * currentSpeed * dtScale;

        // Collision with canvas bounds
        newX = Math.max(player.radius, Math.min(CANVAS_WIDTH - player.radius, newX));
        newY = Math.max(player.radius, Math.min(CANVAS_HEIGHT - player.radius, newY));

        // Collision with walls and servers
        let collided = false;
        let isInsideVent = false;

        lvl.obstacles.forEach((obs) => {
          if (obs.type === 'vent') {
            if (
              newX >= obs.x &&
              newX <= obs.x + obs.w &&
              newY >= obs.y &&
              newY <= obs.y + obs.h
            ) {
              isInsideVent = true;
            }
          } else {
            // Wall / Server box collision
            const nearestX = Math.max(obs.x, Math.min(newX, obs.x + obs.w));
            const nearestY = Math.max(obs.y, Math.min(newY, obs.y + obs.h));
            const distX = newX - nearestX;
            const distY = newY - nearestY;
            const distSq = distX * distX + distY * distY;

            if (distSq < player.radius * player.radius) {
              collided = true;
            }
          }
        });

        if (!collided) {
          player.x = newX;
          player.y = newY;
        }

        player.isHidden = isInsideVent && alarmLevelRef.current < 2;

        // Sound emission from sprinting
        if (player.isSprinting && !player.isHidden) {
          lvl.guards.forEach((guard) => {
            const dist = Math.hypot(guard.x - player.x, guard.y - player.y);
            if (dist < 120 && guard.state === 'patrol') {
              guard.state = 'suspicious';
              guard.investigatePos = { x: player.x, y: player.y };
              guard.searchTimer = 120;
            }
          });
        }

        // Camera Update
        lvl.cameras.forEach((cam) => {
          if (cam.disabled) {
            cam.disableTimer -= dt * 1000;
            if (cam.disableTimer <= 0) cam.disabled = false;
            return;
          }

          cam.angle += cam.rotSpeed;
          if (cam.angle > cam.maxAngle || cam.angle < cam.minAngle) {
            cam.rotSpeed *= -1;
          }

          // Check if player in camera cone
          if (!player.isHidden) {
            const dist = Math.hypot(player.x - cam.x, player.y - cam.y);
            if (dist < cam.range) {
              const angleToPlayer = Math.atan2(player.y - cam.y, player.x - cam.x);
              let diff = angleToPlayer - cam.angle;
              while (diff < -Math.PI) diff += Math.PI * 2;
              while (diff > Math.PI) diff -= Math.PI * 2;

              if (Math.abs(diff) < cam.fov / 2) {
                // Line of sight check
                let blocked = false;
                lvl.obstacles.forEach((obs) => {
                  if (obs.type === 'wall' || obs.type === 'server') {
                    // Approximate ray check
                    const midX = (cam.x + player.x) / 2;
                    const midY = (cam.y + player.y) / 2;
                    if (midX >= obs.x && midX <= obs.x + obs.w && midY >= obs.y && midY <= obs.y + obs.h) {
                      blocked = true;
                    }
                  }
                });

                if (!blocked) {
                  alarmLevelRef.current = 2;
                  setAlarmLevel(2);
                  detectionCounterRef.current += 1;
                  setStealthRank('Detected');
                  audio.playHit();
                }
              }
            }
          }
        });

        // Laser Update
        lvl.lasers.forEach((laser) => {
          if (!laser.switchControlled) {
            laser.cycleTimer = (laser.cycleTimer + dt * 1000) % laser.cycleTime;
            laser.active = laser.cycleTimer < laser.activeDuration;
          }

          if (laser.active && !player.isHidden) {
            // Distance from player to line segment
            const x1 = laser.x1, y1 = laser.y1, x2 = laser.x2, y2 = laser.y2;
            const A = player.x - x1;
            const B = player.y - y1;
            const C = x2 - x1;
            const D = y2 - y1;
            const dot = A * C + B * D;
            const lenSq = C * C + D * D;
            let param = -1;
            if (lenSq !== 0) param = dot / lenSq;

            let xx, yy;
            if (param < 0) {
              xx = x1;
              yy = y1;
            } else if (param > 1) {
              xx = x2;
              yy = y2;
            } else {
              xx = x1 + param * C;
              yy = y1 + param * D;
            }

            const dist = Math.hypot(player.x - xx, player.y - yy);
            if (dist < player.radius + 3) {
              player.health -= 35 * dt;
              audio.playLaser();
              spawnParticles(player.x, player.y, '#ef4444', 3);
              alarmLevelRef.current = 2;
              setAlarmLevel(2);
              if (player.health <= 0) {
                audio.playGameOver();
                triggerGameOver();
              }
            }
          }
        });

        // Guard AI & Vision
        let anyGuardAlerted = false;

        lvl.guards.forEach((guard) => {
          // Patrol / Pathfinding
          if (guard.state === 'patrol') {
            const wp = guard.waypoints[guard.currentWaypoint];
            const dist = Math.hypot(wp.x - guard.x, wp.y - guard.y);
            if (dist < 5) {
              guard.currentWaypoint = (guard.currentWaypoint + 1) % guard.waypoints.length;
            } else {
              guard.targetAngle = Math.atan2(wp.y - guard.y, wp.x - guard.x);
              guard.x += Math.cos(guard.targetAngle) * guard.speed * dtScale;
              guard.y += Math.sin(guard.targetAngle) * guard.speed * dtScale;
            }
          } else if (guard.state === 'suspicious' && guard.investigatePos) {
            const dist = Math.hypot(guard.investigatePos.x - guard.x, guard.investigatePos.y - guard.y);
            if (dist < 10) {
              guard.searchTimer--;
              guard.angle += 0.05 * dtScale;
              if (guard.searchTimer <= 0) {
                guard.state = 'patrol';
              }
            } else {
              guard.targetAngle = Math.atan2(guard.investigatePos.y - guard.y, guard.investigatePos.x - guard.x);
              guard.x += Math.cos(guard.targetAngle) * (guard.speed * 1.2) * dtScale;
              guard.y += Math.sin(guard.targetAngle) * (guard.speed * 1.2) * dtScale;
            }
          } else if (guard.state === 'chase') {
            guard.targetAngle = Math.atan2(player.y - guard.y, player.x - guard.x);
            guard.x += Math.cos(guard.targetAngle) * (guard.speed * 1.8) * dtScale;
            guard.y += Math.sin(guard.targetAngle) * (guard.speed * 1.8) * dtScale;

            // Damage player if reached
            const distToPlayer = Math.hypot(player.x - guard.x, player.y - guard.y);
            if (distToPlayer < player.radius + 15) {
              player.health -= 60 * dt;
              audio.playHit();
              spawnParticles(player.x, player.y, '#f43f5e', 4);
              if (player.health <= 0) {
                audio.playGameOver();
                triggerGameOver();
              }
            }
          }

          // Smooth rotation
          let angleDiff = guard.targetAngle - guard.angle;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          guard.angle += angleDiff * 0.1 * dtScale;

          // Vision check
          if (!player.isHidden) {
            const dist = Math.hypot(player.x - guard.x, player.y - guard.y);
            if (dist < guard.visionRange) {
              const angleToPlayer = Math.atan2(player.y - guard.y, player.x - guard.x);
              let diff = angleToPlayer - guard.angle;
              while (diff < -Math.PI) diff += Math.PI * 2;
              while (diff > Math.PI) diff -= Math.PI * 2;

              if (Math.abs(diff) < guard.visionAngle / 2) {
                // Check if blocked by walls
                let blocked = false;
                lvl.obstacles.forEach((obs) => {
                  if (obs.type === 'wall' || obs.type === 'server') {
                    const midX = (guard.x + player.x) / 2;
                    const midY = (guard.y + player.y) / 2;
                    if (midX >= obs.x && midX <= obs.x + obs.w && midY >= obs.y && midY <= obs.y + obs.h) {
                      blocked = true;
                    }
                  }
                });

                if (!blocked) {
                  guard.state = 'chase';
                  anyGuardAlerted = true;
                  alarmLevelRef.current = 2;
                  setAlarmLevel(2);
                  detectionCounterRef.current += 1;
                  setStealthRank('Detected');
                  audio.playHit();
                }
              }
            }
          }

          if (guard.state === 'chase') anyGuardAlerted = true;
        });

        // Alarm cooldown
        if (alarmLevelRef.current === 2 && !anyGuardAlerted && player.isHidden) {
          alertCooldownRef.current += dt;
          if (alertCooldownRef.current > 4) {
            alarmLevelRef.current = 1;
            setAlarmLevel(1);
            alertCooldownRef.current = 0;
            lvl.guards.forEach((g) => {
              if (g.state === 'chase') g.state = 'patrol';
            });
          }
        }

        // Terminal Hacking
        let isNearTerminal = false;
        lvl.terminals.forEach((term) => {
          if (term.hacked) return;
          const dist = Math.hypot(player.x - term.x, player.y - term.y);
          if (dist < 35) {
            isNearTerminal = true;
            term.progress += dt * 50;
            if (term.progress >= 100) {
              term.hacked = true;
              audio.playPowerup();
              spawnParticles(term.x, term.y, '#06b6d4', 20);

              if (term.type === 'intel') {
                setIntelCollected((prev) => {
                  const next = prev + 1;
                  const pts = 250;
                  updateScore(score + pts);
                  return next;
                });
              } else if (term.type === 'laser_switch') {
                lvl.lasers.forEach((l) => (l.active = false));
                updateScore(score + 150);
              } else if (term.type === 'camera_jam') {
                lvl.cameras.forEach((c) => {
                  c.disabled = true;
                  c.disableTimer = 12000;
                });
                updateScore(score + 150);
              }
            }
          } else {
            term.progress = Math.max(0, term.progress - dt * 25);
          }
        });

        // Exit Extraction Check
        const exit = lvl.exit;
        const reachedExit =
          player.x >= exit.x &&
          player.x <= exit.x + exit.w &&
          player.y >= exit.y &&
          player.y <= exit.y + exit.h;

        if (reachedExit && intelCollected >= lvl.requiredIntel) {
          // Level Cleared
          audio.playCoin();
          const timeBonus = Math.max(50, Math.floor(600 - (Date.now() - levelStartTimeRef.current) / 1000) * 5);
          const stealthBonus = detectionCounterRef.current === 0 ? 500 : 200;
          const levelTotal = 500 + timeBonus + stealthBonus;

          updateScore(score + levelTotal);

          if (currentLevelIndex + 1 < levelsRef.current.length) {
            initLevel(currentLevelIndex + 1);
          } else {
            // Victory / Game Complete!
            audio.playLevelUp();
            triggerGameOver();
          }
        }

        // Distractions pulse
        distractionsRef.current = distractionsRef.current.filter((d) => {
          d.radius += 2.5;
          d.alpha = Math.max(0, 1 - d.radius / d.maxRadius);
          d.lifetime--;
          return d.lifetime > 0;
        });

        // Particles
        particlesRef.current = particlesRef.current.filter((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= 0.02;
          return p.alpha > 0;
        });
      }

      // RENDER PHASE
      ctx.fillStyle = '#090b10';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Floor Grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let x = 0; x < CANVAS_WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y < CANVAS_HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }

      // Obstacles
      lvl.obstacles.forEach((obs) => {
        if (obs.type === 'wall') {
          ctx.fillStyle = '#1e293b';
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 2;
          ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
          ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        } else if (obs.type === 'server') {
          ctx.fillStyle = '#0f172a';
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 1.5;
          ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
          ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);

          // Blinking rack lights
          ctx.fillStyle = (Date.now() % 500 < 250) ? '#10b981' : '#06b6d4';
          ctx.fillRect(obs.x + 4, obs.y + 6, 6, 4);
          ctx.fillRect(obs.x + 4, obs.y + 16, 6, 4);
        } else if (obs.type === 'vent') {
          ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 1;
          ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
          ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);

          // Vent hatch lines
          ctx.beginPath();
          ctx.moveTo(obs.x + 8, obs.y + 8);
          ctx.lineTo(obs.x + obs.w - 8, obs.y + obs.h - 8);
          ctx.moveTo(obs.x + obs.w - 8, obs.y + 8);
          ctx.lineTo(obs.x + 8, obs.y + obs.h - 8);
          ctx.stroke();
        }
      });

      // Exit Hatch
      const exit = lvl.exit;
      const canExit = intelCollected >= lvl.requiredIntel;
      ctx.fillStyle = canExit ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.15)';
      ctx.strokeStyle = canExit ? '#22c55e' : '#ef4444';
      ctx.lineWidth = 2;
      ctx.fillRect(exit.x, exit.y, exit.w, exit.h);
      ctx.strokeRect(exit.x, exit.y, exit.w, exit.h);

      ctx.fillStyle = canExit ? '#22c55e' : '#ef4444';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(canExit ? 'EXTRACTION' : 'LOCKED', exit.x + exit.w / 2, exit.y + exit.h / 2 + 3);

      // Terminals
      lvl.terminals.forEach((term) => {
        ctx.save();
        ctx.translate(term.x, term.y);

        ctx.fillStyle = term.hacked ? '#334155' : term.type === 'intel' ? '#06b6d4' : '#eab308';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing glow if active
        if (!term.hacked) {
          ctx.strokeStyle = term.type === 'intel' ? 'rgba(6, 182, 212, 0.5)' : 'rgba(234, 179, 8, 0.5)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 14 + Math.sin(Date.now() / 200) * 3, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Progress ring
        if (term.progress > 0 && !term.hacked) {
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, 16, -Math.PI / 2, -Math.PI / 2 + (term.progress / 100) * Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillStyle = '#94a3b8';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(term.label, 0, 22);

        ctx.restore();
      });

      // Lasers
      lvl.lasers.forEach((laser) => {
        if (!laser.active) {
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.2)';
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(laser.x1, laser.y1);
          ctx.lineTo(laser.x2, laser.y2);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = '#ef4444';
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 10;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(laser.x1, laser.y1);
          ctx.lineTo(laser.x2, laser.y2);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      });

      // Cameras
      lvl.cameras.forEach((cam) => {
        // Camera base
        ctx.fillStyle = cam.disabled ? '#64748b' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(cam.x, cam.y, 8, 0, Math.PI * 2);
        ctx.fill();

        if (!cam.disabled) {
          // Vision cone
          const coneGrad = ctx.createRadialGradient(cam.x, cam.y, 10, cam.x, cam.y, cam.range);
          coneGrad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
          coneGrad.addColorStop(1, 'rgba(56, 189, 248, 0.02)');

          ctx.fillStyle = coneGrad;
          ctx.beginPath();
          ctx.moveTo(cam.x, cam.y);
          ctx.arc(cam.x, cam.y, cam.range, cam.angle - cam.fov / 2, cam.angle + cam.fov / 2);
          ctx.closePath();
          ctx.fill();
        }
      });

      // Distraction rings
      distractionsRef.current.forEach((d) => {
        ctx.strokeStyle = `rgba(6, 182, 212, ${d.alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Guards
      lvl.guards.forEach((guard) => {
        // Vision cone
        const coneColor =
          guard.state === 'chase'
            ? 'rgba(239, 68, 68, 0.4)'
            : guard.state === 'suspicious'
            ? 'rgba(234, 179, 8, 0.3)'
            : 'rgba(245, 158, 11, 0.15)';

        const coneGrad = ctx.createRadialGradient(guard.x, guard.y, 10, guard.x, guard.y, guard.visionRange);
        coneGrad.addColorStop(0, coneColor);
        coneGrad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = coneGrad;
        ctx.beginPath();
        ctx.moveTo(guard.x, guard.y);
        ctx.arc(guard.x, guard.y, guard.visionRange, guard.angle - guard.visionAngle / 2, guard.angle + guard.visionAngle / 2);
        ctx.closePath();
        ctx.fill();

        // Guard Body
        ctx.save();
        ctx.translate(guard.x, guard.y);
        ctx.rotate(guard.angle);

        ctx.fillStyle = guard.state === 'chase' ? '#ef4444' : guard.state === 'suspicious' ? '#eab308' : '#f59e0b';
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();

        // Guard weapon/flashlight
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(6, -2, 8, 4);

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

      // Player
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.angle);

      // Footstep noise ring when sprinting
      if (player.isSprinting && !player.isHidden) {
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 24 + Math.sin(Date.now() / 100) * 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = player.isHidden ? 'rgba(16, 185, 129, 0.6)' : '#06b6d4';
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = player.isHidden ? 0 : 8;
      ctx.beginPath();
      ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Direction visor
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(player.radius - 3, -3, 6, 6);

      ctx.restore();

      // Alarm Strobe Flash if in full alert
      if (alarmLevelRef.current === 2) {
        const strobe = Math.sin(Date.now() / 150) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(239, 68, 68, ${strobe * 0.15})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
      });
    }
  }, [gameState, startLoop, setupCanvasContext, currentLevelIndex, initLevel, intelCollected, triggerGameOver, updateScore, score]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center select-none bg-[#090b10] font-sans">
      {/* Top Cyber HUD */}
      <div className="absolute top-2 left-3 right-3 flex items-center justify-between z-10 pointer-events-none text-xs font-mono">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-zinc-900/90 border border-white/10 rounded-xl flex items-center gap-2">
            <span className="text-zinc-400">SEKTOR:</span>
            <span className="text-cyan-400 font-bold">{currentLevelRef.current.name}</span>
          </div>

          <div className="px-3 py-1 bg-zinc-900/90 border border-white/10 rounded-xl flex items-center gap-2">
            <Key size={13} className="text-amber-400" />
            <span className="text-zinc-400">INTEL:</span>
            <span className="text-white font-bold">{intelCollected}/{intelRequired}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-zinc-900/90 border border-white/10 rounded-xl flex items-center gap-2">
            <Radio size={13} className="text-indigo-400" />
            <span className="text-zinc-400">EMP DART:</span>
            <span className="text-indigo-400 font-bold">{distractionCharges}</span>
          </div>

          <div className={`px-3 py-1 rounded-xl flex items-center gap-2 border ${
            alarmLevel === 2
              ? 'bg-rose-950/80 border-rose-500 text-rose-400 animate-pulse'
              : alarmLevel === 1
              ? 'bg-amber-950/80 border-amber-500 text-amber-400'
              : 'bg-zinc-900/90 border-white/10 text-emerald-400'
          }`}>
            <AlertTriangle size={13} />
            <span className="font-bold">
              {alarmLevel === 2 ? 'ALARM: ALERT' : alarmLevel === 1 ? 'ALARM: SUSPICIOUS' : 'ALARM: CALM'}
            </span>
          </div>

          <div className="px-3 py-1 bg-zinc-900/90 border border-white/10 rounded-xl flex items-center gap-2">
            <span className="text-zinc-400">SKOR:</span>
            <span className="text-yellow-400 font-bold">{score}</span>
          </div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onClick={handleCanvasClick}
        className="w-full h-full max-w-full max-h-full object-contain cursor-crosshair rounded-xl"
      />

      <GameOverlay
        gameState={gameState}
        countdown={countdown}
        score={score}
        highScore={highScore}
        onStart={startGame}
        onResume={() => setGameState('playing')}
        onRestart={startGame}
        instructions="WASD / Panah untuk bergerak. Shift untuk sprint (berisik!). Klik / Shift+Z untuk menembak EMP Dart pengalih perhatian. Hack semua terminal intel lalu masuki portal extraction!"
      />
    </div>
  );
}

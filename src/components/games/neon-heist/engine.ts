import { LevelData, Guard, Camera, LaserBarrier, Terminal, Distraction } from './types';
import { audio } from '../../../utils/audio';

// Just basic math/physics
export function lineRectCollide(x1: number, y1: number, x2: number, y2: number, rx: number, ry: number, rw: number, rh: number) {
  // simple AABB vs Line intersection
  const left = lineLine(x1, y1, x2, y2, rx, ry, rx, ry + rh);
  const right = lineLine(x1, y1, x2, y2, rx + rw, ry, rx + rw, ry + rh);
  const top = lineLine(x1, y1, x2, y2, rx, ry, rx + rw, ry);
  const bottom = lineLine(x1, y1, x2, y2, rx, ry + rh, rx + rw, ry + rh);
  return left || right || top || bottom || (x1 >= rx && x1 <= rx + rw && y1 >= ry && y1 <= ry + rh);
}

function lineLine(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) {
  const uA = ((x4-x3)*(y1-y3) - (y4-y3)*(x1-x3)) / ((y4-y3)*(x2-x1) - (x4-x3)*(y2-y1));
  const uB = ((x2-x1)*(y1-y3) - (y2-y1)*(x1-x3)) / ((y4-y3)*(x2-x1) - (x4-x3)*(y2-y1));
  return (uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1);
}

export function hasLineOfSight(x1: number, y1: number, x2: number, y2: number, obstacles: any[]) {
  for (const obs of obstacles) {
    if (obs.type === 'wall' || obs.type === 'server') {
      if (lineRectCollide(x1, y1, x2, y2, obs.x, obs.y, obs.w, obs.h)) return false;
    }
  }
  return true;
}

export function updateGuards(dt: number, lvl: LevelData, player: any, alarmLevelRef: any, setAlarmLevel: any, setStealthRank: any, distractionsRef: any) {
  let isDetected = false;
  
  lvl.guards.forEach((guard) => {
    // Check vision
    if (!player.isHidden) {
      const dist = Math.hypot(player.x - guard.x, player.y - guard.y);
      if (dist < guard.visionRange) {
        const angleToPlayer = Math.atan2(player.y - guard.y, player.x - guard.x);
        let diff = angleToPlayer - guard.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        
        if (Math.abs(diff) < guard.visionAngle / 2) {
          if (hasLineOfSight(guard.x, guard.y, player.x, player.y, lvl.obstacles)) {
            guard.state = 'chase';
            alarmLevelRef.current = 2;
            setAlarmLevel(2);
            setStealthRank('Detected');
            isDetected = true;
          }
        }
      }
    }

    // Distractions
    distractionsRef.current.forEach((d: any) => {
      const dist = Math.hypot(d.x - guard.x, d.y - guard.y);
      if (dist < 180 && guard.state !== 'chase') {
        guard.state = 'suspicious';
        guard.investigatePos = { x: d.x, y: d.y };
        guard.searchTimer = 240;
      }
    });

    // Guard Movement Logic
    if (guard.state === 'patrol') {
      const wp = guard.waypoints[guard.currentWaypoint];
      const dist = Math.hypot(wp.x - guard.x, wp.y - guard.y);
      if (dist < 5) {
        guard.currentWaypoint = (guard.currentWaypoint + 1) % guard.waypoints.length;
      } else {
        guard.targetAngle = Math.atan2(wp.y - guard.y, wp.x - guard.x);
        guard.x += Math.cos(guard.targetAngle) * guard.speed * (dt * 60);
        guard.y += Math.sin(guard.targetAngle) * guard.speed * (dt * 60);
      }
    } else if (guard.state === 'chase') {
      guard.targetAngle = Math.atan2(player.y - guard.y, player.x - guard.x);
      guard.x += Math.cos(guard.targetAngle) * (guard.speed * 1.5) * (dt * 60);
      guard.y += Math.sin(guard.targetAngle) * (guard.speed * 1.5) * (dt * 60);
    } else if (guard.state === 'suspicious') {
      if (guard.investigatePos) {
        const dist = Math.hypot(guard.investigatePos.x - guard.x, guard.investigatePos.y - guard.y);
        if (dist < 5) {
          guard.state = 'search';
        } else {
          guard.targetAngle = Math.atan2(guard.investigatePos.y - guard.y, guard.investigatePos.x - guard.x);
          guard.x += Math.cos(guard.targetAngle) * guard.speed * (dt * 60);
          guard.y += Math.sin(guard.targetAngle) * guard.speed * (dt * 60);
        }
      }
    } else if (guard.state === 'search') {
      guard.targetAngle += 0.05 * (dt * 60);
      guard.searchTimer -= dt * 60;
      if (guard.searchTimer <= 0) {
        guard.state = 'patrol';
        guard.investigatePos = undefined;
      }
    }

    // Angle interpolation
    let adiff = guard.targetAngle - guard.angle;
    while (adiff < -Math.PI) adiff += Math.PI * 2;
    while (adiff > Math.PI) adiff -= Math.PI * 2;
    guard.angle += adiff * 0.1 * (dt * 60);
  });
  
  return isDetected;
}

export function updateCameras(dt: number, lvl: LevelData, player: any, alarmLevelRef: any, setAlarmLevel: any, setStealthRank: any) {
  let isDetected = false;
  lvl.cameras.forEach((cam) => {
    if (cam.disabled) {
      cam.disableTimer -= dt * 1000;
      if (cam.disableTimer <= 0) cam.disabled = false;
      return;
    }
    
    cam.angle += cam.rotSpeed * (dt * 60);
    if (cam.angle > cam.maxAngle || cam.angle < cam.minAngle) {
      cam.rotSpeed *= -1;
    }
    
    if (!player.isHidden) {
      const dist = Math.hypot(player.x - cam.x, player.y - cam.y);
      if (dist < cam.range) {
        const angleToPlayer = Math.atan2(player.y - cam.y, player.x - cam.x);
        let diff = angleToPlayer - cam.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        
        if (Math.abs(diff) < cam.fov / 2) {
          if (hasLineOfSight(cam.x, cam.y, player.x, player.y, lvl.obstacles)) {
            alarmLevelRef.current = 2;
            setAlarmLevel(2);
            setStealthRank('Detected');
            isDetected = true;
          }
        }
      }
    }
  });
  return isDetected;
}

export function updateLasers(dt: number, lvl: LevelData, player: any, alarmLevelRef: any, setAlarmLevel: any, setStealthRank: any) {
  let isDetected = false;
  lvl.lasers.forEach((laser) => {
    if (!laser.switchControlled) {
      laser.cycleTimer += dt * 1000;
      if (laser.cycleTimer >= laser.cycleTime) {
        laser.cycleTimer = 0;
      }
      laser.active = laser.cycleTimer < laser.activeDuration;
    }

    if (laser.active && !player.isHidden) {
      if (lineRectCollide(laser.x1, laser.y1, laser.x2, laser.y2, player.x - player.radius, player.y - player.radius, player.radius * 2, player.radius * 2)) {
        alarmLevelRef.current = 2;
        setAlarmLevel(2);
        setStealthRank('Detected');
        isDetected = true;
      }
    }
  });
  return isDetected;
}

export function checkPlayerCollision(newX: number, newY: number, player: any, lvl: LevelData) {
  let collided = false;
  let isInsideVent = false;
  lvl.obstacles.forEach((obs) => {
    if (obs.type === 'vent') {
      if (newX >= obs.x && newX <= obs.x + obs.w && newY >= obs.y && newY <= obs.y + obs.h) {
        isInsideVent = true;
      }
    } else {
      const nearestX = Math.max(obs.x, Math.min(newX, obs.x + obs.w));
      const nearestY = Math.max(obs.y, Math.min(newY, obs.y + obs.h));
      const distSq = (newX - nearestX) ** 2 + (newY - nearestY) ** 2;
      if (distSq < player.radius * player.radius) collided = true;
    }
  });
  return { collided, isInsideVent };
}

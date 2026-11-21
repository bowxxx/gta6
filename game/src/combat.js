// Combat: rival gang members who guard the big score, their bullets, and the
// player's tracers. Enemies take cover in place, shoot when the player is in
// range, and drop cash when they go down.
import { ENEMY_DAMAGE, ENEMY_HP } from './config.js';
import { addParticles, playerPos } from './state.js';
import { damagePlayer } from './player.js';

export function spawnEnemy(state, x, y) {
  const e = {
    x, y, hp: ENEMY_HP, angle: 0, shootCd: state.rng.range(0.5, 1.5),
    speed: 95, dead: false, strafe: state.rng.chance(0.5) ? 1 : -1, strafeTimer: 0,
  };
  state.enemies.push(e);
  return e;
}

export function updateEnemies(state, dt, audio) {
  const pp = playerPos(state);
  for (const e of state.enemies) {
    if (e.dead) continue;
    const dx = pp.x - e.x;
    const dy = pp.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    e.angle = Math.atan2(dy, dx);
    // Keep a fighting distance: close in when far, strafe when near.
    e.strafeTimer -= dt;
    if (e.strafeTimer <= 0) {
      e.strafeTimer = state.rng.range(1, 2.5);
      e.strafe = -e.strafe;
    }
    if (dist > 320) {
      e.x += (dx / dist) * e.speed * dt;
      e.y += (dy / dist) * e.speed * dt;
    } else if (dist < 150) {
      e.x -= (dx / dist) * e.speed * 0.6 * dt;
      e.y -= (dy / dist) * e.speed * 0.6 * dt;
    } else {
      e.x += -Math.sin(e.angle) * e.strafe * e.speed * 0.5 * dt;
      e.y += Math.cos(e.angle) * e.strafe * e.speed * 0.5 * dt;
    }
    e.shootCd -= dt;
    if (dist < 460 && e.shootCd <= 0) {
      e.shootCd = state.rng.range(0.9, 1.6);
      state.bullets.push({ x: e.x, y: e.y, tx: pp.x, ty: pp.y, t: 0.09, fromPlayer: false });
      addParticles(state, e.x + Math.cos(e.angle) * 20, e.y + Math.sin(e.angle) * 20, '#ffd76a', 4, 140);
      if (audio) audio.enemyShot();
    }
  }
  state.enemies = state.enemies.filter((e) => !e.dead);
}

// Tracers live a tenth of a second; enemy tracers hurt when they land near you.
export function updateBullets(state, dt, audio) {
  for (const b of state.bullets) {
    b.t -= dt;
    if (!b.fromPlayer && b.t > 0) {
      const pp = playerPos(state);
      const d = Math.hypot(b.tx - pp.x, b.ty - pp.y);
      if (d < 26 && state.player.inCar === null) {
        damagePlayer(state, ENEMY_DAMAGE, audio);
        b.t = 0;
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.t > 0);
}

import { scene } from './engine.js';
import { colliders } from './level.js';

const effects = [];

export function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.life -= dt;
    if (e.life <= 0) {
      // даём эффекту шанс сдетонировать в точке финала
      if (e.onEnd) e.onEnd(e.mesh.position.clone());
      scene.remove(e.mesh);
      if (e.ownGeo) e.mesh.geometry.dispose();
      e.mesh.material.dispose();
      effects.splice(i, 1);
      continue;
    }
    e.update(e, dt);
  }
}

export function spawnImpact(point) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 3), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
  mesh.position.copy(point); scene.add(mesh);
  effects.push({ mesh, life: 0.15, maxLife: 0.15, ownGeo: true, update(e) { const t = e.life / e.maxLife; e.mesh.scale.setScalar(1 + (1 - t) * 1.5); e.mesh.material.opacity = t; } });
}

export function spawnStunRing(pos, radius, color) {
  const mesh = new THREE.Mesh(new THREE.RingGeometry(0.92, 1.0, 40), new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(pos.x, 0.06, pos.z); scene.add(mesh);
  effects.push({ mesh, life: 0.85, maxLife: 0.85, ownGeo: false, update(e) { const t = 1 - e.life / e.maxLife; e.mesh.scale.setScalar((0.2 + t * 0.8) * radius); e.mesh.material.opacity = (1 - t) * 0.95; } });
}

export function spawnBlast(pos, radius, color) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color, transparent: true, wireframe: true, depthWrite: false }));
  mesh.position.set(pos.x, Math.max(radius * 0.5, pos.y), pos.z); scene.add(mesh);
  effects.push({ mesh, life: 0.5, maxLife: 0.5, ownGeo: false, update(e) { const t = 1 - e.life / e.maxLife; e.mesh.scale.setScalar((0.15 + t * 0.85) * radius); e.mesh.material.opacity = (1 - t) * 0.9; } });
}

// Проверка попадания снаряда в препятствие (пол + все коллайдеры).
// Возвращает точку попадания (Vector3) или null.
function checkProjectileCollision(pos, radius) {
  // Пол
  if (pos.y <= radius) {
    return new THREE.Vector3(pos.x, 0, pos.z);
  }

  for (const b of colliders) {
    // отсекаем по высоте, если есть диапазон
    if (b.min && (pos.y < b.min.y - radius || pos.y > b.max.y + radius)) continue;

    if (b.isRound) {
      const dx = pos.x - b.x;
      const dz = pos.z - b.z;
      const r = b.radius + radius;
      if (dx * dx + dz * dz < r * r) return pos.clone();
    } else if (b.isAngled) {
      const dx = pos.x - b.x;
      const dz = pos.z - b.z;
      const cos = Math.cos(-b.angle);
      const sin = Math.sin(-b.angle);
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      const hw = b.w / 2 + radius;
      const hd = b.d / 2 + radius;
      if (Math.abs(lx) < hw && Math.abs(lz) < hd) return pos.clone();
    } else if (b.min && b.max) {
      if (pos.x >= b.min.x - radius && pos.x <= b.max.x + radius &&
          pos.z >= b.min.z - radius && pos.z <= b.max.z + radius) {
        return pos.clone();
      }
    }
  }
  return null;
}

// Снаряд-заклинание с пошаговой проверкой коллизий.
export function spawnProjectile(startPos, dir, speed, color, isFire, onEnd) {
  const geo = new THREE.SphereGeometry(0.15, 6, 6);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(startPos);
  scene.add(mesh);

  const radius = 0.15;
  const lifeMax = 1.2; // ~15–20 юнитов по направлению (было 800 мс)

  const proj = {
    mesh, dir: dir.clone().normalize(), speed,
    life: lifeMax, maxLife: lifeMax, isFire, ownGeo: true, onEnd,
    update(e, dt) {
      const totalDist = e.speed * dt;
      const stepSize = 0.2;
      let remaining = totalDist;

      while (remaining > 0) {
        const step = Math.min(stepSize, remaining);
        e.mesh.position.addScaledVector(e.dir, step);
        remaining -= step;

        const hit = checkProjectileCollision(e.mesh.position, radius);
        if (hit) {
          e.mesh.position.copy(hit);
          e.life = 0; // updateEffects на следующем кадре вызовет onEnd
          return;
        }
      }

      e.mesh.material.opacity = 0.9 * (e.life / e.maxLife);
      e.mesh.rotation.x += dt * 10;
      e.mesh.rotation.y += dt * 8;
    }
  };
  effects.push(proj);
  return proj;
}
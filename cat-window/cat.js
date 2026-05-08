// Floating desktop cat window — AI + render.

const canvas = document.getElementById('cv');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

let sprites = null;
let CAT_W = 100, CAT_H = 100;
let WIN_W = 130, WIN_H = 130;
const PADDING = 20;
let userScale = 1.0; // user-adjustable size multiplier (1.0 = 100px tall)

let displays = [{ x: 0, y: 0, width: 1920, height: 1080 }];
let panelBounds = null;

if (window.catApi) {
  window.catApi.onWorkArea((data) => {
    if (data.displays && data.displays.length > 0) displays = data.displays;
  });
  window.catApi.onPanelBounds((b) => { panelBounds = b; });
  window.catApi.onCatSize((px) => {
    if (sprites) applyCatSize(px);
  });
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
resize();

const cat = {
  x: 800, y: 600,
  facing: 1,
  state: 'idle',
  stateUntil: 0,
  frame: 0,
  frameTime: 0,
  variantIdx: 0,    // which variant of the current state's sprite is playing
  target: null,
  pathQueue: [],
  mood: 'idle',
  celebrateUntil: 0,
};

function pickVariant(state) {
  if (!sprites || !sprites.variants[state]) return 0;
  const n = sprites.variants[state].length;
  return Math.floor(Math.random() * n);
}

function getCurrentFrames() {
  if (!sprites) return null;
  const variants = sprites.variants[cat.state];
  if (!variants || variants.length === 0) return null;
  return variants[cat.variantIdx % variants.length];
}

const FRAME_INTERVAL = {
  idle: 240, walk: 110, sleep: 380,
  run: 90, alert: 220, pounce: 130, scratch: 160, play: 200, crouch: 220,
};

const DEFAULT_FACING = {
  walk: 1,
  run: -1,
};

// States whose animation should play exactly once, then transition to a
// calm idle pose. Avoids the busy looping of flashy moves (leap, pounce, dig).
const ONE_SHOT_STATES = new Set(['run', 'pounce', 'play']);

// Per-state vertical draw offset (display pixels, scaled by current CAT_H/100).
// Negative = shift up. Use when sprite has empty space at top of its cell.
const STATE_Y_OFFSET = {
  play: -18,
};

// === Display graph for multi-monitor pathing ===
function dispAt(px, py) {
  for (const d of displays) {
    if (px >= d.x && px < d.x + d.width && py >= d.y && py < d.y + d.height) return d;
  }
  return null;
}

function transitPoint(a, b) {
  const TOL = 8;
  if (Math.abs((a.x + a.width) - b.x) < TOL) {
    const top = Math.max(a.y, b.y);
    const bot = Math.min(a.y + a.height, b.y + b.height);
    if (bot - top > CAT_H) return { x: b.x + 2, y: (top + bot) / 2 - CAT_H / 2 };
  }
  if (Math.abs((b.x + b.width) - a.x) < TOL) {
    const top = Math.max(a.y, b.y);
    const bot = Math.min(a.y + a.height, b.y + b.height);
    if (bot - top > CAT_H) return { x: b.x + b.width - CAT_W - 2, y: (top + bot) / 2 - CAT_H / 2 };
  }
  if (Math.abs((a.y + a.height) - b.y) < TOL) {
    const left  = Math.max(a.x, b.x);
    const right = Math.min(a.x + a.width, b.x + b.width);
    if (right - left > CAT_W) return { x: (left + right) / 2 - CAT_W / 2, y: b.y + 2 };
  }
  if (Math.abs((b.y + b.height) - a.y) < TOL) {
    const left  = Math.max(a.x, b.x);
    const right = Math.min(a.x + a.width, b.x + b.width);
    if (right - left > CAT_W) return { x: (left + right) / 2 - CAT_W / 2, y: b.y + b.height - CAT_H - 2 };
  }
  return null;
}

function findDisplayChain(fromIdx, toIdx) {
  if (fromIdx === toIdx) return [fromIdx];
  const visited = new Set([fromIdx]);
  const queue = [[fromIdx]];
  while (queue.length) {
    const path = queue.shift();
    const last = path[path.length - 1];
    for (let i = 0; i < displays.length; i++) {
      if (visited.has(i)) continue;
      if (transitPoint(displays[last], displays[i])) {
        if (i === toIdx) return [...path, i];
        visited.add(i);
        queue.push([...path, i]);
      }
    }
  }
  return null;
}

function planPath(dest) {
  const cx = cat.x + CAT_W / 2;
  const cy = cat.y + CAT_H / 2;
  const dx = dest.x + CAT_W / 2;
  const dy = dest.y + CAT_H / 2;
  const fromIdx = displays.findIndex(d => cx >= d.x && cx < d.x+d.width && cy >= d.y && cy < d.y+d.height);
  const toIdx   = displays.findIndex(d => dx >= d.x && dx < d.x+d.width && dy >= d.y && dy < d.y+d.height);
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return [dest];
  const chain = findDisplayChain(fromIdx, toIdx);
  if (!chain || chain.length < 2) return [dest];
  const waypoints = [];
  for (let i = 0; i < chain.length - 1; i++) {
    const t = transitPoint(displays[chain[i]], displays[chain[i + 1]]);
    if (t) waypoints.push(t);
  }
  waypoints.push(dest);
  return waypoints;
}

// === Panel avoidance ===
function isInPanel(x, y) {
  if (!panelBounds) return false;
  const margin = 10;
  return x + CAT_W > panelBounds.x - margin
      && x < panelBounds.x + panelBounds.width + margin
      && y + CAT_H > panelBounds.y - margin
      && y < panelBounds.y + panelBounds.height + margin;
}

function pickTarget() {
  for (let attempt = 0; attempt < 12; attempt++) {
    const d = displays[Math.floor(Math.random() * displays.length)];
    const margin = 40;
    const tx = d.x + margin + Math.random() * Math.max(1, d.width  - CAT_W - margin * 2);
    const ty = d.y + margin + Math.random() * Math.max(1, d.height - CAT_H - margin * 2);
    if (!isInPanel(tx, ty)) return { x: tx, y: ty };
  }
  // Fallback if panel covers everything: just pick anywhere
  const d = displays[0];
  return { x: d.x + 40, y: d.y + 40 };
}

function unionBounds() {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const d of displays) {
    if (d.x < minX) minX = d.x;
    if (d.y < minY) minY = d.y;
    if (d.x + d.width  > maxX) maxX = d.x + d.width;
    if (d.y + d.height > maxY) maxY = d.y + d.height;
  }
  return { minX, minY, maxX, maxY };
}

function clampPos() {
  const u = unionBounds();
  if (cat.x < u.minX) cat.x = u.minX;
  if (cat.y < u.minY) cat.y = u.minY;
  if (cat.x + CAT_W > u.maxX) cat.x = u.maxX - CAT_W;
  if (cat.y + CAT_H > u.maxY) cat.y = u.maxY - CAT_H;
}

// === Behavior weights ===
// Stationary states stay long (20~45s); walk/run keep their natural duration via path.
// pounce is a brief action — kept rare and short.
const BEHAVIORS = {
  idle: [
    { name: 'idle',    weight: 32, min: 25000, max: 45000 },
    { name: 'sleep',   weight: 20, min: 30000, max: 60000 },
    { name: 'walk',    weight: 18, min: 0, max: 0 },
    { name: 'alert',   weight: 10, min: 20000, max: 35000 },
    { name: 'scratch', weight: 8,  min: 18000, max: 30000 },
    { name: 'play',    weight: 7,  min: 18000, max: 30000 },
    { name: 'run',     weight: 3,  min: 0, max: 0 },
    { name: 'pounce',  weight: 2,  min: 1500, max: 2500 },
  ],
  study: [
    { name: 'walk',    weight: 25, min: 0, max: 0 },
    { name: 'alert',   weight: 18, min: 22000, max: 35000 },
    { name: 'idle',    weight: 30, min: 22000, max: 35000 },
    { name: 'run',     weight: 10, min: 0, max: 0 },
    { name: 'scratch', weight: 7,  min: 18000, max: 28000 },
    { name: 'play',    weight: 7,  min: 18000, max: 28000 },
    { name: 'pounce',  weight: 3,  min: 1500, max: 2500 },
  ],
  rest: [
    { name: 'sleep',   weight: 40, min: 35000, max: 70000 },
    { name: 'idle',    weight: 22, min: 25000, max: 40000 },
    { name: 'play',    weight: 12, min: 20000, max: 30000 },
    { name: 'scratch', weight: 10, min: 20000, max: 30000 },
    { name: 'alert',   weight: 8,  min: 20000, max: 30000 },
    { name: 'walk',    weight: 8,  min: 0, max: 0 },
  ],
};

function hasFrames(state) {
  return sprites && sprites.variants[state] && sprites.variants[state].length > 0
    && sprites.variants[state][0].length > 0;
}

function enter(state, durationMs) {
  if (!hasFrames(state) && state !== 'walk' && state !== 'run') {
    state = hasFrames('idle') ? 'idle' : 'walk';
  }
  cat.state = state;
  cat.stateUntil = Date.now() + durationMs;
  cat.target = null;
  cat.frame = 0;
  cat.frameTime = 0;
  cat.variantIdx = pickVariant(state);
}
function enterWalk() {
  cat.state = 'walk';
  const dest = pickTarget();
  const path = planPath(dest);
  cat.target = path.shift();
  cat.pathQueue = path;
  cat.facing = cat.target.x > cat.x ? 1 : -1;
  cat.frame = 0;
  cat.frameTime = 0;
  cat.variantIdx = pickVariant('walk');
}
function enterRun() {
  cat.state = 'run';
  const dest = pickTarget();
  const path = planPath(dest);
  cat.target = path.shift();
  cat.pathQueue = path;
  cat.facing = cat.target.x > cat.x ? 1 : -1;
  cat.frame = 0;
  cat.frameTime = 0;
  cat.variantIdx = pickVariant('run');
}
function celebrate() {
  cat.celebrateUntil = Date.now() + 5000;
  enterRun();
}

function pickIdleBehavior() {
  // Wake-up transition: if leaving sleep into anything active, pause briefly first
  const wasSleeping = (cat.state === 'sleep');
  if (wasSleeping && Math.random() < 0.85) {
    enter('idle', 1200);
    return;
  }

  const table = BEHAVIORS[cat.mood] || BEHAVIORS.idle;
  const total = table.reduce((s, b) => s + b.weight, 0);
  let r = Math.random() * total;
  let chosen = table[0];
  for (const b of table) {
    r -= b.weight;
    if (r <= 0) { chosen = b; break; }
  }
  if (chosen.name === 'walk') return enterWalk();
  if (chosen.name === 'run')  return enterRun();
  const dur = chosen.min + Math.random() * (chosen.max - chosen.min);
  enter(chosen.name, dur);
}

if (window.catApi) {
  window.catApi.onMood((mood) => { cat.mood = mood; pickIdleBehavior(); });
  window.catApi.onCelebrate(celebrate);
}

let lastTime = performance.now();
let lastBoundsTime = 0;
function tick(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (sprites) {
    const interval = FRAME_INTERVAL[cat.state] || 240;
    cat.frameTime += dt * 1000;
    const currentFrames = getCurrentFrames();
    while (cat.frameTime >= interval) {
      cat.frameTime -= interval;
      const fc = currentFrames ? currentFrames.length : 1;
      cat.frame = (cat.frame + 1) % fc;
      if (cat.frame === 0 && ONE_SHOT_STATES.has(cat.state)
          && Date.now() >= cat.celebrateUntil) {
        // Animation completed one full cycle — go calm. (Celebration sprints
        // are exempt so they keep looping for the full celebrate window.)
        enter('idle', 20000 + Math.random() * 15000);
        break;
      }
    }
  }

  if (cat.state === 'walk' || cat.state === 'run') {
    if (cat.target) {
      const dx = cat.target.x - cat.x;
      const dy = cat.target.y - cat.y;
      const dist = Math.hypot(dx, dy);
      const isCelebrate = Date.now() < cat.celebrateUntil;
      let speed;
      if (cat.state === 'run') speed = isCelebrate ? 200 : 130;
      else                     speed = isCelebrate ? 80  : 40;
      if (dist < 4) {
        if (cat.pathQueue && cat.pathQueue.length > 0) {
          cat.target = cat.pathQueue.shift();
          cat.facing = cat.target.x > cat.x ? 1 : -1;
        } else {
          cat.target = null;
          if (isCelebrate) enterRun();
          else pickIdleBehavior();
        }
      } else {
        const step = Math.min(dist, speed * dt);
        cat.x += (dx / dist) * step;
        cat.y += (dy / dist) * step;
        cat.facing = dx >= 0 ? 1 : -1;
      }
    } else {
      pickIdleBehavior();
    }
  } else {
    if (Date.now() >= cat.stateUntil) pickIdleBehavior();
  }

  clampPos();

  if (window.catApi && now - lastBoundsTime > 32) {
    lastBoundsTime = now;
    window.catApi.setBounds({
      x: cat.x - PADDING,
      y: cat.y - PADDING,
      w: WIN_W,
      h: WIN_H,
    });
  }

  draw();
  requestAnimationFrame(tick);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!sprites) return;

  // Drop shadow under cat (subtle ground effect)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.beginPath();
  ctx.ellipse(
    PADDING + CAT_W / 2,
    PADDING + CAT_H - 4,
    CAT_W * 0.32,
    5,
    0, 0, Math.PI * 2
  );
  ctx.fill();

  const frames = getCurrentFrames();
  if (!frames || frames.length === 0) return;
  const frame = frames[cat.frame % frames.length];

  const yOffsetBase = STATE_Y_OFFSET[cat.state] || 0;
  const yOffset = Math.round(yOffsetBase * (CAT_H / 100));

  ctx.save();
  const defFace = DEFAULT_FACING[cat.state];
  const shouldFlip = defFace !== undefined && cat.facing !== defFace;
  if (shouldFlip) {
    ctx.translate(PADDING + CAT_W, PADDING + yOffset);
    ctx.scale(-1, 1);
    ctx.drawImage(frame, 0, 0, CAT_W, CAT_H);
  } else {
    ctx.drawImage(frame, PADDING, PADDING + yOffset, CAT_W, CAT_H);
  }
  ctx.restore();

  if (cat.state === 'sleep') {
    drawZ(PADDING + CAT_W - 8, PADDING - 4 + Math.sin(Date.now() / 600) * 3);
  }
}

function drawZ(x, y) {
  ctx.save();
  ctx.strokeStyle = '#000';
  ctx.fillStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.font = 'bold 16px sans-serif';
  ctx.strokeText('z', x, y);
  ctx.fillText('z', x, y);
  ctx.restore();
}

function applyCatSize(targetH) {
  if (!sprites) return;
  const scale = targetH / sprites.h;
  CAT_H = Math.round(sprites.h * scale);
  CAT_W = Math.round(sprites.w * scale);
  WIN_W = CAT_W + PADDING * 2;
  WIN_H = CAT_H + PADDING * 2;
}

function init() {
  window.SPRITES_DATA.loadSprites((data) => {
    if (!data) {
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.fillText('sprite missing', 10, 20);
      return;
    }
    sprites = data;
    applyCatSize(100);

    const d0 = displays[0];
    cat.x = d0.x + d0.width / 2 - CAT_W / 2;
    cat.y = d0.y + d0.height - CAT_H - 80;
    enter('idle', 3000);
    requestAnimationFrame(tick);
  });
}

if (document.readyState === 'complete') init();
else window.addEventListener('load', init);

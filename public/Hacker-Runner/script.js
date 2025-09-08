/**
 * script.js - Fixed and improved Hacker Runner
 * Key fixes:
 *  - overlay markup toggles corrected
 *  - player collision box corrected (top and height when sliding)
 *  - endGame reliably shows gameover overlay and updates best score
 *  - added simple touch controls for mobile
 *  - cleaned stray/no-op lines
 */

/* ---------------------------
   Config & Globals
   --------------------------- */
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const W = canvas.width;
const H = canvas.height;

// Game state
let lastTime = 0;
let delta = 0;
let running = false;
let gameSpeed = 320;
let worldMultiplier = 1;
let distance = 0;
let packetsCollected = 0;
const highScoreKey = 'hr_highscore';

// Entities
const obstacles = [];
const drones = [];
const packets = [];
const powerups = [];

// Player
const player = {
  x: 120,
  y: H - 120,       // baseline (y of the feet)
  width: 44,
  height: 64,
  vy: 0,
  gravity: 1900,
  jumpForce: -680,
  isGrounded: true,
  isSliding: false,
  slideTimer: 0,
  slideDuration: 0.5
};

let spawnTimer = 0;
let spawnInterval = 1.0;
let droneSpawnChance = 0.25;
let packetSpawnChance = 0.4;
let powerupSpawnChance = 0.08;

let elapsedSinceStart = 0;
let speedIncreaseRate = 3.5;

let activePower = null;
const powerIndicatorEl = document.getElementById('power-indicator');

// Assets (optional)
const images = {};
const sounds = {};

function loadAssets() {
  const imgList = {
    hacker: 'assets/images/hacker.png',
    firewall: 'assets/images/firewall.png',
    drone: 'assets/images/drone.png',
    datapacket: 'assets/images/datapacket.png',
    vpn: 'assets/images/vpn.png',
    speedhack: 'assets/images/speedhack.png'
  };
  for (const key in imgList) {
    const img = new Image();
    img.src = imgList[key];
    images[key] = img;
  }

  const soundList = {
    jump: 'assets/sounds/jump.wav',
    collect: 'assets/sounds/collect.wav',
    powerup: 'assets/sounds/powerup.wav',
    gameover: 'assets/sounds/gameover.wav'
  };
  for (const k in soundList) {
    const a = new Audio(soundList[k]);
    a.volume = 0.7;
    sounds[k] = a;
  }
}

/* ---------------------------
   Utilities
   --------------------------- */
function rand(min, max) { return Math.random() * (max - min) + min; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function playSound(name) {
  try {
    const s = sounds[name];
    if (s) { s.currentTime = 0; s.play().catch(()=>{}); }
  } catch(e){}
}

/* ---------------------------
   Input
   --------------------------- */
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.key] = true;
  if ([' ', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
  handleKey(e.key, true);
});
window.addEventListener('keyup', (e) => {
  keys[e.key] = false;
  handleKey(e.key, false);
});

function handleKey(key, down) {
  if (!running) return;
  if (down && (key === ' ' || key === 'ArrowUp' || key === 'w' || key === 'W')) {
    attemptJump();
  }
  if (down && (key === 'ArrowDown' || key === 's' || key === 'S')) {
    startSlide();
  }
}

/* Touch controls: tap to jump, swipe down to slide */
let touchStartY = null;
canvas.addEventListener('touchstart', (e) => {
  if (!e.touches || e.touches.length === 0) return;
  touchStartY = e.touches[0].clientY;
  // Short tap -> jump
  attemptJump();
}, {passive: true});

canvas.addEventListener('touchmove', (e) => {
  if (!touchStartY || !e.touches || e.touches.length === 0) return;
  const dy = e.touches[0].clientY - touchStartY;
  if (dy > 50) {
    startSlide();
    touchStartY = null;
  }
}, {passive: true});

canvas.addEventListener('touchend', () => { touchStartY = null; });

/* ---------------------------
   Player actions
   --------------------------- */
function attemptJump() {
  if (player.isGrounded && !player.isSliding) {
    player.vy = player.jumpForce;
    player.isGrounded = false;
    playSound('jump');
  }
}

function startSlide() {
  if (player.isGrounded && !player.isSliding) {
    player.isSliding = true;
    player.slideTimer = player.slideDuration;
  }
}

/* ---------------------------
   Spawns
   --------------------------- */
function spawnObstacle() {
  if (Math.random() < droneSpawnChance) {
    drones.push({
      x: W + 60,
      y: rand(H - 280, H - 220),
      width: 64,
      height: 36,
      speed: gameSpeed + 80
    });
  } else {
    const height = rand(36, 72);
    obstacles.push({
      x: W + 40,
      y: H - 80 - (height - 36),
      width: rand(38, 66),
      height: height,
      speed: gameSpeed
    });
  }
}

function spawnPacket() {
  packets.push({
    x: W + 40,
    y: rand(H - 250, H - 140),
    width: 30,
    height: 30,
    speed: gameSpeed
  });
}

function spawnPowerup() {
  const type = Math.random() < 0.5 ? 'vpn' : 'speedhack';
  powerups.push({
    x: W + 40,
    y: rand(H - 260, H - 160),
    width: 36,
    height: 36,
    type,
    speed: gameSpeed
  });
}

/* ---------------------------
   Collision
   --------------------------- */
function rectsIntersect(a, b) {
  return !(a.x + a.width < b.x ||
           a.x > b.x + b.width ||
           a.y + a.height < b.y ||
           a.y > b.y + b.height);
}

/* ---------------------------
   Game control
   --------------------------- */
function initGame() {
  lastTime = performance.now();
  elapsedSinceStart = 0;
  gameSpeed = 320;
  worldMultiplier = 1;
  distance = 0;
  packetsCollected = 0;
  obstacles.length = 0;
  drones.length = 0;
  packets.length = 0;
  powerups.length = 0;
  activePower = null;
  spawnTimer = 0;
  running = true;

  player.y = H - 120;
  player.vy = 0;
  player.isGrounded = true;
  player.isSliding = false;
  player.slideTimer = 0;

  // show/hide overlays
  document.querySelectorAll('.overlay').forEach(el => el.classList.remove('visible'));
  updateHUD();

  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function endGame() {
  running = false;
  playSound('gameover');

  const finalScore = Math.floor(distance) + packetsCollected * 50;
  const prevBest = Number(localStorage.getItem(highScoreKey) || 0);
  const best = Math.max(finalScore, prevBest);
  localStorage.setItem(highScoreKey, best);

  document.getElementById('final-score').textContent = `Score: ${finalScore}`;
  document.getElementById('best-score').textContent = `Best: ${best}`;

  // show the gameover overlay reliably
  const goOverlay = document.querySelector('[data-state="gameover"]');
  if (goOverlay) goOverlay.classList.add('visible');
}

/* ---------------------------
   Main loop
   --------------------------- */
function gameLoop(ts) {
  if (!running) return;
  delta = (ts - lastTime) / 1000;
  lastTime = ts;
  delta = Math.min(delta, 0.033);

  update(delta);
  draw();

  requestAnimationFrame(gameLoop);
}

/* UPDATE */
function update(dt) {
  elapsedSinceStart += dt;
  gameSpeed += speedIncreaseRate * dt;
  const speedNow = gameSpeed * worldMultiplier;
  distance += speedNow * dt * 0.1;

  spawnTimer += dt;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnInterval = clamp(rand(0.7, 1.4) - Math.min(elapsedSinceStart * 0.0015, 0.5), 0.6, 1.4);
    spawnObstacle();
    if (Math.random() < packetSpawnChance) spawnPacket();
    if (Math.random() < powerupSpawnChance) spawnPowerup();
  }

  // Player physics
  if (!player.isGrounded) {
    player.vy += player.gravity * dt;
    player.y += player.vy * dt;
    if (player.y >= H - 120) {
      player.y = H - 120;
      player.vy = 0;
      player.isGrounded = true;
    }
  }
  if (player.isSliding) {
    player.slideTimer -= dt;
    if (player.slideTimer <= 0) {
      player.isSliding = false;
      player.slideTimer = 0;
    }
  }

  // Move movers and clean off-screen
  [obstacles, drones, packets, powerups].forEach(arr => {
    for (let i = arr.length - 1; i >= 0; i--) {
      const o = arr[i];
      o.x -= (o.speed || speedNow) * dt * (arr === drones ? 1.05 : 1);
      if (o.x + o.width < -80) arr.splice(i, 1);
    }
  });

  // Build player collision box correctly:
  // topY = player.y - player.height (when standing) or reduced height when sliding
  const playerHeightNow = player.isSliding ? player.height * 0.6 : player.height;
  const playerTop = player.y - playerHeightNow;
  const playerBox = {
    x: player.x,
    y: playerTop,
    width: player.width,
    height: playerHeightNow
  };

  // Packets
  for (let i = packets.length - 1; i >= 0; i--) {
    if (rectsIntersect(playerBox, packets[i])) {
      packetsCollected++;
      playSound('collect');
      packets.splice(i, 1);
    }
  }

  // Powerups
  for (let i = powerups.length - 1; i >= 0; i--) {
    if (rectsIntersect(playerBox, powerups[i])) {
      activatePower(powerups[i].type);
      playSound('powerup');
      powerups.splice(i, 1);
    }
  }

  // Active power effects
  let invincible = false;
  if (activePower) {
    const now = performance.now();
    invincible = activePower.type === 'vpn' && now < activePower.expiresAt;
    if (activePower.type === 'speedhack' && now < activePower.expiresAt) {
      worldMultiplier = 0.45;
    } else {
      worldMultiplier = 1;
    }
    if (now >= activePower.expiresAt) {
      activePower = null;
      worldMultiplier = 1;
    }
  } else {
    worldMultiplier = 1;
  }

  // Collisions with obstacles/drones
  for (let i = obstacles.length - 1; i >= 0; i--) {
    if (rectsIntersect(playerBox, obstacles[i])) {
      if (!invincible) { endGame(); return; }
      else obstacles.splice(i, 1);
    }
  }
  for (let i = drones.length - 1; i >= 0; i--) {
    if (rectsIntersect(playerBox, drones[i])) {
      if (!invincible) { endGame(); return; }
      else drones.splice(i, 1);
    }
  }

  updateHUD();
}

/* DRAW */
function draw() {
  ctx.clearRect(0, 0, W, H);

  // background
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#06060a');
  grad.addColorStop(1, '#01020a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  drawGround();
  drawHacker();
  drawObstacles();
  drawDrones();
  drawPackets();
  drawPowerups();
  drawHUDOverlays();
}

function drawGround() {
  ctx.fillStyle = '#0b0f14';
  ctx.fillRect(0, H - 80, W, 80);
  ctx.fillStyle = 'rgba(0,255,213,0.04)';
  for (let i = 0; i < 20; i++) {
    ctx.fillRect(-((Date.now() / 40) % 60) + i * 60, H - 100 + Math.sin((Date.now()/800) + i)*2, 40, 2);
  }
}

function drawHacker() {
  const px = player.x, py = player.y;
  const drawH = player.isSliding ? player.height * 0.6 : player.height;
  if (images.hacker && images.hacker.complete && images.hacker.naturalWidth) {
    ctx.drawImage(images.hacker, px, py - drawH, player.width, drawH);
  } else {
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#00ffd5';
    ctx.fillStyle = '#00171a';
    ctx.fillRect(px, py - drawH, player.width, drawH);
    ctx.strokeStyle = '#00ffd5';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py - drawH, player.width, drawH);
    ctx.fillStyle = '#00ffd5';
    ctx.fillRect(px + 6, py - drawH + 12, player.width - 12, 6);
    ctx.restore();
  }
}

function drawObstacles() {
  ctx.save();
  obstacles.forEach(o => {
    if (images.firewall && images.firewall.complete && images.firewall.naturalWidth) {
      ctx.drawImage(images.firewall, o.x, o.y, o.width, o.height);
    } else {
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#ff4d4d';
      ctx.fillStyle = '#1a0000';
      ctx.fillRect(o.x, o.y, o.width, o.height);
      ctx.strokeStyle = '#ff4d4d';
      ctx.strokeRect(o.x, o.y, o.width, o.height);
    }
  });
  ctx.restore();
}

function drawDrones() {
  ctx.save();
  drones.forEach(d => {
    if (images.drone && images.drone.complete && images.drone.naturalWidth) {
      ctx.drawImage(images.drone, d.x, d.y, d.width, d.height);
    } else {
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#ff66ff';
      ctx.fillStyle = '#220022';
      ctx.fillRect(d.x, d.y, d.width, d.height);
      ctx.strokeStyle = '#ff66ff';
      ctx.strokeRect(d.x, d.y, d.width, d.height);
    }
  });
  ctx.restore();
}

function drawPackets() {
  ctx.save();
  packets.forEach(p => {
    if (images.datapacket && images.datapacket.complete && images.datapacket.naturalWidth) {
      ctx.drawImage(images.datapacket, p.x, p.y, p.width, p.height);
    } else {
      ctx.shadowBlur = 16;
      ctx.shadowColor = '#ffd166';
      ctx.fillStyle = '#2b1a00';
      ctx.fillRect(p.x, p.y, p.width, p.height);
      ctx.strokeStyle = '#ffd166';
      ctx.strokeRect(p.x, p.y, p.width, p.height);
    }
  });
  ctx.restore();
}

function drawPowerups() {
  ctx.save();
  powerups.forEach(p => {
    if (images[p.type] && images[p.type].complete && images[p.type].naturalWidth) {
      ctx.drawImage(images[p.type], p.x, p.y, p.width, p.height);
    } else {
      ctx.beginPath();
      ctx.shadowBlur = 20;
      ctx.shadowColor = p.type === 'vpn' ? '#66ffcc' : '#66b0ff';
      ctx.fillStyle = '#00111a';
      ctx.arc(p.x + p.width/2, p.y + p.height/2, p.width/2, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = p.type === 'vpn' ? '#66ffcc' : '#66b0ff';
      ctx.stroke();
    }
  });
  ctx.restore();
}

function drawHUDOverlays() {
  if (activePower) {
    const rem = Math.max(0, activePower.expiresAt - performance.now());
    const total = activePower.duration * 1000;
    const pct = clamp(rem / total, 0, 1);
    const barW = 160;
    const barH = 10;
    const x = W - barW - 14, y = 14;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x-6, y-6, barW+12, barH+12);
    ctx.fillStyle = '#003030';
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = activePower.type === 'vpn' ? '#66ffcc' : '#66b0ff';
    ctx.fillRect(x, y, barW * pct, barH);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.strokeRect(x, y, barW, barH);
    ctx.restore();
  }
}

/* ---------------------------
   Powerups
   --------------------------- */
function activatePower(type) {
  const now = performance.now();
  if (type === 'vpn') {
    activePower = { type: 'vpn', duration: 4, expiresAt: now + 4000 };
  } else if (type === 'speedhack') {
    activePower = { type: 'speedhack', duration: 3.5, expiresAt: now + 3500 };
  }
}

/* ---------------------------
   HUD & UI
   --------------------------- */
function updateHUD() {
  document.getElementById('score').textContent = `SCORE: ${Math.floor(distance)}`;
  document.getElementById('packets').textContent = `PACKETS: ${packetsCollected}`;
  if (activePower) {
    const msLeft = Math.ceil((activePower.expiresAt - performance.now()) / 1000);
    powerIndicatorEl.textContent = `${activePower.type.toUpperCase()} ${msLeft}s`;
  } else {
    powerIndicatorEl.textContent = '';
  }
}

/* UI buttons */
document.getElementById('btn-start').addEventListener('click', () => {
  initGame();
});
document.getElementById('btn-retry').addEventListener('click', () => {
  initGame();
});
document.getElementById('btn-menu').addEventListener('click', () => {
  document.querySelector('[data-state="gameover"]').classList.remove('visible');
  document.querySelector('[data-state="start"]').classList.add('visible');
});

/* Start overlay on load */
window.addEventListener('load', () => {
  document.querySelector('[data-state="start"]').classList.add('visible');
  loadAssets();
  const best = localStorage.getItem(highScoreKey) || 0;
  document.getElementById('best-score').textContent = `Best: ${best}`;
});

/* Start with Enter on start screen */
window.addEventListener('keydown', (e) => {
  if (!running && (e.key === 'Enter')) {
    const startOverlay = document.querySelector('[data-state="start"]');
    if (startOverlay && startOverlay.classList.contains('visible')) {
      initGame();
    }
  }
});

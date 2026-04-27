// ══════════════════════════════════════════════════════════════════
// FUTURA CRT — Power-on sequence, terminal, music & effects
// ══════════════════════════════════════════════════════════════════
'use strict';

// ── DOM references ──
const $ = (s) => document.querySelector(s);
const powerScreen = $('#power-screen');
const powerBtn    = $('#power-btn');
const crtOverlay  = $('#crt-overlay');
const crtCanvas   = $('#crt-canvas');
const mainPage    = $('#main-page');
const audioToggle = $('#audio-toggle');
const svgWrapper  = $('.svg-wrapper');
const svgDraw     = $('.svg-draw');
const writeHead   = $('.write-head');
const powerLabel  = $('.power-label');

const ctx = crtCanvas.getContext('2d');
let W, H;
let mainPageVisible = false;

function resize() {
  W = crtCanvas.width  = window.innerWidth;
  H = crtCanvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);
resize();

// ══════════════════════════════════════════════════════════════════
// AUDIO ENGINE
// ══════════════════════════════════════════════════════════════════
const TARGET_VOL = 0.5;
let audioCtx  = null;
let bgBuffer  = null;
let bgRawData = null;
let bgGain    = null;
let bgAudio   = null;
let bgPlaying = false;

function ensureAudioCtx() {
  return audioCtx ?? (audioCtx = new (window.AudioContext || window.webkitAudioContext)());
}

async function fetchBgMusic() {
  try {
    const resp = await fetch('static/scooter.opus');
    if (resp.ok) bgRawData = await resp.arrayBuffer();
  } catch (err) {
    console.warn('Failed to fetch bg music:', err);
  }
}

async function decodeBgMusic() {
  if (bgBuffer || !bgRawData) return;
  try {
    bgBuffer = await ensureAudioCtx().decodeAudioData(bgRawData.slice(0));
  } catch (err) {
    console.warn('Web Audio decode failed:', err);
  }
}

function startBgMusic(fadeMs) {
  if (!bgBuffer || bgPlaying) return;
  const ac = ensureAudioCtx();

  bgGain = ac.createGain();
  bgGain.gain.setValueAtTime(0, ac.currentTime);
  bgGain.connect(ac.destination);

  const src = ac.createBufferSource();
  src.buffer = bgBuffer;
  src.loop   = true;
  src.connect(bgGain);
  src.start(0);
  bgPlaying = true;

  bgGain.gain.linearRampToValueAtTime(TARGET_VOL, ac.currentTime + fadeMs / 1000);
}

function startBgMusicFallback(fadeMs) {
  if (bgPlaying) return;

  bgAudio = new Audio('static/scooter.opus');
  bgAudio.loop   = true;
  bgAudio.volume = 0;

  bgAudio.play().then(() => {
    bgPlaying = true;
    const steps = 60;
    let step = 0;
    const iv = setInterval(() => {
      bgAudio.volume = Math.min(TARGET_VOL, (++step / steps) * TARGET_VOL);
      if (step >= steps) clearInterval(iv);
    }, fadeMs / steps);
  }).catch(err => console.warn('HTML Audio fallback failed:', err));
}

// ── Synthesis helpers ──
function playOscillator({ type, f0, f1, tf, v0, tv, tStop, start }) {
  const ac   = ensureAudioCtx();
  const osc  = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(f0, start);
  osc.frequency.exponentialRampToValueAtTime(f1, start + tf);

  gain.gain.setValueAtTime(v0, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + tv);

  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + tStop);
}

function playPowerSound() {
  const t = ensureAudioCtx().currentTime;
  playOscillator({ type: 'square', f0: 800,  f1: 100, tf: 0.03, v0: 0.4, tv: 0.03, tStop: 0.03, start: t });
  playOscillator({ type: 'square', f0: 600,  f1: 80,  tf: 0.03, v0: 0.3, tv: 0.03, tStop: 0.03, start: t + 0.08 });
}

function playKeySound() {
  const t = ensureAudioCtx().currentTime;
  playOscillator({ type: 'square', f0: 1800 + Math.random() * 800, f1: 400, tf: 0.02, v0: 0.06 + Math.random() * 0.03, tv: 0.04, tStop: 0.05, start: t });
  playOscillator({ type: 'sine',   f0: 200  + Math.random() * 100, f1: 80,  tf: 0.03, v0: 0.04, tv: 0.04, tStop: 0.05, start: t });
}

// ══════════════════════════════════════════════════════════════════
// CRT TURN-ON ANIMATION
// ══════════════════════════════════════════════════════════════════
function runCRTEffect() {
  return new Promise(resolve => {
    crtOverlay.style.display = 'block';
    resize();

    const totalDuration = 1800;
    const start = performance.now();
    let noiseData = null;

    function frame(now) {
      const t = Math.min((now - start) / totalDuration, 1);
      ctx.clearRect(0, 0, W, H);

      if (t < 0.15) {
        // Phase 1: Initial dot expanding to thin line
        const p = t / 0.15;
        const lineH = 2 + p;
        const lineW = W * (0.02 + p * 0.3);
        ctx.fillStyle = `rgba(200,240,160,${0.5 + p * 0.5})`;
        ctx.shadowColor = '#a0e060';
        ctx.shadowBlur = 20 + p * 30;
        ctx.fillRect((W - lineW) / 2, (H - lineH) / 2, lineW, lineH);
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, 3 + p * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(234,255,204,${0.5 + p * 0.5})`;
        ctx.fill();
      } else if (t < 0.35) {
        // Phase 2: Line expands to full width
        const p = (t - 0.15) / 0.2;
        ctx.fillStyle = `rgba(200,240,160,${0.9 + p * 0.1})`;
        ctx.shadowColor = '#c8f0a0';
        ctx.shadowBlur = 40 + p * 20;
        ctx.fillRect((W - W * (0.32 + p * 0.68)) / 2, (H - 2 - p * 6) / 2, W * (0.32 + p * 0.68), 2 + p * 6);
        ctx.shadowBlur = 0;
      } else if (t < 0.55) {
        // Phase 3: Screen opens vertically
        const p = (t - 0.35) / 0.2;
        const rectH = H * (1 - Math.pow(1 - p, 3));
        ctx.fillStyle = `rgba(200,240,160,${(1 - p * 0.3) * 0.15})`;
        ctx.fillRect(0, (H - rectH) / 2, W, rectH);
        ctx.fillStyle = `rgba(234,255,204,${(1 - p) * 0.8})`;
        ctx.fillRect(0, (H - rectH) / 2, W, 3);
        ctx.fillRect(0, (H + rectH) / 2 - 3, W, 3);
      } else if (t < 0.75) {
        // Phase 4: Static noise fading in
        const p = (t - 0.55) / 0.2;
        const noiseA = (1 - p) * 0.4;
        if (!noiseData) noiseData = ctx.createImageData(W, H);
        const d = noiseData.data;
        for (let i = 0; i < d.length; i += 16) {
          const v = (Math.random() * 200 + 56) | 0;
          for (let s = 0; s < 4 && (i + s * 4) < d.length; s++) {
            const idx = i + s * 4;
            d[idx]     = (v * 0.8) | 0;
            d[idx + 1] = v;
            d[idx + 2] = (v * 0.6) | 0;
            d[idx + 3] = (noiseA * 255) | 0;
          }
        }
        ctx.putImageData(noiseData, 0, 0);
        if (p < 0.3) {
          ctx.fillStyle = `rgba(234,255,204,${(1 - p / 0.3) * 0.4})`;
          ctx.fillRect(0, 0, W, H);
        }
      } else {
        // Phase 5: Final fade-out
        const a = (1 - (t - 0.75) / 0.25) * 0.1;
        if (a > 0.01) {
          ctx.fillStyle = `rgba(200,240,160,${a})`;
          ctx.fillRect(0, 0, W, H);
        }
      }

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, W, H);
        crtOverlay.style.display = 'none';
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}

// ══════════════════════════════════════════════════════════════════
// WAKE LOCK
// ══════════════════════════════════════════════════════════════════
let wakeLock = null;

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (err) {
    console.warn('Wake Lock unavailable:', err.message);
  }
}

document.addEventListener('visibilitychange', () => {
  if (wakeLock !== null && document.visibilityState === 'visible') requestWakeLock();
});

// ══════════════════════════════════════════════════════════════════
// CORE SEQUENCE
// ══════════════════════════════════════════════════════════════════
function typeText(el, text) {
  return new Promise(resolve => {
    el.textContent = '';
    let i = 0;
    function next() {
      if (i < text.length) {
        el.textContent += text[i++];
        playKeySound();
        setTimeout(next, 30 + Math.random() * 60);
      } else {
        setTimeout(resolve, 400);
      }
    }
    setTimeout(next, 200);
  });
}

async function powerOn() {
  powerBtn.removeEventListener('click', powerOn);
  requestWakeLock();

  const ac = ensureAudioCtx();
  if (ac.state === 'suspended') try { await ac.resume(); } catch (_) {}

  playPowerSound();

  await decodeBgMusic();
  bgBuffer ? startBgMusic(5000) : startBgMusicFallback(5000);

  powerLabel.classList.add('terminal-style');
  await typeText(powerLabel, 'encendiendo XERON COMPUTER ™');

  powerScreen.classList.add('fade-out');
  setTimeout(() => powerScreen.remove(), 300);
  document.body.classList.add('on');

  await runCRTEffect();
  showMainPage();
}

function showMainPage() {
  mainPage.classList.add('visible');
  mainPageVisible = true;

  svgDraw.classList.add('animate');
  writeHead.classList.add('animate');
  audioToggle.classList.add('visible');

  spawnPolaroid();
  schedulePolaroid();
  scheduleAfterImage();
}

powerBtn.addEventListener('click', powerOn);
fetchBgMusic();

// ══════════════════════════════════════════════════════════════════
// AUDIO TOGGLE
// ══════════════════════════════════════════════════════════════════
let muted = false;

audioToggle.addEventListener('click', () => {
  muted = !muted;
  audioToggle.classList.toggle('muted', muted);
  audioToggle.setAttribute('aria-pressed', String(muted));

  const vol = muted ? 0 : TARGET_VOL;
  if (bgGain) bgGain.gain.setValueAtTime(vol, ensureAudioCtx().currentTime);
  if (bgAudio) bgAudio.volume = vol;
});

// ══════════════════════════════════════════════════════════════════
// PHOSPHOR AFTER-IMAGES
// ══════════════════════════════════════════════════════════════════
function spawnAfterImage() {
  if (!svgWrapper || !mainPageVisible) return;

  const ghost = document.createElement('div');
  ghost.className = 'ghost';
  const offset = (Math.random() - 0.5) * 6;
  Object.assign(ghost.style, {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
    transform: `translateX(${offset}px)`
  });

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 873 135');
  Object.assign(svg.style, {
    width: '100%',
    height: 'auto',
    display: 'block',
    fill: '#c8f0a0',
    filter: 'blur(3px)'
  });

  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#futura-path');
  svg.appendChild(use);
  ghost.appendChild(svg);
  svgWrapper.appendChild(ghost);

  // Use Web Animations API instead of manual rAF loop
  const duration = 600 + Math.random() * 800;
  ghost.animate(
    [{ opacity: 0.12 }, { opacity: 0 }],
    { duration, easing: 'ease-out', fill: 'forwards' }
  ).onfinish = () => ghost.remove();
}

function scheduleAfterImage() {
  setTimeout(() => {
    spawnAfterImage();
    scheduleAfterImage();
  }, 7000 + Math.random() * 5000);
}

// ══════════════════════════════════════════════════════════════════
// POLAROID PHOTOS
// ══════════════════════════════════════════════════════════════════
const PHOTOS = Array.from({ length: 31 }, (_, i) => `media/foto${i + 1}.jpg`);

// Fisher-Yates shuffle
for (let i = PHOTOS.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [PHOTOS[i], PHOTOS[j]] = [PHOTOS[j], PHOTOS[i]];
}

let currentPhotoIndex = 0;
const activePolaroids = new Set();
let rafId = null;

const PAD_TOP    = 8;
const PAD_BOTTOM = 28;
const PAD_SIDE   = 8;

/** Generate random wave parameters for organic polaroid motion */
function randomWaveParams() {
  const rand  = Math.random;
  const TAU   = Math.PI * 2;
  return {
    w1A: 18 + rand() * 14,  w1F: 1.5 + rand() * 1.0,  w1P: rand() * TAU,
    w2A: 6  + rand() * 6,   w2F: 3.0 + rand() * 2.0,  w2P: rand() * TAU,
    w3A: 2  + rand() * 3,   w3F: 7   + rand() * 4,     w3P: rand() * TAU,
    rotA: 2 + rand() * 3,   rotF: 1.0 + rand() * 1.5,  rotP: rand() * TAU,
    sclA: 0.02 + rand() * 0.02, sclF: 0.8 + rand() * 1.2, sclP: rand() * TAU,
  };
}

function globalPolaroidAnimator(now) {
  for (const state of activePolaroids) {
    const t = (now - state.startTime) / state.duration;

    if (t >= 1) {
      state.el.remove();
      activePolaroids.delete(state);
      continue;
    }

    const angle = t * Math.PI * 2;
    const x = window.innerWidth + state.overflow - state.totalDist * t;

    const waveY = Math.sin(angle * state.w1F + state.w1P) * state.w1A
               + Math.sin(angle * state.w2F + state.w2P) * state.w2A
               + Math.sin(angle * state.w3F + state.w3P) * state.w3A;

    const rot = state.baseRot + Math.sin(angle * state.rotF + state.rotP) * state.rotA;
    const scl = 1 + Math.sin(angle * state.sclF + state.sclP) * state.sclA;

    state.el.style.transform = `translate3d(${x}px, ${state.startY + waveY}px, 0) rotate(${rot}deg) scale(${scl})`;
  }

  rafId = activePolaroids.size > 0 ? requestAnimationFrame(globalPolaroidAnimator) : null;
}

function spawnPolaroid() {
  const layer = $('#polaroid-layer');
  if (!layer || !mainPageVisible) return;

  const src = PHOTOS[currentPhotoIndex];
  currentPhotoIndex = (currentPhotoIndex + 1) % PHOTOS.length;

  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  img.alt = '';

  img.decode().then(() => {
    const sizeVh = 35 + Math.random() * 10;
    const totalH = (sizeVh / 100) * window.innerHeight;
    const imgW   = (totalH - PAD_TOP - PAD_BOTTOM) * (img.naturalWidth / img.naturalHeight);
    const totalW = imgW + PAD_SIDE * 2;

    const el = document.createElement('div');
    el.className = 'polaroid';
    el.style.width  = `${totalW}px`;
    el.style.height = `${totalH}px`;
    el.appendChild(img);
    layer.appendChild(el);

    const waves = randomWaveParams();
    const overflow  = window.innerWidth * 0.15 + totalW;
    const totalDist = window.innerWidth + totalW + overflow * 2;

    activePolaroids.add({
      el,
      startTime: performance.now(),
      duration: 30000 + Math.random() * 10000,
      startY: Math.random() * (window.innerHeight - totalH - 60),
      baseRot: (Math.random() - 0.5) * 24,
      overflow,
      totalDist,
      ...waves
    });

    if (!rafId) rafId = requestAnimationFrame(globalPolaroidAnimator);
  }).catch(() => {
    // Image failed to decode — skip silently
  });
}

function schedulePolaroid() {
  if (!mainPageVisible) return;
  setTimeout(() => {
    spawnPolaroid();
    schedulePolaroid();
  }, 4000 + Math.random() * 7000);
}

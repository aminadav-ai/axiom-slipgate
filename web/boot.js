const WIDTH = 720;
const HEIGHT = 450;

const canvas = document.getElementById('fps-canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const statHp = document.getElementById('stat-hp');
const statArmor = document.getElementById('stat-armor');
const statAmmo = document.getElementById('stat-ammo');
const statKills = document.getElementById('stat-kills');
const statFps = document.getElementById('stat-fps');
const wasmBadge = document.getElementById('wasm-size-badge');
const overlayBanner = document.getElementById('overlay-banner');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub = document.getElementById('overlay-sub');
const rewindSlider = document.getElementById('rewind-slider');
const ttStatus = document.getElementById('tt-status');
const btnSound = document.getElementById('btn-sound');
const btnReset = document.getElementById('btn-reset');
const btnResume = document.getElementById('btn-resume');

const keys = new Set();
let mouseTurnAccum = 0;
let fireQueued = 0;
let mouseDownFire = false;
let scrubbing = false;
let soundEnabled = true;
let audioCtx = null;
let noiseBuf = null;

function ensureAudio() {
  if (!soundEnabled) return null;
  if (!audioCtx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (Ctor) {
      audioCtx = new Ctor();
      // Pre-build 0.5s white-noise buffer for heavy 1996 shotgun & industrial percussion!
      noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.5, audioCtx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playNoiseBurst(ac, startTime, duration, filterType, freqStart, freqEnd, peakGain) {
  if (!noiseBuf) return;
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  const filt = ac.createBiquadFilter();
  filt.type = filterType;
  filt.frequency.setValueAtTime(freqStart, startTime);
  if (freqEnd !== freqStart) {
    filt.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), startTime + duration);
  }
  const g = ac.createGain();
  g.gain.setValueAtTime(peakGain, startTime);
  g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  src.connect(filt).connect(g).connect(ac.destination);
  src.start(startTime);
  src.stop(startTime + duration + 0.01);
}

function playSlipgateSfx(mask) {
  if (!mask || !soundEnabled) return;
  const ac = ensureAudio();
  if (!ac) return;
  const now = ac.currentTime;

  // Bit 0: Thunderous 1996 Twin-Barrel Boomstick + Mechanical Pump-Action Slide!
  if (mask & 1) {
    playNoiseBurst(ac, now, 0.26, 'lowpass', 1800, 140, 0.38);
    const punch = ac.createOscillator();
    const pg = ac.createGain();
    punch.type = 'sawtooth';
    punch.frequency.setValueAtTime(118, now);
    punch.frequency.exponentialRampToValueAtTime(28, now + 0.19);
    pg.gain.setValueAtTime(0.32, now);
    pg.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
    punch.connect(pg).connect(ac.destination);
    punch.start(now);
    punch.stop(now + 0.22);

    // Metallic "clack-clack" pump rack at +180ms & +250ms
    playNoiseBurst(ac, now + 0.18, 0.045, 'bandpass', 2400, 1600, 0.12);
    playNoiseBurst(ac, now + 0.25, 0.05, 'bandpass', 2900, 2100, 0.14);
  }

  // Bit 1: Pellet Impact / Monster Stagger
  if (mask & 2) {
    playNoiseBurst(ac, now + 0.02, 0.09, 'bandpass', 720, 240, 0.2);
  }

  // Bit 2: Monster Death Roar!
  if (mask & 4) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(185, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.38);
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(g).connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.42);
  }

  // Bit 3: Enemy Plasma / Nail Bolt
  if (mask & 8) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.11);
    g.gain.setValueAtTime(0.09, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(g).connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  // Bit 4: Player Hurt Grunt
  if (mask & 16) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(132, now);
    osc.frequency.linearRampToValueAtTime(76, now + 0.14);
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(g).connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  // Bit 5: Medkit / Shells / Bronze Armor Pickup
  if (mask & 32) {
    [440, 659.25].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      const t = now + i * 0.055;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(g).connect(ac.destination);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  // Bit 6: Boot Footstep on Riveted Iron Grate
  if (mask & 64) {
    playNoiseBurst(ac, now, 0.035, 'bandpass', 420, 180, 0.06);
  }

  // Bit 7: Runic Exit Slipgate Dimensional Teleport!
  if (mask & 128) {
    [220, 329.63, 440, 659.25, 880].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      const t = now + i * 0.07;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.45);
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.connect(g).connect(ac.destination);
      osc.start(t);
      osc.stop(t + 0.52);
    });
  }
}

function syncSliderVars() {
  const minVal = Number(rewindSlider.min || 0);
  const maxVal = Math.max(minVal + 1, Number(rewindSlider.max || 1));
  rewindSlider.style.setProperty('--attr-min', String(minVal));
  rewindSlider.style.setProperty('--attr-max', String(maxVal));
  rewindSlider.style.setProperty('--control-value', String(rewindSlider.value));
}

function normalizeKeyTokens(e) {
  const tokens = [];
  if (e.code) tokens.push(e.code);
  if (e.key) {
    if (e.key.startsWith('Arrow')) tokens.push(e.key);
    if (e.key === ' ') tokens.push('Space');
  }
  return tokens;
}

window.addEventListener('keydown', (e) => {
  const toks = normalizeKeyTokens(e);
  if (document.activeElement !== rewindSlider && toks.some((t) => ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(t))) {
    e.preventDefault();
  }
  ensureAudio();
  if (toks.includes('Space')) {
    fireQueued = 1;
  }
  toks.forEach((t) => keys.add(t));
}, { capture: true });

window.addEventListener('keyup', (e) => {
  normalizeKeyTokens(e).forEach((t) => keys.delete(t));
}, { capture: true });

window.addEventListener('blur', () => {
  keys.clear();
  mouseDownFire = false;
});

canvas.addEventListener('mousedown', (e) => {
  ensureAudio();
  if (scrubbing) exitScrubMode();
  if (document.pointerLockElement !== canvas && canvas.requestPointerLock) {
    canvas.requestPointerLock();
  } else if (e.button === 0) {
    fireQueued = 1;
    mouseDownFire = true;
  }
});

window.addEventListener('mouseup', () => {
  mouseDownFire = false;
});

document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas) {
    mouseTurnAccum += e.movementX * 0.45;
  }
});

document.addEventListener('pointerlockchange', () => {
  if (!scrubbing) {
    ttStatus.textContent = document.pointerLockElement === canvas
      ? 'Mouse-Look Active (ESC to release cursor)'
      : 'Live Combat (Click 3D view for Mouse-Look)';
  }
});

function exitScrubMode() {
  scrubbing = false;
  rewindSlider.value = '0';
  rewindSlider.setAttribute('aria-valuetext', 'Live combat frame');
  ttStatus.textContent = document.pointerLockElement === canvas
    ? 'Mouse-Look Active (ESC to release cursor)'
    : 'Live Combat (Click 3D view for Mouse-Look)';
  btnResume.hidden = true;
  syncSliderVars();
}

async function boot() {
  const resp = await fetch('./slipgate.wasm');
  const buf = await resp.arrayBuffer();
  wasmBadge.textContent = `Wasm: ${(buf.byteLength / 1024).toFixed(2)} KB (Zero rustc)`;

  const { instance } = await WebAssembly.instantiate(buf, {});
  const ex = instance.exports;
  const fbOffset = ex.init_game(1996);
  const pixelView = new Uint8ClampedArray(ex.memory.buffer, fbOffset, WIDTH * HEIGHT * 4);
  const imageData = new ImageData(pixelView, WIDTH, HEIGHT);

  function blitAndSyncHud() {
    ctx.putImageData(imageData, 0, 0);
    const hp = ex.get_health();
    const arm = ex.get_armor();
    const ammo = ex.get_ammo();
    const kills = ex.get_kills();
    const score = ex.get_score();
    const state = ex.get_state();

    statHp.textContent = String(hp);
    statArmor.textContent = String(arm);
    statAmmo.textContent = String(ammo);
    statKills.textContent = `${kills} / 8`;

    if (state === 1) {
      overlayBanner.hidden = false;
      overlayTitle.textContent = 'SLIPGATE COMPLEX CLEARED!';
      overlaySub.textContent = `Kills: ${kills}/8 • Score: ${score} • Click Restart or Rewind`;
    } else if (state === 2) {
      overlayBanner.hidden = false;
      overlayTitle.textContent = 'YOU FELL IN THE CITADEL';
      overlaySub.textContent = 'Drag the Time-Travel Slider below to rewind before death, or Restart!';
    } else {
      overlayBanner.hidden = true;
    }

    const snapCount = Math.max(1, ex.get_snap_count());
    rewindSlider.max = String(Math.max(1, snapCount - 1));
    syncSliderVars();
  }

  btnSound.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    btnSound.setAttribute('aria-pressed', String(soundEnabled));
    btnSound.textContent = soundEnabled ? 'Sound: ON' : 'Sound: OFF';
    if (soundEnabled) ensureAudio();
  });

  btnReset.addEventListener('click', () => {
    ensureAudio();
    exitScrubMode();
    const seed = (Date.now() & 0x7fffffff) || 1996;
    ex.init_game(seed);
    blitAndSyncHud();
  });

  rewindSlider.addEventListener('input', () => {
    const back = Number(rewindSlider.value);
    syncSliderVars();
    if (back === 0) {
      exitScrubMode();
      return;
    }
    scrubbing = true;
    btnResume.hidden = false;
    ex.rewind_combat(back);
    const rewoundTick = ex.get_tick();
    const label = `Rewound ${back} combat snapshots to tick #${rewoundTick}`;
    ttStatus.textContent = label;
    rewindSlider.setAttribute('aria-valuetext', label);
    blitAndSyncHud();
  });

  btnResume.addEventListener('click', () => {
    exitScrubMode();
  });

  blitAndSyncHud();

  let frames = 0;
  let fpsTimer = performance.now();

  function frame(now) {
    if (!scrubbing) {
      const pointerLocked = document.pointerLockElement === canvas;
      const fwd = (keys.has('KeyW') || keys.has('ArrowUp') || keys.has('Numpad8') ? 1 : 0)
                - (keys.has('KeyS') || keys.has('ArrowDown') || keys.has('Numpad2') ? 1 : 0);
      const arrowLeft = keys.has('ArrowLeft') || keys.has('Numpad4') ? 1 : 0;
      const arrowRight = keys.has('ArrowRight') || keys.has('Numpad6') ? 1 : 0;

      // When Mouse-Look is active, ArrowLeft/ArrowRight strafe alongside A/D; otherwise they turn camera!
      const strafe = (keys.has('KeyD') || (pointerLocked && arrowRight) ? 1 : 0)
                   - (keys.has('KeyA') || (pointerLocked && arrowLeft) ? 1 : 0);
      const keyTurn = (((!pointerLocked && arrowRight) || keys.has('KeyE') ? 1 : 0)
                    - ((!pointerLocked && arrowLeft) || keys.has('KeyQ') ? 1 : 0)) * 12;
      const mouseTurn = Math.trunc(mouseTurnAccum);
      mouseTurnAccum -= mouseTurn;

      const shoot = fireQueued || mouseDownFire || keys.has('Space') ? 1 : 0;
      fireQueued = 0;

      ex.step_fps(fwd, strafe, keyTurn + mouseTurn, shoot);
      const sfxMask = ex.pop_sfx();
      if (sfxMask > 0) playSlipgateSfx(sfxMask);
      blitAndSyncHud();
    }

    frames++;
    if (now - fpsTimer >= 500) {
      statFps.textContent = String(Math.round((frames * 1000) / (now - fpsTimer)));
      frames = 0;
      fpsTimer = now;
    }
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

boot();

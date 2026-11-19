const canvas = document.getElementById('fps-canvas');
const viewportBox = document.getElementById('viewport-box');
const statHp = document.getElementById('stat-hp');
const statArmor = document.getElementById('stat-armor');
const statAmmo = document.getElementById('stat-ammo');
const statKills = document.getElementById('stat-kills');
const statFps = document.getElementById('stat-fps');
const qHp = document.getElementById('q-hp');
const qArm = document.getElementById('q-arm');
const qAmmo = document.getElementById('q-ammo');
const wasmBadge = document.getElementById('wasm-size-badge');
const overlayBanner = document.getElementById('overlay-banner');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub = document.getElementById('overlay-sub');
const rewindSlider = document.getElementById('rewind-slider');
const ttStatus = document.getElementById('tt-status');
const btnSound = document.getElementById('btn-sound');
const btnFullscreen = document.getElementById('btn-fullscreen');
const btnReset = document.getElementById('btn-reset');
const btnResume = document.getElementById('btn-resume');

// ============================================================================
// GLSL ES 3.00 SHADERS (Procedural Storm Sky + Bump-Mapped Multi-Light 3D)
// ============================================================================

const SKY_VS = `#version 300 es
precision highp float;
out vec2 v_ndc;
void main() {
  vec2 pos[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
  v_ndc = pos[gl_VertexID];
  gl_Position = vec4(v_ndc, 0.9999, 1.0);
}`;

const SKY_FS = `#version 300 es
precision highp float;
in vec2 v_ndc;
uniform vec3 u_camFwd;
uniform vec3 u_camRight;
uniform vec3 u_camUp;
uniform float u_aspect;
uniform float u_tanHalfFov;
uniform float u_time;
uniform vec3 u_tintOverlay;
out vec4 fragColor;

float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x),
    mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbmSky(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise2(p);
    p *= 2.07;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 dir = normalize(
    u_camFwd
    + v_ndc.x * u_aspect * u_tanHalfFov * u_camRight
    + v_ndc.y * u_tanHalfFov * u_camUp
  );

  float up = clamp(dir.y, 0.0, 1.0);
  // Dramatic Crimson-Coral Canyon Sky blending into Dark Violet-Charcoal Quake Storm Clouds!
  vec2 uv = dir.xz / (abs(dir.y) + 0.22);
  float c1 = fbmSky(uv * 1.4 + vec2(u_time * 0.08, u_time * 0.05));
  float c2 = fbmSky(uv * 2.9 - vec2(u_time * 0.13, u_time * 0.09));
  float clouds = clamp(c1 * 0.65 + c2 * 0.45, 0.0, 1.0);

  vec3 sunsetGlow = vec3(0.96, 0.37, 0.31);
  vec3 crimsonMid = vec3(0.76, 0.24, 0.28);
  vec3 stormDark  = vec3(0.11, 0.07, 0.12);
  vec3 violetRift = vec3(0.46, 0.20, 0.36);

  vec3 baseSky = mix(sunsetGlow, crimsonMid, smoothstep(0.0, 0.55, up));
  vec3 cloudCol = mix(stormDark, violetRift, clouds);
  // Let crimson sky blaze brightly near canyon openings while dark storm clouds roll overhead!
  float cloudMask = smoothstep(0.32, 0.82, clouds) * smoothstep(0.04, 0.55, up);
  vec3 col = mix(baseSky, cloudCol, cloudMask * 0.82);

  // Subtle warm sun halo on the upper-right canyon rim casting golden beams onto the left masonry!
  vec3 sunDir = normalize(vec3(0.56, 0.64, 0.52));
  float sunDot = max(dot(dir, sunDir), 0.0);
  col += vec3(1.0, 0.72, 0.45) * pow(sunDot, 12.0) * 0.35;

  col = mix(col, u_tintOverlay, length(u_tintOverlay) * 0.28);
  fragColor = vec4(col, 1.0);
}`;

const WORLD_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_pos;
layout(location = 1) in vec4 a_norm;
layout(location = 2) in vec2 a_uv;
layout(location = 3) in int a_texFlags;
layout(location = 4) in vec4 a_colAo;

uniform mat4 u_mvp;
uniform bool u_isViewmodel;
uniform vec3 u_camPos;
uniform vec3 u_camRight;
uniform vec3 u_camUp;
uniform vec3 u_camFwd;

out vec3 v_worldPos;
out vec3 v_geomN;
out vec2 v_uv;
flat out int v_texFlags;
out vec4 v_colAo;

void main() {
  vec3 posMeters = a_pos * 0.001;
  vec3 nLocal = normalize(a_norm.xyz - 128.0);

  if (u_isViewmodel) {
    // Transform view-space Super-Shotgun into world-space for real-time torch & sun lighting!
    v_worldPos = u_camPos
               + u_camRight * posMeters.x
               + u_camUp * posMeters.y
               - u_camFwd * posMeters.z;
    v_geomN = normalize(
      u_camRight * nLocal.x + u_camUp * nLocal.y - u_camFwd * nLocal.z
    );
    gl_Position = u_mvp * vec4(posMeters, 1.0);
  } else {
    v_worldPos = posMeters;
    v_geomN = nLocal;
    gl_Position = u_mvp * vec4(posMeters, 1.0);
  }

  v_uv = a_uv / 1024.0;
  v_texFlags = a_texFlags;
  v_colAo = a_colAo;
}`;

const WORLD_FS = `#version 300 es
precision highp float;
precision highp sampler2DArray;

in vec3 v_worldPos;
in vec3 v_geomN;
in vec2 v_uv;
flat in int v_texFlags;
in vec4 v_colAo;

uniform sampler2DArray u_texArray;
uniform vec3 u_camPos;
uniform float u_time;
uniform bool u_isViewmodel;
uniform int u_lightCount;
uniform vec4 u_lightPosRad[24];
uniform vec3 u_lightColor[24];
uniform vec3 u_tintOverlay;

out vec4 fragColor;

void main() {
  int layer = v_texFlags & 7;
  bool emissive = (v_texFlags & 16) != 0;
  bool useSmooth = (v_texFlags & 32) != 0;

  vec2 uv = v_uv;
  if (layer == 5) {
    // Boiling radioactive green slime flow
    uv += vec2(sin(uv.y * 6.283 + u_time * 1.8) * 0.04, u_time * 0.14);
  }

  // Procedural Swirling Elder Exit Slipgate Portal at North Sanctum (z < -47.0m)
  if (emissive && layer == 7 && !u_isViewmodel && v_worldPos.z < -47.0) {
    vec2 p = fract(uv) * 2.0 - 1.0;
    float r = length(p);
    float a = atan(p.y, p.x);
    float swirl = sin(r * 14.0 - u_time * 3.2 + a * 3.0);
    float runeRing = smoothstep(0.14, 0.02, abs(r - 0.62)) + smoothstep(0.10, 0.01, abs(r - 0.34));
    vec3 portalCol = mix(vec3(0.38, 0.12, 0.85), vec3(0.98, 0.76, 0.28), clamp(swirl * 0.5 + 0.5, 0.0, 1.0));
    portalCol += vec3(1.0, 0.88, 0.45) * runeRing * 0.85;
    fragColor = vec4(portalCol, 1.0);
    return;
  }

  vec4 texSample = texture(u_texArray, vec3(uv, float(layer)));
  vec3 albedo = pow(texSample.rgb * v_colAo.rgb, vec3(2.1)); // Linearize sRGB for rich contrast!
  float ao = v_colAo.a;

  if (emissive) {
    vec3 glow = pow(albedo, vec3(0.48)) * 1.35;
    fragColor = vec4(glow, 1.0);
    return;
  }

  // Screen-space derivative tangent frame + Smooth Radial / Heightmap Bump Normals!
  vec3 dPdx = dFdx(v_worldPos);
  vec3 dPdy = dFdy(v_worldPos);
  vec3 faceN = normalize(cross(dPdx, dPdy));
  vec3 V = normalize(u_camPos - v_worldPos);
  if (dot(faceN, V) < 0.0) {
    faceN = -faceN;
  }
  vec3 baseN = useSmooth ? normalize(v_geomN) : faceN;
  if (dot(baseN, V) < 0.0 && !useSmooth) {
    baseN = -baseN;
  }

  float hC = texSample.a;
  float hU = texture(u_texArray, vec3(uv + vec2(1.0 / 256.0, 0.0), float(layer))).a;
  float hV = texture(u_texArray, vec3(uv + vec2(0.0, 1.0 / 256.0), float(layer))).a;

  vec2 dUVdx = dFdx(uv);
  vec2 dUVdy = dFdy(uv);
  vec3 r1 = cross(dPdy, baseN);
  vec3 r2 = cross(baseN, dPdx);
  float det = dot(dPdx, r1);
  float bumpGain = (layer == 0 || layer == 1) ? 4.6 : 3.4;
  float dHdu = (hU - hC) * bumpGain;
  float dHdv = (hV - hC) * bumpGain;
  float dHdx = dHdu * dUVdx.x + dHdv * dUVdx.y;
  float dHdy = dHdu * dUVdy.x + dHdv * dUVdy.y;
  vec3 surfGrad = sign(det) * (dHdx * r1 + dHdy * r2);
  vec3 N = normalize(max(abs(det), 1e-6) * baseN - surfGrad * 0.24);

  // 1. Directional Canyon Sunlight + Analytical Slatted-Bridge Sunbeam Shadows!
  vec3 sunDir = normalize(vec3(-0.52, 0.66, 0.54));
  // note: sun shines from upper-right-south (+X/-X? Wait: if sunDir points TOWARD the light source,
  // to illuminate the LEFT wall (-X, whose normal points +X), sunDir.x MUST be POSITIVE (+0.56)!)
  sunDir = normalize(vec3(0.56, 0.64, 0.52));
  float sunNdotL = max(dot(N, sunDir), 0.0);

  // Cast crisp real-time slatted wooden plank & beam shadows onto Canyon wall and floor!
  float bridgeShadow = 1.0;
  if (!u_isViewmodel && v_worldPos.y < 3.26 && v_worldPos.z > -17.5) {
    float tPlank = (3.34 - v_worldPos.y) / sunDir.y;
    vec3 hitP = v_worldPos + sunDir * tPlank;
    if (hitP.z >= -5.82 && hitP.z <= -1.78 && hitP.x >= -5.10 && hitP.x <= 3.10) {
      float localPlank = mod(hitP.x + 5.05, 0.58);
      bool hitBoard = localPlank < 0.39;
      bool hitStringer = abs(hitP.z + 5.54) < 0.12 || abs(hitP.z + 2.06) < 0.12;
      if (hitBoard || hitStringer) {
        bridgeShadow = 0.26;
      }
    }
  }

  // Outdoor canyon (z > -18.2m) gets warm golden-crimson sky light; indoor halls get moody gothic shadow
  float outdoor = smoothstep(-21.0, -15.5, v_worldPos.z);
  vec3 skyAmb = mix(vec3(0.055, 0.048, 0.068), vec3(0.19, 0.135, 0.145), outdoor) * (0.62 + 0.38 * N.y);
  vec3 totalLight = skyAmb * ao
    + vec3(1.32, 0.96, 0.66) * sunNdotL * bridgeShadow * (0.24 + 0.76 * outdoor) * ao;

  float metallic = (layer == 7 || (layer == 6 && uv.y > 0.5)) ? 0.78 : 0.14;
  vec3 totalSpec = vec3(0.0);
  if (sunNdotL > 0.0) {
    vec3 Hsun = normalize(sunDir + V);
    totalSpec += vec3(1.0, 0.86, 0.68) * pow(max(dot(N, Hsun), 0.0), 32.0) * metallic * bridgeShadow * outdoor * 0.55;
  }

  // 2. Dynamic Point Lights (Flickering Torches, Acid Trench, Elder Portal & Shotgun Muzzle Blast!)
  for (int i = 0; i < 24; i++) {
    if (i >= u_lightCount) break;
    vec3 lPos = u_lightPosRad[i].xyz;
    float lRad = u_lightPosRad[i].w;
    vec3 toL = lPos - v_worldPos;
    float dist = length(toL);
    if (dist < lRad && dist > 0.001) {
      vec3 L = toL / dist;
      float atten = 1.0 - (dist / lRad);
      atten = atten * atten;
      float ndl = max(dot(N, L), 0.0);
      totalLight += u_lightColor[i] * ndl * atten * 1.45;

      vec3 H = normalize(L + V);
      float specPow = u_isViewmodel ? 36.0 : 22.0;
      totalSpec += u_lightColor[i] * pow(max(dot(N, H), 0.0), specPow) * atten * metallic;
    }
  }

  vec3 lit = albedo * totalLight + totalSpec;

  // 3. Atmospheric Quake Canyon/Citadel Depth Fog
  if (!u_isViewmodel) {
    float camDist = length(u_camPos - v_worldPos);
    float fogFactor = clamp(1.0 - exp(-camDist * 0.026), 0.0, 0.88);
    vec3 fogCol = mix(vec3(0.05, 0.032, 0.042), vec3(0.24, 0.085, 0.08), outdoor * 0.65);
    lit = mix(lit, fogCol, fogFactor);
  }

  // Gamma 2.1 output + Hurt/Pickup screen tint
  vec3 gammaOut = pow(max(lit, vec3(0.0)), vec3(1.0 / 2.1));
  gammaOut = mix(gammaOut, u_tintOverlay, length(u_tintOverlay) * 0.30);
  fragColor = vec4(gammaOut, 1.0);
}`;

// ============================================================================
// MATRIX HELPERS (Column-Major Float32Array(16))
// ============================================================================

function mat4Perspective(fovRad, aspect, near, far) {
  const f = 1.0 / Math.tan(fovRad * 0.5);
  const nf = 1.0 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

function mat4ViewFromBasis(eye, right, up, fwd) {
  // Camera looks along `fwd`; OpenGL view space looks along `-Z`, so `back = -fwd`
  const bx = -fwd[0], by = -fwd[1], bz = -fwd[2];
  return new Float32Array([
    right[0], up[0], bx, 0,
    right[1], up[1], by, 0,
    right[2], up[2], bz, 0,
    -(right[0] * eye[0] + right[1] * eye[1] + right[2] * eye[2]),
    -(up[0] * eye[0] + up[1] * eye[1] + up[2] * eye[2]),
    -(bx * eye[0] + by * eye[1] + bz * eye[2]),
    1,
  ]);
}

function mat4Mul(a, b) {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      out[col * 4 + row] =
        a[0 * 4 + row] * b[col * 4 + 0] +
        a[1 * 4 + row] * b[col * 4 + 1] +
        a[2 * 4 + row] * b[col * 4 + 2] +
        a[3 * 4 + row] * b[col * 4 + 3];
    }
  }
  return out;
}

function compileProgram(gl, vsSrc, fsSrc) {
  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, vsSrc);
  gl.compileShader(vs);
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
    throw new Error(`VS compile error: ${gl.getShaderInfoLog(vs)}`);
  }
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, fsSrc);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    throw new Error(`FS compile error: ${gl.getShaderInfoLog(fs)}`);
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(prog)}`);
  }
  return prog;
}

function setupVertexAttributes(gl, vbo) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  // Stride = 32 bytes (8 x Int32 words from Axiom.Strata!)
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.INT, false, 32, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, false, 32, 12);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.INT, false, 32, 16);
  gl.enableVertexAttribArray(3);
  gl.vertexAttribIPointer(3, 1, gl.INT, 32, 24);
  gl.enableVertexAttribArray(4);
  gl.vertexAttribPointer(4, 4, gl.UNSIGNED_BYTE, true, 32, 28);
  gl.bindVertexArray(null);
  return vao;
}

// ============================================================================
// PROCEDURAL 1996 INDUSTRIAL WEB AUDIO SYNTHESIZER
// ============================================================================

const keys = new Set();
let mouseYawAccum = 0;
let mousePitchAccum = 0;
let fireQueued = 0;
let jumpQueued = 0;
let restartQueued = false;
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
      noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.5, audioCtx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
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

  if (mask & 1) {
    playNoiseBurst(ac, now, 0.28, 'lowpass', 1950, 130, 0.42);
    const punch = ac.createOscillator();
    const pg = ac.createGain();
    punch.type = 'sawtooth';
    punch.frequency.setValueAtTime(122, now);
    punch.frequency.exponentialRampToValueAtTime(26, now + 0.21);
    pg.gain.setValueAtTime(0.34, now);
    pg.gain.exponentialRampToValueAtTime(0.001, now + 0.23);
    punch.connect(pg).connect(ac.destination);
    punch.start(now);
    punch.stop(now + 0.24);
    playNoiseBurst(ac, now + 0.19, 0.045, 'bandpass', 2400, 1600, 0.12);
    playNoiseBurst(ac, now + 0.26, 0.05, 'bandpass', 2900, 2100, 0.14);
  }
  if (mask & 2) playNoiseBurst(ac, now + 0.02, 0.09, 'bandpass', 720, 240, 0.22);
  if (mask & 4) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.42);
    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.44);
    osc.connect(g).connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  }
  if (mask & 8) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(135, now + 0.11);
    g.gain.setValueAtTime(0.09, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(g).connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }
  if (mask & 16) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(132, now);
    osc.frequency.linearRampToValueAtTime(72, now + 0.15);
    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    osc.connect(g).connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }
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
  if (mask & 64) playNoiseBurst(ac, now, 0.04, 'bandpass', 380, 160, 0.065);
  if (mask & 128) {
    [220, 329.63, 440, 659.25, 880].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      const t = now + i * 0.07;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.45);
      g.gain.setValueAtTime(0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.connect(g).connect(ac.destination);
      osc.start(t);
      osc.stop(t + 0.52);
    });
  }
}

// ============================================================================
// INPUT & SLIDER CONTROLS
// ============================================================================

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
  if (toks.includes('KeyR')) {
    e.preventDefault();
    restartQueued = true;
    return;
  }
  if (toks.includes('Space') || toks.includes('ShiftLeft') || toks.includes('ShiftRight')) {
    jumpQueued = 1;
  }
  if (toks.includes('ControlLeft') || toks.includes('ControlRight') || toks.includes('KeyF')) {
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

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

canvas.addEventListener('mousedown', (e) => {
  ensureAudio();
  if (scrubbing) exitScrubMode();
  if (document.pointerLockElement !== canvas && canvas.requestPointerLock) {
    canvas.requestPointerLock();
  } else if (e.button === 0) {
    fireQueued = 1;
    mouseDownFire = true;
  } else if (e.button === 2) {
    jumpQueued = 1;
  }
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouseDownFire = false;
});

document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas) {
    mouseYawAccum += e.movementX * 1.65;
    mousePitchAccum -= e.movementY * 1.35;
  }
});

document.addEventListener('pointerlockchange', () => {
  if (!scrubbing) {
    ttStatus.textContent = document.pointerLockElement === canvas
      ? '3D Mouse-Look Active (Move Mouse Up/Down/360° • ESC unlocks)'
      : 'Click 3D Viewport for Full 360° + Up/Down Mouse-Look';
  }
});

btnFullscreen.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    viewportBox.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
});

function exitScrubMode() {
  scrubbing = false;
  rewindSlider.value = '0';
  rewindSlider.setAttribute('aria-valuetext', 'Live combat frame');
  ttStatus.textContent = document.pointerLockElement === canvas
    ? '3D Mouse-Look Active (Move Mouse Up/Down/360° • ESC unlocks)'
    : 'Click 3D Viewport for Full 360° + Up/Down Mouse-Look';
  btnResume.hidden = true;
  syncSliderVars();
}

// ============================================================================
// BOOT AXIOM.STRATA + WEBGL2 HARDWARE 3D ENGINE
// ============================================================================

async function boot() {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, depth: true });
  if (!gl) {
    overlayBanner.hidden = false;
    overlayTitle.textContent = 'WebGL2 Required';
    overlaySub.textContent = 'Enable hardware acceleration / WebGL2 in your browser settings.';
    return;
  }

  const resp = await fetch('./slipgate.wasm');
  const buf = await resp.arrayBuffer();
  wasmBadge.textContent = `Wasm: ${(buf.byteLength / 1024).toFixed(2)} KB (Zero rustc)`;

  const { instance } = await WebAssembly.instantiate(buf, {});
  const ex = instance.exports;
  ex.init_game(1996);
  const urlScene = new URLSearchParams(window.location.search).get('scene');
  if (urlScene === 'hall' && ex.set_camera_pose) {
    ex.set_camera_pose(-1900, 3480, -19600, 95, 55);
  }

  // Compile Sky & Bump-Mapped World Shaders
  const skyProg = compileProgram(gl, SKY_VS, SKY_FS);
  const worldProg = compileProgram(gl, WORLD_VS, WORLD_FS);
  const emptyVao = gl.createVertexArray();

  // Upload 8 Procedural 256x256 Albedo+Heightmap Textures from Axiom.Strata Linear Memory!
  const texArray = gl.createTexture();
  function uploadStrataTextures() {
    const texBytes = new Uint8Array(ex.memory.buffer, ex.get_tex_byte_offset(), 8 * 256 * 256 * 4);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, texArray);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, 256, 256, 8, 0, gl.RGBA, gl.UNSIGNED_BYTE, texBytes);
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    if (aniso) {
      const maxAniso = gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
      gl.texParameterf(gl.TEXTURE_2D_ARRAY, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, maxAniso));
    }
  }
  uploadStrataTextures();

  // Create Static World VBO, Dynamic Entities VBO, and 3D Super-Shotgun Viewmodel VBO
  const staticVbo = gl.createBuffer();
  const dynVbo = gl.createBuffer();
  const gunVbo = gl.createBuffer();

  const staticVao = setupVertexAttributes(gl, staticVbo);
  const dynVao = setupVertexAttributes(gl, dynVbo);
  const gunVao = setupVertexAttributes(gl, gunVbo);

  function uploadStaticWorldVbo() {
    const vCnt = ex.get_static_vert_count();
    const view = new Int32Array(ex.memory.buffer, ex.get_static_vbo_byte_offset(), vCnt * 8);
    gl.bindBuffer(gl.ARRAY_BUFFER, staticVbo);
    gl.bufferData(gl.ARRAY_BUFFER, view, gl.STATIC_DRAW);
  }
  uploadStaticWorldVbo();

  // Cache uniform locations
  const skyLoc = {
    camFwd: gl.getUniformLocation(skyProg, 'u_camFwd'),
    camRight: gl.getUniformLocation(skyProg, 'u_camRight'),
    camUp: gl.getUniformLocation(skyProg, 'u_camUp'),
    aspect: gl.getUniformLocation(skyProg, 'u_aspect'),
    tanHalfFov: gl.getUniformLocation(skyProg, 'u_tanHalfFov'),
    time: gl.getUniformLocation(skyProg, 'u_time'),
    tintOverlay: gl.getUniformLocation(skyProg, 'u_tintOverlay'),
  };

  const wLoc = {
    mvp: gl.getUniformLocation(worldProg, 'u_mvp'),
    isViewmodel: gl.getUniformLocation(worldProg, 'u_isViewmodel'),
    camPos: gl.getUniformLocation(worldProg, 'u_camPos'),
    camRight: gl.getUniformLocation(worldProg, 'u_camRight'),
    camUp: gl.getUniformLocation(worldProg, 'u_camUp'),
    camFwd: gl.getUniformLocation(worldProg, 'u_camFwd'),
    texArray: gl.getUniformLocation(worldProg, 'u_texArray'),
    time: gl.getUniformLocation(worldProg, 'u_time'),
    lightCount: gl.getUniformLocation(worldProg, 'u_lightCount'),
    lightPosRad: gl.getUniformLocation(worldProg, 'u_lightPosRad'),
    lightColor: gl.getUniformLocation(worldProg, 'u_lightColor'),
    tintOverlay: gl.getUniformLocation(worldProg, 'u_tintOverlay'),
  };

  const lightPosRadFlat = new Float32Array(24 * 4);
  const lightColorFlat = new Float32Array(24 * 3);

  function resizeCanvasToDisplay() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(640, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(360, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function renderGpuScene() {
    resizeCanvasToDisplay();
    const W = canvas.width;
    const H = canvas.height;
    const aspect = W / H;
    const fovRad = (74 * Math.PI) / 180;
    const tanHalfFov = Math.tan(fovRad * 0.5);
    const timeSec = ex.get_tick() / 60.0;

    // Camera pose from Axiom.Strata
    const eye = [ex.get_cam_x() * 0.001, ex.get_cam_y() * 0.001, ex.get_cam_z() * 0.001];
    const yawRad = (ex.get_cam_yaw() * 2.0 * Math.PI) / 4096.0;
    const pitchRad = (ex.get_cam_pitch() * 0.5 * Math.PI) / 1024.0;

    const cp = Math.cos(pitchRad), sp = Math.sin(pitchRad);
    const sy = Math.sin(yawRad), cy = Math.cos(yawRad);

    const fwd = [sy * cp, sp, -cy * cp];
    const right = [cy, 0, sy];
    const up = [-sy * sp, cp, cy * sp];

    const hurt = ex.get_hurt();
    const pickup = ex.get_pickup();
    const tint = hurt > 0
      ? [0.95, 0.08, 0.08]
      : pickup > 0
        ? [0.92, 0.78, 0.22]
        : [0.0, 0.0, 0.0];

    gl.viewport(0, 0, W, H);
    gl.clear(gl.DEPTH_BUFFER_BIT);

    // 1. Render Sky Dome Pass
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(skyProg);
    gl.uniform3fv(skyLoc.camFwd, fwd);
    gl.uniform3fv(skyLoc.camRight, right);
    gl.uniform3fv(skyLoc.camUp, up);
    gl.uniform1f(skyLoc.aspect, aspect);
    gl.uniform1f(skyLoc.tanHalfFov, tanHalfFov);
    gl.uniform1f(skyLoc.time, timeSec);
    gl.uniform3fv(skyLoc.tintOverlay, tint);
    gl.bindVertexArray(emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 2. Pack Dynamic Point Lights from Axiom.Strata + Live Shotgun Muzzle Flash!
    const baseLights = Math.min(22, ex.get_light_count());
    const lMem = new Int32Array(ex.memory.buffer, ex.get_lights_byte_offset(), baseLights * 8);
    let totalLights = 0;
    for (let i = 0; i < baseLights; i++) {
      const b = i * 8;
      const flick = lMem[b + 7] === 1
        ? 0.86 + 0.14 * Math.sin(timeSec * 14.0 + i * 2.3) * Math.cos(timeSec * 23.0 + i)
        : 1.0;
      lightPosRadFlat[totalLights * 4 + 0] = lMem[b + 0] * 0.001;
      lightPosRadFlat[totalLights * 4 + 1] = lMem[b + 1] * 0.001;
      lightPosRadFlat[totalLights * 4 + 2] = lMem[b + 2] * 0.001;
      lightPosRadFlat[totalLights * 4 + 3] = lMem[b + 3] * 0.001;
      lightColorFlat[totalLights * 3 + 0] = (lMem[b + 4] / 255.0) * flick;
      lightColorFlat[totalLights * 3 + 1] = (lMem[b + 5] / 255.0) * flick;
      lightColorFlat[totalLights * 3 + 2] = (lMem[b + 6] / 255.0) * flick;
      totalLights++;
    }

    const muzzle = ex.get_muzzle();
    if (muzzle > 0 && totalLights < 24) {
      lightPosRadFlat[totalLights * 4 + 0] = eye[0] + fwd[0] * 0.8;
      lightPosRadFlat[totalLights * 4 + 1] = eye[1] + fwd[1] * 0.8;
      lightPosRadFlat[totalLights * 4 + 2] = eye[2] + fwd[2] * 0.8;
      lightPosRadFlat[totalLights * 4 + 3] = 11.5;
      const mStr = muzzle / 7.0;
      lightColorFlat[totalLights * 3 + 0] = 2.2 * mStr;
      lightColorFlat[totalLights * 3 + 1] = 1.35 * mStr;
      lightColorFlat[totalLights * 3 + 2] = 0.45 * mStr;
      totalLights++;
    }

    // 3. Render Bump-Mapped 3D World + Dynamic 3D Monsters/Items/Particles
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.useProgram(worldProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, texArray);
    gl.uniform1i(wLoc.texArray, 0);
    gl.uniform3fv(wLoc.camPos, eye);
    gl.uniform3fv(wLoc.camRight, right);
    gl.uniform3fv(wLoc.camUp, up);
    gl.uniform3fv(wLoc.camFwd, fwd);
    gl.uniform1f(wLoc.time, timeSec);
    gl.uniform1i(wLoc.lightCount, totalLights);
    gl.uniform4fv(wLoc.lightPosRad, lightPosRadFlat);
    gl.uniform3fv(wLoc.lightColor, lightColorFlat);
    gl.uniform3fv(wLoc.tintOverlay, tint);

    const proj = mat4Perspective(fovRad, aspect, 0.12, 95.0);
    const view = mat4ViewFromBasis(eye, right, up, fwd);
    const mvp = mat4Mul(proj, view);
    gl.uniformMatrix4fv(wLoc.mvp, false, mvp);
    gl.uniform1i(wLoc.isViewmodel, 0);

    const staticCnt = ex.get_static_vert_count();
    gl.bindVertexArray(staticVao);
    gl.drawArrays(gl.TRIANGLES, 0, staticCnt);

    const dynCnt = ex.get_dyn_vert_count();
    if (dynCnt > 0) {
      const dynView = new Int32Array(ex.memory.buffer, ex.get_dyn_vbo_byte_offset(), dynCnt * 8);
      gl.bindBuffer(gl.ARRAY_BUFFER, dynVbo);
      gl.bufferData(gl.ARRAY_BUFFER, dynView, gl.STREAM_DRAW);
      gl.bindVertexArray(dynVao);
      gl.drawArrays(gl.TRIANGLES, 0, dynCnt);
    }

    // 4. Depth-Cleared Pass for 3D Twin-Barrel Super-Shotgun Viewmodel!
    const gunCnt = ex.get_gun_vert_count();
    if (gunCnt > 0) {
      gl.clear(gl.DEPTH_BUFFER_BIT);
      const gunProj = mat4Perspective((62 * Math.PI) / 180, aspect, 0.05, 6.0);
      gl.uniformMatrix4fv(wLoc.mvp, false, gunProj);
      gl.uniform1i(wLoc.isViewmodel, 1);

      const gunView = new Int32Array(ex.memory.buffer, ex.get_gun_vbo_byte_offset(), gunCnt * 8);
      gl.bindBuffer(gl.ARRAY_BUFFER, gunVbo);
      gl.bufferData(gl.ARRAY_BUFFER, gunView, gl.STREAM_DRAW);
      gl.bindVertexArray(gunVao);
      gl.drawArrays(gl.TRIANGLES, 0, gunCnt);
    }

    // Sync HUD telemetry
    const hp = ex.get_health();
    const arm = ex.get_armor();
    const ammo = ex.get_ammo();
    const kills = ex.get_kills();
    const score = ex.get_score();
    const state = ex.get_state();

    statHp.textContent = String(hp);
    statArmor.textContent = String(arm);
    statAmmo.textContent = String(ammo);
    statKills.textContent = `${kills} / 10`;
    qHp.textContent = String(hp);
    qArm.textContent = String(arm);
    qAmmo.textContent = String(ammo);

    if (state === 1) {
      overlayBanner.hidden = false;
      overlayTitle.textContent = 'ELDER SLIPGATE REACHED — CITADEL CONQUERED!';
      overlaySub.textContent = `Monsters Slain: ${kills}/10 • Score: ${score} • Press [R] to Restart Instantly`;
    } else if (state === 2) {
      overlayBanner.hidden = false;
      overlayTitle.textContent = 'YOU FELL IN THE CITADEL';
      overlaySub.textContent = 'Press [R] to Restart Instantly (no Esc needed) — or drag Time-Travel Slider below!';
    } else {
      overlayBanner.hidden = true;
    }

    const snapCount = Math.max(1, ex.get_snap_count());
    rewindSlider.max = String(Math.max(1, snapCount - 1));
    syncSliderVars();
  }

  function resetLevelNow() {
    ensureAudio();
    exitScrubMode();
    restartQueued = false;
    fireQueued = 0;
    jumpQueued = 0;
    const seed = (Date.now() & 0x7fffffff) || 1996;
    ex.init_game(seed);
    uploadStaticWorldVbo();
    renderGpuScene();
  }

  btnSound.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    btnSound.setAttribute('aria-pressed', String(soundEnabled));
    btnSound.textContent = soundEnabled ? 'Sound: ON' : 'Sound: OFF';
    if (soundEnabled) ensureAudio();
  });

  btnReset.addEventListener('click', () => {
    resetLevelNow();
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
    renderGpuScene();
  });

  btnResume.addEventListener('click', () => {
    exitScrubMode();
  });

  renderGpuScene();

  let frames = 0;
  let fpsTimer = performance.now();

  function frame(now) {
    if (restartQueued || (ex.get_state() !== 0 && keys.has('Enter'))) {
      resetLevelNow();
    } else if (!scrubbing) {
      const pointerLocked = document.pointerLockElement === canvas;
      const fwd = (keys.has('KeyW') || keys.has('ArrowUp') || keys.has('Numpad8') ? 1 : 0)
                - (keys.has('KeyS') || keys.has('ArrowDown') || keys.has('Numpad2') ? 1 : 0);
      const arrowLeft = keys.has('ArrowLeft') || keys.has('Numpad4') ? 1 : 0;
      const arrowRight = keys.has('ArrowRight') || keys.has('Numpad6') ? 1 : 0;

      const strafe = (keys.has('KeyD') || (pointerLocked && arrowRight) ? 1 : 0)
                   - (keys.has('KeyA') || (pointerLocked && arrowLeft) ? 1 : 0);
      const keyYaw = (((!pointerLocked && arrowRight) || keys.has('KeyE') ? 1 : 0)
                   - ((!pointerLocked && arrowLeft) || keys.has('KeyQ') ? 1 : 0)) * 34;
      const keyPitch = ((keys.has('PageUp') ? 1 : 0)
                     - (keys.has('PageDown') ? 1 : 0)) * 18;

      const mouseYaw = Math.trunc(mouseYawAccum);
      mouseYawAccum -= mouseYaw;
      const mousePitch = Math.trunc(mousePitchAccum);
      mousePitchAccum -= mousePitch;

      const jump = jumpQueued || keys.has('Space') || keys.has('ShiftLeft') || keys.has('ShiftRight') ? 1 : 0;
      jumpQueued = 0;
      const shoot = fireQueued || mouseDownFire || keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyF') ? 1 : 0;
      fireQueued = 0;

      ex.step_fps(fwd, strafe, keyYaw + mouseYaw, keyPitch + mousePitch, jump, shoot);
      const sfxMask = ex.pop_sfx();
      if (sfxMask > 0) playSlipgateSfx(sfxMask);
      renderGpuScene();
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

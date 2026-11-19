import fs from 'node:fs';
import assert from 'node:assert/strict';

const wasmBytes = fs.readFileSync(new URL('../web/slipgate.wasm', import.meta.url));
const { instance } = await WebAssembly.instantiate(wasmBytes, {});
const ex = instance.exports;

const WIDTH = 720;
const HEIGHT = 450;

const fbOffset = ex.init_game(1996);
assert.equal(fbOffset, 262144, 'Expected framebuffer byte offset 262144');
assert.equal(ex.get_health(), 100);
assert.equal(ex.get_armor(), 25);
assert.equal(ex.get_ammo(), 24);
assert.equal(ex.get_kills(), 0);

const u8 = new Uint8Array(ex.memory.buffer, fbOffset, WIDTH * HEIGHT * 4);
const colors = new Set();
for (let i = 0; i < u8.length; i += 32) {
  assert.equal(u8[i + 3], 255, 'Every pixel alpha must be 255');
  colors.add((u8[i] << 16) | (u8[i + 1] << 8) | u8[i + 2]);
}
assert(colors.size > 600, `Expected rich 3D textured Quake-palette scene (>600 RGB colors), got ${colors.size}`);

// Sprint forward down the East corridor toward Cyber-Grunt #0 at tile (9,4) and blast double-barrel shotgun!
const t0 = performance.now();
let shotgunBoomHeard = false;
let monsterHitOrKillHeard = false;
let ammoAt20 = -1;
let tickAt20 = -1;

for (let f = 1; f <= 80; f++) {
  const shoot = (f === 35 || f === 55) ? 1 : 0;
  ex.step_fps(1, 0, 0, shoot);
  const sfx = ex.pop_sfx();
  if (sfx & 1) shotgunBoomHeard = true;
  if (sfx & 6) monsterHitOrKillHeard = true;
  if (f === 20) {
    tickAt20 = ex.get_tick();
    ammoAt20 = ex.get_ammo();
  }
}
const avgFrameMs = (performance.now() - t0) / 80;

assert.equal(shotgunBoomHeard, true, 'Firing boomstick must emit SFX bit 0');
assert.equal(monsterHitOrKillHeard, true, 'Buckshot down corridor must hit/kill patrolling Cyber-Grunt');
assert(ex.get_kills() >= 1, `Expected >=1 Cyber-Grunt kill after 2 close-range blasts, got ${ex.get_kills()}`);

// Verify Time-Travel Combat Rewind back 15 snapshots (60 ticks -> tick 20!)
ex.rewind_combat(15);
assert.equal(ex.get_tick(), tickAt20, 'Combat Time-Travel must restore exact historical tick');
assert.equal(ex.get_ammo(), ammoAt20, 'Combat Time-Travel must restore pre-shot ammo');

console.log(JSON.stringify({
  status: 'PASS',
  wasmBytes: wasmBytes.length,
  wasmKB: +(wasmBytes.length / 1024).toFixed(2),
  distinctSampledColors: colors.size,
  snapshotsRecorded: ex.get_snap_count(),
  avgFrameMs: +avgFrameMs.toFixed(2),
  theoreticalMaxFps: Math.round(1000 / avgFrameMs),
}, null, 2));

import fs from 'node:fs';
import assert from 'node:assert/strict';

const wasmBytes = fs.readFileSync(new URL('../web/slipgate.wasm', import.meta.url));
const mod = await WebAssembly.compile(wasmBytes);

// 1. Verify Axiom Security Passport records `[CAP] Gpu` and `[CAP] Mem`
const passportSec = WebAssembly.Module.customSections(mod, 'axiom.passport');
assert.equal(passportSec.length, 1);
const passport = JSON.parse(new TextDecoder().decode(passportSec[0]));
const caps = passport.capabilities.map((c) => c.effect);
assert(caps.includes('Gpu') && caps.includes('Mem'), `Expected Gpu & Mem capabilities, got ${JSON.stringify(caps)}`);

const inst = await WebAssembly.instantiate(mod, {});
const ex = inst.exports;

// 2. Initialize 3D Citadel world & 8x 256x256 bump-mapped procedural textures
const texOff = ex.init_game(1996);
assert.equal(texOff, 262144);
assert.equal(ex.get_tex_byte_offset(), 262144);
assert.equal(ex.get_static_vbo_byte_offset(), 2400000);
assert.equal(ex.get_dyn_vbo_byte_offset(), 5600000);
assert.equal(ex.get_gun_vbo_byte_offset(), 7400000);

const staticVerts = ex.get_static_vert_count();
const dynVerts = ex.get_dyn_vert_count();
const gunVerts = ex.get_gun_vert_count();
const lights = ex.get_light_count();

assert(staticVerts > 1500 && staticVerts % 3 === 0, `Expected >1500 static 3D world vertices (divisible by 3), got ${staticVerts}`);
assert(dynVerts > 1200 && dynVerts % 3 === 0, `Expected >1200 dynamic 3D monster/item vertices, got ${dynVerts}`);
assert(gunVerts > 180 && gunVerts % 3 === 0, `Expected >180 3D Super-Shotgun vertices, got ${gunVerts}`);
assert(lights >= 6, `Expected >=6 dynamic point lights, got ${lights}`);

// 3. Check 256x256 Worley/FBM texture richness + non-flat heightmap channel
const texU8 = new Uint8Array(ex.memory.buffer, texOff, 8 * 256 * 256 * 4);
const distinctRgb = new Set();
const distinctHeights = new Set();
for (let i = 0; i < texU8.length; i += 8) {
  distinctRgb.add((texU8[i] << 16) | (texU8[i + 1] << 8) | texU8[i + 2]);
  distinctHeights.add(texU8[i + 3]);
}
assert(distinctRgb.size > 4000, `Expected >4000 organic FBM/Worley RGB gradations across 256x256 textures, got ${distinctRgb.size}`);
assert(distinctHeights.size > 120, `Expected >120 heightmap relief levels for GPU bump mapping, got ${distinctHeights.size}`);

// 4. Verify 6-DOF signed controls: Forward, Backward (-1), StrafeLeft (-1), YawLeft (-24), PitchUp (+20), Jump, Fire
const initX = ex.get_cam_x();
const initZ = ex.get_cam_z();
ex.step_fps(-1, 0, 0, 0, 0, 0); // Move Backward!
assert(ex.get_cam_z() > initZ, 'Backward (-1) must move +Z (back) in right-handed 3D space');
ex.step_fps(0, -1, -24, 30, 1, 1); // Strafe left + turn left + look up + jump + fire boomstick!
assert.equal(ex.get_ammo(), 27, 'Firing 3D Super-Shotgun consumes 1 shell (28 -> 27)');
assert(ex.pop_sfx() & 1, 'Firing emits Boomstick SFX bit 0');

// 5. Benchmark per-frame CPU step + dynamic 3D monster/gun mesh generation!
const t0 = performance.now();
let tickAt20 = -1;
for (let f = 0; f < 120; f++) {
  ex.step_fps(1, 0, 0, 0, 0, f === 40 ? 1 : 0);
  if (f === 20) tickAt20 = ex.get_tick();
}
const avgCpuMs = (performance.now() - t0) / 120;

// 6. Verify Time-Travel Combat Rewind
const snaps = ex.get_snap_count();
assert(snaps >= 25, `Expected >=25 combat snapshots, got ${snaps}`);
ex.rewind_combat(24);
assert(ex.get_tick() <= tickAt20 + 8, 'Rewind restores earlier combat tick');

// 7. Verify Exact 3D Line-of-Sight Occlusion Behind Pillars & Walls!
ex.init_game(1996);
// Clear open canyon line-of-sight from Grunt #0 (-1200, -6800) to open floor (0, 1000)
assert.equal(ex.check_los_3d(-1200, 1150, -6800, 0, 1480, 1000), 1, 'Open canyon must have clear LOS');
// Blocked by Monumental Fluted Pillar #1 at (3600, -1500) when player hides at (4250, -200)!
assert.equal(ex.check_los_3d(-1200, 1150, -6800, 4250, 1480, -200), 0, 'Fluted stone pillar must block monster LOS');
// Blocked by Gothic Hall Entrance Wall at Z=-18000 when hiding behind (-5000, -16500) from Grunt #2 (-2300, -23200)!
assert.equal(ex.check_los_3d(-2300, 2950, -23200, -5000, 1480, -16500), 0, 'Solid stone wall must block monster LOS');

// Place player behind Pillar #1 and step 90 ticks: zero damage through the pillar!
ex.set_camera_pose(4250, 1680, -200, 0, 0);
for (let k = 0; k < 90; k++) {
  ex.step_fps(0, 0, 0, 0, 0, 0);
}
assert.equal(ex.get_health(), 100, 'Hiding behind pillar must block 100% of enemy shots');
assert.equal(ex.get_armor(), 50, 'Armor must remain 50 behind solid pillar cover');

// 8. Verify Spacebar Jump onto Left Stone Terrace (Y = 820) & Flanking Side Terrace (Y = 2200)!
ex.set_camera_pose(-3150, 1680, -2000, 3072, 0); // Facing -X toward Left Stone Terrace
for (let k = 0; k < 24; k++) {
  ex.step_fps(1, 0, 0, 0, k === 0 ? 1 : 0, 0);
}
assert(ex.get_cam_y() >= 1680 + 820 - 50, `Expected player to jump onto 820mm Left Terrace, got cam_y=${ex.get_cam_y()}`);

ex.set_camera_pose(-2500, 1680 + 1800, -16500, 3072, 0); // Top of canyon stairs facing -X toward 2200mm Flanking Side Terrace
for (let k = 0; k < 24; k++) {
  ex.step_fps(1, 0, 0, 0, k === 0 ? 1 : 0, 0);
}
assert(ex.get_cam_y() >= 1680 + 2200 - 50, `Expected player to jump onto 2200mm Flanking Side Terrace, got cam_y=${ex.get_cam_y()}`);

console.log(JSON.stringify({
  status: 'PASS',
  wasmBytes: wasmBytes.length,
  wasmKB: +(wasmBytes.length / 1024).toFixed(2),
  staticWorldTriangles: staticVerts / 3,
  dynamicEntityTriangles: dynVerts / 3,
  superShotgunTriangles: gunVerts / 3,
  pointLights: lights,
  distinctTextureColors: distinctRgb.size,
  distinctHeightmapLevels: distinctHeights.size,
  avgCpuStepMs: +avgCpuMs.toFixed(3),
}, null, 2));

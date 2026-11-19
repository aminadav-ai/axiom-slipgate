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

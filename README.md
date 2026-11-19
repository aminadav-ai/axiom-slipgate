# Axiom Slipgate — 1996-Style 3D Dark-Industrial FPS in 100% Axiom (`17.4 KB` Wasm)

**Live Playable Demo:** [https://aminadav-ai.github.io/axiom-slipgate/](https://aminadav-ai.github.io/axiom-slipgate/)  
**Powered by:** [Project Axiom (`axiom-lang` v0.2)](https://github.com/aminadav-ai/axiom-lang)

**Axiom Slipgate** is a **100% clean-room, original-IP** dark-industrial & gothic 3D first-person shooter inspired by the atmosphere of 1996 boomer-shooters — written **100% in the [Axiom](https://github.com/aminadav-ai/axiom-lang) programming language** (`src/slipgate.ax`) and compiled **directly to raw W3C WebAssembly bytecode (`17.40 KB` uncompressed / `7.10 KB` gzipped)** with **zero `rustc`, zero external textures, and zero third-party engine dependencies**.

---

## Measured Engineering Metrics

| Metric | Value |
| :--- | :--- |
| **3D Engine + Procedural Textures + AI + Combat** | 100% `Axiom` (`src/slipgate.ax`, 42 semantic graph nodes) |
| **Compiled `.wasm` Binary Size** | **17,817 bytes (`17.40 KB`)** |
| **Gzipped HTTP Transfer Size** | **7,270 bytes (`7.10 KB`)** |
| **Z3 Mathematical Proof Obligations Proved** | **155 / 155 proved** (46 in `render_3d_frame` alone — zero division-by-zero or map out-of-bounds) |
| **Widescreen 3D Framebuffer (`720 × 450` RGBA)** | **~89 FPS** (`~11.24 ms/frame` in V8 on a dual-core 2.0 GHz laptop CPU) |
| **Procedural Assets Generated in Linear Memory** | 8 `64×64` 24-bit textures (riveted iron, mossy stone, copper doors, flickering torches, glowing acid slime, storm sky, runic exit arch) |
| **Combat Time-Travel Ring Buffer** | **120 snapshots** stored directly in `Axiom.Strata` linear memory |

---

## Clean-Room Architecture

- **100% Original Code & Procedural Art:** Every single wall texture, slime wave, monster silhouette, twin-barrel viewmodel, level layout, and Web Audio synthesizer effect is generated mathematically from scratch under **BUSL-1.1** (`Copyright (c) 2026 Yehuda Aminadav`).
- **Constant-Z Floor/Ceiling + 720-Ray DDA Walls + Z-Buffered 3D Monsters:** Classic Abrash/Carmack-era software rendering architecture with real-time orange muzzle-flash corridor lighting and flickering wall torches.

---

## Build & Verify Locally

```bash
axiom compile-wasm src/slipgate.ax -o web/slipgate.wasm
node scripts/verify_game.mjs
python3 -m http.server 8082 -d web
```

---

## License

Copyright (c) 2026 Yehuda Aminadav. Licensed under **Business Source License 1.1 (`BUSL-1.1`)** — free for personal, educational, academic, and non-commercial use. See [LICENSE](./LICENSE) and [CONTRIBUTING.md](./CONTRIBUTING.md).

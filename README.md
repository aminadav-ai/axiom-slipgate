# Axiom Slipgate v2.0 GPU HD — True 3D Polygonal Shooter in 100% Axiom + WebGL2

**Live Playable Demo:** [https://aminadav-ai.github.io/axiom-slipgate/](https://aminadav-ai.github.io/axiom-slipgate/)  
**Powered by:** [Project Axiom (`axiom-lang` v0.2)](https://github.com/aminadav-ai/axiom-lang)

**Axiom Slipgate v2.0 GPU HD** is a **100% clean-room, original-IP** 3D polygonal first-person shooter written **100% in the [Axiom](https://github.com/aminadav-ai/axiom-lang) programming language** (`src/slipgate.ax`) using `Axiom.Strata` linear memory + the `-[Mem, Gpu]->` hardware GPU capability — compiled **directly to raw W3C WebAssembly bytecode (`30.38 KB` uncompressed / `11.66 KB` gzipped)** with **zero `rustc`, zero external image/model files, and zero third-party engine dependencies**.

---

## Measured Engineering Metrics (`v2.0 GPU HD`)

| Metric | Value |
| :--- | :--- |
| **3D Level Geometry + Procedural Textures + AI + Physics** | 100% `Axiom` (`src/slipgate.ax`, 82 verified graph nodes) |
| **Compiled `.wasm` Binary Size** | **31,109 bytes (`30.38 KB`)** |
| **Gzipped HTTP Transfer Size** | **11,939 bytes (`11.66 KB`)** |
| **Axiom Security Passport Capabilities** | `[CAP] Gpu`, `[CAP] Mem` (embedded in `axiom.passport` Wasm custom section) |
| **Procedural Textures Synthesized in Linear Memory** | **8 seamless `256×256` Worley/FBM textures + micro-relief heightmaps** (`25,339` RGB gradations, `217` relief levels) |
| **True 3D Polygonal Scene** | Multi-level sunlit canyon, overhead slatted wooden sky-bridge with real-time sunbeam shadows, 12-sided smooth fluted pillars, 3D stone staircases, diagonal gothic ceiling rafters, sculpted 3D Shambler/Knight/Grunt meshes, and cylindrical 3D Twin-Barrel Super-Shotgun (`2,456` triangles) |
| **CPU Simulation + Dynamic 3D Mesh Generation** | **`0.475 ms / frame`** in V8 (`60+ FPS` native HD WebGL2 with trilinear mipmaps & per-pixel bump mapping) |
| **Combat Time-Travel Ring Buffer** | **120 snapshots** stored directly in `Axiom.Strata` 8 MiB linear memory |

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

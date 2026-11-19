# Contributing to Axiom Slipgate

`axiom-slipgate` is maintained with **100% clean-room, single-owner intellectual property** under **BUSL-1.1** (free for personal, academic, and non-commercial use; Commercial Licenses available from the Project Owner).

- **Bug Reports & Level Design Ideas (Issues)** are warmly welcome!
- **External Code Pull Requests:** Unsolicited code PRs are not merged without a signed **Contributor License Agreement (CLA)** granting full commercial relicensing rights to the Project Owner.

## Local Verification

```bash
axiom compile-wasm src/slipgate.ax -o web/slipgate.wasm
node scripts/verify_game.mjs
```

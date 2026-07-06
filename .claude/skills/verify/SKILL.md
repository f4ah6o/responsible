---
name: verify
description: Build, launch, and drive the responsible viewer to verify UI changes end-to-end.
---

# Verifying the responsible viewer

## Build & launch

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm preview --port 4173 --strictPort   # serves dist/ at http://localhost:4173/
```

(`pnpm dev` also works for unbuilt sources.)

## Drive with Playwright

Playwright is available globally; symlink it into a scratch dir for ESM
resolution, and launch the pre-installed Chromium explicitly:

```js
import { chromium } from "playwright";
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
```

## Flows worth driving

- Wait for `.activity-card`, then ~600ms extra: measured heights flush on a
  requestAnimationFrame, and lanes relayout one frame after any card resizes.
- Composite expansion: click `.member-toggle` (aria-expanded tracks state),
  then compare `getBoundingClientRect()` of `.activity-card` vs its enclosing
  `.react-flow__node.lane-node` — the card's bottom must stay above the lane's.
- Boundary zoom: 粗く見る / 詳しく見る buttons in `.zoom-bar`.
- Drill-down: the 分解先 select in `.scope-control`.

## Gotchas

- favicon.ico 404s in the console are pre-existing noise, not a regression.
- Lane nodes are React Flow siblings (not DOM ancestors) of activity nodes;
  match a card to its lane geometrically, not via `closest()`.

# Squeek Sprouts

A single-page idle garden powered by Squeektoshi's real Squeekchain wheel. Plant, let the hamster run, harvest, and open up all nine plots. All artwork is drawn in code. No wallet, gas, signature, transaction, backend, or runtime dependency.

## Run it

The finished site is in **`dist/`**. Serve that directory with any static HTTP server. It also works below a gateway path such as `/ipfs/<CID>/`; every runtime asset uses relative URLs. Opening `index.html` with `file://` is not supported because the browser's ES-module and fetch security rules require HTTP(S).

With Node.js 20 or newer:

```sh
npm run build
npm run preview
```

Open `http://localhost:4173/preview/`. The optional numeric argument changes the port: `npm run preview -- 8080`.

**No dependency installation or compilation is needed to play, preview, or export.** The build command is a small Node script that copies the source and required assets into `dist/`, verifies linked files, and reports its size. `index.html`, `src/`, and `assets/` are directly servable source as well.

For development checks:

```sh
npm ci
npx playwright install --with-deps chromium webkit
npm run typecheck
npm test
npm run build
npm run test:browser
```

`npm run typecheck` uses TypeScript's strict `checkJs` on the browser JavaScript with JSDoc and `src/types.d.ts`; it emits nothing. The browser suite starts and stops its own static server and serves the actual export under `/preview/`. Browser test data and screenshots stay in `test/scratch/`. Optional tool-path overrides `IMD_PLAYWRIGHT` and `IMD_AXE` allow installed tooling outside the repository. Dependencies and caches are excluded at every nesting level.

To regenerate the share image after changing the artwork, run `node scripts/share-card.mjs` with Playwright installed, then rebuild. The already generated PNG is included, so deployment does not need Playwright.

## How to play

- Start with 10 crumbs, three open plots, and free Wheel Radish seeds.
- Pick a seed, then select an empty plot. Select a growing crop to inspect its remaining work.
- Select a glowing ripe crop to harvest it. Earn crumbs to unlock seeds; spend them on seeds and new plots.
- A nap pauses the garden. There is no elapsed-time growth in the live garden.
- The journal records planting, ripening, harvests, golden crops, unlocks, and counter restarts, with local timestamps. It retains the newest 80 entries.
- Reset requires two activations, offers Cancel, and clears only the active garden. No `confirm()` dialogs are used.

| Crop | Work | Seed cost | Base sale | Lifetime crumbs to unlock |
| --- | ---: | ---: | ---: | ---: |
| Wheel Radish | 40 | Free | 6 | 0 |
| Zoomie Carrot | 120 | 8 | 20 | 30 |
| Round Pumpkin | 400 | 30 | 70 | 150 |
| Rim Sunflower | 1,000 | 90 | 190 | 500 |
| Moon Melon | 3,000 | 260 | 600 | 1,500 |

Plots four through nine cost **25, 60, 120, 250, 500, 1,000** crumbs, in that order. Starting crumbs do not count toward lifetime earnings. Spending crumbs does not relock seeds.

An online running-wheel harvest gives **2× the base price** and rolls a **15% golden chance**. The golden **5× multiplier stacks on that fresh reward**, for **10× base** in total (a golden radish earns 60). This interpretation of the two bonuses is stated in the in-game help. A napping or stale-signal harvest receives the base price and never rolls golden. Crumbs have no token or monetary value.

## Live data and growth math

The browser reads [`GET https://api.squeekchain.com/v1/status`](https://api.squeekchain.com/v1/status) immediately, then every **15 seconds**, with an **8-second request timeout**, no credentials, and no API key. It also refreshes when the tab becomes visible or connectivity returns. Overlapping requests are prevented; malformed payloads count as failures.

Relevant fields:

| API field | Use |
| --- | --- |
| `measurement.cumulativeWorkUnits` | Exact cumulative work counter; stored as a decimal string and calculated with `BigInt` |
| `measurement.counterEpoch` | Detects counter restarts, including a new epoch with a higher counter |
| `measurement.coreStatus` | `SPINNING` controls the running scene and fresh bonus; `IDLE` shows moon, sleeping hamster, and “zzz” |
| `measurement.freshness` | Only `online` readings may advance the live garden |
| `measurement.rpmMilli / 1000` | RPM display and proportional wheel animation speed |
| `measurement.speedMmPerSecond / 1000` | Speed in m/s |
| `measurement.distanceMm / 1000000` | Distance in km |
| `builder.projected.blockHeight` | Squeek block height |

For each crop, store the accepted work counter at planting:

```text
progress = currentCumulativeWork - workWhenPlanted
ripe = progress >= crop.work
```

The displayed progress is clamped to `[0, crop.work]`. The underlying planted baseline retains the full delta. The next accepted reading after a return grows crops by actual wheel work since the last save, regardless of how long the page was closed. **Local timers never add live work.** The current running/idle flag does not discard delayed real work from the cumulative counter.

If the epoch changes **or** the counter decreases, rebase each planted crop before accepting the new counter:

```text
preservedProgress = lastWork - workWhenPlanted
newWorkWhenPlanted = newWork - preservedProgress
```

For example, a crop planted at 1,000 with the last accepted counter at 1,025 has 25 work. If the counter resets to 3, the new planting baseline is `3 - 25 = -22`. At counter 18 the crop has 40 work. Negative planting baselines are intentional and valid. Ripe crops stay ripe. A restart is journalled once for that transition.

“Work grown here” sums positive accepted counter differences since this garden's first measurement, excluding epoch-reset jumps; it is not multiplied by the number of crops. A newly opened garden does not claim work that predates it.

Stale/expired readings and network errors pause growth and fresh bonuses immediately. New planting waits for a fresh baseline; already ripe crops can still be harvested at base price. Displayed telemetry is marked “Last known.” Successful fresh readings catch up confirmed work. An accepted running status expires after at most 45 seconds without renewal; an API observation's `observedAt` and `staleAfterSeconds`, when present, can shorten that window. This avoids an indefinitely active fresh bonus from an old tab.

## Demo, saves, and privacy

After two consecutive API failures the app opens an explicitly labelled **Demo garden**, with its own save slot. “Try demo” also opens it immediately. Demo alternates 60 seconds of running and 30 seconds of napping, with four simulated work per running second. Its own saved clock accounts for time away. Demo data never writes to the live save. Polling the API continues; returning to live is always an explicit action, so recovered connectivity does not interrupt demo play.

Storage keys are `squeek-sprouts:v1:live` and `squeek-sprouts:v1:demo`. Each stores the balance, lifetime earnings, plots and planting baselines, selection, counters, statistics, and journal. All storage access is wrapped in `try/catch`, loaded saves are validated, and failures show a “this visit only” warning. Storage events synchronize ordinary changes across tabs. Saves are local to the browser origin: different IPFS gateways, browsers, or devices do not share them. Clearing browser data removes them. This is a local game, not a shared or tamper-proof leaderboard.

There are no analytics, cookies, accounts, wallet connections, signatures, or write requests. The only automatic external request is the public status endpoint. Silkscreen and VT323 are locally bundled Google Fonts with their OFL notices. The optional wallet stretch was intentionally omitted to preserve the required signature-free footer.

## Structure and delivery

| Path | Purpose |
| --- | --- |
| `index.html` | Semantic single-page shell, metadata, help dialog, footer |
| `src/engine.js` | Economy, growth, rebasing, rewards, API validation, demo simulation |
| `src/app.js` | DOM interactions, polling, rendering, motion and status management |
| `src/art.js` | Four-stage crop sprites, soil plots, hamster, wheel, day/night scenery |
| `src/storage.js` | Guarded, separate local save slots |
| `src/style.css` | Implemented visual tokens and responsive styles |
| `assets/` | Local fonts/licenses, SVG favicon, 1200×630 share PNG |
| `dist/` | Complete production export, included beside source |
| `tests/` | Reproducible logic and browser interaction tests |
| `DESIGN.md` | Implemented design system |
| `artifacts/validation.md` | Actual checks, six-domain review, fixes, evidence, and limitations |

The static export is ready for the contributor network's Git submission and IPFS/ENS publishing stage. No publishing, domain assignment, remote repository creation, or Git internals are performed by this task. Pin **the contents of `dist/`**, with `index.html` at the pin root. There are no server rewrites or nested route requirements.

The explicit submission budget is 8,388,608 bytes: source/config/docs/lockfile ≤1 MiB, source assets ≤1 MiB, `dist/` ≤2 MiB, artifacts ≤2 MiB, and 2 MiB reserve. Dependency directories, package caches, scratch output, and browser tool output have a **zero-byte** submission budget and are recursively ignored. No dependency archives, submodules, or vendored registry are included.

## Validation and attribution

Production export, strict JavaScript typechecking, logic tests, browser interactions, and the pinned design probe were run locally. Final results: **17/17 logic tests, 38/38 Chromium/WebKit interaction checks, 16/16 design-probe checks, and a clean strict typecheck**. The production export is **151,628 bytes**. Actual commands, fixes, and limitations are recorded in [the validation report](artifacts/validation.md); screenshots and measured summaries accompany it. These are worker observations, not independent certification.

Design guidance: Jakub Krehel's **Better Interface**, MIT, pinned commit `267330e1adfc66a718fb65fa6918c1f06d0a689e`. Documentation method: Paul Bakaus's **Impeccable**, Apache-2.0, pinned commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`. See [the preserved notices and licenses](artifacts/design-guidance-LICENSE.txt). Runtime fonts retain their notices in `assets/fonts/` and `dist/assets/fonts/`.

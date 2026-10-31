# Squeek Sprouts design system

## Overview

Squeek Sprouts is a playable pixel garden for people checking in on Squeektoshi's real wheel. The visual idea is a quiet timber-and-soil garden: square plots, warm light, green shoots, and a small hamster scene. The garden and seed controls take priority over telemetry. There is no landing-page hero.

The single-page composition pairs a left wheel scene and compact measurements with the main seed shed and nine plots. The journal follows the game. On phones the wheel becomes a compact scene beside its status, then the seeds and garden follow before the measurements. Gameplay controls are native buttons. No stock images or emoji are used; `src/art.js` draws the raster artwork in canvas code.

## Colors

The canonical tokens are in `src/style.css:3`. The site uses one deliberate dark palette; it does not switch with system light mode.

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#1c211b` | Page background |
| `--surface` | `#252a21` | Seed cards, dialog, scene surround |
| `--surface-raised` | `#2d3227` | Hover surfaces and resting status |
| `--soil` | `#3c2d23` | Open plot soil |
| `--soil-hover` | `#493727` | Plot hover |
| `--soil-edge` | `#725439` | Open plot border |
| `--text` | `#e4ddc7` | Primary copy |
| `--muted` | `#b0b09a` | Secondary copy, locked plot labels |
| `--subtle` | `#92977f` | Low-emphasis metadata |
| `--line` | `#454b38` | Structural dividers and surfaces |
| `--gold` | `#e7bd76` | Selected seed, crumbs, ripe harvest, golden reward |
| `--gold-dark` | `#33291d` | Text on filled gold actions |
| `--green` | `#b2cb83` | Running state and healthy growth |
| `--green-dark` | `#303e29` | Running status background |
| `--danger` | `#edaa95` | Failed actions, stale warning, armed reset |
| `--focus` | `#f0d9a0` | Two-pixel keyboard focus ring |

Component-specific scenery colors live beside their drawing code. Garden frame `#23281e`, locked soil `#2b3024`, selected seed `#373329`, ripe soil `#403722`, and progress track `#231f1a` are deliberate material variations. Crop hues identify shapes; text and labels also identify all states. The resting scene uses `#21292a` sky, the running scene `#343c2d`; these never change actual growth.

The rendered probe measured the lowest ordinary text pair at 5.42:1 (`--subtle` on `--bg`); selected-seed metadata measured 5.71:1, and locked plot text 6.14:1. Those are measured states, not a claim about every possible overlay. Canvas artwork is not treated as interface text. Full evidence and limitations are in `artifacts/validation.md`.

## Typography

Both families are locally served WOFF2 files, downloaded from Google Fonts. Only the real regular 400 face is used.

- **Silkscreen**: brand, section headings, dialog headings, desktop status, primary help action. Fallback: Courier New, monospace. The font itself has pixel capitals; source strings use natural casing.
- **VT323**: body, control labels, numeric data, journal, and compact phone status. Fallback: Courier New, monospace. The brief explicitly requires these pixel families, including the game's prose.

The five shared sizes are 14, 16, 20, 24, and 32 CSS pixels at the default root size, expressed in rem as `--text-xs`, `--text-sm`, `--text-body`, `--text-lg`, and `--text-xl`. Body uses 20/1.4; section headings use 16/1.5; brand uses 24/1.2 on desktop, 20 on phones, and 16 below 361px. Large changing counters use 32; phone counters use 24. Small data and help details use 16. All weights are 400 and letter spacing is natural.

Numbers use tabular numerals. Important values wrap instead of ellipsizing. The seed names and wheel heading allow word wrapping under text enlargement. Headings use balanced wrapping and paragraphs use pretty wrapping. Metadata is compact; longer help text stays within the dialog's 550px maximum width.

## Layout

Shared spacing tokens: **4, 8, 12, 16, 24, 32, 40px**. Outer max-width is **1216px** with 40px horizontal padding by default. Desktop uses a **280px wheel column** and a flexible game column, with 32px between them. The main game spans the wheel and telemetry rows; the journal spans both columns. The header is a minimum 100px high, with name left and saved/help utilities right.

- At **1400px and up**, padding becomes 24px, wheel column 296px, and gap 40px. Plot minimum height is 144px.
- From **761–1000px**, padding is 24px, wheel column 248px, gap 24px, and the garden's gutters contract. Decorative seed-shed hint text is removed.
- At **760px and below**, the page stacks into one column, maximum 600px wide, with 20px margins. Header minimum height is 76px. The wheel scene is 116px wide beside its heading/status. The persistent saved label and scene caption are omitted to prioritize play; storage failures still appear prominently.
- Below **361px**, margins are 14px and the compact scene is 98px wide. Telemetry uses two columns instead of four.

The garden **always stays three columns**. Default grid padding is 16px and gap 12px; on phones these become 10/8px, then 8/6px below 361px. Open phone plots have a minimum height of 110px (108px at the narrowest breakpoint), and their contents can grow with text.

The seed shed stays five columns with short crop names on phones. Desktop cards expose full names, cost, work, and sale metadata for unlocked crops. The selected-seed detail row exposes full name, work, and sale value on every width. Inspecting a locked seed shows its unlock requirement. No horizontal carousel hides seeds.

The export was rendered at 320, 390, 760, 900, and 1440px; the main planting action is above the fold at 390×844. 200% text enlargement was tested separately from native browser zoom. Controls and footer remain in normal flow; nothing sticky covers game content.

## Elevation and depth

Surfaces use tonal differences and simple structural borders. There are no general-purpose card shadows or gradients. **Ripe plots intentionally combine a gold border and a `0 0 14px #e7bd7624` glow**, because the brief calls for a glowing harvest border. This state-specific treatment is the only exception to the flat surface pattern.

The native help dialog uses a dark `#10150ed9` backdrop and the browser's top layer. The skip link appears above the page only on keyboard focus. Scene labels sit inside the illustrated scene over a solid background.

## Shapes

Game UI surfaces use square corners and 1px structural borders; open plots use 2px borders. Locked plot boundaries are dashed. Selection uses a gold border plus a small square marker. The small square status marker repeats the pixel geometry. Only the favicon has a rounded outer tile for legibility at browser-icon sizes.

Canvas resolutions: crop sprites 32×32, plot artwork 96×60, and hamster scene 280×220. CSS enlarges these with pixelated rendering. Growing crops have seedling, leafy, budding, and ripe stages. Ripe shapes distinguish red-and-cream radish, orange carrot, ribbed pumpkin, yellow sunflower, and violet crescent-marked melon.

## Components

| Pattern | Source | States and behavior |
| --- | --- | --- |
| Seed choice | `src/app.js` seed creation/rendering; `.seed-button` | Native button; selected via `aria-pressed`, gold border and marker. Locked buttons remain inspectable and announce the unlock requirement. Hover and pressed styles never imply a locked seed can be planted. |
| Garden plot | `src/app.js:onPlot`, `render`; `.plot` | Empty plants the selected seed; growing shows work left directly on the tapped plot; ripe harvests and shows its reward there; next locked plot buys if affordable; later plots explain purchase order. Accessible names include plot, crop and remaining work/action. Progress has a redundant textual value. |
| Wheel scene | `src/art.js:drawWheelScene`; `src/app.js:syncAnimation` | RPM-scaled wheel and bobbing hamster while running; stationary sleeper, moon and zzz when napping; stale label on signal loss. Canvas has a changing semantic description. The motion control pauses animation without changing gameplay. |
| Status and notices | `src/app.js:renderStatus`; `.status-pill`, `.notice` | Connecting, running, napping, stale, and explicitly labelled demo. Text accompanies every color. Stale freezes live growth/fresh rewards. Storage warning explains persistence limits. Demo has an explicit Return to live button. |
| Journal | `src/app.js:renderJournal`; `.journal-entry` | Timestamped ordered list, newest first. Four visible entries initially; Show older entries expands up to 80. Static colors/dots accompany event text. Stored strings render with `textContent`. |
| Help | `index.html` native `dialog`; `src/app.js` help handlers | Named native modal with inert background, explicit Tab cycle, Escape/backdrop/close dismissal, and focus restoration. “Let's grow” focuses the garden. |
| Reset | `src/app.js` reset handlers | First activation arms a consequence-labelled button and shows Cancel. Second activation clears only the current slot. Other gameplay actions cancel the armed state. |
| Feedback | `.feedback`, stable `role=status` | Inline result/remaining-work message. Green for routine success, gold for golden reward, peach for failure. No disappearing action/error toasts. |

All buttons inherit the pixel font and have visible focus rings. Hover effects are gated by pointer capability. Native buttons accept Enter/Space. The dialog traps Tab and restores focus. Reduced motion stops the canvas animation and removes press scaling. Running animation also stops in a hidden tab or while napping. CSS transitions name only their changing properties; active press scaling is 0.96 with a 120ms duration.

## Do and don't

- Reuse the existing semantic color tokens, five-size type scale, square boundaries, and section-heading row.
- Keep the garden and planting controls early in phone reading order. Keep three garden columns.
- Pair every state with clear text; do not use animation or color alone.
- Read the cumulative counter for growth. Do not add wall-clock growth or random “live” readings.
- Preserve the separate demo save and conspicuous demo label.
- Keep general surfaces flat; reserve the glow for ripe crops.
- Use canvas code for new crop artwork and preserve distinct four-stage silhouettes.
- Keep optional guidance near controls or in the existing dialog; do not add a marketing hero above play.
- Keep runtime assets local and relative. A future static page can reuse the header, token stylesheet, native buttons and journal row pattern without introducing a framework or a second font system.

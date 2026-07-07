# Particle Text

A Next.js demo where dots and dashes orbit in a wreath, then fly to the center to spell out words one at a time before returning home. The effect is built from canvas-free DOM particles animated with [Motion](https://motion.dev), with live tuning via [DialKit](https://github.com/nickmilo/dialkit).

## Demo

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Use the DialKit panel in the bottom-right corner to edit text, ring shape, particle color, and motion timing.

## How it works

Each particle has two positions:

1. **Home** — a slot on an elliptical wreath around the viewport center
2. **Text target** — a dot or dash that forms part of a word's dot-matrix glyph

All particles share the same wreath. During a word's phase, only that word's particles travel to the center; the rest stay on the ring. A fixed 6.5s timeline sequences three words in order, with per-particle stagger on the way in and out.

```
Ring (idle) → soft drift → spell word 1 → return home
                          → spell word 2 → return home
                          → spell word 3 → return home → loop
```

### Animation

- Particles are `motion.span` elements with keyframed `x`, `y`, `width`, `height`, and `opacity`
- Layout is recalculated on resize via `ResizeObserver`
- `prefers-reduced-motion` renders a static wreath instead of animating
- The container exposes `role="img"` with an `aria-label` built from the current words

## Usage

```tsx
import { ParticleText } from "@/component/particle-text";

export default function Page() {
  return (
    <div className="aspect-[4/5] w-[min(90vw,480px)]">
      <ParticleText
        words={["Changing", "the script", "for life"]}
        className="h-full w-full"
        loop
        controls
      />
    </div>
  );
}
```

### `ParticleText` props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `words` | `string[]` | `["Changing", "the script", "for life"]` | Three lines of text to animate in sequence |
| `className` | `string` | — | Applied to the root container |
| `loop` | `boolean` | `true` | Whether the timeline repeats |
| `controls` | `boolean` | `true` | Show the DialKit panel and "Open for control" hint |

When `controls` is enabled, DialKit persists settings under the id `particle-text-v3`. The panel exposes:

- **Content** — three editable text lines
- **Text** — letter gap, max width, vertical detail toggle
- **Ring** — ellipse width/height, vertical offset, band spread, side scatter
- **Particles** — dot color
- **Motion** — loop toggle, duration, stagger in/out
- **Reset** — restore defaults

## Target generation (`component/target.ts`)

Layout math lives in `target.ts`. Each particle position is a `Target`:

```ts
type Target = {
  x: number;   // center x
  y: number;   // center y
  w: number;   // capsule width (equals s for a dot)
  s: number;   // mark size — dot diameter and dash height
};
```

### `generateWreathTargets(count, width, height, rng, options?)`

Places `count` particles on an elliptical wreath. Dots and horizontal dashes are distributed across four arc segments (top, bottom, left, right) with configurable density. A seeded `mulberry32` RNG keeps layouts stable across re-renders.

Key options: `dotSize`, `minDash`, `maxDash`, `widthRatio`, `heightRatio`, `yOffset`, `bandSpread`, `sideScatter`, `topDensity`, `bottomDensity`, `sideDensity`, `dashFrequency`.

### `generateTextTargets(word, width, height, fontFamily, options?)`

Builds dot-matrix text from explicit 5×7 glyph strokes (lowercase a–z, digits, and basic punctuation). Horizontal runs become dots or dashes; optional vertical detail fills isolated column strokes. The result is centered in the viewport.

Key options: `dotSize`, `cellScale`, `letterGap`, `maxWidth`, `verticalDetail`.

### `assignTargetsGreedy(particles, targets, costMultipliers?)`

Greedy nearest-neighbor matching from particles to targets. Optional per-particle cost multipliers let callers keep certain particles (e.g. the visible wreath ring) in place by making them more expensive to recruit.

### Utilities

- `mulberry32(seed)` — seeded PRNG for deterministic layouts
- `getWreathDotSize(width, value?)` / `getTextDotSize(width, value?)` — scale reference measurements from a 720px-wide source

## Project structure

```
app/
  page.tsx              # Demo page
component/
  particle-text.tsx     # React component, animation timeline, DialKit wiring
  target.ts             # Wreath and text target generation
lib/
  utils.ts              # cn() class name helper
```

## Stack

- [Next.js 16](https://nextjs.org)
- [React 19](https://react.dev)
- [Motion](https://motion.dev) — particle keyframe animation
- [DialKit](https://github.com/nickmilo/dialkit) — live parameter controls
- [Tailwind CSS 4](https://tailwindcss.com)

## Scripts

```bash
pnpm dev      # Start dev server
pnpm build    # Production build
pnpm start    # Serve production build
pnpm lint     # Run ESLint
```

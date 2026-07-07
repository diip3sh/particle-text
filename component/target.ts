export type Target = {
    x: number;
    y: number;
    /** capsule width; equals `s` for a dot */
    w: number;
    /** mark size: dot diameter and dash height */
    s: number;
  };
  
  export type Rng = () => number;
  
  export type WreathTargetOptions = {
    dotSize: number;
    minDash: number;
    maxDash: number;
    widthRatio: number;
    heightRatio: number;
    yOffset: number;
    bandSpread: number;
    sideScatter: number;
    topDensity: number;
    bottomDensity: number;
    sideDensity: number;
    dashFrequency: number;
  };
  
  export type TextTargetOptions = {
    dotSize: number;
    cellScale: number;
    letterGap: number;
    maxWidth: number;
    verticalDetail: boolean;
  };
  
  /** Seeded PRNG (mulberry32) for stable wreath layouts across re-renders. */
  export const mulberry32 = (seed: number): Rng => {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  
  /** All reference measurements were taken on the 720px-wide source video. */
  const ref = (value: number, width: number): number => value * (width / 720);
  
  export const getWreathDotSize = (width: number, value = 6.1): number =>
    ref(value, width);
  export const getTextDotSize = (width: number, value = 8.6): number =>
    ref(value, width);
  
  const TWO_PI = Math.PI * 2;
  
  const lerp = (start: number, end: number, t: number) => start + (end - start) * t;
  
  const DEFAULT_WREATH_OPTIONS: WreathTargetOptions = {
    dotSize: 6.1,
    minDash: 13,
    maxDash: 39,
    widthRatio: 0.87,
    heightRatio: 0.62,
    yOffset: 0,
    bandSpread: 0.018,
    sideScatter: 0.075,
    topDensity: 0.36,
    bottomDensity: 0.32,
    sideDensity: 0.16,
    dashFrequency: 6,
  };
  
  const DEFAULT_TEXT_OPTIONS: TextTargetOptions = {
    dotSize: 8.6,
    cellScale: 1.22,
    letterGap: 1.2,
    maxWidth: 0.76,
    verticalDetail: true,
  };
  
  const shuffleTargets = (targets: Target[], rng: Rng): Target[] => {
    const shuffled = [...targets];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };
  
  export const generateWreathTargets = (
    count: number,
    width: number,
    height: number,
    rng: Rng,
    options: Partial<WreathTargetOptions> = {},
  ): Target[] => {
    if (count <= 0) return [];
  
    const config = { ...DEFAULT_WREATH_OPTIONS, ...options };
    const cx = width / 2;
    const cy = height * 0.5 + config.yOffset;
    const rx = width * (config.widthRatio / 2);
    const ry = height * (config.heightRatio / 2);
    const dotSize = getWreathDotSize(width, config.dotSize);
    const minDash = ref(config.minDash, width);
    const maxDash = ref(config.maxDash, width);
    const targets: Target[] = [];
    const sideArc = 0.66;
    const segmentWeights = [
      config.topDensity,
      config.bottomDensity,
      config.sideDensity,
      config.sideDensity,
    ];
    const segmentAngles = [
      { start: Math.PI + sideArc, end: TWO_PI - sideArc },
      { start: sideArc, end: Math.PI - sideArc },
      { start: Math.PI - sideArc, end: Math.PI + sideArc },
      { start: TWO_PI - sideArc, end: TWO_PI + sideArc },
    ];
    const totalWeight = segmentWeights.reduce((sum, weight) => sum + weight, 0);
    const safeTotalWeight = totalWeight > 0 ? totalWeight : 1;
    const segmentCounts = segmentWeights.map((weight) =>
      Math.max(1, Math.round(count * (weight / safeTotalWeight))),
    );
    const dashFrequency = Math.max(2, Math.round(config.dashFrequency));
  
    while (segmentCounts.reduce((sum, value) => sum + value, 0) > count) {
      const largestIndex = segmentCounts.indexOf(Math.max(...segmentCounts));
      segmentCounts[largestIndex] -= 1;
    }
  
    while (segmentCounts.reduce((sum, value) => sum + value, 0) < count) {
      const smallestIndex = segmentCounts.indexOf(Math.min(...segmentCounts));
      segmentCounts[smallestIndex] += 1;
    }
  
    for (let segmentIndex = 0; segmentIndex < segmentAngles.length; segmentIndex++) {
      const segment = segmentAngles[segmentIndex];
      const segmentCount = segmentCounts[segmentIndex];
      const step = (segment.end - segment.start) / Math.max(1, segmentCount);
  
      for (let i = 0; i < segmentCount; i++) {
        const baseTheta = lerp(
          segment.start,
          segment.end,
          (i + 0.5) / segmentCount,
        );
        const theta = baseTheta + (rng() * 2 - 1) * step * 0.22;
        const normalizedTheta = ((theta % TWO_PI) + TWO_PI) % TWO_PI;
        const topBottomStrength = Math.abs(Math.sin(normalizedTheta));
        const sideStrength = Math.abs(Math.cos(normalizedTheta));
        const bandPattern = ((i + segmentIndex * 2) % 7) - 3;
        const bandOffset = bandPattern * config.bandSpread;
        const sideScatter = sideStrength * (rng() * 2 - 1) * config.sideScatter;
        const radial = 1 + bandOffset + sideScatter + (rng() * 2 - 1) * 0.018;
  
        const x = cx + rx * radial * Math.cos(normalizedTheta);
        const y = cy + ry * radial * Math.sin(normalizedTheta);
        const dashSlot = (i + segmentIndex * 3) % dashFrequency === 0;
        const sideDashSlot = sideStrength > 0.86 && (i + segmentIndex) % 4 === 0;
        const isDash = dashSlot || sideDashSlot;
        const dashT = sideDashSlot ? 0.62 + rng() * 0.38 : rng() * rng();
        const dashScale = 0.65 + topBottomStrength * 0.35;
        const w = isDash
          ? (minDash + dashT * (maxDash - minDash)) * dashScale
          : dotSize;
  
        targets.push({ x, y, w, s: dotSize });
      }
    }
  
    return shuffleTargets(targets, rng);
  };
  
  const MATRIX_GLYPHS: Record<string, string[]> = {
    " ": ["000", "000", "000", "000", "000", "000", "000"],
    a: ["00000", "01110", "00001", "01111", "10001", "10001", "01111"],
    b: ["10000", "10000", "10110", "11001", "10001", "11001", "10110"],
    c: ["00000", "01110", "10001", "10000", "10000", "10001", "01110"],
    d: ["00001", "00001", "01101", "10011", "10001", "10011", "01101"],
    e: ["00000", "01110", "10001", "11111", "10000", "10001", "01110"],
    f: ["00110", "01001", "01000", "11100", "01000", "01000", "01000"],
    g: ["00000", "01111", "10001", "10001", "01111", "00001", "01110"],
    h: ["10000", "10000", "10110", "11001", "10001", "10001", "10001"],
    i: ["00100", "00000", "01100", "00100", "00100", "00100", "01110"],
    j: ["00010", "00000", "00110", "00010", "00010", "10010", "01100"],
    k: ["10000", "10010", "10100", "11000", "10100", "10010", "10001"],
    l: ["01100", "00100", "00100", "00100", "00100", "00100", "01110"],
    m: ["00000", "11011", "10101", "10101", "10101", "10101", "10101"],
    n: ["00000", "10110", "11001", "10001", "10001", "10001", "10001"],
    o: ["00000", "01110", "10001", "10001", "10001", "10001", "01110"],
    p: ["00000", "11110", "10001", "10001", "11110", "10000", "10000"],
    q: ["00000", "01111", "10001", "10001", "01111", "00001", "00001"],
    r: ["00000", "10110", "11001", "10000", "10000", "10000", "10000"],
    s: ["00000", "01111", "10000", "01110", "00001", "10001", "11110"],
    t: ["00100", "00100", "11111", "00100", "00100", "00101", "00010"],
    u: ["00000", "10001", "10001", "10001", "10001", "10011", "01101"],
    v: ["00000", "10001", "10001", "10001", "01010", "01010", "00100"],
    w: ["00000", "10001", "10001", "10101", "10101", "10101", "01010"],
    x: ["00000", "10001", "01010", "00100", "01010", "10001", "10001"],
    y: ["00000", "10001", "10001", "01111", "00001", "10001", "01110"],
    z: ["00000", "11111", "00010", "00100", "01000", "10000", "11111"],
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
    "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
    ".": ["000", "000", "000", "000", "000", "011", "011"],
    ",": ["000", "000", "000", "000", "011", "001", "010"],
    "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
    "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
    "!": ["010", "010", "010", "010", "010", "000", "010"],
  };
  
  const FALLBACK_GLYPH = [
    "11111",
    "00001",
    "00010",
    "00100",
    "00000",
    "00100",
    "00000",
  ];
  
  const splitHorizontalRun = (
    startColumn: number,
    endColumn: number,
    row: number,
    cellSize: number,
    dotSize: number,
  ): Target[] => {
    const runLength = endColumn - startColumn;
    if (runLength <= 0) return [];
    if (runLength === 1) {
      return [
        {
          x: startColumn * cellSize,
          y: row * cellSize,
          w: dotSize,
          s: dotSize,
        },
      ];
    }
  
    const targets: Target[] = [];
    let cursor = startColumn;
  
    while (cursor < endColumn) {
      const remaining = endColumn - cursor;
      const chunkLength = remaining >= 4 ? 2 : remaining;
      const centerColumn = cursor + (chunkLength - 1) / 2;
      targets.push({
        x: centerColumn * cellSize,
        y: row * cellSize,
        w: Math.max(dotSize * 1.8, chunkLength * cellSize * 0.82),
        s: dotSize,
      });
      cursor += chunkLength;
    }
  
    return targets;
  };
  
  /**
   * Builds reference-style dot-matrix text from explicit glyph strokes. Filled
   * font masks collapse into row blobs at this scale; stroke cells preserve
   * counters and keep horizontal dashes separate from vertical dot columns.
   */
  export const generateTextTargets = (
    word: string,
    width: number,
    height: number,
    _fontFamily: string,
    options: Partial<TextTargetOptions> = {},
  ): Target[] => {
    void _fontFamily;
    if (!word) return [];
  
    const config = { ...DEFAULT_TEXT_OPTIONS, ...options };
    const characters = [...word.toLowerCase()];
    const glyphs = characters.map((character) => MATRIX_GLYPHS[character] ?? FALLBACK_GLYPH);
    const rawDotSize = getTextDotSize(width, config.dotSize);
    const gapColumns = config.letterGap;
    const totalColumns = glyphs.reduce((sum, glyph, index) => {
      const glyphWidth = glyph[0]?.length ?? 0;
      return sum + glyphWidth + (index === glyphs.length - 1 ? 0 : gapColumns);
    }, 0);
    const maxTextWidth = width * config.maxWidth;
    const cellSize = Math.min(rawDotSize * config.cellScale, maxTextWidth / Math.max(1, totalColumns));
    const dotSize = Math.max(ref(4.9, width), Math.min(rawDotSize, cellSize * 0.88));
    const targets: Target[] = [];
    let cursorColumn = 0;
  
    for (const glyph of glyphs) {
      const glyphWidth = glyph[0]?.length ?? 0;
      const hasInk = (row: number, column: number): boolean =>
        glyph[row]?.[column] === "1";
      const hasHorizontalNeighbor = (row: number, column: number): boolean =>
        hasInk(row, column - 1) || hasInk(row, column + 1);
  
      for (let row = 0; row < glyph.length; row++) {
        let column = 0;
  
        while (column < glyphWidth) {
          if (glyph[row][column] !== "1") {
            column++;
            continue;
          }
  
          const runStart = column;
          while (column < glyphWidth && glyph[row][column] === "1") {
            column++;
          }
  
          const runTargets = splitHorizontalRun(
            cursorColumn + runStart,
            cursorColumn + column,
            row,
            cellSize,
            dotSize,
          );
          targets.push(...runTargets);
        }
      }
  
      if (config.verticalDetail) {
        for (let row = 0; row < glyph.length - 1; row++) {
          for (let column = 0; column < glyphWidth; column++) {
            if (!hasInk(row, column) || !hasInk(row + 1, column)) continue;
            if (hasHorizontalNeighbor(row, column) && hasHorizontalNeighbor(row + 1, column)) {
              continue;
            }
  
            targets.push({
              x: (cursorColumn + column) * cellSize,
              y: (row + 0.5) * cellSize,
              w: dotSize,
              s: dotSize,
            });
          }
        }
      }
  
      cursorColumn += glyphWidth + gapColumns;
    }
  
    if (targets.length === 0) return [];
  
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
  
    for (const t of targets) {
      minX = Math.min(minX, t.x - t.w / 2);
      maxX = Math.max(maxX, t.x + t.w / 2);
      minY = Math.min(minY, t.y - t.s / 2);
      maxY = Math.max(maxY, t.y + t.s / 2);
    }
  
    const textCx = (minX + maxX) / 2;
    const textCy = (minY + maxY) / 2;
    const destCx = width / 2;
    const destCy = height / 2;
  
    return targets.map((t) => ({
      x: t.x - textCx + destCx,
      y: t.y - textCy + destCy,
      w: t.w,
      s: t.s,
    }));
  };
  
  /**
   * Greedy nearest-available matching from particles to targets. Optional
   * per-particle cost multipliers let callers keep certain particles (e.g. the
   * visible wreath ring) in place by making them more expensive to recruit.
   */
  export const assignTargetsGreedy = (
    particles: { x: number; y: number }[],
    targets: Target[],
    costMultipliers?: number[],
  ): Map<number, Target> => {
    const pairs: { particleIdx: number; targetIdx: number; dist: number }[] = [];
  
    for (let pi = 0; pi < particles.length; pi++) {
      const cost = costMultipliers?.[pi] ?? 1;
      for (let ti = 0; ti < targets.length; ti++) {
        const dx = particles[pi].x - targets[ti].x;
        const dy = particles[pi].y - targets[ti].y;
        pairs.push({
          particleIdx: pi,
          targetIdx: ti,
          dist: (dx * dx + dy * dy) * cost,
        });
      }
    }
  
    pairs.sort((a, b) => a.dist - b.dist);
  
    const assignedParticles = new Set<number>();
    const assignedTargets = new Set<number>();
    const result = new Map<number, Target>();
  
    for (const pair of pairs) {
      if (assignedParticles.has(pair.particleIdx)) continue;
      if (assignedTargets.has(pair.targetIdx)) continue;
      assignedParticles.add(pair.particleIdx);
      assignedTargets.add(pair.targetIdx);
      result.set(pair.particleIdx, targets[pair.targetIdx]);
      if (result.size === targets.length) break;
    }
  
    return result;
  };
  
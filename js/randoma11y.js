/* randoma11y v1.0.0 (mrmrs, MIT) — bundled dependency-free for the browser.
   Source: https://github.com/mrmrs/randoma11y-js  (colorjs.io contrast logic inlined)
   Generate accessible two-colour combinations. Exposes window.randoma11y(). */
(function (global) {
  'use strict';
/* ===== options.js ===== */
const SUPPORTED_ALGORITHMS = new Set([
  "APCA",
  "WCAG21",
  "Michelson",
  "Weber",
  "Lstar",
  "deltaPhi",
]);

function assertAlgorithm(algorithm) {
  if (!SUPPORTED_ALGORITHMS.has(algorithm)) {
    throw new TypeError(`Unknown contrast algorithm: ${algorithm}`);
  }
  return algorithm;
}

function normalizeThreshold(threshold) {
  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new TypeError(
      `threshold must be a finite number greater than or equal to 0, got ${threshold}`
    );
  }
  return threshold;
}

function normalizeMaxIterations(maxIterations) {
  if (!Number.isSafeInteger(maxIterations) || maxIterations < 1) {
    throw new TypeError(
      `maxIterations must be a positive safe integer, got ${maxIterations}`
    );
  }
  return maxIterations;
}

/* ===== color.js ===== */
/**
 * Minimal sRGB-oriented color helpers (parse → linear / XYZ / Lab)
 * Matrix values match colorjs.io srgb-linear / lab-d65 / lab / adapt (Bradford D65↔D50).
 */

// prettier-ignore
const TO_XYZ_M = [
  [0.41239079926595934, 0.357584339383878, 0.1804807884018343],
  [0.21263900587151027, 0.715168678767756, 0.07219231536073371],
  [0.01933081871559182, 0.11919477979462598, 0.9505321522496607],
];

const WHITES = {
  D65: [0.3127 / 0.329, 1, (1 - 0.3127 - 0.329) / 0.329],
  D50: [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585],
};

// prettier-ignore
const CAT_D65_TO_D50 = [
  [1.0479297925449969, 0.022946870601609652, -0.05019226628920524],
  [0.02962780877005599, 0.9904344267538799, -0.017073799063418826],
  [-0.009243040646204504, 0.015055191490298152, 0.7518742814281371],
];

const ε = 216 / 24389;
const ε3 = 24 / 116;
const κ = 24389 / 27;

const NAMED = {
  black: [0, 0, 0],
  white: [1, 1, 1],
  transparent: [0, 0, 0],
};

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function parseFiniteNumber(value, label, source) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`Invalid ${label} in color: ${source}`);
  }
  return parsed;
}

function multiplyM3(v, m) {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

/** WCAG / colorjs relative luminance: linear sRGB → Y (XYZ D65). */
function getLuminanceY(lin) {
  const xyz = multiplyM3(lin, TO_XYZ_M);
  return Math.max(xyz[1], 0);
}

/** Piecewise sRGB → linear (matches CSS / WCAG). */
function linearizeSrgbChannel(c) {
  const sign = c < 0 ? -1 : 1;
  const abs = Math.abs(c);
  if (abs <= 0.04045) return c / 12.92;
  return sign * ((abs + 0.055) / 1.055) ** 2.4;
}

function linearSrgbFromEncoded(rgb) {
  return rgb.map(linearizeSrgbChannel);
}

function xyzD65FromLinearSrgb(lin) {
  return multiplyM3(lin, TO_XYZ_M);
}

function labD65FromXyzD65(xyz) {
  const white = WHITES.D65;
  const xyzn = xyz.map((v, i) => v / white[i]);
  const f = xyzn.map((value) => (value > ε ? Math.cbrt(value) : (κ * value + 16) / 116));
  return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
}

function labD50FromXyzD50(xyz) {
  const white = WHITES.D50;
  const xyzn = xyz.map((v, i) => v / white[i]);
  const f = xyzn.map((value) => (value > ε ? Math.cbrt(value) : (κ * value + 16) / 116));
  return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
}

function xyzD50FromXyzD65(xyz) {
  return multiplyM3(xyz, CAT_D65_TO_D50);
}

/**
 * @param {string} str
 * @returns {[number, number, number]} sRGB 0–1 (encoded)
 */
function parseToSrgb01(str) {
  const s = String(str).trim().toLowerCase();
  if (NAMED[s]) return NAMED[s].slice();

  if (s.startsWith("#")) {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) {
      h = h.replace(/./g, "$&$&");
    }
    if (h.length !== 6 && h.length !== 8) {
      throw new TypeError(`Invalid hex color: ${str}`);
    }
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    return [r, g, b];
  }

  const rgbM = s.match(/^rgba?\(\s*([^)]+)\s*\)/);
  if (rgbM) {
    const parts = rgbM[1].split(/[,\s/]+/).filter(Boolean);
    if (parts.length < 3) {
      throw new TypeError(`Invalid rgb color: ${str}`);
    }
    const toNum = (p, i) => {
      const parsed = parseFiniteNumber(p, "rgb component", str);
      if (p.endsWith("%")) return clamp01(parsed / 100);
      return i < 3 ? clamp01(parsed / 255) : clamp01(parsed);
    };
    return [toNum(parts[0], 0), toNum(parts[1], 1), toNum(parts[2], 2)];
  }

  const hslM = s.match(/^hsla?\(\s*([^)]+)\s*\)/);
  if (hslM) {
    const parts = hslM[1].split(/[,\s/]+/).filter(Boolean);
    if (parts.length < 3) {
      throw new TypeError(`Invalid hsl color: ${str}`);
    }
    let h = parseFiniteNumber(parts[0], "hue", str);
    const sPct = parseFiniteNumber(parts[1], "saturation", str);
    const lPct = parseFiniteNumber(parts[2], "lightness", str);
    h = ((h % 360) + 360) % 360;
    const sat = clamp01(sPct / 100);
    const light = clamp01(lPct / 100);
    return hslToSrgb01(h, sat, light);
  }

  throw new TypeError(`Unsupported color syntax: ${str}`);
}

function hslToSrgb01(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return [f(0), f(8), f(4)];
}

function randomSrgb01() {
  return [Math.random(), Math.random(), Math.random()];
}

/** HSL in degrees / 0–1 / 0–1 → sRGB 0–1 */
function hsl01ToSrgb01(h, s, l) {
  return hslToSrgb01(h * 360, s, l);
}

function toHex([r, g, b]) {
  const x = (n) =>
    Math.max(0, Math.min(255, Math.round(n * 255)))
      .toString(16)
      .padStart(2, "0");
  return `#${x(r)}${x(g)}${x(b)}`;
}

/* ===== contrast.js ===== */
/**
 * Contrast algorithms aligned with colorjs.io (vendored logic).
 * @typedef {'APCA' | 'WCAG21' | 'Michelson' | 'Weber' | 'Lstar' | 'deltaPhi'} ContrastAlgorithm
 */


// --- APCA 0.0.98G (colorjs APCA.js) ---
const normBG = 0.56;
const normTXT = 0.57;
const revTXT = 0.62;
const revBG = 0.65;
const blkThrs = 0.022;
const blkClmp = 1.414;
const loClip = 0.1;
const deltaYmin = 0.0005;
const scaleBoW = 1.14;
const loBoWoffset = 0.027;
const scaleWoB = 1.14;
const loWoBoffset = 0.027;

function fclamp(Y) {
  if (Y >= blkThrs) return Y;
  return Y + (blkThrs - Y) ** blkClmp;
}

function linearizeApca(val) {
  const sign = val < 0 ? -1 : 1;
  const abs = Math.abs(val);
  return sign * abs ** 2.4;
}

function contrastAPCAEncoded(bg, fg) {
  const [fR, fG, fB] = parseToSrgb01(fg);
  let lumTxt = linearizeApca(fR) * 0.2126729 + linearizeApca(fG) * 0.7151522 + linearizeApca(fB) * 0.072175;
  const [bR, bG, bB] = parseToSrgb01(bg);
  let lumBg = linearizeApca(bR) * 0.2126729 + linearizeApca(bG) * 0.7151522 + linearizeApca(bB) * 0.072175;

  let Ytxt = fclamp(lumTxt);
  let Ybg = fclamp(lumBg);
  const BoW = Ybg > Ytxt;
  let S;
  let C;
  let Sapc;

  if (Math.abs(Ybg - Ytxt) < deltaYmin) {
    C = 0;
  } else if (BoW) {
    S = Ybg ** normBG - Ytxt ** normTXT;
    C = S * scaleBoW;
  } else {
    S = Ybg ** revBG - Ytxt ** revTXT;
    C = S * scaleWoB;
  }
  if (Math.abs(C) < loClip) {
    Sapc = 0;
  } else if (C > 0) {
    Sapc = C - loBoWoffset;
  } else {
    Sapc = C + loWoBoffset;
  }
  return Sapc * 100;
}

function contrastWCAG21Encoded(c1, c2) {
  const lin1 = linearSrgbFromEncoded(parseToSrgb01(c1));
  const lin2 = linearSrgbFromEncoded(parseToSrgb01(c2));
  let Y1 = getLuminanceY(lin1);
  let Y2 = getLuminanceY(lin2);
  if (Y2 > Y1) [Y1, Y2] = [Y2, Y1];
  return (Y1 + 0.05) / (Y2 + 0.05);
}

function orderedLuminancePair(c1, c2) {
  const lin1 = linearSrgbFromEncoded(parseToSrgb01(c1));
  const lin2 = linearSrgbFromEncoded(parseToSrgb01(c2));
  let Y1 = getLuminanceY(lin1);
  let Y2 = getLuminanceY(lin2);
  if (Y2 > Y1) [Y1, Y2] = [Y2, Y1];
  return [Y1, Y2];
}

function contrastMichelsonEncoded(c1, c2) {
  const [Y1, Y2] = orderedLuminancePair(c1, c2);
  const denom = Y1 + Y2;
  return denom === 0 ? 0 : (Y1 - Y2) / denom;
}

const WEBER_MAX = 50000;

function contrastWeberEncoded(c1, c2) {
  const [Y1, Y2] = orderedLuminancePair(c1, c2);
  return Y2 === 0 ? WEBER_MAX : (Y1 - Y2) / Y2;
}

function labD65LFromEncoded(c) {
  const lin = linearSrgbFromEncoded(parseToSrgb01(c));
  const xyz = xyzD65FromLinearSrgb(lin);
  return labD65FromXyzD65(xyz)[0];
}

function labD50LFromEncoded(c) {
  const lin = linearSrgbFromEncoded(parseToSrgb01(c));
  const xyz65 = xyzD65FromLinearSrgb(lin);
  const xyz50 = xyzD50FromXyzD65(xyz65);
  return labD50FromXyzD50(xyz50)[0];
}

function contrastLstarEncoded(c1, c2) {
  const L1 = labD50LFromEncoded(c1);
  const L2 = labD50LFromEncoded(c2);
  return Math.abs(L1 - L2);
}

const phi = Math.pow(5, 0.5) * 0.5 + 0.5;

function contrastDeltaPhiEncoded(c1, c2) {
  const Lstr1 = labD65LFromEncoded(c1);
  const Lstr2 = labD65LFromEncoded(c2);
  const deltaPhiStar = Math.abs(Math.pow(Lstr1, phi) - Math.pow(Lstr2, phi));
  const contrast = Math.pow(deltaPhiStar, 1 / phi) * Math.SQRT2 - 40;
  return contrast < 7.5 ? 0 : contrast;
}

/** @type {Record<ContrastAlgorithm, (a: string, b: string) => number>} */
const CONTRASTERS = {
  APCA: (bg, fg) => contrastAPCAEncoded(bg, fg),
  WCAG21: contrastWCAG21Encoded,
  Michelson: contrastMichelsonEncoded,
  Weber: contrastWeberEncoded,
  Lstar: contrastLstarEncoded,
  deltaPhi: contrastDeltaPhiEncoded,
};

/**
 * @param {string} background
 * @param {string} foreground
 * @param {ContrastAlgorithm} algorithm
 */
function contrast(background, foreground, algorithm) {
  const fn = CONTRASTERS[assertAlgorithm(algorithm)];
  return fn(background, foreground);
}

function meetsThreshold(value, algorithm, threshold) {
  const abs = Math.abs(value);
  if (algorithm === "WCAG21") return value >= threshold;
  return abs >= threshold;
}

/* ===== combo.js ===== */
const RANDOM_ATTEMPTS = 2000;
const FALLBACKS = ["#000000", "#ffffff"];

function shuffledGrid(hueSteps, satSteps, lightSteps) {
  const grid = [];
  for (let h = 0; h < 360; h += 360 / hueSteps) {
    for (let s = 0; s <= 100; s += 100 / satSteps) {
      for (let l = 0; l <= 100; l += 100 / lightSteps) {
        grid.push([h / 360, s / 100, l / 100]);
      }
    }
  }
  for (let i = grid.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [grid[i], grid[j]] = [grid[j], grid[i]];
  }
  return grid;
}

/**
 * @param {string} targetCss
 * @param {number} threshold
 * @param {import('./contrast.js').ContrastAlgorithm} algorithm
 * @param {0 | 1} colorToGenerateIndex 0 = first color random, 1 = second color random
 * @param {number} maxIterations total budget (random + grid + fallback)
 */
function findColorMeetingThreshold(
  targetCss,
  threshold,
  algorithm,
  colorToGenerateIndex,
  maxIterations
) {
  let iterations = 0;
  let foundHex = null;
  let foundContrast = null;
  let bestContrast = null;
  let bestHex = null;
  const fallbackBudget = Math.min(FALLBACKS.length, maxIterations);
  const searchBudget = Math.max(0, maxIterations - fallbackBudget);

  const test = (candidateHex) => {
    const pair =
      colorToGenerateIndex === 0
        ? [candidateHex, targetCss]
        : [targetCss, candidateHex];
    return contrast(pair[0], pair[1], algorithm);
  };

  const consider = (candidateHex) => {
    const c = test(candidateHex);
    iterations++;
    if (bestContrast === null || Math.abs(c) > Math.abs(bestContrast)) {
      bestContrast = c;
      bestHex = candidateHex;
    }
    if (meetsThreshold(c, algorithm, threshold)) {
      foundHex = candidateHex;
      foundContrast = c;
      return true;
    }
    return false;
  };

  for (let i = 0; i < RANDOM_ATTEMPTS && iterations < searchBudget; i++) {
    const hex = toHex(randomSrgb01());
    if (consider(hex)) break;
  }

  if (!foundHex && iterations < searchBudget) {
    const grid = shuffledGrid(12, 10, 10);
    for (const [h, s, l] of grid) {
      if (iterations >= searchBudget) break;
      const hex = toHex(hsl01ToSrgb01(h, s, l));
      if (consider(hex)) break;
    }
  }

  if (!foundHex && fallbackBudget > 0) {
    for (const fallback of orderFallbacks(targetCss)) {
      if (iterations >= maxIterations) break;
      if (consider(fallback)) break;
    }
  }

  return {
    foundHex: foundHex || bestHex || "#000000",
    iterations,
    contrast: foundContrast ?? bestContrast ?? test("#000000"),
  };
}

function orderFallbacks(targetCss) {
  const luminance = getLuminanceY(linearSrgbFromEncoded(parseToSrgb01(targetCss)));
  return luminance >= 0.5 ? FALLBACKS : [...FALLBACKS].reverse();
}

/**
 * @param {object} o
 * @param {import('./contrast.js').ContrastAlgorithm} o.algorithm
 * @param {number} o.threshold
 * @param {string | null} o.color
 * @param {'background' | 'foreground'} o.role
 * @param {number} o.maxIterations
 */
function generateCombo(o) {
  const {
    algorithm,
    threshold,
    color,
    role,
    maxIterations,
  } = o;

  if (color == null) {
    let totalIterations = 0;
    let firstHex;
    let secondHex;
    let finalContrast = 0;

    for (let attempt = 0; attempt < 5; attempt++) {
      const baseHex = toHex(randomSrgb01());
      const remaining = Math.max(0, maxIterations - totalIterations);
      const { foundHex, iterations, contrast: c } = findColorMeetingThreshold(
        baseHex,
        threshold,
        algorithm,
        1,
        remaining
      );
      totalIterations += iterations;
      if (meetsThreshold(c, algorithm, threshold)) {
        firstHex = baseHex;
        secondHex = foundHex;
        finalContrast = c;
        break;
      }
    }

    if (!firstHex) {
      const baseHex = toHex(randomSrgb01());
      const remaining = Math.max(0, maxIterations - totalIterations);
      const { foundHex, iterations, contrast: c } = findColorMeetingThreshold(
        baseHex,
        threshold,
        algorithm,
        1,
        remaining
      );
      totalIterations += iterations;
      firstHex = baseHex;
      secondHex = foundHex;
      finalContrast = c;
    }

    return {
      colors: /** @type {[string, string]} */ ([firstHex, secondHex]),
      contrast: finalContrast,
      iterations: totalIterations,
    };
  }

  // Locked color: normalize to hex for stable comparisons
  const parsed = parseToSrgb01(color);
  const targetHex = toHex(parsed);
  const colorToGenerateIndex = role === "background" ? 1 : 0;

  const { foundHex, iterations, contrast: c } = findColorMeetingThreshold(
    targetHex,
    threshold,
    algorithm,
    colorToGenerateIndex,
    maxIterations
  );

  const colors =
    role === "background"
      ? /** @type {[string, string]} */ ([targetHex, foundHex])
      : /** @type {[string, string]} */ ([foundHex, targetHex]);

  return {
    colors,
    contrast: c,
    iterations,
  };
}

/* ===== cssVariables.js ===== */
const DEFAULT_COLOR1 = "--randoma11y-color-1";
const DEFAULT_COLOR2 = "--randoma11y-color-2";

/** @param {string} name */
function normalizeVarName(name) {
  const n = String(name).trim();
  if (!n) throw new TypeError("CSS variable name cannot be empty");
  return n.startsWith("--") ? n : `--${n}`;
}

/**
 * @param {boolean | { target?: Element | null; color1?: string; color2?: string; names?: [string, string] } | null | undefined} opt
 * @returns {{ target: Element | null; color1: string; color2: string } | null}
 */
function resolveCssVariablesOption(opt) {
  if (opt == null || opt === false) return null;

  const fallbackTarget =
    typeof document !== "undefined" ? document.documentElement : null;

  if (opt === true) {
    return {
      target: fallbackTarget,
      color1: DEFAULT_COLOR1,
      color2: DEFAULT_COLOR2,
    };
  }

  if (typeof opt !== "object") {
    throw new TypeError(
      "cssVariables must be true, false, null, or an options object"
    );
  }

  const color1 = normalizeVarName(
    opt.color1 ?? opt.names?.[0] ?? DEFAULT_COLOR1
  );
  const color2 = normalizeVarName(
    opt.color2 ?? opt.names?.[1] ?? DEFAULT_COLOR2
  );
  const target = opt.target !== undefined ? opt.target : fallbackTarget;

  if (
    target !== null &&
    (!target ||
      !target.style ||
      typeof target.style.setProperty !== "function")
  ) {
    throw new TypeError(
      "cssVariables.target must be null or an object with style.setProperty(name, value)"
    );
  }

  return {
    target,
    color1,
    color2,
  };
}

/**
 * @param {Element | null} target
 * @param {string} color1Name
 * @param {string} color2Name
 * @param {[string, string]} colors
 */
function applyCssVariables(target, color1Name, color2Name, colors) {
  if (!target) return false;
  if (!target.style || typeof target.style.setProperty !== "function") {
    throw new TypeError(
      "target must be an object with style.setProperty(name, value)"
    );
  }
  target.style.setProperty(color1Name, colors[0]);
  target.style.setProperty(color2Name, colors[1]);
  return true;
}

/* ===== index.js ===== */
/**
 * randoma11y — generate accessible two-color combinations (same contrast models as colorjs.io, inlined).
 *
 * @module randoma11y
 */




/** @typedef {import('./contrast.js').ContrastAlgorithm} ContrastAlgorithm */

/**
 * @typedef {object} Randoma11yOptions
 * @property {ContrastAlgorithm} [algorithm='APCA']
 * @property {number} [threshold=75]
 * @property {string} [color] If set, generates a partner for this color (see `role`).
 * @property {'background' | 'foreground'} [role='background'] When `color` is set: treat it as background (default) or foreground; the other slot is generated.
 * @property {number} [maxIterations=20000] Total search steps (random HSL grid + fallbacks share this budget).
 * @property {boolean | Randoma11yCssVariables} [cssVariables] When truthy, assigns `colors[0]` and `colors[1]` to CSS custom properties on a target element (default `document.documentElement`). In environments without `document`, nothing is set (`cssVariables.applied` is false).
 */

/**
 * @typedef {object} Randoma11yCssVariables
 * @property {Element | null} [target] Element to call `style.setProperty` on. Defaults to `document.documentElement` in browsers.
 * @property {string} [color1] First variable name (background). Default `--randoma11y-color-1`. Names without a `--` prefix get it added.
 * @property {string} [color2] Second variable name (foreground). Default `--randoma11y-color-2`.
 * @property {[string, string]} [names] Shorthand for `[color1, color2]`.
 */

/**
 * @typedef {object} Randoma11yResult
 * @property {[string, string]} colors `[background, foreground]` as hex strings.
 * @property {number} contrast Raw contrast value for the chosen algorithm (see `contrast()`).
 * @property {ContrastAlgorithm} algorithm The algorithm used for this result.
 * @property {number} threshold The threshold that was requested.
 * @property {boolean} meetsThreshold Whether `contrast` meets `threshold` for `algorithm`.
 * @property {number} iterations Search steps used.
 * @property {Randoma11yCssVariablesResult} [cssVariables] Present when `cssVariables` was requested.
 */

/**
 * @typedef {object} Randoma11yCssVariablesResult
 * @property {boolean} applied Whether `setProperty` ran (false if no DOM target).
 * @property {[string, string]} names The variable names used for color 1 and color 2.
 * @property {Element | null} target Element that received the properties, if any.
 */

/**
 * Generate an accessible **[background, foreground]** pair as hex strings.
 *
 * Naming: **`randoma11y`** matches the package name (`randoma11y` on npm). You can alias it locally
 * (`import { randoma11y as randomAccessiblePair } from 'randoma11y'`) if you prefer descriptive names.
 *
 * @param {Randoma11yOptions | string} [options] Options object, or a CSS color string shorthand for `{ color }`.
 * @returns {Randoma11yResult}
 *
 * @example
 * randoma11y()
 * randoma11y({ threshold: 90 })
 * randoma11y({ color: '#336699', role: 'background' })
 * randoma11y('#e2b714') // shorthand for { color: '#e2b714' }
 * randoma11y({ cssVariables: true }) // sets --randoma11y-color-1 / --randoma11y-color-2 on :root
 * randoma11y({ cssVariables: { target: document.body, names: ['--bg', '--fg'] } })
 */
function randoma11y(options) {
  const opts =
    typeof options === "string"
      ? { color: options }
      : options && typeof options === "object"
        ? options
        : {};

  const algorithm = assertAlgorithm(opts.algorithm ?? "APCA");
  const threshold = normalizeThreshold(opts.threshold ?? 75);
  const color = opts.color ?? null;
  const role = opts.role ?? "background";
  const maxIterations = normalizeMaxIterations(opts.maxIterations ?? 20000);
  const cssOpt = opts.cssVariables;

  if (role !== "background" && role !== "foreground") {
    throw new TypeError(`role must be 'background' or 'foreground', got ${role}`);
  }

  const combo = generateCombo({
    algorithm,
    threshold,
    color,
    role,
    maxIterations,
  });

  const result = {
    colors: combo.colors,
    contrast: combo.contrast,
    algorithm,
    threshold,
    meetsThreshold: meetsThreshold(combo.contrast, algorithm, threshold),
    iterations: combo.iterations,
  };

  const resolved = resolveCssVariablesOption(cssOpt);
  if (!resolved) {
    return result;
  }

  const applied = applyCssVariables(
    resolved.target,
    resolved.color1,
    resolved.color2,
    result.colors
  );

  return {
    ...result,
    cssVariables: {
      applied,
      names: /** @type {[string, string]} */ ([resolved.color1, resolved.color2]),
      target: resolved.target,
    },
  };
}

/** Descriptive alias for `randoma11y`. */
const randomAccessiblePair = randoma11y;

  global.randoma11y = randoma11y;
  global.randoma11y.randomAccessiblePair = randomAccessiblePair;
})(typeof window !== 'undefined' ? window : globalThis);

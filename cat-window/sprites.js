// Loads all 4 sprite sheets and exposes a combined cache of named animations.
// Each sheet is 6 cols × 3 rows. Each state may have multiple variants —
// when the cat enters that state the renderer picks one randomly.

const SHEETS = [
  '../assets/cat/sheet1.png',
  '../assets/cat/sheet2.png',
  '../assets/cat/sheet3.png',
  '../assets/cat/sheet4.png',
];

// Map state name → array of variant defs.
// Each variant: { sheet, row, frames, frameStart? }
//   frameStart defaults to 0 (start at column 0 of the row)
const STATE_MAP = {
  idle: [
    { sheet: 0, row: 0, frames: 6 },                      // sit + tail flick
    { sheet: 1, row: 1, frameStart: 0, frames: 2 },       // sheet2 — hunched
    { sheet: 1, row: 1, frameStart: 2, frames: 2 },       // sheet2 — forward gaze
    { sheet: 1, row: 1, frameStart: 4, frames: 2 },       // sheet2 — peaceful sit
    { sheet: 2, row: 1, frameStart: 0, frames: 2 },       // sheet3 — pose A
    { sheet: 2, row: 1, frameStart: 2, frames: 2 },       // sheet3 — pose B
    { sheet: 2, row: 1, frameStart: 4, frames: 2 },       // sheet3 — pose C
    { sheet: 3, row: 2, frameStart: 0, frames: 1 },       // sheet4 — single static pose
    { sheet: 3, row: 2, frameStart: 1, frames: 3 },       // sheet4 — 3-frame loop
    { sheet: 3, row: 2, frameStart: 4, frames: 2 },       // sheet4 — 2-frame loop
  ],
  walk: [
    { sheet: 0, row: 1, frames: 6 },                      // original walk
    { sheet: 1, row: 0, frames: 6 },                      // sheet2 walk variant
    { sheet: 2, row: 0, frames: 6 },                      // sheet3 walk variant
  ],
  sleep:   [{ sheet: 0, row: 2, frames: 6 }],             // curled up
  run: [
    { sheet: 1, row: 2, frames: 6 },                      // sheet2 — hop / leap
    { sheet: 2, row: 2, frames: 6 },                      // sheet3 — sprint
  ],
  alert:   [{ sheet: 1, row: 1, frameStart: 2, frames: 2 }], // forward gaze pair
  pounce:  [{ sheet: 2, row: 2, frames: 6 }],
  scratch: [{ sheet: 3, row: 0, frames: 6 }],
  play:    [{ sheet: 3, row: 1, frames: 6 }],
};

const NUM_COLS = 6;
const NUM_ROWS = 3;

function loadSprites(callback) {
  let loaded = 0;
  const images = new Array(SHEETS.length);

  SHEETS.forEach((src, idx) => {
    const img = new Image();
    img.onload = () => {
      images[idx] = img;
      loaded++;
      if (loaded === SHEETS.length) build();
    };
    img.onerror = () => {
      console.error('Failed to load sheet:', src);
      images[idx] = null;
      loaded++;
      if (loaded === SHEETS.length) build();
    };
    img.src = src;
  });

  function build() {
    const cache = {};
    let refW = 0, refH = 0;

    for (const [name, defs] of Object.entries(STATE_MAP)) {
      const variants = [];
      for (const def of defs) {
        const img = images[def.sheet];
        if (!img) continue;
        const cellW = img.naturalWidth / NUM_COLS;
        const cellH = img.naturalHeight / NUM_ROWS;
        if (!refW) { refW = cellW; refH = cellH; }
        const start = def.frameStart || 0;
        const frames = [];
        for (let f = 0; f < def.frames; f++) {
          const sx = Math.round((start + f) * cellW);
          const sy = Math.round(def.row * cellH);
          const sw = Math.round(cellW);
          const sh = Math.round(cellH);
          const cv = document.createElement('canvas');
          cv.width = sw;
          cv.height = sh;
          const cctx = cv.getContext('2d');
          cctx.imageSmoothingEnabled = false;
          cctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
          frames.push(cv);
        }
        variants.push(frames);
      }
      cache[name] = variants;
    }
    callback({ variants: cache, w: Math.round(refW), h: Math.round(refH) });
  }
}

window.SPRITES_DATA = { loadSprites };

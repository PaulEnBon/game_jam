/*
  Extrait PAUL - textures procedurales
*/

let blockTextures = {};
let texturePixelCache = {};

function generateAllBlockTextures() {
  blockTextures[1] = generateStoneTexture();
  blockTextures[2] = generateDirtTexture();
  blockTextures[3] = generateGrassSideTexture();
  blockTextures[4] = generateMossyCobblestoneTexture();
  blockTextures[5] = generateGlowstoneTexture();
  blockTextures[6] = generateCorruptionTexture();
}

function generateStoneTexture() {
  const tex = createGraphics(TEXTURE_SIZE, TEXTURE_SIZE);
  tex.loadPixels();
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const base = 128 + Math.floor(Math.random() * 18 - 9);
      const r = base - Math.floor(Math.random() * 12);
      const g = base - Math.floor(Math.random() * 8);
      const b = base + Math.floor(Math.random() * 6);
      setPixelAt(tex, x, y, r, g, b);
    }
  }
  for (let i = 0; i < 12; i++) {
    const cx = Math.floor(Math.random() * TEXTURE_SIZE);
    const cy = Math.floor(Math.random() * TEXTURE_SIZE);
    setPixelAt(tex, cx, cy, 70, 70, 72);
  }
  tex.updatePixels();
  return tex;
}

function generateDirtTexture() {
  const tex = createGraphics(TEXTURE_SIZE, TEXTURE_SIZE);
  tex.loadPixels();
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const n = Math.floor(Math.random() * 24 - 12);
      setPixelAt(tex, x, y, 134 + n, 96 + n, 67 + n);
    }
  }
  for (let i = 0; i < 8; i++) {
    const px = Math.floor(Math.random() * TEXTURE_SIZE);
    const py = Math.floor(Math.random() * TEXTURE_SIZE);
    setPixelAt(tex, px, py, 160, 140, 110);
  }
  tex.updatePixels();
  return tex;
}

function generateGrassSideTexture() {
  const tex = createGraphics(TEXTURE_SIZE, TEXTURE_SIZE);
  tex.loadPixels();
  const grassLine = Math.floor(TEXTURE_SIZE * 0.30);
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const n = Math.floor(Math.random() * 18 - 9);
      if (y < grassLine) {
        setPixelAt(tex, x, y, 76 + n, 175 + n, 60 + n);
      } else if (y === grassLine) {
        setPixelAt(tex, x, y, 60 + n, 130 + n, 48 + n);
      } else {
        setPixelAt(tex, x, y, 134 + n, 96 + n, 67 + n);
      }
    }
  }
  tex.updatePixels();
  return tex;
}

function generateMossyCobblestoneTexture() {
  const tex = createGraphics(TEXTURE_SIZE, TEXTURE_SIZE);
  tex.loadPixels();
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const n = Math.floor(Math.random() * 20 - 10);
      const mossy = Math.random() < 0.25;
      if (mossy) {
        setPixelAt(tex, x, y, 72 + n, 140 + n, 68 + n);
      } else {
        setPixelAt(tex, x, y, 115 + n, 115 + n, 115 + n);
      }
    }
  }
  tex.updatePixels();
  return tex;
}

function generateGlowstoneTexture() {
  const tex = createGraphics(TEXTURE_SIZE, TEXTURE_SIZE);
  tex.loadPixels();
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const n = Math.floor(Math.random() * 30 - 15);
      setPixelAt(tex, x, y, 220 + n, 195 + n, 100 + Math.floor(Math.random() * 30));
    }
  }
  tex.updatePixels();
  return tex;
}

function generateCorruptionTexture() {
  const tex = createGraphics(TEXTURE_SIZE, TEXTURE_SIZE);
  tex.loadPixels();
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const n = Math.floor(Math.random() * 22 - 11);
      setPixelAt(tex, x, y, 140 + n, 18 + Math.abs(n), 28 + Math.abs(n));
    }
  }
  for (let i = 0; i < 18; i++) {
    const vx = Math.floor(Math.random() * TEXTURE_SIZE);
    const vy = Math.floor(Math.random() * TEXTURE_SIZE);
    setPixelAt(tex, vx, vy, 255, 60, 60);
  }
  tex.updatePixels();
  return tex;
}

function setPixelAt(gfx, pixelX, pixelY, r, g, b) {
  const index = 4 * (pixelY * gfx.width + pixelX);
  gfx.pixels[index] = constrain(r, 0, 255);
  gfx.pixels[index + 1] = constrain(g, 0, 255);
  gfx.pixels[index + 2] = constrain(b, 0, 255);
  gfx.pixels[index + 3] = 255;
}

function cacheAllTexturePixels() {
  for (const key of Object.keys(blockTextures)) {
    const tex = blockTextures[key];
    tex.loadPixels();
    texturePixelCache[key] = new Uint8ClampedArray(tex.pixels);
  }
}

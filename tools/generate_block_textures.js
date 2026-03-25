#!/usr/bin/env node

/**
 * Generate Minecraft-style block textures
 * Creates PNG files for each block type
 */

const fs = require('fs');
const path = require('path');

// Try to use canvas, fallback to creating simple colored PNG
let Canvas, createCanvas;
try {
  const canvasModule = require('canvas');
  Canvas = canvasModule.Canvas;
  createCanvas = canvasModule.createCanvas;
} catch (e) {
  console.log('canvas module not available, will create simple PNG textures without noise patterns');
}

const TEXTURE_SIZE = 16;
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'textures');

// Block color definitions (base RGB)
const blockDefinitions = {
  1: { name: 'stone', colors: { main: [128, 128, 128], accent: [96, 96, 96] } },
  2: { name: 'dirt', colors: { main: [139, 90, 43], accent: [110, 70, 35] } },
  3: { name: 'grass_side', colors: { main: [139, 90, 43], accent: [107, 142, 35] } }, // Dirt with green trim
  4: { name: 'mossy_cobblestone', colors: { main: [100, 100, 100], accent: [70, 120, 70] } },
  5: { name: 'glowstone', colors: { main: [255, 255, 150], accent: [255, 255, 100] } },
  6: { name: 'lava', colors: { main: [255, 140, 0], accent: [200, 60, 0] } },
  7: { name: 'plank', colors: { main: [139, 69, 19], accent: [100, 45, 10] } },
  8: { name: 'leaves', colors: { main: [34, 139, 34], accent: [22, 85, 22] } },
  9: { name: 'obsidian', colors: { main: [16, 16, 16], accent: [5, 5, 5] } },
  10: { name: 'plank', colors: { main: [210, 180, 140], accent: [170, 140, 100] } },
  11: { name: 'obsidian', colors: { main: [20, 20, 20], accent: [10, 10, 10] } }
};

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Create a simple texture using raw PNG bytes
 * This is a minimal valid PNG generator
 */
function createSimplePNG(width, height, pixelData) {
  const zlib = require('zlib');
  
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk (image header)
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type (RGB)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = Buffer.concat([
    Buffer.from('IHDR'),
    ihdr,
    Buffer.from(crc32('IHDR' + ihdr.toString('binary')).toString(16).padStart(8, '0'), 'hex')
  ]);

  // Pad IHDR length
  const ihdrLength = Buffer.alloc(4);
  ihdrLength.writeUInt32BE(13, 0);

  // IDAT chunk (image data)
  const rawImageData = Buffer.alloc(height * (width * 3 + 1));
  let offset = 0;
  
  for (let y = 0; y < height; y++) {
    rawImageData[offset++] = 0; // filter type none
    for (let x = 0; x < width; x++) {
      const pixelIndex = (y * width + x) * 3;
      rawImageData[offset++] = pixelData[pixelIndex];
      rawImageData[offset++] = pixelData[pixelIndex + 1];
      rawImageData[offset++] = pixelData[pixelIndex + 2];
    }
  }

  const compressed = zlib.deflateSync(rawImageData);
  const idatChunk = Buffer.concat([
    Buffer.from('IDAT'),
    compressed,
    Buffer.from(crc32('IDAT' + compressed.toString('binary')).toString(16).padStart(8, '0'), 'hex')
  ]);

  const idatLength = Buffer.alloc(4);
  idatLength.writeUInt32BE(compressed.length, 0);

  // IEND chunk
  const iendChunk = Buffer.concat([
    Buffer.from('IEND'),
    Buffer.from('0000b725', 'hex') // Pre-calculated CRC for IEND
  ]);
  const iendLength = Buffer.from([0, 0, 0, 0]);

  return Buffer.concat([
    signature,
    ihdrLength, ihdrChunk,
    idatLength, idatChunk,
    iendLength, iendChunk
  ]);
}

function crc32(str) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < str.length; i++) {
    crc = (crc >>> 8) ^ ((crc ^ str.charCodeAt(i)) << 24);
  }
  return (crc ^ (-1)) >>> 0;
}

/**
 * Generate a texture as pixel data array
 */
function generateTexturePixels(blockId) {
  const def = blockDefinitions[blockId];
  const [r, g, b] = def.colors.main;
  const [ar, ag, ab] = def.colors.accent;
  
  const pixelData = Buffer.alloc(TEXTURE_SIZE * TEXTURE_SIZE * 3);
  
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const idx = (y * TEXTURE_SIZE + x) * 3;
      
      // Create simple pattern based on block type
      let useAccent = false;
      
      if (blockId === 3) {
        // Grass: green on top, dirt bottom
        useAccent = y < 4;
      } else if (blockId === 4) {
        // Mossy: spots of moss
        const pattern = ((x ^ y) % 4 === 0) ? Math.random() > 0.5 : false;
        useAccent = pattern;
      } else if (blockId === 7 || blockId === 10) {
        // Planks: wood grain
        useAccent = (Math.floor(x / 2) % 2) === (Math.floor(y / 4) % 2);
      } else if (blockId === 6) {
        // Lava: wavy pattern
        useAccent = Math.sin(x * 0.5 + y * 0.3) > 0;
      } else {
        // Random pixel variation
        useAccent = (x + y) % 3 === 0;
      }
      
      if (useAccent) {
        pixelData[idx] = ar;
        pixelData[idx + 1] = ag;
        pixelData[idx + 2] = ab;
      } else {
        pixelData[idx] = r;
        pixelData[idx + 1] = g;
        pixelData[idx + 2] = b;
      }
    }
  }
  
  return pixelData;
}

/**
 * Generate all block textures
 */
async function generateAllTextures() {
  console.log(`Generating block textures in ${OUTPUT_DIR}...`);
  
  for (const blockId of Object.keys(blockDefinitions)) {
    const def = blockDefinitions[blockId];
    const filename = `${def.name}.png`;
    const filepath = path.join(OUTPUT_DIR, filename);
    
    try {
      const pixelData = generateTexturePixels(Number(blockId));
      const pngBuffer = createSimplePNG(TEXTURE_SIZE, TEXTURE_SIZE, pixelData);
      fs.writeFileSync(filepath, pngBuffer);
      console.log(`✅ Created: ${filename}`);
    } catch (err) {
      console.error(`❌ Error creating ${filename}:`, err.message);
    }
  }
  
  console.log('\n✨ All block textures generated!');
}

generateAllTextures().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

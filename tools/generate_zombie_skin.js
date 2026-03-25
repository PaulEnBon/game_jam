#!/usr/bin/env node
/**
 * Generate a 64x64 Minecraft Zombie skin PNG from scratch
 * Uses the exact color palette and placement coordinates
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// Color palette (RGB)
const COLORS = {
  skin_light: [121, 158, 75],   // Vert Moisi #799E4B
  skin_dark: [68, 93, 37],       // Vert Sombre #445D25
  hair: [31, 44, 15],            // Vert Très Foncé #1F2C0F
  shirt: [4, 115, 116],          // Bleu Canard #047374
  pants: [60, 68, 129],          // Bleu Jean #3C4481
  eye_dark: [26, 11, 43],        // Noir #1A0B2B
};

// Create 64x64 RGBA image buffer (256KB)
const WIDTH = 64;
const HEIGHT = 64;
const pixelData = Buffer.alloc(WIDTH * HEIGHT * 4);

// Fill entire canvas with transparent
for (let i = 0; i < pixelData.length; i += 4) {
  pixelData[i] = 0;     // R
  pixelData[i + 1] = 0; // G
  pixelData[i + 2] = 0; // B
  pixelData[i + 3] = 0; // A (transparent)
}

function setPixel(x, y, [r, g, b]) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const idx = (y * WIDTH + x) * 4;
  pixelData[idx] = r;
  pixelData[idx + 1] = g;
  pixelData[idx + 2] = b;
  pixelData[idx + 3] = 255; // Full opacity
}

function fillRect(x, y, w, h, color) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      setPixel(x + dx, y + dy, color);
    }
  }
}

// ============================================================
// 1. HEAD (8x8) - Face Front at (8, 8)
// ============================================================
fillRect(8, 8, 8, 8, COLORS.skin_light);
// Eyes
setPixel(9, 12, COLORS.eye_dark);   // Left eye
setPixel(14, 12, COLORS.eye_dark);  // Right eye
// Nose
setPixel(11, 13, COLORS.skin_dark);
setPixel(12, 13, COLORS.skin_dark);

// ============================================================
// 2. BODY/TORSO (8x12) - Face Front at (20, 20)
// ============================================================
fillRect(20, 20, 8, 12, COLORS.shirt);
// Neck gap (show skin color)
setPixel(23, 20, COLORS.skin_light);
setPixel(24, 20, COLORS.skin_light);

// ============================================================
// 3. RIGHT ARM (4x12) - Face Front at (44, 20)
// ============================================================
fillRect(44, 20, 4, 12, COLORS.skin_light);

// ============================================================
// 4. LEFT ARM (4x12) - Face Front at (36, 52)
// ============================================================
fillRect(36, 52, 4, 12, COLORS.skin_light);

// ============================================================
// 5. RIGHT LEG (4x12) - Face Front at (4, 20)
// ============================================================
fillRect(4, 20, 4, 12, COLORS.pants);

// ============================================================
// 6. LEFT LEG (4x12) - Face Front at (20, 52)
// ============================================================
fillRect(20, 52, 4, 12, COLORS.pants);

// ============================================================
// Write PNG using manual encoding
// ============================================================

function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const typeStr = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  
  const crcData = Buffer.concat([typeStr, data]);
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(crcData), 0);
  
  return Buffer.concat([length, typeStr, data, crcVal]);
}

function writePNG(filename) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(WIDTH, 0);      // Width
  ihdrData.writeUInt32BE(HEIGHT, 4);     // Height
  ihdrData.writeUInt8(8, 8);             // Bit depth
  ihdrData.writeUInt8(6, 9);             // Color type (6 = RGBA)
  ihdrData.writeUInt8(0, 10);            // Compression
  ihdrData.writeUInt8(0, 11);            // Filter
  ihdrData.writeUInt8(0, 12);            // Interlace
  
  // Build uncompressed IDAT data with filter bytes
  let rawData = Buffer.alloc((1 + WIDTH * 4) * HEIGHT);
  let offset = 0;
  
  for (let y = 0; y < HEIGHT; y++) {
    rawData[offset++] = 0; // Filter type: None
    for (let x = 0; x < WIDTH; x++) {
      const pixIdx = (y * WIDTH + x) * 4;
      rawData[offset++] = pixelData[pixIdx];     // R
      rawData[offset++] = pixelData[pixIdx + 1]; // G
      rawData[offset++] = pixelData[pixIdx + 2]; // B
      rawData[offset++] = pixelData[pixIdx + 3]; // A
    }
  }
  
  // Compress synchronously
  const compressedData = zlib.deflateSync(rawData);
  
  // Build PNG file
  let pngBuffer = Buffer.concat([
    signature,
    makeChunk("IHDR", ihdrData),
    makeChunk("IDAT", compressedData),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
  
  fs.writeFileSync(filename, pngBuffer);
  console.log("✓ Zombie skin PNG generated:", filename);
}

// Generate the PNG
const outputPath = path.join(__dirname, "..", "Zombie.png");
writePNG(outputPath);

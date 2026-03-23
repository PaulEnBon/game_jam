/*
  ============================================================
  MAP GENERATOR
  ============================================================
  The map is a 2-D array of integers.
  0  = empty (walkable)
  1+ = wall block type (see textures)

  We generate a bordered arena with random internal pillars / structures
  to make navigation interesting.
*/

let worldTileMap = [];

/**
 * Builds the initial tile map.
 * Border walls are grass-side (3), internal features use stone (1),
 * mossy cobble (4) and occasional glowstone (5) for lighting landmarks.
 */
function generateWorldMap() {
  // Initialise empty grid
  worldTileMap = [];
  for (let row = 0; row < MAP_TILE_COUNT; row++) {
    worldTileMap[row] = [];
    for (let col = 0; col < MAP_TILE_COUNT; col++) {
      worldTileMap[row][col] = 0;
    }
  }

  // Outer border (grass side blocks)
  for (let row = 0; row < MAP_TILE_COUNT; row++) {
    for (let col = 0; col < MAP_TILE_COUNT; col++) {
      if (row === 0 || row === MAP_TILE_COUNT - 1 || col === 0 || col === MAP_TILE_COUNT - 1) {
        worldTileMap[row][col] = 3; // grass side
      }
    }
  }

  // Random internal pillars (stone)
  const pillarCount = 18;
  for (let i = 0; i < pillarCount; i++) {
    const pr = Math.floor(Math.random() * (MAP_TILE_COUNT - 6)) + 3;
    const pc = Math.floor(Math.random() * (MAP_TILE_COUNT - 6)) + 3;
    // Avoid placing a pillar right at the player spawn (centre)
    if (Math.abs(pr - MAP_TILE_COUNT / 2) < 3 && Math.abs(pc - MAP_TILE_COUNT / 2) < 3) continue;
    const blockType = Math.random() < 0.15 ? 4 : 1; // 15 % mossy cobble
    worldTileMap[pr][pc] = blockType;
    // Sometimes extend to a 2-tall or L-shape
    if (Math.random() < 0.4 && pr + 1 < MAP_TILE_COUNT - 1) {
      worldTileMap[pr + 1][pc] = blockType;
    }
    if (Math.random() < 0.3 && pc + 1 < MAP_TILE_COUNT - 1) {
      worldTileMap[pr][pc + 1] = blockType;
    }
  }

  // A few glowstone landmarks
  const glowCount = 5;
  for (let i = 0; i < glowCount; i++) {
    const gr = Math.floor(Math.random() * (MAP_TILE_COUNT - 6)) + 3;
    const gc = Math.floor(Math.random() * (MAP_TILE_COUNT - 6)) + 3;
    if (worldTileMap[gr][gc] === 0) {
      worldTileMap[gr][gc] = 5;
    }
  }

  // Make sure the spawn area (centre 3×3) is clear
  const cx = Math.floor(MAP_TILE_COUNT / 2);
  const cy = Math.floor(MAP_TILE_COUNT / 2);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      worldTileMap[cy + dy][cx + dx] = 0;
    }
  }
}

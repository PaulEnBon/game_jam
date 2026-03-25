/*
  ============================================================
  MAP GENERATOR
  ============================================================
  The map is a 2-D array of integers.
  0  = empty (walkable)
  1+ = wall block type (see textures)

  Normal generation with walls, pillars, structures
*/

let worldTileMap = [];

/**
 * Builds the tile map with border walls and internal structures.
 * Rendered the same way in both 2D and 3D.
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

  const spawnCenter = Math.floor(MAP_TILE_COUNT / 2);
  const isNearSpawn = (row, col, pad = 3) =>
    Math.abs(row - spawnCenter) <= pad && Math.abs(col - spawnCenter) <= pad;

  const canPlaceInside = (row, col) =>
    row > 0 && row < MAP_TILE_COUNT - 1 && col > 0 && col < MAP_TILE_COUNT - 1;

  const tryPlaceBlock = (row, col, blockType, overwrite = false) => {
    if (!canPlaceInside(row, col)) return false;
    if (isNearSpawn(row, col)) return false;
    if (!overwrite && worldTileMap[row][col] !== 0) return false;
    worldTileMap[row][col] = blockType;
    return true;
  };

  // Outer border
  for (let row = 0; row < MAP_TILE_COUNT; row++) {
    for (let col = 0; col < MAP_TILE_COUNT; col++) {
      if (row === 0 || row === MAP_TILE_COUNT - 1 || col === 0 || col === MAP_TILE_COUNT - 1) {
        const isCorner =
          (row === 0 || row === MAP_TILE_COUNT - 1) &&
          (col === 0 || col === MAP_TILE_COUNT - 1);
        if (isCorner) {
          worldTileMap[row][col] = 9;
        } else {
          worldTileMap[row][col] = (row + col) % 5 === 0 ? 7 : 3;
        }
      }
    }
  }

  // Random internal pillars (REDUCED for 3D performance)
  const pillarCount = Math.floor(MAP_TILE_COUNT * 0.25);  // Réduit à 25%
  for (let i = 0; i < pillarCount; i++) {
    const pr = Math.floor(Math.random() * (MAP_TILE_COUNT - 6)) + 3;
    const pc = Math.floor(Math.random() * (MAP_TILE_COUNT - 6)) + 3;
    if (isNearSpawn(pr, pc, 3)) continue;

    const r = Math.random();
    const blockType =
      r < 0.52 ? 1 :
      r < 0.72 ? 4 :
      r < 0.88 ? 7 : 9;

    tryPlaceBlock(pr, pc, blockType);

    // Sometimes extend to short line
    if (Math.random() < 0.1 && pr + 1 < MAP_TILE_COUNT - 1) {
      tryPlaceBlock(pr + 1, pc, blockType);
    }
  }

  // Ruined walls (REDUCED)
  const ruinCount = Math.floor(MAP_TILE_COUNT * 0.08);
  for (let i = 0; i < ruinCount; i++) {
    const startRow = Math.floor(Math.random() * (MAP_TILE_COUNT - 8)) + 4;
    const startCol = Math.floor(Math.random() * (MAP_TILE_COUNT - 8)) + 4;
    if (isNearSpawn(startRow, startCol, 4)) continue;

    const horizontal = Math.random() < 0.5;
    const len = 2 + Math.floor(Math.random() * 3);
    const blockType = Math.random() < 0.68 ? 9 : 7;

    for (let t = 0; t < len; t++) {
      const rr = horizontal ? startRow : startRow + t;
      const cc = horizontal ? startCol + t : startCol;
      tryPlaceBlock(rr, cc, blockType);
    }
  }

  // Add solid floor foundation at bottom (last 4 rows)
  // Creates a solid base platform of floor blocks (type 12)
  // DISABLED: Type 12 blocks are causing rendering issues - keep them out for now
  /*
  const floorStartRow = MAP_TILE_COUNT - 4;
  for (let row = floorStartRow; row < MAP_TILE_COUNT; row++) {
    for (let col = 0; col < MAP_TILE_COUNT; col++) {
      // Don't overwrite border walls, keep them
      if (row === MAP_TILE_COUNT - 1 || col === 0 || col === MAP_TILE_COUNT - 1) {
        // Keep existing border
        continue;
      }
      worldTileMap[row][col] = 12;  // Floor block type
    }
  }
  */

  // Make sure spawn area is clear
  const cx = Math.floor(MAP_TILE_COUNT / 2);
  const cy = Math.floor(MAP_TILE_COUNT / 2);
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      worldTileMap[cy + dy][cx + dx] = 0;
    }
  }
}

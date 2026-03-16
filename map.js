let worldTileMap = [];

/**
 * Builds the initial tile map.
 * Border: mixed natural fortification materials.
 * Varied internal structures.
 *
 * Block types:
 *   0  = empty (walkable)
 *   1  = stone
 *   2  = dirt
 *   3  = grass side
 *   4  = mossy cobblestone
 *   5  = glowstone
 *   6  = lava (corruption)
 *   7  = wooden plank
 *   8  = crystal / leaves
 *   9  = dark brick / obsidian
 *  10  = candy cartoon
 *  11  = pop cartoon
 */
function generateWorldMap() {
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

  // --- Outer border (mixed fortification) ---
  for (let row = 0; row < MAP_TILE_COUNT; row++) {
    for (let col = 0; col < MAP_TILE_COUNT; col++) {
      if (row === 0 || row === MAP_TILE_COUNT - 1 || col === 0 || col === MAP_TILE_COUNT - 1) {
        const isCorner =
          (row === 0 || row === MAP_TILE_COUNT - 1) &&
          (col === 0 || col === MAP_TILE_COUNT - 1);
        if (isCorner) {
          worldTileMap[row][col] = 9;             // corners = obsidian
        } else {
          worldTileMap[row][col] = (row + col) % 5 === 0 ? 7 : 3;
        }
      }
    }
  }

  // --- Inner pillars (reduced density) ---
  const pillarCount = Math.floor(MAP_TILE_COUNT * 0.52);
  for (let i = 0; i < pillarCount; i++) {
    const pr = Math.floor(Math.random() * (MAP_TILE_COUNT - 6)) + 3;
    const pc = Math.floor(Math.random() * (MAP_TILE_COUNT - 6)) + 3;
    if (isNearSpawn(pr, pc, 3)) continue;

    const r = Math.random();
    const blockType =
      r < 0.52 ? 1 :       // stone
      r < 0.72 ? 4 :       // mossy
      r < 0.88 ? 7 : 9;    // plank / dark brick

    tryPlaceBlock(pr, pc, blockType);

    // Short extension (line / L shape)
    if (Math.random() < 0.18 && pr + 1 < MAP_TILE_COUNT - 1) tryPlaceBlock(pr + 1, pc, blockType);
    if (Math.random() < 0.14 && pc + 1 < MAP_TILE_COUNT - 1) tryPlaceBlock(pr, pc + 1, blockType);
    if (Math.random() < 0.10 && pr - 1 > 0)                  tryPlaceBlock(pr - 1, pc, blockType);
  }

  // --- Ruined walls ---
  const ruinCount = Math.floor(MAP_TILE_COUNT * 0.18);
  for (let i = 0; i < ruinCount; i++) {
    const startRow = Math.floor(Math.random() * (MAP_TILE_COUNT - 8)) + 4;
    const startCol = Math.floor(Math.random() * (MAP_TILE_COUNT - 8)) + 4;
    if (isNearSpawn(startRow, startCol, 4)) continue;

    const horizontal = Math.random() < 0.5;
    const len = 2 + Math.floor(Math.random() * 4);
    const blockType = Math.random() < 0.68 ? 9 : 7;

    for (let t = 0; t < len; t++) {
      const rr = horizontal ? startRow : startRow + t;
      const cc = horizontal ? startCol + t : startCol;
      tryPlaceBlock(rr, cc, blockType);
      if (Math.random() < 0.08) {
        tryPlaceBlock(rr + (horizontal ? 1 : 0), cc + (horizontal ? 0 : 1), blockType);
      }
    }
  }

  // --- Crystal clusters ---
  const crystalCount = Math.floor(MAP_TILE_COUNT * 0.16);
  for (let i = 0; i < crystalCount; i++) {
    const cr = Math.floor(Math.random() * (MAP_TILE_COUNT - 8)) + 4;
    const cc = Math.floor(Math.random() * (MAP_TILE_COUNT - 8)) + 4;
    if (isNearSpawn(cr, cc, 4)) continue;

    if (tryPlaceBlock(cr, cc, 8)) {
      if (Math.random() < 0.2) tryPlaceBlock(cr + 1, cc, 8);
      if (Math.random() < 0.2) tryPlaceBlock(cr - 1, cc, 8);
      if (Math.random() < 0.2) tryPlaceBlock(cr, cc + 1, 8);
      if (Math.random() < 0.2) tryPlaceBlock(cr, cc - 1, 8);
      if (Math.random() < 0.12) tryPlaceBlock(cr + 1, cc + 1, 5); // nearby glowstone
    }
  }

  // --- Extra glowstones ---
  const glowCount = Math.floor(MAP_TILE_COUNT * 0.08);
  for (let i = 0; i < glowCount; i++) {
    const gr = Math.floor(Math.random() * (MAP_TILE_COUNT - 6)) + 3;
    const gc = Math.floor(Math.random() * (MAP_TILE_COUNT - 6)) + 3;
    tryPlaceBlock(gr, gc, 5);
  }

  // --- Cartoon zone (top-right) — blocks 7, 8, 9 ---
  const cartoonZoneHeight = Math.max(10, Math.floor(MAP_TILE_COUNT * 0.24));
  const cartoonZoneWidth  = Math.max(12, Math.floor(MAP_TILE_COUNT * 0.30));
  const cartoonTop   = 2;
  const cartoonLeft  = MAP_TILE_COUNT - cartoonZoneWidth - 2;
  const cartoonBottom = cartoonTop  + cartoonZoneHeight - 1;
  const cartoonRight  = cartoonLeft + cartoonZoneWidth  - 1;

  for (let row = cartoonTop; row <= cartoonBottom; row++) {
    for (let col = cartoonLeft; col <= cartoonRight; col++) {
      const border =
        row === cartoonTop || row === cartoonBottom ||
        col === cartoonLeft || col === cartoonRight;

      if (border) {
        worldTileMap[row][col] = (row + col) % 2 === 0 ? 7 : 9;
      } else if ((row + col) % 7 === 0 || (row % 4 === 0 && col % 3 === 0)) {
        worldTileMap[row][col] = (row * 3 + col) % 3 === 0 ? 8 : 7;
      } else {
        worldTileMap[row][col] = 0;
      }
    }
  }

  // Entry gate into the cartoon zone
  const zoneGateRow = Math.floor((cartoonTop + cartoonBottom) / 2);
  const zoneGateCol = cartoonLeft;
  worldTileMap[zoneGateRow][zoneGateCol]     = 0;
  worldTileMap[zoneGateRow][zoneGateCol - 1] = 0;

  // Corridor from spawn to the cartoon zone (vertical then horizontal)
  for (let row = spawnCenter; row >= zoneGateRow; row--) {
    if (row > 0 && row < MAP_TILE_COUNT - 1) {
      worldTileMap[row][spawnCenter] = 0;
      if (spawnCenter + 1 < MAP_TILE_COUNT - 1) worldTileMap[row][spawnCenter + 1] = 0;
    }
  }
  for (let col = spawnCenter; col <= zoneGateCol; col++) {
    if (zoneGateRow > 0 && zoneGateRow < MAP_TILE_COUNT - 1 && col > 0 && col < MAP_TILE_COUNT - 1) {
      worldTileMap[zoneGateRow][col] = 0;
      if (zoneGateRow - 1 > 0) worldTileMap[zoneGateRow - 1][col] = 0;
    }
  }

  // --- Clear spawn zone (center 5×5) ---
  const cx = Math.floor(MAP_TILE_COUNT / 2);
  const cy = Math.floor(MAP_TILE_COUNT / 2);
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      worldTileMap[cy + dy][cx + dx] = 0;
    }
  }
}

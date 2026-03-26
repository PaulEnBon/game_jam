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

  // Random internal pillars (HEAVILY INCREASED density)
  const pillarCount = Math.floor(MAP_TILE_COUNT * 0.5);  // Augmenté à 50%
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

    // Less often extend - keep more isolated blocks
    if (Math.random() < 0.15) {
      const direction = Math.floor(Math.random() * 4); // 0=down, 1=right, 2=up, 3=left
      const steps = 1 + Math.floor(Math.random() * 2);
      for (let s = 0; s < steps; s++) {
        const nr = pr + (direction === 0 ? s + 1 : direction === 2 ? -(s + 1) : 0);
        const nc = pc + (direction === 1 ? s + 1 : direction === 3 ? -(s + 1) : 0);
        if (nr > 0 && nr < MAP_TILE_COUNT - 1 && nc > 0 && nc < MAP_TILE_COUNT - 1) {
          tryPlaceBlock(nr, nc, blockType);
        }
      }
    }
  }

  // Extra scattered blocks (NEW - pure isolated blocks)
  const scatteredCount = Math.floor(MAP_TILE_COUNT * 0.35);  // 35% de blocs isolés supplémentaires
  for (let i = 0; i < scatteredCount; i++) {
    const sr = Math.floor(Math.random() * (MAP_TILE_COUNT - 6)) + 3;
    const sc = Math.floor(Math.random() * (MAP_TILE_COUNT - 6)) + 3;
    if (isNearSpawn(sr, sc, 3)) continue;

    const r = Math.random();
    const blockType =
      r < 0.45 ? 1 :
      r < 0.68 ? 4 :
      r < 0.82 ? 7 : 9;

    // Just place the block, never extend these
    tryPlaceBlock(sr, sc, blockType);
  }

  // Ruined walls (SIGNIFICANTLY INCREASED)
  const ruinCount = Math.floor(MAP_TILE_COUNT * 0.27);  // Augmenté à 27%
  for (let i = 0; i < ruinCount; i++) {
    const startRow = Math.floor(Math.random() * (MAP_TILE_COUNT - 8)) + 4;
    const startCol = Math.floor(Math.random() * (MAP_TILE_COUNT - 8)) + 4;
    if (isNearSpawn(startRow, startCol, 4)) continue;

    const direction = Math.floor(Math.random() * 4); // 0=vertical, 1=horizontal, 2=diagonal+, 3=diagonal-
    const len = 3 + Math.floor(Math.random() * 5);  // Murs plus longs (3-7)
    const blockType = Math.random() < 0.75 ? 9 : (Math.random() < 0.6 ? 7 : 4);  // Plus d'obsidienne

    for (let t = 0; t < len; t++) {
      let rr = startRow;
      let cc = startCol;
      
      if (direction === 0) {
        rr = startRow + t;  // Vertical vers le bas
      } else if (direction === 1) {
        cc = startCol + t;  // Horizontal vers la droite
      } else if (direction === 2) {
        rr = startRow + t;  // Diagonal +
        cc = startCol + t;
      } else {
        rr = startRow + t;  // Diagonal -
        cc = startCol - t;
      }
      
      if (rr > 0 && rr < MAP_TILE_COUNT - 1 && cc > 0 && cc < MAP_TILE_COUNT - 1) {
        tryPlaceBlock(rr, cc, blockType);
      }
    }
  }

  // NEW: Obsidian vein lines (vertical obsidian streaks for atmosphere)
  const veinCount = Math.floor(MAP_TILE_COUNT * 0.1);  // 10% de la carte
  for (let i = 0; i < veinCount; i++) {
    const startRow = Math.floor(Math.random() * (MAP_TILE_COUNT - 12)) + 6;
    const startCol = Math.floor(Math.random() * (MAP_TILE_COUNT - 12)) + 6;
    if (isNearSpawn(startRow, startCol, 5)) continue;

    const veinLen = 4 + Math.floor(Math.random() * 6);  // 4-9 blocs
    const isVertical = Math.random() < 0.6;  // 60% vertical, 40% horizontal
    
    for (let v = 0; v < veinLen; v++) {
      const vr = isVertical ? startRow + v : startRow;
      const vc = isVertical ? startCol : startCol + v;
      if (vr > 0 && vr < MAP_TILE_COUNT - 1 && vc > 0 && vc < MAP_TILE_COUNT - 1) {
        tryPlaceBlock(vr, vc, 9);  // Pure obsidian (type 9)
      }
    }
  }

  // NEW: Small rooms/chambers (3x3 structures)
  const roomCount = Math.floor(MAP_TILE_COUNT * 0.12);  // 12% de la carte
  for (let i = 0; i < roomCount; i++) {
    const startRow = Math.floor(Math.random() * (MAP_TILE_COUNT - 12)) + 6;
    const startCol = Math.floor(Math.random() * (MAP_TILE_COUNT - 12)) + 6;
    if (isNearSpawn(startRow, startCol, 5)) continue;

    // Draw 3x3 room perimeter
    const blockType = Math.random() < 0.6 ? 4 : (Math.random() < 0.5 ? 7 : 9);
    for (let r = startRow; r < startRow + 3; r++) {
      for (let c = startCol; c < startCol + 3; c++) {
        // Only place on perimeter (edges of 3x3)
        if ((r === startRow || r === startRow + 2) || (c === startCol || c === startCol + 2)) {
          tryPlaceBlock(r, c, blockType);
        }
      }
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

  // NEW: Validate the map to prevent completely sealed zones that could trap zombies
  validateAndFixClosedZones();
}

/**
 * Detect and break up sealed zones that could trap zombies
 * A sealed zone is an empty space completely surrounded by walls with no exit
 */
function validateAndFixClosedZones() {
  const visited = new Set();
  
  // Find all connected regions of walkable tiles (type 0)
  for (let row = 1; row < MAP_TILE_COUNT - 1; row++) {
    for (let col = 1; col < MAP_TILE_COUNT - 1; col++) {
      const key = `${row},${col}`;
      
      // Skip if not walkable or already visited
      if (worldTileMap[row][col] !== 0 || visited.has(key)) continue;
      
      // Flood fill to find this region
      const region = [];
      const queue = [{row, col}];
      visited.add(key);
      region.push({row, col});
      
      while (queue.length > 0) {
        const {row: r, col: c} = queue.shift();
        
        // Check 4 neighbors
        const neighbors = [
          {row: r - 1, col: c},
          {row: r + 1, col: c},
          {row: r, col: c - 1},
          {row: r, col: c + 1}
        ];
        
        for (const {row: nr, col: nc} of neighbors) {
          const nkey = `${nr},${nc}`;
          
          // Check bounds and if it's walkable and not visited
          if (nr > 0 && nr < MAP_TILE_COUNT - 1 && 
              nc > 0 && nc < MAP_TILE_COUNT - 1 &&
              worldTileMap[nr][nc] === 0 && 
              !visited.has(nkey)) {
            
            visited.add(nkey);
            region.push({nr, col: nc});
            queue.push({row: nr, col: nc});
          }
        }
      }
      
      // Check if this region touches the border (guaranteed exit)
      let touchesBorder = false;
      for (const {row: r, col: c} of region) {
        if (r === 1 || r === MAP_TILE_COUNT - 2 || c === 1 || c === MAP_TILE_COUNT - 2) {
          touchesBorder = true;
          break;
        }
      }
      
      // If region is small AND doesn't touch border → it's sealed → break it open
      if (!touchesBorder && region.length < 40) {  // Arbitrary threshold: small sealed chamber
        // Remove 1-2 blocks around the edge of this region to make an exit
        const randomBlocks = region.sort(() => Math.random() - 0.5).slice(0, Math.max(1, Math.floor(region.length * 0.15)));
        
        for (const {row: r, col: c} of randomBlocks) {
          // Try to break a neighbor wall instead of the open tile
          const neighbors = [
            {row: r - 1, col: c},
            {row: r + 1, col: c},
            {row: r, col: c - 1},
            {row: r, col: c + 1}
          ];
          
          for (const {row: nr, col: nc} of neighbors) {
            if (nr > 0 && nr < MAP_TILE_COUNT - 1 && 
                nc > 0 && nc < MAP_TILE_COUNT - 1 &&
                worldTileMap[nr][nc] !== 0) {
              // Break this wall - remove 15% of surrounding blocks
              worldTileMap[nr][nc] = 0;
              break;
            }
          }
        }
      }
    }
  }
  
  console.log(`✅ Map validation complete: sealed zones fixed`);
}

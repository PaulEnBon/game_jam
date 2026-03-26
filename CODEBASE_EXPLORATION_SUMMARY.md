# Codebase Exploration: Minimap, Orbs & Rendering Systems

**Date**: March 26, 2026  
**Objective**: Understand minimap rendering, orb storage, world blocks, and investigate texture clipping bug

---

## 1. MINIMAP RENDERING IMPLEMENTATION

### Primary Location
📍 **File**: `src/systems/gamemanager.js`  
📍 **Function**: `drawMinimap()`  
📍 **Lines**: 4968-5100

### Minimap Properties
```javascript
// Size and Position
mmSize = constrain(Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.24, 170, 230)
mmX = SCREEN_WIDTH - mmSize - 14
mmY = Math.min(156, Math.max(10, SCREEN_HEIGHT - mmSize - 10))

// Pixel scale (world tiles to screen pixels)
tilePixels = mmSize / MAP_TILE_COUNT  // ~3-4 pixels per tile on 170px minimap
```

### Coordinate Transform (World → Minimap Screen)
```javascript
// For any world entity at (x, y):
screenX = mmX + x * tilePixels
screenY = mmY + y * tilePixels

// Example: Entity at (28.5, 28.5) - map center
screenX = mmX + 28.5 * 3.5 ≈ mmX + 100  // Center of minimap
```

---

## 2. MINIMAP COLOR SCHEME - All Rendered Elements

### Walkable Tiles
- **Value 0 (Empty)**: Not rendered (transparency shows background)

### Wall Block Types (All Shown with Type-Specific Colors)
| Type | Name | Color | RGB |
|------|------|-------|-----|
| 1 | Stone | Gray | [130, 130, 130, 200] |
| 2 | Dirt | Brown | [134, 96, 67, 200] |
| 3 | Grass | Green | [76, 155, 60, 200] |
| 4 | Mossy Cobble | Med-Green | [90, 130, 90, 200] |
| 5 | Glowstone | Gold | [220, 195, 100, 200] |
| 6 | Corruption/Lava | Red | [180, 30, 30, 220] ⚠️ **SPECIAL** |
| 7 | Plank | Wood-Brown | [150, 108, 74, 210] |
| 8 | Water/Special | Cyan | [90, 205, 235, 220] |
| 9 | Obsidian | Dark-Red | [150, 82, 72, 210] |
| 10 | Tan Plank | Pink | [255, 155, 215, 220] |
| 11 | Dark Obsidian | Light-Blue | [150, 210, 255, 220] |

### Orbs (ALL STATES VISIBLE!) ✓ Already Implemented
| State | Color | RGB | Size |
|-------|-------|-----|------|
| **safe** | Bright Green | [80, 255, 120] | 3px circle |
| **warning** | Orange | [255, 180, 40] | 3px circle |
| **patrol** | Dim Red | [180, 70, 70] | 3px circle |
| **chase** | Bright Red | [255, 50, 50] | 3px circle |

### Other Game Objects (Also All Shown!)
- **World Modules**: 4×4 squares (aegis=cyan, emp=light-cyan, chrono=magenta)
- **Drops**: 3px circles (ammo=gold, score=yellow, pulse=magenta, rounds=orange)
- **Mission Beacons**: 4×4 squares, green [120, 245, 210]
- **Extraction Portal**: 8px circle outline, no fill, green [130, 255, 180]
- **Punch Machine**: 5×5 square, magenta [235, 120, 255]
- **Player**: 5px blue circle [100, 180, 255] + direction arrow

---

## 3. ORB STATE MACHINE & STORAGE

### Storage Location
📍 **File**: `src/systems/gamemanager.js` Constructor  
📍 **Property**: `this.orbs = []` (Array of Orb instances)

```javascript
// Access example
for (const orb of gameManager.orbs) {
  console.log(orb.state, orb.posX, orb.posY);
}
```

### Orb Creation
📍 **File**: `src/systems/gamemanager.js`  
📍 **Function**: `spawnHunterAt(wx, wy, speed, health)` [Line 1237]

```javascript
const hunter = new Orb(wx, wy, MAX_MUTATION_DELAY_MS * 4, speed);
hunter.state = "chase";        // Can be set per spawn
hunter.radius = ENEMY_WORLD_RADIUS;
hunter.health = Math.max(1, Math.floor(health));
hunter.maxHealth = hunter.health;
this.orbs.push(hunter);
```

### Orb Class: State Machine & Properties
📍 **File**: `src/entities/orb.js` [Lines 1-200]

```javascript
class Orb {
  // === IDENTIFIER ===
  id                    // Unique integer ID (OrbIdCounter)
  
  // === POSITION ===
  posX, posY            // Current position (world coordinates, 0-56)
  baseX, baseY          // Original spawn position (for bob animation)
  
  // === STATE MACHINE ===
  state                 // "safe" → "warning" → "patrol" | "chase"
  birthMs               // Creation timestamp
  mutationDelayMs       // Time until warning phase
  warningStartMs        // When warning started
  
  // === STATE QUERIES (Helpers) ===
  isSafe()              // state === "safe"
  isWarning()           // state === "warning"
  isHunter()            // state === "patrol" || "chase"
  isChasing()           // state === "chase"
  
  // === PROGRESS TRACKING ===
  mutationProgress()    // 0→1, time until warning (used for color fade)
  warningProgress()     // 0→1, time through warning phase (used for flash)
  
  // === PHYSICAL PROPERTIES ===
  radius                // ORB_WORLD_RADIUS or ENEMY_WORLD_RADIUS
  health                // Damage points
  maxHealth             // Max health
  hunterSpeed           // Movement speed (base)
  
  // === DIRECTION & MOVEMENT ===
  moveDirX, moveDirY    // Direction of movement
  bodyAngle             // Facing angle (zombies)
  bodyDirX, bodyDirY    // Body facing direction
  lookDirX, lookDirY    // Head look direction
  
  // === HUNTING AI ===
  waypointX, waypointY  // Patrol waypoint
  chargeActive          // Is charging?
  lastChargeMs          // Charge cooldown tracker
  strafeSeed            // Chase strafe randomness
  lastRepathMs          // Path recalculation cooldown
}
```

### State Transitions (Automatic)
```javascript
// In orb.update() each frame:
const now = millis();

// SAFE → WARNING (after mutationDelayMs)
if (state === "safe" && now - birthMs >= mutationDelayMs) {
  state = "warning";
  warningStartMs = now;
}

// WARNING → PATROL (after WARNING_DURATION_MS = 2000ms)
if (state === "warning" && now - warningStartMs >= 2000) {
  state = "patrol";
  pickNewWaypoint();
}

// PATROL → CHASE (player detected within range)
// Controlled by AI in updatePatrol() and updateChase()
```

---

## 4. WORLD BLOCKS & WALLS - Data Structure

### Storage
📍 **File**: `src/world/map.js` [Lines 1-150]  
📍 **Global Variable**: `worldTileMap`

```javascript
// 2D array of tile types
let worldTileMap = [];  // 56×56 array

// Access pattern
const blockType = worldTileMap[row][col];  // 0 = walkable, 1-11 = walls

// Coordinate system (NOTE: array is [row][col] but entities use [x][y])
// row = Y-axis (0=north, 56=south)
// col = X-axis (0=west, 56=east)
```

### Block Type Values
```javascript
0   = Empty/walkable
1   = Stone
2   = Dirt
3   = Grass
4   = Mossy Cobble
5   = Glowstone
6   = Lava/Corruption (can trigger events)
7   = Plank
8   = Leaves/Water
9   = Obsidian
10  = Tan Plank
11  = Dark Obsidian
12  = Floor (currently disabled - causes rendering issues)
```

### Map Generation Zones
```javascript
// Border (perimeter)
for (row/col = 0 to 55):
  if (row === 0 || row === 55 || col === 0 || col === 55)
    Place walls (corners=type 9, edges=varying)

// Random Interior Pillars (~25% density)
- Random position: (3, 3) to (52, 52)
- Type: Randomly stone(1), mossy(4), plank(7), or obsidian(9)
- Sometimes extends to adjacent tile

// Ruined Walls (~8% density)
- Short horizontal or vertical lines
- Type: Obsidian(9) or plank(7)

// Spawn Zone (Always Clear)
- 5×5 area centered on (28, 28)
- All set to 0 (walkable)
```

### Collision Detection
```javascript
// Utility function (player.js or gamemanager.js)
isWalkableTile(row, col) {
  return worldTileMap[row][col] === 0;
}

// Blocked path check
if (!isWalkableTile(row, col)) {
  // Cannot move here - collision
}
```

---

## 5. SPRITE RENDERING PIPELINE

### Main Entry Points
📍 **2D Mode**: `src/systems/game-mode-2d.js` → `drawSpritesToBuffer()` [Line 271]  
📍 **Delegate**: `src/systems/gamemanager.js` → `drawSingleSpriteToBuffer()` [Line 3100]

### Coordinate System Transformation
```javascript
// Step 1: Relative Position (world space)
relX = sprite.x - player.posX
relY = sprite.y - player.posY

// Step 2: Camera Transform (align with raycaster orientation)
// Camera facing: (cos(angle), sin(angle))
// Camera right:  (-sin(angle), cos(angle))
cosA = Math.cos(player.angle)
sinA = Math.sin(player.angle)
transformX = -relX * sinA + relY * cosA   // Horizontal offset (right=positive)
transformY =  relX * cosA + relY * sinA   // Depth (forward=positive)

// Step 3: Screen Position (perspective projection)
fovScale = SCREEN_WIDTH / (2 * tan(FOV / 2))  // ≈ 960 (60° FOV)
spriteScreenX = SCREEN_WIDTH / 2 + (transformX / transformY) * fovScale
spriteScreenY = SCREEN_HEIGHT / 2 + cameraOffset

// Step 4: Screen Clipping
drawStartX = Math.max(0, Math.floor(spriteScreenX - spriteScreenW / 2))
drawEndX   = Math.min(SCREEN_WIDTH, Math.floor(spriteScreenX + spriteScreenW / 2))
drawStartY = Math.max(0, Math.floor(spriteScreenY - spriteScreenH / 2))
drawEndY   = Math.min(SCREEN_HEIGHT, Math.floor(spriteScreenY + spriteScreenH / 2))
```

### Sprite Size Calculation
```javascript
// Base size from distance and FOV
worldSize = 0.6  // Base world units (varies by sprite type)
spriteBaseSize = Math.abs((worldSize / transformY) * fovScale)

// Size caps and aspect ratio preservation
if (isZombieHumanoid) {
  spriteScreenW = Math.min(spriteBaseSize, SCREEN_HEIGHT * 0.4)
  zombieAspect = zombieTexH / zombieTexW  // e.g., 1.25
  spriteScreenH = Math.min(spriteScreenW * zombieAspect, SCREEN_HEIGHT * 0.62)
}
```

---

## 6. ORB TEXTURE COORDINATE MAPPING - Clipping Bug Analysis

### Current Fix Status
🔴 **PARTIAL FIX**: Orbs have corrected mapping; other sprites still buggy  
📍 **File**: `src/systems/gamemanager.js`  
📍 **Lines**: 3390-3410

### For Collectible Orbs (CORRECTED)
```javascript
if (isCollectOrb) {
  // Use FULL sprite dimensions, not clipped ones
  const spriteLeftEdge = spriteScreenX - spriteScreenW / 2;
  const spriteTopEdge = SCREEN_HEIGHT / 2 - spriteScreenH / 2 + cameraOffset;
  
  // Map to [-1, 1] range based on full sprite
  fracX = ((sx - spriteLeftEdge) / spriteScreenW) * 2 - 1;
  fracY = ((sy - spriteTopEdge) / spriteScreenH) * 2 - 1;
  
  // Texture lookup: [-1, 1] → [0, texW]
  const orbTxCalculated = Math.min(orbTexW - 1, 
    Math.floor(((fracX + 1) / 2) * orbTexW));
  const orbTyCalculated = Math.min(orbTexH - 1,
    Math.floor(((fracY + 1) / 2) * orbTexH));
}
```

### Why This Works
✓ Uses **full sprite width** (`spriteScreenW`) not clipped width (`drawEndX - drawStartX`)  
✓ Uses **logical boundaries** (`spriteLeftEdge`) not screen bounds (`drawStartX`)  
✓ Coordinates always map to full **[-1, 1] range** regardless of clipping  
✓ Partially off-screen portions sample correct texture regions

### For Other Sprites (BUGGY - Still Using Old Code)
```javascript
else {
  // ❌ WRONG: Uses clipped dimensions
  const invSize = 1 / Math.max(spriteScreenW, spriteScreenH);
  fracX = (sx - drawStartX) * invSize - 0.5;
  fracY = (sy - drawStartY) * invSize - 0.5;
  // When sprite is clipped, fracX/fracY range becomes compressed!
  // Example: 75 visible pixels / 100 full pixels = coordinate undersampling
}
```

### Left-Side Clipping Bug Explanation
**Problem**: When sprite partially off-screen left, screen clipping destroys texture mapping:

```
Example: Sprite center at x=25, width=100 (logical bounds: [-25, 75])
Screen clips to: [0, 75] (75 visible pixels)

OLD CODE (buggy):
  invSize = 1/100
  At sx=0:   fracX = (0-0)*0.01 - 0.5 = -0.5 (left edge OK)
  At sx=75:  fracX = (75-0)*0.01 - 0.5 = 0.25 (ONLY 75% of texture!)
  Problem: fracX should reach 0.5 to access full texture width
  Result: Right side of texture inaccessible → clipping/wrapping

CORRECT CODE (new):
  spriteLeftEdge = 25 - 50 = -25
  At sx=0:   fracX = ((0-(-25))/100)*2-1 = -0.5 (correct!)
  At sx=75:  fracX = ((75-(-25))/100)*2-1 = 0.5 (full range!)
  Result: Full texture sampled correctly
```

### Root Cause Location
📍 **File**: `src/systems/gamemanager.js`  
📍 **Lines**: 3390-3410 (if-else block for coordinate mapping)  
📍 **Specific Line**: Line 3400 (old buggy formula for non-orb sprites)

---

## 7. KEY FILES REFERENCE TABLE

| File | Key Functions/Variables | Lines | Purpose |
|------|------------------------|-------|---------|
| `gamemanager.js` | `drawMinimap()` | 4968-5100 | **Minimap rendering** ✓ Complete |
| `gamemanager.js` | `spawnHunterAt()` | 1237 | Orb creation & state init |
| `gamemanager.js` | `drawSingleSpriteToBuffer()` | 3100-3500 | **Sprite rendering** - contains clipping logic |
| `gamemanager.js` | `drawSpritesToBuffer()` | 3048-3140 | Sprite collection & sorting |
| `orb.js` | `Orb` class | 1-200 | **Orb definition** - stores state & AI |
| `orb.js` | State machine | 70-130 | `isSafe()`, `isWarning()`, `isHunter()`, `isChasing()` |
| `map.js` | `generateWorldMap()` | 14-150 | **Map generation** - creates `worldTileMap` |
| `map.js` | `worldTileMap` | 12 | **Global 2D array** [56][56] - stores wall blocks |
| `constants.js` | `MAP_TILE_COUNT` | 6 | 56×56 tile grid size |
| `constants.js` | `WARNING_DURATION_MS` | 45-90 | 2000ms warning phase |
| `constants.js` | `MAX_MUTATION_DELAY_MS` | 45-90 | Max delay before warning |
| `game-mode-2d.js` | `drawSpritesToBuffer()` | 271-400 | 2D render path delegates to gameManager |
| `zombie-sprite-renderer.js` | `drawZombieTextureSprite()` | 1-90 | Texture-based zombie rendering |

---

## 8. MINIMAP CURRENT STATUS - FEATURE COMPLETE ✓

### What's Already Implemented
✅ **All orb states shown** - safe (green), warning (orange), patrol (dim red), chase (bright red)  
✅ **World blocks rendered** - type-specific colors for all 11 block types  
✅ **Player position** - blue circle with direction arrow  
✅ **All game objects** - drops, beacons, modules, portals, punch machine  
✅ **Proper coordinate transform** - world→minimap mapping correct  
✅ **Minimap positioning** - bottom-right corner with dynamic sizing  

### No Additional Implementation Needed
The minimap already displays:
- ✓ All orb states (safe/warning/patrol/chase)
- ✓ All world blocks/walls with color differentiation
- ✓ Correct coordinate system
- ✓ Player and all game objects

---

## 9. RECOMMENDATIONS

### Priority 1: Sprite Rendering Bug Fix
**Issue**: Left-side clipping on particles, beacons, and other non-orb sprites  
**Location**: `src/systems/gamemanager.js` Line 3400  
**Solution**: Apply same coordinate mapping fix from orbs to all sprite types:

```javascript
// FOR ALL SPRITES (not just orbs):
const spriteLeftEdge = spriteScreenX - spriteScreenW / 2;
const spriteTopEdge = SCREEN_HEIGHT / 2 - spriteScreenH / 2 + cameraOffset;
fracX = ((sx - spriteLeftEdge) / spriteScreenW) * 2 - 1;
fracY = ((sy - spriteTopEdge) / spriteScreenH) * 2 - 1;
```

### Priority 2: Separate Patrol/Chase Visual Distinction
**Current**: Both patrol and chase orbs render as red  
**Suggestion**: Use brighter/dimmer red or different symbols to distinguish AI states visually

### Priority 3: Optional Enhancements
- Fog-of-war on minimap (show explored vs unexplored)
- Player view cone indicator
- Enemy threat radius visualization
- Danger proximity warnings for nearby hunters

---

## END OF EXPLORATION SUMMARY

All requested information has been mapped:
1. ✅ Minimap rendering code identified and documented
2. ✅ Orbs storage location and state machine explained
3. ✅ World blocks data structure analyzed
4. ✅ Coordinate systems documented
5. ✅ Texture clipping bug analyzed (partial fix found, more needed)

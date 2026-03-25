/**
 * ============================================================
 * ZOMBIE TEXTURE MAPPER
 * ============================================================
 * Maps a flat Minecraft zombie skin to rotated sprite directions
 * Follows Minecraft skin layout (64x64):
 *   - Front face: (8, 8) to (16, 16)
 *   - Side face: (16, 8) to (24, 16)
 *   - Back face: (24, 8) to (32, 16)
 *   - Body sections follow below
 */

const ZOMBIE_SKIN_LAYOUT = {
  // Each face is 8x8 pixels in the 64x64 spritesheet
  // Head faces (at Y=8)
  front: { x: 8, y: 8, w: 8, h: 8 },     // Front head
  right: { x: 16, y: 8, w: 8, h: 8 },    // Right side head
  back: { x: 24, y: 8, w: 8, h: 8 },     // Back head
  left: { x: 32, y: 8, w: 8, h: 8 },     // Left side head

  // Body sections (at Y=20)
  body_front: { x: 20, y: 20, w: 8, h: 12 },
  body_right: { x: 28, y: 20, w: 8, h: 12 },
  body_back: { x: 32, y: 20, w: 8, h: 12 },
  body_left: { x: 12, y: 20, w: 8, h: 12 },

  // Arms (at Y=20 for right arm, Y=52+ for left arm overlay)
  arm_right: { x: 44, y: 20, w: 4, h: 12 },
  arm_left: { x: 36, y: 52, w: 4, h: 12 },

  // Legs
  leg_right: { x: 4, y: 20, w: 4, h: 12 },
  leg_left: { x: 20, y: 52, w: 4, h: 12 },
};

/**
 * Quantizes an angle (0..2π) into 8 sprite directions
 * Returns: "front", "front_right", "right", "back_right", "back", "back_left", "left", "front_left"
 */
function getZombieSpriteDirection(angleRadians) {
  // Normalize angle to [0, 2π)
  let angle = angleRadians % (Math.PI * 2);
  if (angle < 0) angle += Math.PI * 2;

  // Divide into 8 sections (each 45°)
  const sectionIndex = Math.floor((angle / (Math.PI * 2)) * 8) % 8;
  const directions = [
    "front",       // 0° facing player
    "front_right", // 45°
    "right",       // 90°
    "back_right",  // 135°
    "back",        // 180°
    "back_left",   // 225°
    "left",        // 270°
    "front_left",  // 315°
  ];
  return directions[sectionIndex];
}

/**
 * Extracts a rectangular region from the zombie texture and returns as p5.Graphics
 * @param {p5.Image} zombieTexture - The 64x64 zombie skin image
 * @param {object} srcRect - { x, y, w, h } in texture coordinates
 * @returns {p5.Graphics} A p5 graphics canvas with the extracted region
 */
function extractZombieSkinRegion(zombieTexture, srcRect) {
  if (!zombieTexture) return null;

  const g = createGraphics(srcRect.w, srcRect.h);
  g.image(
    zombieTexture,
    0, 0, srcRect.w, srcRect.h,           // destination
    srcRect.x, srcRect.y, srcRect.w, srcRect.h // source in texture
  );
  return g;
}

/**
 * Creates a composite zombie sprite for a given direction
 * Combines head, body, arms, and legs from the skin layout
 * @param {p5.Image} zombieTexture - The full 64x64 zombie skin
 * @param {string} direction - One of the 8 directions from getZombieSpriteDirection()
 * @returns {p5.Graphics} Composite sprite (usually 24×32 or similar)
 */
function buildZombieSpriteForDirection(zombieTexture, direction) {
  if (!zombieTexture) return null;

  // Build a composite image
  const SPRITE_WIDTH = 20;
  const SPRITE_HEIGHT = 32;
  const composite = createGraphics(SPRITE_WIDTH, SPRITE_HEIGHT);
  composite.background(0, 0); // transparent

  // Pick the correct head based on direction
  let headKey = "front";
  let bodyKey = "body_front";
  if (direction === "front_right" || direction === "right") {
    headKey = "right";
    bodyKey = "body_right";
  } else if (direction === "back_right" || direction === "back") {
    headKey = "back";
    bodyKey = "body_back";
  } else if (direction === "back_left" || direction === "left") {
    headKey = "left";
    bodyKey = "body_left";
  }

  // Extract texture regions
  const head = extractZombieSkinRegion(zombieTexture, ZOMBIE_SKIN_LAYOUT[headKey]);
  const body = extractZombieSkinRegion(zombieTexture, ZOMBIE_SKIN_LAYOUT[bodyKey]);
  const armRight = extractZombieSkinRegion(zombieTexture, ZOMBIE_SKIN_LAYOUT.arm_right);
  const armLeft = extractZombieSkinRegion(zombieTexture, ZOMBIE_SKIN_LAYOUT.arm_left);
  const legRight = extractZombieSkinRegion(zombieTexture, ZOMBIE_SKIN_LAYOUT.leg_right);
  const legLeft = extractZombieSkinRegion(zombieTexture, ZOMBIE_SKIN_LAYOUT.leg_left);

  // Compose the sprite (scale up 2x for better visibility)
  const SCALE = 2;
  if (head) composite.image(head, SPRITE_WIDTH / 2 - (ZOMBIE_SKIN_LAYOUT[headKey].w * SCALE) / 2, 0, ZOMBIE_SKIN_LAYOUT[headKey].w * SCALE, ZOMBIE_SKIN_LAYOUT[headKey].h * SCALE);
  if (body) composite.image(body, SPRITE_WIDTH / 2 - (ZOMBIE_SKIN_LAYOUT[bodyKey].w * SCALE) / 2, (ZOMBIE_SKIN_LAYOUT[headKey].h + 2) * SCALE, ZOMBIE_SKIN_LAYOUT[bodyKey].w * SCALE, ZOMBIE_SKIN_LAYOUT[bodyKey].h * SCALE);
  if (armLeft) composite.image(armLeft, 2, (ZOMBIE_SKIN_LAYOUT[headKey].h + 3) * SCALE, ZOMBIE_SKIN_LAYOUT.arm_left.w * SCALE, ZOMBIE_SKIN_LAYOUT.arm_left.h * SCALE);
  if (armRight) composite.image(armRight, SPRITE_WIDTH - 2 - ZOMBIE_SKIN_LAYOUT.arm_right.w * SCALE, (ZOMBIE_SKIN_LAYOUT[headKey].h + 3) * SCALE, ZOMBIE_SKIN_LAYOUT.arm_right.w * SCALE, ZOMBIE_SKIN_LAYOUT.arm_right.h * SCALE);
  if (legRight) composite.image(legRight, SPRITE_WIDTH / 4, SPRITE_HEIGHT - (ZOMBIE_SKIN_LAYOUT.leg_right.h * SCALE), ZOMBIE_SKIN_LAYOUT.leg_right.w * SCALE, ZOMBIE_SKIN_LAYOUT.leg_right.h * SCALE);
  if (legLeft) composite.image(legLeft, SPRITE_WIDTH - SPRITE_WIDTH / 4 - ZOMBIE_SKIN_LAYOUT.leg_left.w * SCALE, SPRITE_HEIGHT - (ZOMBIE_SKIN_LAYOUT.leg_left.h * SCALE), ZOMBIE_SKIN_LAYOUT.leg_left.w * SCALE, ZOMBIE_SKIN_LAYOUT.leg_left.h * SCALE);

  return composite;
}

/**
 * Pre-caches all 8 zombie sprite directions
 * @param {p5.Image} zombieTexture - The 64x64 zombie skin image
 * @returns {object} Map of direction → p5.Graphics sprite
 */
function cacheAllZombieDirections(zombieTexture) {
  const cache = {};
  const directions = ["front", "front_right", "right", "back_right", "back", "back_left", "left", "front_left"];

  directions.forEach((dir) => {
    cache[dir] = buildZombieSpriteForDirection(zombieTexture, dir);
  });

  console.log("✓ Zombie 8-way sprite cache created from flat skin");
  return cache;
}

/**
 * Gets the appropriate sprite for a zombie's current angle
 * @param {object} spriteCache - Cache from cacheAllZombieDirections()
 * @param {number} angleRadians - Zombie's body angle
 * @returns {p5.Graphics} The sprite for this angle
 */
function getZombieSpriteForAngle(spriteCache, angleRadians) {
  const direction = getZombieSpriteDirection(angleRadians);
  return spriteCache[direction] || spriteCache.front;
}

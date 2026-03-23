/*
  ============================================================
  BETRAYAL BOX — P5.JS LIFECYCLE
  ============================================================
  Entry point : setup(), draw(), and input callbacks.
  All game logic lives in the other files loaded before this one :
    constants.js  → global tuning knobs
    textures.js   → procedural Minecraft block textures
    map.js        → tile map generator
    player.js     → Player class + isWorldBlocked()
    orb.js        → Orb class (safe → hunter)
    particle.js   → Particle class
    gamemanager.js → GameManager (state machine + render pipeline)
*/

let gameManager = null;

function setup() {
  updateViewportSize();
  const cnv = createCanvas(SCREEN_WIDTH, SCREEN_HEIGHT);
  cnv.parent("game-container");
  pixelDensity(1);              // keep pixel art sharp on Retina screens
  noSmooth();                   // blocky Minecraft aesthetic

  generateAllBlockTextures();
  cacheAllTexturePixels();      // pre-extract pixel data for fast raycaster access
  generateWorldMap();

  gameManager = new GameManager();
  gameManager.initDOM();
}

function draw() {
  gameManager.runFrame();
}

function windowResized() {
  updateViewportSize();
  resizeCanvas(SCREEN_WIDTH, SCREEN_HEIGHT);
  if (gameManager) {
    gameManager.onViewportResize();
  }
}

/**
 * Mouse movement handler.
 * When pointer lock is active movedX gives the raw mouse delta
 * for smooth first-person camera rotation.
 */
function mouseMoved() {
  if (gameManager && gameManager.gameState === "playing") {
    gameManager.player.rotateByMouseDelta(movedX);
  }
}

function mouseDragged() {
  // Also handle dragged state so look works even with button held
  if (gameManager && gameManager.gameState === "playing") {
    gameManager.player.rotateByMouseDelta(movedX);
  }
}

/**
 * Click on canvas during gameplay re-acquires pointer lock
 * if it was accidentally lost (e.g. pressing Escape).
 */
function mousePressed() {
  if (gameManager && gameManager.gameState === "playing") {
    gameManager.requestPointerLock();
  }
}
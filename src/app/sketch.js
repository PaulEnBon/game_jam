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
    orb.js        → Orb class (safe → zombie)
    particle.js   → Particle class
    gamemanager.js → GameManager (state machine + render pipeline)
*/

let gameManager = null;

function preload() {
  preloadExternalBlockTextures();
  preloadZombieSkinTexture();
}

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

  // Hard fallback bridge: called by inline onclick handlers from index.html.
  window.__startGameFallback = (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!gameManager) return false;
    gameManager.requestPointerLock();
    gameManager.startNewGame();
    return false;
  };

  window.__openSettingsFallback = (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!gameManager) return false;
    gameManager.openSettingsMenu();
    return false;
  };

  window.__overlayStartFallback = (event) => {
    if (!gameManager) return false;
    const target = event && event.target;
    if (target && typeof target.closest === "function" && target.closest("button")) {
      return false;
    }
    if (gameManager.isSettingsVisible && gameManager.isSettingsVisible()) {
      return false;
    }
    gameManager.requestPointerLock();
    gameManager.startNewGame();
    return false;
  };
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
    gameManager.player.lookByMouseDelta(movedX, movedY);
  }
}

function mouseDragged() {
  // Also handle dragged state so look works even with button held
  if (gameManager && gameManager.gameState === "playing") {
    gameManager.player.lookByMouseDelta(movedX, movedY);
  }
}

/**
 * Click on canvas during gameplay re-acquires pointer lock
 * if it was accidentally lost (e.g. pressing Escape).
 */
function mousePressed() {
  if (gameManager) {
    gameManager.handlePrimaryAction();
  }
}

function keyPressed() {
  if (!gameManager) return;

  if ((keyCode === ENTER || key === " ") && gameManager.handleStartInput()) {
    return false;
  }

  if (gameManager.handleHotbarInput(key, keyCode)) {
    return false;
  }

  if (keyCode === ESCAPE) {
    gameManager.handleEscapeKey();
    return false;
  }
}

function mouseWheel(event) {
  if (!gameManager) return;
  const delta = (event && typeof event.deltaY === "number")
    ? event.deltaY
    : (event && typeof event.delta === "number" ? event.delta : 0);

  if (gameManager.handleMouseWheelSlot(delta)) {
    return false;
  }
}
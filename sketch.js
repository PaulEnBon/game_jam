<<<<<<< HEAD
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
=======
﻿let gameManager = null;

function preload() {
  preloadExternalBlockTextures();   // NOUVEAU — charge les PNG de blocs
  preloadZombieSkinTexture();        // NOUVEAU — charge sprite zombie
}
>>>>>>> 849054761324ace091cb613435baa7cbd0695970

function setup() {
  updateViewportSize();
  const cnv = createCanvas(SCREEN_WIDTH, SCREEN_HEIGHT);
  cnv.parent("game-container");
<<<<<<< HEAD
  pixelDensity(1);              // keep pixel art sharp on Retina screens
  noSmooth();                   // blocky Minecraft aesthetic

  generateAllBlockTextures();
  cacheAllTexturePixels();      // pre-extract pixel data for fast raycaster access
=======
  pixelDensity(1);
  noSmooth();

  generateAllBlockTextures();
  cacheAllTexturePixels();
>>>>>>> 849054761324ace091cb613435baa7cbd0695970
  generateWorldMap();

  gameManager = new GameManager();
  gameManager.initDOM();
<<<<<<< HEAD
=======

  // ── Bridges d'urgence ────────────────────────────────────────────────────────
  // Appelés par les onclick HTML inline (fallback si l'event bubbling ne marche pas)
  window.__startGameFallback = (event) => {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (!gameManager) return false;
    gameManager.requestPointerLock();
    gameManager.startNewGame();
    return false;
  };

  window.__openSettingsFallback = (event) => {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (!gameManager) return false;
    gameManager.openSettingsMenu();
    return false;
  };

  window.__overlayStartFallback = (event) => {
    if (!gameManager) return false;
    const target = event && event.target;
    if (target && typeof target.closest === "function" && target.closest("button")) return false;
    if (gameManager.isSettingsVisible && gameManager.isSettingsVisible()) return false;
    gameManager.requestPointerLock();
    gameManager.startNewGame();
    return false;
  };
>>>>>>> 849054761324ace091cb613435baa7cbd0695970
}

function draw() {
  gameManager.runFrame();
}

function windowResized() {
  updateViewportSize();
  resizeCanvas(SCREEN_WIDTH, SCREEN_HEIGHT);
<<<<<<< HEAD
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
=======
  if (gameManager) gameManager.onViewportResize();
}

// MODIFIÉ : utilisait rotateByMouseDelta(movedX) → maintenant lookByMouseDelta(movedX, movedY)
function mouseMoved() {
  if (gameManager && gameManager.gameState === "playing") {
    gameManager.player.lookByMouseDelta(movedX, movedY);
  }
}

// NOUVEAU — le look fonctionne aussi quand un bouton est maintenu enfoncé
function mouseDragged() {
  if (gameManager && gameManager.gameState === "playing") {
    gameManager.player.lookByMouseDelta(movedX, movedY);
  }
}

// MODIFIÉ : redirige vers handlePrimaryAction() (fire + pointer lock)
function mousePressed() {
  if (gameManager) gameManager.handlePrimaryAction();
}

// MODIFIÉ : gestion ESC + hotbar + start
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

// NOUVEAU — molette de souris pour changer de slot d'inventaire
function mouseWheel(event) {
  if (!gameManager) return;
  const delta = (event && typeof event.deltaY === "number")
    ? event.deltaY
    : (event && typeof event.delta === "number" ? event.delta : 0);

  if (gameManager.handleMouseWheelSlot(delta)) {
    return false;
  }
}
>>>>>>> 849054761324ace091cb613435baa7cbd0695970

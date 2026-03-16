let gameManager = null;

function preload() {
  preloadExternalBlockTextures();   // NOUVEAU — charge les PNG de blocs
  preloadZombieSkinTexture();        // NOUVEAU — charge sprite zombie
}

function setup() {
  updateViewportSize();
  const cnv = createCanvas(SCREEN_WIDTH, SCREEN_HEIGHT);
  cnv.parent("game-container");
  pixelDensity(1);
  noSmooth();

  generateAllBlockTextures();
  cacheAllTexturePixels();
  generateWorldMap();

  gameManager = new GameManager();
  gameManager.initDOM();

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
}

function draw() {
  gameManager.runFrame();
}

function windowResized() {
  updateViewportSize();
  resizeCanvas(SCREEN_WIDTH, SCREEN_HEIGHT);
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

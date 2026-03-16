
let gameManager = null;

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

function mouseMoved() {
  if (gameManager && gameManager.gameState === "playing") {
    gameManager.player.rotateByMouseDelta(movedX);
  }
}

function mouseDragged() {
  if (gameManager && gameManager.gameState === "playing") {
    gameManager.player.rotateByMouseDelta(movedX);
  }
}

function mousePressed() {
  if (gameManager && gameManager.gameState === "playing") {
    gameManager.requestPointerLock();
  }
}

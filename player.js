/*
<<<<<<< HEAD
  ============================================================
  PLAYER CLASS  (first-person camera)
  ============================================================
=======
 - keybinding UI (affichage + remapping)
>>>>>>> 849054761324ace091cb613435baa7cbd0695970
*/

const CONTROL_STORAGE_KEY = "betrayal-box-keybinds";

const CONTROL_ACTIONS = ["forward", "backward", "left", "right"];

const CONTROL_ACTION_LABELS = Object.freeze({
  forward: "Avancer",
  backward: "Reculer",
  left: "Gauche",
  right: "Droite",
});

const DEFAULT_KEY_BINDINGS = Object.freeze({
  forward: "KeyW",
  backward: "KeyS",
  left: "KeyA",
  right: "KeyD",
});

let controlBindings = loadControlBindings();

<<<<<<< HEAD
const pressedKeyCodes = new Set();

window.addEventListener("keydown", (event) => {
  pressedKeyCodes.add(event.code);
});

window.addEventListener("keyup", (event) => {
  pressedKeyCodes.delete(event.code);
});

window.addEventListener("blur", () => {
  pressedKeyCodes.clear();
});

=======
>>>>>>> 849054761324ace091cb613435baa7cbd0695970
function loadControlBindings() {
  const fallback = { ...DEFAULT_KEY_BINDINGS };
  try {
    const raw = localStorage.getItem(CONTROL_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return fallback;

    const next = { ...fallback };
    for (const action of CONTROL_ACTIONS) {
      const value = parsed[action];
      if (typeof value === "string" && value.length > 0) {
        next[action] = value;
      }
    }
    return next;
  } catch {
    return fallback;
  }
}

function saveControlBindings() {
  try {
    localStorage.setItem(CONTROL_STORAGE_KEY, JSON.stringify(controlBindings));
  } catch {
    // ignore localStorage failures
  }
}

<<<<<<< HEAD
function isControlPressed(action) {
  const code = controlBindings[action];
  if (!code) return false;
  return pressedKeyCodes.has(code);
}

=======
>>>>>>> 849054761324ace091cb613435baa7cbd0695970
function getControlBinding(action) {
  return controlBindings[action] || DEFAULT_KEY_BINDINGS[action];
}

function getAllControlBindings() {
  return { ...controlBindings };
}

function setControlBinding(action, code) {
  if (!CONTROL_ACTIONS.includes(action)) {
    return { ok: false, message: "Action invalide." };
  }
  if (typeof code !== "string" || code.length === 0) {
    return { ok: false, message: "Touche invalide." };
  }

  if (code === "Escape" || code === "Tab") {
<<<<<<< HEAD
    return { ok: false, message: "Cette touche est réservée." };
=======
    return { ok: false, message: "Cette touche est reservee." };
>>>>>>> 849054761324ace091cb613435baa7cbd0695970
  }

  const duplicateAction = CONTROL_ACTIONS.find(
    (name) => name !== action && getControlBinding(name) === code
  );

  if (duplicateAction) {
    return {
      ok: false,
<<<<<<< HEAD
      message: `${CONTROL_ACTION_LABELS[duplicateAction]} utilise déjà ${getDisplayKeyName(code)}.`,
=======
      message: `${CONTROL_ACTION_LABELS[duplicateAction]} utilise deja ${getDisplayKeyName(code)}.`,
>>>>>>> 849054761324ace091cb613435baa7cbd0695970
    };
  }

  controlBindings = {
    ...controlBindings,
    [action]: code,
  };
  saveControlBindings();
  return { ok: true, message: `${CONTROL_ACTION_LABELS[action]} = ${getDisplayKeyName(code)}` };
}

function resetControlBindings() {
  controlBindings = { ...DEFAULT_KEY_BINDINGS };
  saveControlBindings();
}

function getDisplayKeyName(code) {
  const aliases = {
<<<<<<< HEAD
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
=======
    ArrowUp: "^",
    ArrowDown: "v",
    ArrowLeft: "<",
    ArrowRight: ">",
>>>>>>> 849054761324ace091cb613435baa7cbd0695970
    Space: "Espace",
    ShiftLeft: "Shift",
    ShiftRight: "Shift",
    ControlLeft: "Ctrl",
    ControlRight: "Ctrl",
    AltLeft: "Alt",
    AltRight: "Alt",
    Backquote: "`",
  };

  if (aliases[code]) return aliases[code];
  if (code.startsWith("Key")) return code.slice(3).toUpperCase();
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;
  return code;
}

function getMovementLegendText() {
  const forward = getDisplayKeyName(getControlBinding("forward"));
  const left = getDisplayKeyName(getControlBinding("left"));
  const backward = getDisplayKeyName(getControlBinding("backward"));
  const right = getDisplayKeyName(getControlBinding("right"));
<<<<<<< HEAD
  return `${forward}${left}${backward}${right} — Move | Mouse — Look | Walk over green orbs to collect`;
}

class Player {
  /**
   * @param {number} startX - tile-space X (e.g. 12.5 for centre of tile 12)
   * @param {number} startY - tile-space Y
   */
  constructor(startX, startY) {
    this.posX = startX;
    this.posY = startY;
    this.angle = 0;                             // radians, 0 = facing +X
    this.moveSpeed = PLAYER_MOVE_SPEED;
    this.radius = PLAYER_RADIUS;
  }

  /** Reset position and angle for a new game. */
  resetToSpawn() {
    this.posX = MAP_TILE_COUNT / 2 + 0.5;
    this.posY = MAP_TILE_COUNT / 2 + 0.5;
    this.angle = 0;
  }

  /**
   * Process WASD / Arrow key movement, frame-rate independent.
   * Uses **wall sliding** collision : we attempt X and Y movement
   * separately so the player slides along walls instead of sticking.
   */
  update(deltaSeconds) {
    // --- Keyboard input ---
    let forwardInput = 0;
    let strafeInput  = 0;

    if (isControlPressed("forward"))  forwardInput += 1;
    if (isControlPressed("backward")) forwardInput -= 1;
    if (isControlPressed("left"))     strafeInput  -= 1;
    if (isControlPressed("right"))    strafeInput  += 1;

    // --- Calculate forward and strafe direction vectors ---
    const forwardX = Math.cos(this.angle);
    const forwardY = Math.sin(this.angle);
    const strafeX  = -Math.sin(this.angle);   // perpendicular right
    const strafeY  =  Math.cos(this.angle);

    // Combined movement vector
    let moveX = forwardInput * forwardX + strafeInput * strafeX;
    let moveY = forwardInput * forwardY + strafeInput * strafeY;

    // Normalise so diagonal movement isn't faster
=======
  return `${forward}${left}${backward}${right} - Move | Mouse - Look | Walk over green orbs to collect`;
}

const pressedKeyCodes = new Set();

window.addEventListener("keydown", (event) => {
  pressedKeyCodes.add(event.code);
});

window.addEventListener("keyup", (event) => {
  pressedKeyCodes.delete(event.code);
});

window.addEventListener("blur", () => {
  pressedKeyCodes.clear();
});

function isControlPressed(action) {
  const code = controlBindings[action];
  if (!code) return false;
  return pressedKeyCodes.has(code);
}

class Player {
  constructor(startX, startY) {
    this.posX = startX;
    this.posY = startY;
    this.angle = 0;
    this.moveSpeed = PLAYER_MOVE_SPEED;
    this.radius = PLAYER_RADIUS;

    this.pitch = 0;
    this.heightOffset = 0;
    this.verticalVelocity = 0;
    this.isGrounded = true;
  }

  update(deltaSeconds) {
    let forwardInput = 0;
    let strafeInput = 0;

    if (isControlPressed("forward")) forwardInput += 1;
    if (isControlPressed("backward")) forwardInput -= 1;
    if (isControlPressed("left")) strafeInput -= 1;
    if (isControlPressed("right")) strafeInput += 1;

    const forwardX = Math.cos(this.angle);
    const forwardY = Math.sin(this.angle);
    const strafeX = -Math.sin(this.angle);
    const strafeY = Math.cos(this.angle);

    let moveX = forwardInput * forwardX + strafeInput * strafeX;
    let moveY = forwardInput * forwardY + strafeInput * strafeY;

>>>>>>> 849054761324ace091cb613435baa7cbd0695970
    const moveMagnitude = Math.hypot(moveX, moveY);
    if (moveMagnitude > 0) {
      moveX = (moveX / moveMagnitude) * this.moveSpeed * deltaSeconds;
      moveY = (moveY / moveMagnitude) * this.moveSpeed * deltaSeconds;
    }

<<<<<<< HEAD
    // --- Wall-sliding collision ---
    // Try X movement alone
=======
>>>>>>> 849054761324ace091cb613435baa7cbd0695970
    const newX = this.posX + moveX;
    if (!isWorldBlocked(newX, this.posY, this.radius)) {
      this.posX = newX;
    }
<<<<<<< HEAD
    // Try Y movement alone
=======

>>>>>>> 849054761324ace091cb613435baa7cbd0695970
    const newY = this.posY + moveY;
    if (!isWorldBlocked(this.posX, newY, this.radius)) {
      this.posY = newY;
    }
  }

<<<<<<< HEAD
  /**
   * Rotate the camera based on mouse movement (pointer lock delta).
   * Called from the mouseMoved() p5 callback.
   */
  rotateByMouseDelta(deltaX) {
    this.angle += deltaX * PLAYER_ROTATE_SPEED;
  }
}

/**
 * Checks if a circle at (cx, cy) with given radius overlaps any solid tile.
 * We test the 4 corner points of the circle's bounding box.
 * This is a simplified but robust approach for grid-based maps.
 */
function isWorldBlocked(cx, cy, radius) {
  const offsets = [
    { dx: -radius, dy: -radius },
    { dx:  radius, dy: -radius },
    { dx: -radius, dy:  radius },
    { dx:  radius, dy:  radius },
  ];
  for (const off of offsets) {
    const tileCol = Math.floor(cx + off.dx);
    const tileRow = Math.floor(cy + off.dy);
    if (tileCol < 0 || tileCol >= MAP_TILE_COUNT || tileRow < 0 || tileRow >= MAP_TILE_COUNT) {
      return true; // out of bounds = blocked
    }
    if (worldTileMap[tileRow][tileCol] !== 0) {
      return true; // solid block
    }
  }
=======
  rotateByMouseDelta(deltaX) {
    this.lookByMouseDelta(deltaX, 0);
  }

  updateVerticalMotion(deltaSeconds) {
    if (this.isGrounded && this.verticalVelocity === 0 && this.heightOffset === 0) return;

    this.verticalVelocity -= PLAYER_GRAVITY * deltaSeconds;
    this.heightOffset += this.verticalVelocity * deltaSeconds;

    if (this.heightOffset <= 0) {
      this.heightOffset = 0;
      this.verticalVelocity = 0;
      this.isGrounded = true;
    }
  }

  lookByMouseDelta(deltaX, deltaY) {
    const sensitivity = getLookSensitivity();
    this.angle += deltaX * PLAYER_ROTATE_SPEED * sensitivity;
    this.pitch -= deltaY * PLAYER_PITCH_SPEED * sensitivity;
    this.pitch = constrain(this.pitch, -PLAYER_MAX_PITCH, PLAYER_MAX_PITCH);
  }

  cameraVerticalOffsetPx() {
    const pitchOffset = this.pitch * SCREEN_HEIGHT * CAMERA_PITCH_PIXEL_RATIO;
    const jumpOffset = this.heightOffset * SCREEN_HEIGHT * CAMERA_JUMP_PIXEL_RATIO;
    return pitchOffset + jumpOffset;
  }
}

function isWorldBlocked(cx, cy, radius) {
  const offsets = [
    { dx: -radius, dy: -radius },
    { dx: radius, dy: -radius },
    { dx: -radius, dy: radius },
    { dx: radius, dy: radius },
  ];

  for (const off of offsets) {
    const tileCol = Math.floor(cx + off.dx);
    const tileRow = Math.floor(cy + off.dy);

    if (tileCol < 0 || tileCol >= MAP_TILE_COUNT || tileRow < 0 || tileRow >= MAP_TILE_COUNT) {
      return true;
    }
    if (worldTileMap[tileRow][tileCol] !== 0) {
      return true;
    }
  }

>>>>>>> 849054761324ace091cb613435baa7cbd0695970
  return false;
}

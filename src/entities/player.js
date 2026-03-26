/*
  ============================================================
  PLAYER CLASS  (first-person camera)
  ============================================================
*/

const CONTROL_STORAGE_KEY = "betrayal-box-keybinds";
const LOOK_SENSITIVITY_STORAGE_KEY = "betrayal-box-look-sensitivity";
const LOOK_SENSITIVITY_DEFAULT = 1;
const LOOK_SENSITIVITY_MIN = 0.2;
const LOOK_SENSITIVITY_MAX = 2;

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
let lookSensitivity = loadLookSensitivity();

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

function isControlPressed(action) {
  const code = controlBindings[action];
  if (!code) return false;
  return pressedKeyCodes.has(code);
}

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
    return { ok: false, message: "Cette touche est réservée." };
  }

  const duplicateAction = CONTROL_ACTIONS.find(
    (name) => name !== action && getControlBinding(name) === code
  );

  if (duplicateAction) {
    return {
      ok: false,
      message: `${CONTROL_ACTION_LABELS[duplicateAction]} utilise déjà ${getDisplayKeyName(code)}.`,
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

function sanitizeLookSensitivity(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return LOOK_SENSITIVITY_DEFAULT;
  }
  return constrain(value, LOOK_SENSITIVITY_MIN, LOOK_SENSITIVITY_MAX);
}

function loadLookSensitivity() {
  try {
    const raw = localStorage.getItem(LOOK_SENSITIVITY_STORAGE_KEY);
    if (!raw) return LOOK_SENSITIVITY_DEFAULT;
    return sanitizeLookSensitivity(Number(raw));
  } catch {
    return LOOK_SENSITIVITY_DEFAULT;
  }
}

function saveLookSensitivity() {
  try {
    localStorage.setItem(LOOK_SENSITIVITY_STORAGE_KEY, String(lookSensitivity));
  } catch {
    // ignore localStorage failures
  }
}

function getLookSensitivity() {
  return lookSensitivity;
}

function setLookSensitivity(value) {
  const nextValue = sanitizeLookSensitivity(Number(value));
  lookSensitivity = nextValue;
  saveLookSensitivity();
  return lookSensitivity;
}

function resetLookSensitivity() {
  lookSensitivity = LOOK_SENSITIVITY_DEFAULT;
  saveLookSensitivity();
}

function getDisplayKeyName(code) {
  const aliases = {
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
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
  return `${forward}${left}${backward}${right} — Move | Shift — Sprint | Mouse — Look | Space — Jump | Click — Shoot | F — Punch | Wheel/1-2-3 — Slots | Esc — Pause`;
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
    this.pitch = 0;                             // vertical look angle
    this.moveSpeed = PLAYER_MOVE_SPEED;
    this.radius = PLAYER_RADIUS;

    // Jump / vertical camera state
    this.heightOffset = 0;                      // world units above ground
    this.verticalVelocity = 0;
    this.isGrounded = true;
    this.jumpLatch = false;

    // Sensitivity multipliers (can be changed by settings)
    this.rotateSensitivity = PLAYER_ROTATE_SPEED;
    this.pitchSensitivity = PLAYER_PITCH_SPEED;
  }

  /** Reset position and angle for a new game. */
  resetToSpawn() {
    this.posX = MAP_TILE_COUNT / 2 + 0.5;
    this.posY = MAP_TILE_COUNT / 2 + 0.5;
    this.angle = 0;
    this.pitch = 0;
    this.heightOffset = 0;
    this.verticalVelocity = 0;
    this.isGrounded = true;
    this.jumpLatch = false;
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

    // Jump (Space)
    const jumpPressed = pressedKeyCodes.has("Space");
    if (jumpPressed && !this.jumpLatch && this.isGrounded) {
      this.verticalVelocity = PLAYER_JUMP_VELOCITY;
      this.isGrounded = false;
    }
    this.jumpLatch = jumpPressed;

    // --- Calculate forward and strafe direction vectors ---
    const forwardX = Math.cos(this.angle);
    const forwardY = Math.sin(this.angle);
    const strafeX  = -Math.sin(this.angle);   // perpendicular right
    const strafeY  =  Math.cos(this.angle);   // perpendicular right

    // Combined movement vector
    let moveX = forwardInput * forwardX + strafeInput * strafeX;
    let moveY = forwardInput * forwardY + strafeInput * strafeY;

    // Normalise so diagonal movement isn't faster
    const moveMagnitude = Math.hypot(moveX, moveY);
    if (moveMagnitude > 0) {
      moveX = (moveX / moveMagnitude) * this.moveSpeed * deltaSeconds;
      moveY = (moveY / moveMagnitude) * this.moveSpeed * deltaSeconds;
    }

    // --- Wall-sliding collision ---
    // Try X movement alone
    const newX = this.posX + moveX;
    if (!isWorldBlocked(newX, this.posY, this.radius)) {
      this.posX = newX;
    }
    // Try Y movement alone
    const newY = this.posY + moveY;
    if (!isWorldBlocked(this.posX, newY, this.radius)) {
      this.posY = newY;
    }

    this.updateVerticalMotion(deltaSeconds);
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

  /**
   * Rotate the camera based on mouse movement (pointer lock delta).
   * Called from the mouseMoved() p5 callback.
   */
  rotateByMouseDelta(deltaX) {
    this.lookByMouseDelta(deltaX, 0);
  }

  lookByMouseDelta(deltaX, deltaY) {
    const sensitivity = getLookSensitivity();
    this.angle += deltaX * this.rotateSensitivity * sensitivity;
    this.pitch -= deltaY * this.pitchSensitivity * sensitivity;
    this.pitch = constrain(this.pitch, -PLAYER_MAX_PITCH, PLAYER_MAX_PITCH);
  }

  cameraVerticalOffsetPx() {
    const pitchOffset = this.pitch * SCREEN_HEIGHT * CAMERA_PITCH_PIXEL_RATIO;
    const jumpOffset = this.heightOffset * SCREEN_HEIGHT * CAMERA_JUMP_PIXEL_RATIO;
    return pitchOffset + jumpOffset;
  }
}

/**
 * Checks if a circle at (cx, cy) with given radius overlaps any solid tile.
 * We test the 4 corner points of the circle's bounding box.
 * This is a simplified but robust approach for grid-based maps.
 * 
 * NOTE: Type 12 blocks (floor) do not block movement - they are walkable terrain.
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
    const tileType = worldTileMap[tileRow][tileCol];
    // Blocks movement unless it's type 0 (empty) or type 12 (floor/terrain)
    if (tileType !== 0 && tileType !== 12) {
      return true; // solid block (wall)
    }
  }
  return false;
}

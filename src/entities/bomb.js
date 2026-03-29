// Bomb entity for 2D/3D
// Stocke position, vitesse, timer, état (explose ou non)

class Bomb {
  constructor(x, y, angle, speed = 0.18) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = speed;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.timer = 900; // ms avant explosion
    this.createdMs = millis();
    this.exploded = false;
    this.explosionRadius = 3.5; // rayon d'effet
    this.explosionTime = null;
  }

  update(dt) {
    if (this.exploded) return;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // Friction simple
    this.vx *= 0.98;
    this.vy *= 0.98;
    if (millis() - this.createdMs > this.timer) {
      this.exploded = true;
      this.explosionTime = millis();
    }
  }

  isExploding() {
    return this.exploded && millis() - this.explosionTime < 400;
  }

  isDone() {
    return this.exploded && millis() - this.explosionTime > 400;
  }
}

// Export pour import dans GameManager
if (typeof window !== 'undefined') {
  window.Bomb = Bomb;
}

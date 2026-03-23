
class Particle {
  constructor(worldX, worldY, colorArray) {
    this.posX = worldX;
    this.posY = worldY;
    this.velX = (Math.random() - 0.5) * 3;
    this.velY = (Math.random() - 0.5) * 3;
    this.lifeMs = 400 + Math.random() * 300;
    this.birthMs = millis();
    this.colorArray = colorArray;
  }

  isDead() { return millis() - this.birthMs > this.lifeMs; }

  update(deltaSeconds) {
    this.posX += this.velX * deltaSeconds;
    this.posY += this.velY * deltaSeconds;
  }

  opacity() {
    const age = millis() - this.birthMs;
    return constrain(map(age, 0, this.lifeMs, 255, 0), 0, 255);
  }
}

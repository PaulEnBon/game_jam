

class GameManager {
  addScreenShake(intensity, durationMs) {
    this.shakeIntensity = intensity;
    this.shakeDuration = durationMs;
    this.shakeStartMs = millis();
  }

  currentShakeOffset() {
    if (this.shakeIntensity === 0) return { x: 0, y: 0 };
    const elapsed = millis() - this.shakeStartMs;
    if (elapsed > this.shakeDuration) {
      this.shakeIntensity = 0;
      return { x: 0, y: 0 };
    }
    const factor = 1 - elapsed / this.shakeDuration;
    return {
      x: (Math.random() - 0.5) * 2 * this.shakeIntensity * factor,
      y: (Math.random() - 0.5) * 2 * this.shakeIntensity * factor,
    };
  }

  renderFrame() {
    this.drawSkyAndFloor();

    loadPixels();
    this.castAllRays();
    this.drawSpritesToBuffer();
    updatePixels();

    const shake = this.currentShakeOffset();
    push();
    translate(shake.x, shake.y);
    this.drawVignette();
    this.drawMinimap();
    this.drawHUD();
    this.drawCrosshair();
    pop();
  }

  drawSkyAndFloor() {
    const cyclePhase = (this.survivalSeconds() % 90) / 90;
    const nightFactor = (Math.sin(cyclePhase * TWO_PI - HALF_PI) + 1) / 2;

    const skyR = lerp(85, 12, nightFactor);
    const skyG = lerp(130, 14, nightFactor);
    const skyB = lerp(210, 45, nightFactor);

    const floorR = lerp(95, 28, nightFactor);
    const floorG = lerp(80, 22, nightFactor);
    const floorB = lerp(65, 16, nightFactor);

    noStroke();
    fill(skyR, skyG, skyB);
    rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT / 2);

    fill(floorR, floorG, floorB);
    rect(0, SCREEN_HEIGHT / 2, SCREEN_WIDTH, SCREEN_HEIGHT / 2);
  }

  castAllRays() {
    const halfFOV = FIELD_OF_VIEW_RADIANS / 2;

    for (let col = 0; col < RAY_COUNT; col++) {
      const rayScreenFraction = (col / RAY_COUNT) * 2 - 1;
      const rayAngle = this.player.angle + Math.atan(rayScreenFraction * Math.tan(halfFOV));

      const rayDirX = Math.cos(rayAngle);
      const rayDirY = Math.sin(rayAngle);

      let mapX = Math.floor(this.player.posX);
      let mapY = Math.floor(this.player.posY);

      const deltaDistX = Math.abs(rayDirX) < 1e-10 ? 1e10 : Math.abs(1 / rayDirX);
      const deltaDistY = Math.abs(rayDirY) < 1e-10 ? 1e10 : Math.abs(1 / rayDirY);

      let stepX;
      let stepY;
      let sideDistX;
      let sideDistY;

      if (rayDirX < 0) {
        stepX = -1;
        sideDistX = (this.player.posX - mapX) * deltaDistX;
      } else {
        stepX = 1;
        sideDistX = (mapX + 1.0 - this.player.posX) * deltaDistX;
      }
      if (rayDirY < 0) {
        stepY = -1;
        sideDistY = (this.player.posY - mapY) * deltaDistY;
      } else {
        stepY = 1;
        sideDistY = (mapY + 1.0 - this.player.posY) * deltaDistY;
      }

      let hitWall = false;
      let hitSide = 0;
      let tileType = 0;
      let stepsDone = 0;

      while (!hitWall && stepsDone < MAX_RAY_DISTANCE * 2) {
        if (sideDistX < sideDistY) {
          sideDistX += deltaDistX;
          mapX += stepX;
          hitSide = 0;
        } else {
          sideDistY += deltaDistY;
          mapY += stepY;
          hitSide = 1;
        }

        stepsDone++;

        if (mapX < 0 || mapX >= MAP_TILE_COUNT || mapY < 0 || mapY >= MAP_TILE_COUNT) {
          hitWall = true;
          tileType = 3;
          break;
        }

        if (worldTileMap[mapY][mapX] !== 0) {
          hitWall = true;
          tileType = worldTileMap[mapY][mapX];
        }
      }

      if (!hitWall) {
        this.zBuffer[col] = MAX_RAY_DISTANCE;
        continue;
      }

      let perpDist;
      if (hitSide === 0) {
        perpDist = (mapX - this.player.posX + (1 - stepX) / 2) / rayDirX;
      } else {
        perpDist = (mapY - this.player.posY + (1 - stepY) / 2) / rayDirY;
      }
      perpDist = Math.abs(perpDist);
      if (perpDist < 0.001) perpDist = 0.001;

      this.zBuffer[col] = perpDist;

      const wallStripHeight = (SCREEN_HEIGHT * WALL_HEIGHT_PROJECTION_FACTOR) / perpDist;
      const drawStart = Math.floor((SCREEN_HEIGHT - wallStripHeight) / 2);

      let wallHitFraction;
      if (hitSide === 0) wallHitFraction = this.player.posY + perpDist * rayDirY;
      else wallHitFraction = this.player.posX + perpDist * rayDirX;
      wallHitFraction -= Math.floor(wallHitFraction);

      const texX = Math.floor(wallHitFraction * TEXTURE_SIZE);
      const cachedTexPixels = texturePixelCache[tileType];
      if (cachedTexPixels) {
        this.drawTexturedColumn(col, drawStart, wallStripHeight, cachedTexPixels, texX, perpDist, hitSide);
      }
    }
  }

  drawTexturedColumn(screenCol, drawStart, stripHeight, texPixels, texX, distance, hitSide) {
    const rawFog = constrain(1 - (distance / MAX_RAY_DISTANCE) * FOG_DENSITY, 0, 1);
    const fogFactor = Math.max(rawFog, AMBIENT_LIGHT_MINIMUM);
    const sideBrightness = hitSide === 1 ? SIDE_SHADE_FACTOR : 1.0;
    const combinedShade = fogFactor * sideBrightness;

    const yStart = Math.max(0, Math.floor(drawStart));
    const yEnd = Math.min(SCREEN_HEIGHT, Math.floor(drawStart + stripHeight));
    const invStripHeight = TEXTURE_SIZE / stripHeight;
    const safeTexX = texX < 0 ? 0 : (texX >= TEXTURE_SIZE ? TEXTURE_SIZE - 1 : texX);

    for (let screenY = yStart; screenY < yEnd; screenY++) {
      const texY = Math.floor((screenY - drawStart) * invStripHeight);
      const safeTexY = texY < 0 ? 0 : (texY >= TEXTURE_SIZE ? TEXTURE_SIZE - 1 : texY);

      const srcIdx = 4 * (safeTexY * TEXTURE_SIZE + safeTexX);
      const dstIdx = 4 * (screenY * SCREEN_WIDTH + screenCol);
      pixels[dstIdx] = texPixels[srcIdx] * combinedShade;
      pixels[dstIdx + 1] = texPixels[srcIdx + 1] * combinedShade;
      pixels[dstIdx + 2] = texPixels[srcIdx + 2] * combinedShade;
    }
  }

  drawSpritesToBuffer() {
    const allSprites = [];

    for (const orb of this.orbs) {
      const dist = Math.hypot(orb.posX - this.player.posX, orb.posY - this.player.posY);
      let spriteType;
      if (orb.isSafe()) spriteType = "safe";
      else if (orb.isWarning()) spriteType = "warning";
      else if (orb.isChasing()) spriteType = "chase";
      else spriteType = "patrol";
      allSprites.push({ x: orb.posX, y: orb.posY, dist, type: spriteType, obj: orb });
    }

    for (const p of this.particles) {
      const dist = Math.hypot(p.posX - this.player.posX, p.posY - this.player.posY);
      allSprites.push({ x: p.posX, y: p.posY, dist, type: "particle", obj: p });
    }

    allSprites.sort((a, b) => b.dist - a.dist);
    for (const sp of allSprites) {
      this.drawSingleSpriteToBuffer(sp);
    }
  }

  drawSingleSpriteToBuffer(spriteData) {
    const relX = spriteData.x - this.player.posX;
    const relY = spriteData.y - this.player.posY;

    const cosA = Math.cos(this.player.angle);
    const sinA = Math.sin(this.player.angle);
    const transformX = -relX * sinA + relY * cosA;
    const transformY = relX * cosA + relY * sinA;

    if (transformY <= 0.1) return;

    const fovScale = SCREEN_WIDTH / (2 * Math.tan(FIELD_OF_VIEW_RADIANS / 2));
    const spriteScreenX = SCREEN_WIDTH / 2 + (transformX / transformY) * fovScale;

    let worldSize = 0.6;
    if (spriteData.type === "particle") worldSize = 0.15;
    if (spriteData.type === "patrol" || spriteData.type === "chase") worldSize = 0.75;
    if (spriteData.type === "warning") worldSize = 0.65;
    const spriteScreenSize = Math.abs((worldSize / transformY) * fovScale);

    const drawStartX = Math.max(0, Math.floor(spriteScreenX - spriteScreenSize / 2));
    const drawEndX = Math.min(SCREEN_WIDTH, Math.floor(spriteScreenX + spriteScreenSize / 2));
    const drawStartY = Math.max(0, Math.floor(SCREEN_HEIGHT / 2 - spriteScreenSize / 2));
    const drawEndY = Math.min(SCREEN_HEIGHT, Math.floor(SCREEN_HEIGHT / 2 + spriteScreenSize / 2));

    const rawFog = constrain(1 - (spriteData.dist / MAX_RAY_DISTANCE) * FOG_DENSITY, 0, 1);
    const fogFactor = Math.max(rawFog, AMBIENT_LIGHT_MINIMUM);

    let baseR;
    let baseG;
    let baseB;
    let baseA = 255;
    if (spriteData.type === "safe") {
      const pulse = 0.7 + 0.3 * Math.sin(millis() * 0.006);
      baseR = 60 * pulse;
      baseG = 255 * pulse;
      baseB = 100 * pulse;
      const mp = spriteData.obj.mutationProgress();
      baseR = lerp(baseR, 255, mp * 0.5);
      baseG = lerp(baseG, 180, mp * 0.3);
    } else if (spriteData.type === "warning") {
      const wp = spriteData.obj.warningProgress();
      const flash = Math.sin(millis() * 0.025) > 0 ? 1 : 0.4;
      baseR = lerp(255, 255, wp) * flash;
      baseG = lerp(180, 40, wp) * flash;
      baseB = 30 * flash;
    } else if (spriteData.type === "patrol") {
      const pulse = 0.6 + 0.15 * Math.sin(millis() * 0.005);
      baseR = 200 * pulse;
      baseG = 60 * pulse;
      baseB = 60 * pulse;
    } else if (spriteData.type === "chase") {
      const pulse = 0.8 + 0.2 * Math.sin(millis() * 0.015);
      const isCharging = spriteData.obj.chargeActive;
      baseR = (isCharging ? 255 : 240) * pulse;
      baseG = (isCharging ? 100 : 40) * pulse;
      baseB = isCharging ? 30 : 40;
    } else if (spriteData.type === "particle") {
      const p = spriteData.obj;
      baseR = p.colorArray[0];
      baseG = p.colorArray[1];
      baseB = p.colorArray[2];
      baseA = p.opacity();
    }

    const finalR = baseR * fogFactor;
    const finalG = baseG * fogFactor;
    const finalB = baseB * fogFactor;
    const invSize = 1 / spriteScreenSize;
    const alphaFrac = baseA / 255;
    const invAlpha = 1 - alphaFrac;

    for (let sx = drawStartX; sx < drawEndX; sx++) {
      if (transformY >= this.zBuffer[sx]) continue;

      for (let sy = drawStartY; sy < drawEndY; sy++) {
        const fracX = (sx - drawStartX) * invSize - 0.5;
        const fracY = (sy - drawStartY) * invSize - 0.5;
        if (fracX * fracX + fracY * fracY > 0.2) continue;

        const dstIdx = 4 * (sy * SCREEN_WIDTH + sx);

        if (alphaFrac >= 0.98) {
          pixels[dstIdx] = finalR;
          pixels[dstIdx + 1] = finalG;
          pixels[dstIdx + 2] = finalB;
        } else {
          pixels[dstIdx] = finalR * alphaFrac + pixels[dstIdx] * invAlpha;
          pixels[dstIdx + 1] = finalG * alphaFrac + pixels[dstIdx + 1] * invAlpha;
          pixels[dstIdx + 2] = finalB * alphaFrac + pixels[dstIdx + 2] * invAlpha;
        }
      }
    }
  }

  drawVignette() {
    const cx = SCREEN_WIDTH / 2;
    const cy = SCREEN_HEIGHT / 2;
    const maxR = Math.hypot(cx, cy);

    noStroke();
    for (let ring = 3; ring >= 1; ring--) {
      const frac = ring / 3;
      const alpha = frac * frac * 40;
      fill(0, 0, 0, alpha);
      ellipse(cx, cy, maxR * 2 * (0.65 + frac * 0.35), maxR * 2 * (0.65 + frac * 0.35));
    }
  }
}

/**
 * Generate Minecraft Zombie Skin (64×64) as SVG data URI
 * Uses standard Minecraft zombie textures with authentic colors and patterns
 */

const fs = require('fs');
const path = require('path');

// Standard Minecraft zombie colors
const COLORS = {
  skin_head: '#526F47',      // Greenish zombie head
  skin_arm: '#8E9678',       // Paler zombie arm
  skin_leg: '#2E2E2E',       // Dark pants
  shirt: '#4F6D2E',          // Shirt color
  dirt: '#957555',           // Dirt/mud accent
  shadow: '#1A1A1A',         // Shadows
};

function generateZombieSVG() {
  // 64×64 canvas for skin layout
  const svg = document.createElement ? null : {
    width: 64,
    height: 64,
  };

  let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <!-- HEAD (8×8×8) -->
  <!-- Front face (8,8) to (16,16) -->
  <rect x="8" y="8" width="8" height="8" fill="${COLORS.skin_head}" stroke="none"/>
  <!-- Zombie face details - eyes -->
  <rect x="9" y="10" width="1" height="1" fill="${COLORS.shadow}"/>
  <rect x="13" y="10" width="1" height="1" fill="${COLORS.shadow}"/>
  <!-- Mouth -->
  <rect x="9" y="13" width="5" height="1" fill="${COLORS.shadow}"/>
  
  <!-- Top face (8,0) to (16,8) -->
  <rect x="8" y="0" width="8" height="8" fill="${COLORS.skin_head}" stroke="none"/>
  <!-- Hair shadows -->
  <rect x="8" y="0" width="8" height="2" fill="${COLORS.shadow}" opacity="0.3"/>
  
  <!-- Bottom face (16,0) - unused in head, but for completeness -->
  <rect x="16" y="0" width="8" height="8" fill="${COLORS.skin_head}" stroke="none" opacity="0.8"/>
  
  <!-- Right face (16,8) to (24,16) -->
  <rect x="16" y="8" width="8" height="8" fill="${COLORS.skin_head}" stroke="none"/>
  <rect x="18" y="10" width="1" height="1" fill="${COLORS.shadow}"/>
  
  <!-- Back face (24,8) to (32,16) -->
  <rect x="24" y="8" width="8" height="8" fill="${COLORS.skin_head}" stroke="none"/>
  
  <!-- Left face (32,8) - extra layer (hat) -->
  <rect x="32" y="0" width="8" height="16" fill="${COLORS.skin_head}" stroke="none" opacity="0.9"/>
  
  <!-- BODY/CHEST (8×12×4) -->
  <!-- Front (20,20) to (28,32) -->
  <rect x="20" y="20" width="8" height="12" fill="${COLORS.shirt}" stroke="none"/>
  <!-- Shirt detail - buttons -->
  <rect x="23" y="22" width="1" height="1" fill="${COLORS.shadow}"/>
  <rect x="23" y="25" width="1" height="1" fill="${COLORS.shadow}"/>
  <rect x="23" y="28" width="1" height="1" fill="${COLORS.shadow}"/>
  
  <!-- Right side (28,20) to (36,32) -->
  <rect x="28" y="20" width="8" height="12" fill="${COLORS.shirt}" stroke="none" opacity="0.95"/>
  
  <!-- Back (32,20) to (40,32) -->
  <rect x="32" y="20" width="8" height="12" fill="${COLORS.shirt}" stroke="none" opacity="0.9"/>
  
  <!-- Left side (12,20) to (20,32) -->
  <rect x="12" y="20" width="8" height="12" fill="${COLORS.shirt}" stroke="none" opacity="0.95"/>
  
  <!-- TOP of body/neck area (20,20) -->
  <rect x="20" y="20" width="8" height="2" fill="${COLORS.skin_arm}" stroke="none"/>
  
  <!-- BOTTOM of body (28,32) -->
  <rect x="28" y="32" width="8" height="2" fill="${COLORS.skin_leg}" stroke="none"/>
  
  <!-- ARMS (4×12×4) - Right arm -->
  <!-- Front (44,20) to (48,32) -->
  <rect x="44" y="20" width="4" height="12" fill="${COLORS.skin_arm}" stroke="none"/>
  <!-- Sleeve color -->
  <rect x="44" y="20" width="4" height="3" fill="${COLORS.shirt}" stroke="none"/>
  <!-- Hand detail -->
  <rect x="44" y="30" width="4" height="2" fill="${COLORS.dirt}" stroke="none"/>
  
  <!-- Right side of arm (48,20) to (52,32) -->
  <rect x="48" y="20" width="4" height="12" fill="${COLORS.skin_arm}" stroke="none" opacity="0.95"/>
  
  <!-- Back of arm (52,20) -->
  <rect x="52" y="20" width="4" height="12" fill="${COLORS.skin_arm}" stroke="none" opacity="0.9"/>
  
  <!-- Left side (40,20) -->
  <rect x="40" y="20" width="4" height="12" fill="${COLORS.skin_arm}" stroke="none" opacity="0.95"/>
  
  <!-- ARMS (4×12×4) - Left arm -->
  <!-- Front (32,48) to (36,60) -->
  <rect x="32" y="48" width="4" height="12" fill="${COLORS.skin_arm}" stroke="none"/>
  <!-- Sleeve -->
  <rect x="32" y="48" width="4" height="3" fill="${COLORS.shirt}" stroke="none"/>
  <!-- Hand -->
  <rect x="32" y="58" width="4" height="2" fill="${COLORS.dirt}" stroke="none"/>
  
  <!-- Right of left arm (36,48) -->
  <rect x="36" y="48" width="4" height="12" fill="${COLORS.skin_arm}" stroke="none" opacity="0.95"/>
  
  <!-- Back (40,48) -->
  <rect x="40" y="48" width="4" height="12" fill="${COLORS.skin_arm}" stroke="none" opacity="0.9"/>
  
  <!-- Left (48,48) -->
  <rect x="48" y="48" width="4" height="12" fill="${COLORS.skin_arm}" stroke="none" opacity="0.95"/>
  
  <!-- LEGS (4×12×4) - Right leg -->
  <!-- Front (4,20) to (8,32) -->
  <rect x="4" y="20" width="4" height="12" fill="${COLORS.skin_leg}" stroke="none"/>
  <!-- Shoe detail -->
  <rect x="4" y="30" width="4" height="2" fill="${COLORS.shadow}" stroke="none"/>
  
  <!-- Right side (8,20) -->
  <rect x="8" y="20" width="4" height="12" fill="${COLORS.skin_leg}" stroke="none" opacity="0.95"/>
  
  <!-- Back (12,20) -->
  <rect x="12" y="20" width="4" height="12" fill="${COLORS.skin_leg}" stroke="none" opacity="0.9"/>
  
  <!-- Left (0,20) -->
  <rect x="0" y="20" width="4" height="12" fill="${COLORS.skin_leg}" stroke="none" opacity="0.95"/>
  
  <!-- LEGS (4×12×4) - Left leg -->
  <!-- Front (16,48) to (20,60) -->
  <rect x="16" y="48" width="4" height="12" fill="${COLORS.skin_leg}" stroke="none"/>
  <!-- Shoe -->
  <rect x="16" y="58" width="4" height="2" fill="${COLORS.shadow}" stroke="none"/>
  
  <!-- Right (20,48) -->
  <rect x="20" y="48" width="4" height="12" fill="${COLORS.skin_leg}" stroke="none" opacity="0.95"/>
  
  <!-- Back (24,48) -->
  <rect x="24" y="48" width="4" height="12" fill="${COLORS.skin_leg}" stroke="none" opacity="0.9"/>
  
  <!-- Left (0,48) - part of right leg second layer -->
  <rect x="0" y="48" width="4" height="12" fill="${COLORS.skin_leg}" stroke="none" opacity="0.95"/>
  
  <!-- Shadow overlay for depth -->
  <rect x="0" y="0" width="64" height="64" fill="black" opacity="0.05"/>
</svg>`;

  return svgContent;
}

// Generate and embed
const svgContent = generateZombieSVG();
const svg64 = Buffer.from(svgContent).toString('base64');
const dataURI = `data:image/svg+xml;base64,${svg64}`;

// Create output file
const output = `/**
 * Auto-generated Minecraft Zombie Skin (64×64)
 * Used for 3D zombie model texturing
 */
window.EMBEDDED_ZOMBIE_SKIN_SVG = '${dataURI}';

console.log('✓ Zombie skin loaded: 64×64 Minecraft texture');
`;

fs.writeFileSync(
  path.join(__dirname, '../src/world/embedded-zombie-skin.js'),
  output
);

console.log('✓ Generated Minecraft zombie skin texture (64×64 SVG)');
console.log('File: src/world/embedded-zombie-skin.js');

#!/usr/bin/env node

/**
 * Generate Minecraft 16×16 pixel textures as SVG Data URIs
 * Classic blocky Minecraft style
 */

const fs = require('fs');
const path = require('path');

const TEXTURE_SIZE = 16; // 16×16 classic Minecraft texture size

// Block definitions with detailed 16×16 patterns
const blocks = {
  1: {
    name: 'stone',
    generate: () => createNoisePattern([128, 128, 128], [96, 96, 96], 0.3)
  },
  2: {
    name: 'dirt',
    generate: () => createNoisePattern([139, 90, 43], [110, 70, 35], 0.4)
  },
  3: {
    name: 'grass_side',
    generate: () => {
      let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">';
      // Dirt bottom
      svg += '<rect fill="rgb(139,90,43)" width="16" height="14"/>';
      // Grass top
      svg += '<rect fill="rgb(107,142,35)" width="16" height="2"/>';
      // Grass texture details
      for (let i = 0; i < 16; i += 2) {
        const h = Math.random() > 0.5 ? 2 : 3;
        svg += `<rect fill="rgb(80,120,20)" x="${i}" y="${2-h}" width="1" height="${h}"/>`;
      }
      svg += '</svg>';
      return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }
  },
  4: {
    name: 'mossy_cobblestone',
    generate: () => {
      let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">';
      svg += '<rect fill="rgb(100,100,100)" width="16" height="16"/>';
      // Mossy spots
      const spots = [[2,2], [10,3], [3,9], [11,11], [6,6]];
      for (const [x, y] of spots) {
        svg += `<rect fill="rgb(70,120,70)" x="${x}" y="${y}" width="3" height="3"/>`;
      }
      svg += '</svg>';
      return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }
  },
  5: {
    name: 'glowstone',
    generate: () => {
      let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">';
      // Yellow base
      svg += '<rect fill="rgb(255,255,150)" width="16" height="16"/>';
      // Grid pattern (glowstone blocks)
      for (let i = 0; i < 16; i += 4) {
        svg += `<line x1="${i}" y1="0" x2="${i}" y2="16" stroke="rgb(200,200,0)" stroke-width="0.5"/>`;
        svg += `<line x1="0" y1="${i}" x2="16" y2="${i}" stroke="rgb(200,200,0)" stroke-width="0.5"/>`;
      }
      svg += '</svg>';
      return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }
  },
  6: {
    name: 'lava',
    generate: () => {
      let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">';
      svg += '<rect fill="rgb(255,140,0)" width="16" height="16"/>';
      // Simple lava pattern - rectangles only, no circles
      svg += '<rect fill="rgb(200,60,0)" x="1" y="1" width="3" height="3"/>';
      svg += '<rect fill="rgb(200,60,0)" x="8" y="4" width="4" height="4"/>';
      svg += '<rect fill="rgb(200,60,0)" x="11" y="11" width="3" height="3"/>';
      svg += '</svg>';
      return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }
  },
  7: {
    name: 'plank',
    generate: () => {
      let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">';
      svg += '<rect fill="rgb(139,69,19)" width="16" height="16"/>';
      // Wood grain - horizontal lines
      for (let i = 0; i < 16; i += 3) {
        svg += `<line x1="0" y1="${i}" x2="16" y2="${i}" stroke="rgb(100,45,10)" stroke-width="1"/>`;
      }
      svg += '</svg>';
      return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }
  },
  8: {
    name: 'leaves',
    generate: () => {
      let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">';
      svg += '<rect fill="rgb(34,139,34)" width="16" height="16"/>';
      // Leaf texture - random spots
      const spots = [[1,1], [5,3], [10,2], [13,5], [3,9], [11,8], [6,12], [14,14]];
      for (const [x, y] of spots) {
        svg += `<rect fill="rgb(22,85,22)" x="${x}" y="${y}" width="2" height="2"/>`;
      }
      svg += '</svg>';
      return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }
  },
  9: {
    name: 'obsidian',
    generate: () => {
      let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">';
      svg += '<rect fill="rgb(16,16,16)" width="16" height="16"/>';
      // Shiny obsidian reflections
      svg += '<rect fill="rgb(5,5,5)" x="2" y="2" width="4" height="4"/>';
      svg += '<rect fill="rgb(5,5,5)" x="10" y="10" width="4" height="4"/>';
      svg += '</svg>';
      return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }
  },
  10: {
    name: 'plank',
    generate: () => {
      let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">';
      svg += '<rect fill="rgb(210,180,140)" width="16" height="16"/>';
      // Light wood grain
      for (let i = 0; i < 16; i += 2) {
        svg += `<line x1="0" y1="${i}" x2="16" y2="${i}" stroke="rgb(170,140,100)" stroke-width="1"/>`;
      }
      svg += '</svg>';
      return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }
  },
  11: {
    name: 'obsidian',
    generate: () => {
      let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">';
      svg += '<rect fill="rgb(20,20,20)" width="16" height="16"/>';
      svg += '<rect fill="rgb(10,10,10)" x="1" y="1" width="14" height="14"/>';
      svg += '</svg>';
      return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }
  }
};

function createNoisePattern(mainColor, accentColor, density) {
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">`;
  svg += `<rect fill="rgb(${mainColor[0]},${mainColor[1]},${mainColor[2]})" width="16" height="16"/>`;
  
  // Add noise/detail pixels
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (Math.random() < density) {
        svg += `<rect fill="rgb(${accentColor[0]},${accentColor[1]},${accentColor[2]})" x="${x}" y="${y}" width="1" height="1"/>`;
      }
    }
  }
  svg += '</svg>';
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

async function generate() {
  const output = {};
  const textureDir = path.join(__dirname, '..', 'assets', 'textures');
  
  if (!fs.existsSync(textureDir)) {
    fs.mkdirSync(textureDir, { recursive: true });
  }
  
  console.log('🎨 Generating 16×16 Minecraft block textures...\n');
  
  for (const [blockId, block] of Object.entries(blocks)) {
    try {
      const dataUri = block.generate();
      output[blockId] = dataUri;
      console.log(`✅ ${block.name.padEnd(20)} - Block ${blockId}`);
    } catch (err) {
      console.error(`❌ Error for block ${blockId}:`, err.message);
    }
  }
  
  // Save to JavaScript file
  const jsOutput = path.join(textureDir, 'embedded.js');
  fs.writeFileSync(jsOutput, 
    'const EMBEDDED_BLOCK_TEXTURES = ' + JSON.stringify(output, null, 2) + ';\n'
  );
  
  console.log(`\n✨ Generated 16×16 textures to: ${jsOutput}`);
}

generate().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

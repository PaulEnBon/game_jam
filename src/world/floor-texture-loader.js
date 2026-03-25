/**
 * Floor Texture Loader Utility
 * Provides functions to load custom floor textures for 3D mode
 */

window.FloorTextureLoader = {
  /**
   * Load floor texture from a file input element
   * Usage: Click a file input or call directly with an image file
   */
  loadFromFile(file) {
    console.log('🔄 Loading floor texture from file:', file.name || 'unknown');
    
    const reader = new FileReader();
    reader.onload = (e) => {
      console.log('📦 File loaded, creating image...');
      const img = new Image();
      const onLoadTimeout = setTimeout(() => {
        console.error('❌ Image load timeout (5 seconds)');
      }, 5000);
      
      img.onload = () => {
        clearTimeout(onLoadTimeout);
        console.log('✅ Image loaded:', img.width, 'x', img.height);
        
        if (!window.gameManager) {
          console.error('❌ gameManager not available - game may not be initialized yet');
          console.error('   Try waiting a moment and trying again after the game fully loads');
          return;
        }
        
        window.gameManager.setFloorTextureFromImage(img);
      };
      img.onerror = () => {
        clearTimeout(onLoadTimeout);
        console.error('❌ Failed to load image from file data');
      };
      img.src = e.target.result;
    };
    reader.onerror = () => {
      console.error('❌ Failed to read file');
    };
    reader.readAsDataURL(file);
  },

  /**
   * Load floor texture from URL
   * Usage: FloorTextureLoader.loadFromURL('path/to/texture.png')
   */
  loadFromURL(url) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (window.gameManager) {
        window.gameManager.setFloorTextureFromImage(img);
        console.log('✅ Floor texture loaded from URL:', url);
      }
    };
    img.onerror = () => {
      console.error('❌ Failed to load floor texture from URL:', url);
    };
    img.src = url;
  },

  /**
   * Create a procedural checkerboard floor texture
   * Options: { colors: [color1, color2], tileSize: 16 }
   */
  createCheckerboard(options = {}) {
    const { 
      colors = ['rgb(118, 140, 78)', 'rgb(140, 115, 78)'],
      tileSize = 16,
      size = 128
    } = options;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    for (let x = 0; x < size; x += tileSize) {
      for (let y = 0; y < size; y += tileSize) {
        const tileX = Math.floor(x / tileSize);
        const tileY = Math.floor(y / tileSize);
        ctx.fillStyle = (tileX + tileY) % 2 === 0 ? colors[0] : colors[1];
        ctx.fillRect(x, y, tileSize, tileSize);
      }
    }

    const img = new Image();
    img.src = canvas.toDataURL();
    img.onload = () => {
      if (window.gameManager) {
        window.gameManager.setFloorTextureFromImage(img);
        console.log('✅ Procedural checkerboard floor texture created');
      }
    };
  },

  /**
   * Create file input dialog
   */
  createFileInputDialog() {
    console.log('🎯 Opening file picker...');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      console.log('📋 File input changed, files:', e.target.files.length);
      if (e.target.files && e.target.files[0]) {
        console.log('✓ File selected:', e.target.files[0].name);
        this.loadFromFile(e.target.files[0]);
      } else {
        console.log('⚠️ No file was selected');
      }
    };
    input.oncancel = () => {
      console.log('⚠️ File picker cancelled');
    };
    console.log('🎪 Clicking file input...');
    input.click();
  },

  /**
   * Clear saved texture from localStorage
   */
  clearSavedTexture() {
    try {
      localStorage.removeItem('floor_texture_base64');
      console.log('✅ Saved floor texture cleared');
    } catch (e) {
      console.error('Could not clear saved texture:', e);
    }
  },

  /**
   * Check if a texture is already saved
   */
  hasSavedTexture() {
    try {
      return localStorage.getItem('floor_texture_base64') !== null;
    } catch (e) {
      return false;
    }
  }
};

// Show quick instructions when loaded
console.log('%c🎨 Floor Texture System Ready!', 'color: #4CAF50; font-size: 14px; font-weight: bold;');
console.log('%cUse console commands:', 'color: #2196F3; font-weight: bold;');
console.log('  FloorTextureLoader.createFileInputDialog()  — Pick an image file');
console.log('  FloorTextureLoader.loadFromURL(url)         — Load from URL');
console.log('  FloorTextureLoader.clearSavedTexture()      — Remove saved texture');
console.log('  FloorTextureLoader.hasSavedTexture()        — Check if saved');
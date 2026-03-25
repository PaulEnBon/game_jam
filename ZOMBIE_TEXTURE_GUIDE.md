# 🧟 Zombie Texture System - Guide d'Intégration

## Vue d'ensemble

Le système d'intégration de texture zombie transforme votre fichier **Zombie.png** (peau Minecraft plate 64×64) en sprites directionnels 3D dans votre moteur p5.js. Chaque face de zombie est automatiquement extractée et affichée selon l'angle du zombie.

---

## Architecture

### Fichiers Nouveaux

1. **`src/world/zombie-texture-mapper.js`**
   - Définit la mise en page de peau Minecraft (Minecraft skeleton)
   - Fonction: `getZombieSpriteDirection(angleRadians)` → 8 directions
   - Fonction: `cacheAllZombieDirections(zombieTexture)` → Cache d'sprites
   - Fonction: `buildZombieSpriteForDirection(zombieTexture, direction)`

2. **`src/world/zombie-sprite-renderer.js`**
   - Intégration des sprites texturés au pipeline de rendu
   - Fonction: `drawZombieTextureSprite()` → Rendu à l'écran
   - Fonction: `shouldRenderZombieAsTexture()` → Vérification de disponibilité

### Fichiers Modifiés

1. **`index.html`**
   - Ajout du chargement des deux nouveaux scripts

2. **`src/systems/gamemanager.js`**
   - Nouvelle méthode: `createZombieSpriteCacheFromTexture()`
   - Modification de `createZombieSpriteCache()` pour utiliser la texture si disponible
   - Intégration du rendu texturé dans `castAllRays()`

---

## Comment ça fonctionne

### 1. Chargement de la Texture

```javascript
preloadZombieSkinTexture()  // Appelée automatiquement dans sketch.js
├─→ Charge Zombie.png (encodée en base64)
└─→ Stocke PRELOADED_ZOMBIE_SKIN_IMAGE et PRELOADED_ZOMBIE_SKIN_PIXELS
```

### 2. Création du Cache de Sprites

Lors de l'initialisation du GameManager:

```
createZombieSpriteCache()
├─→ Vérifie si PRELOADED_ZOMBIE_SKIN_IMAGE est chargée
├─→ Si OKOK: createZombieSpriteCacheFromTexture()
│   ├─→ cacheAllZombieDirections()
│   │   └─→ buildZombieSpriteForDirection() × 8 directions
│   └─→ Retourne { mode: "texture", width, height, directionalSprites }
└─→ Si non: Utilise la génération procédurale (ancien système)
```

### 3. Rendu par Angle

Lors du rendu d'un zombie:

- **Obtenir l'angle du zombie** : `spriteData.obj.bodyAngle`
- **Quantifier en 8 directions** : `getZombieSpriteDirection(angle)`
- **Sélectionner le sprite** : `directionalSprites[direction]`
- **Blitter à l'écran** : Appliquer le brouillard et l'alpha

Directions (radians):
- 0°: **front** (facing player)
- 45°: **front_right**
- 90°: **right**  
- 135°: **back_right**
- 180°: **back** (opposite)
- 225°: **back_left**
- 270°: **left**
- 315°: **front_left**

---

## Format de la Peau (Minecraft 64×64)

Partie du CorpsOrigine (x,y)Taille Totale (L×H)Dimensions 3D (L×H×P)Tête (Base)$(0, 0)$$32 \times 16$ px$8 \times 8 \times 8$Tête (Couche 2)$(32, 0)$$32 \times 16$ px$8 \times 8 \times 8$Buste (Base)$(16, 16)$$24 \times 16$ px$8 \times 12 \times 4$Buste (Couche 2)$(16, 32)$$24 \times 16$ px$8 \times 12 \times 4$Bras Droit (Base)$(40, 16)$$16 \times 16$ px$4 \times 12 \times 4$Bras Droit (C2)$(40, 32)$$16 \times 16$ px$4 \times 12 \times 4$Jambe Droite (Base)$(0, 16)$$16 \times 16$ px$4 \times 12 \times 4$Jambe Droite (C2)$(0, 32)$$16 \times 16$ px$4 \times 12 \times 4$Bras Gauche (Base)$(32, 48)$$16 \times 16$ px$4 \times 12 \times 4$Bras Gauche (C2)$(48, 48)$$16 \times 16$ px$4 \times 12 \times 4$Jambe Gauche (Base)$(16, 48)$$16 \times 16$ px$4 \times 12 \times 4$Jambe Gauche (C2)$(0, 48)$$16 \times 16$ px$4 \times 12 \times 4$

Détail interne d'un bloc (Faces précises)Pour chaque "Origine" citée plus haut, les faces sont toujours rangées dans cet ordre précis :Dessus (Top) : Origine + $(P, 0)$ | Taille : $L \times P$Dessous (Bottom) : Origine + $(P + L, 0)$ | Taille : $L \times P$Droite (Right) : Origine + $(0, P)$ | Taille : $P \times H$Devant (Front) : Origine + $(P, P)$ | Taille : $L \times H$Gauche (Left) : Origine + $(P + L, P)$ | Taille : $P \times H$Arrière (Back) : Origine + $(P + L + P, P)$ | Taille : $L \times H$Exemple concret : Face avant du Buste (Body Front)Origine du bloc : $(16, 16)$Dimensions : $L=8, H=12, P=4$Calcul : $x = 16 + 4 = \mathbf{20}$ | $y = 16 + 4 = \mathbf{20}$Position du carré "Face" : $(20, 20)$ avec une taille de $8 \times 12$ pixels.

Chaque face est **8×8 pixels** pour la tête, **8×12 pour le corps/bras/jambes**.

---

## Utilisation du Zombie.png

### Format Attendu

- **Dimensions**: 64 × 64 pixels
- **Format**: PNG avec support rgba
- **Palette**: Couleurs opérante (non-transparentes pour les faces

)
- **Disposition**: Layout Minecraft standard (voir ci-dessus)

### Exemple: Créer une Peau Compatible

```python
# Si vous avez un modèle 3D en Blender ou ailleurs:
# 1. Exporter les UV du modèle de zombie
# 2. Créer une texture 64×64 avec:
#    - Heads: Front(8,8), Right(16,8), Back(24,8), Left(32,8)
#    - Body: Front(20,20)  [faces avant des bras/jambes aussi]
#    - Arms/Legs: suivre le layout Minecraft
# 3. Exporter en PNG et remplacer Zombie.png
```

---

## Dépannage

### Le zombie affiche toujours la génération procédurale

**Cause**: `PRELOADED_ZOMBIE_SKIN_IMAGE` n'est pas chargée

**Solution**:
1. Vérifier que `preloadZombieSkinTexture()` est appelée dans `sketch.js`
2. Vérifier la console (logs avec "✓" ou "❌")
3. Recharger la page

### Le sprite affiche une couleur unie

**Cause**: L'image de texture est chargée mais mal mappée

**Solution**:
1. Vérifier que `Zombie.png` est un fichier PNG valide
2. Vérifier que les dimensions sont exactes (64×64)
3. Vérifier que les couleurs ne sont pas très transparentes

### Le zombie semble "tourner" en sautant

**Cause**: L'angle du zombie ne change pas correctement ou le cache directionnel n'a que 1 ou 2 directions

**Solution**:
- Vérifier que `buildZombieSpriteForDirection()` crée bien 8 sprites
- Vérifier que `getZombieSpriteDirection()` quantifie correctement vers 8 directions distinctes

---

## Intégration avec un Modèle 3D Externe

Si vous avez un modèle 3D (Blender, Maya, etc.) et pas seulement une peau plate:

### Option 1: Three.js + p5.js Overlay

```javascript
// Dans sketch.js, après p5 setup():
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@r128/build/three.module.js';

// Créer scène Three.js pour le zombie 3D
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, width/height, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true });

// Charger modèle 3D zombie.gltf avec texture Zombie.png
// Afficher entre les sprites 2D

// Dans draw():
// 1. Rendre p5 (arrière-plan, raycasting)
// 2. Rendre Three.js (zombies 3D) par-dessus
// 3. Rendre HUD p5 par-dessus
```

### Option 2: Babylon.js

Même approche mais avec le moteur Babylon.js pour meilleure compatibilité WebGL.

---

## Optimisations Futures

1. **Caching amélioré**: Recalculer les sprites lors du changement de texture
2. **Animation**: Ajouter des frames animées (marche, course, attaque)
3. **Shadow mapping**: Projeter l'ombre du zombie sur le sol
4. **Parallaxe**: Décaler légèrement selon la position de la caméra

---

## Références

- **Minecraft Texture Format**: https://minecraft.wiki/w/Texture
- **p5.js Image**: https://p5js.org/reference/#/p5/image
- **2D Isometric Projection**: https://en.wikipedia.org/wiki/Isometric_projection


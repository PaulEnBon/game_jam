/**
 * ============================================================
 * CUSTOM FOG SHADER (GLSL)
 * ============================================================
 * Exponential fog that darkens to black with depth
 * Starts at 8 blocks distance from camera
 * Ambiance horrifique : le fond de la map est "mangé" par le noir
 * 
 * Paramètres :
 * - fogStartDistance: 8 (distance où le brouillard commence)
 * - fogDensity: 0.25 (contrôle la courbe exponentielle)
 */

// Vertex Shader - calcule la profondeur en espace de vue
const FOG_VERTEX_SHADER = `
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;

attribute vec3 aPosition;
attribute vec3 aNormal;

varying float vDepth;
varying vec3 vNormal;

void main() {
  // Transforme la position au monde
  vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
  
  // Calcule la profondeur (distance du caméra en espace de vue)
  vec4 viewPos = uViewMatrix * worldPos;
  vDepth = -viewPos.z;  // Distance du caméra (valeur positive)
  
  // Couleur normale (pour illumination)
  vNormal = mat3(uModelMatrix) * aNormal;
  
  gl_Position = uProjectionMatrix * viewPos;
}
`;

// Fragment Shader - applique le brouillard exponentiel avec assombrissement
const FOG_FRAGMENT_SHADER = `
precision highp float;

uniform float uFogStartDistance;  // 8.0 blocs (distance de début)
uniform float uFogDensity;        // 0.25 (contrôle l'exponentialité)

varying float vDepth;
varying vec3 vNormal;

void main() {
  // Récupère la couleur dont le pixel aurait reçu (couleur venant de la vue)
  vec4 pixelColor = vec4(vNormal * 0.5 + 0.5, 1.0);
  
  // Calcule le facteur de brouillard exponentiel
  // Le brouillard commence à uFogStartDistance (8 blocs)
  // Augmente exponentiellement : factor = exp(-density * (depth - startDist)^2)
  
  float distanceFromFogStart = max(0.0, vDepth - uFogStartDistance);
  
  // Brouillard exponentiel : devient opaque rapidement après la distance de début
  // Utilise exp(-density * distance^2) pour un assombrissement naturel
  float fogFactor = exp(-uFogDensity * distanceFromFogStart * distanceFromFogStart);
  
  // Limite à [0, 1]
  fogFactor = clamp(fogFactor, 0.0, 1.0);
  
  // Applique le brouillard : mélange la couleur avec le noir
  // À mesure que fogFactor diminue, la couleur s'assombrit vers le noir
  vec3 finalColor = mix(vec3(0.0, 0.0, 0.0), pixelColor.rgb, fogFactor);
  
  gl_FragColor = vec4(finalColor, 1.0);
}
`;

/**
 * Crée un shader de brouillard personnalisé pour p5.js
 * Retourne un objet shader prêt à être utilisé avec p5.js
 */
function createFogShader() {
  return createShader(FOG_VERTEX_SHADER, FOG_FRAGMENT_SHADER);
}

/**
 * Applique le shader de brouillard au contexte WEBGL
 * @param {number} fogStartDistance - Distance où le brouillard commence (défaut 8)
 * @param {number} fogDensity - Facteur de densité exponentielle (défaut 0.25)
 * @returns {p5.Shader} Shader appliqué ou null si erreur
 */
function createAndApplyFogShader(fogStartDistance = 8, fogDensity = 0.25) {
  try {
    const fogShader = createFogShader();
    
    // Active le shader
    shader(fogShader);
    
    // Configure les uniformes du shader
    fogShader.setUniform('uFogStartDistance', fogStartDistance);
    fogShader.setUniform('uFogDensity', fogDensity);
    
    console.log(`✓ Fog Shader appliqué (distance: ${fogStartDistance}, densité: ${fogDensity})`);
    return fogShader;
  } catch (e) {
    console.warn('⚠️ Erreur création fog shader (non supporté):', e);
    return null;
  }
}

/**
 * Version alternative : applique une teinte de brouillard en noir
 * Utilise un post-processing simple sans shader complexe
 * @param {number} startDistance - Distance où le brouillard commence
 * @param {number} maxDistance - Distance où le brouillard est complètement opaque
 */
function applySimpleFogEffect(startDistance = 8, maxDistance = 50) {
  // Cette fonction peut être appelée après le rendu
  // pour appliquer une vignette sombre progressive
  // (alternative au shader si shader ne fonctionne pas)
}

# Betrayal Box

Raycasting FPS arcade survival en JavaScript/p5.js.

## Objectif
- Survis à des vagues de zombies de plus en plus dures.
- Active toutes les balises de mission dans l'arène.
- Une faille d'extraction apparaît ensuite.
- Atteins la faille pour gagner la partie.

## Nouvelles mécaniques
- Mode Zombies par vagues (spawn progressif, difficulté croissante, récompense de fin de vague).
- Punch Machine type COD (`F`) : dépense des points pour obtenir un power-up aléatoire.
- Sprint tactique (`Shift`) avec barre d'énergie.
- Kill-streak dynamique (multiplicateur de score + bonus munitions).
- Navigation d'objectif (pointeur HUD + marqueurs minimap).

## Contrôles
- `WASD` : déplacement (configurable en jeu)
- `Souris` : regarder
- `Espace` : saut
- `Click` : tirer
- `F` : utiliser la Punch Machine
- `Molette` / `1 2 3` : sélectionner/consommer slots
- `Esc` : pause

## Lancement
Ouvre `index.html` dans un navigateur compatible, puis clique pour démarrer.

## Structure
- `src/config` : constantes globales et équilibrage
- `src/world` : génération de map + textures procédurales
- `src/entities` : entités (player, orb/zombie, particules)
- `src/systems` : orchestration gameplay (`GameManager`)
- `src/app` : cycle p5.js (`setup`, `draw`, input)
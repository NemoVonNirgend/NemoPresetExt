import * as THREE from './lib/three.module.js';
import { FBXLoader } from './lib/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from './lib/jsm/loaders/GLTFLoader.js';

import { DEBUG_PREFIX } from "./constants.js";
import { scene } from "./vrm.js";

export class EnvironmentSystem {
    constructor() {
        this.gridSize = { width: 10, height: 10 }; // 10x10 grid
        this.cellSize = 0.2; // Each cell is 0.2 units
        this.grid = []; // 2D array representing walkable areas
        this.objects = []; // Interactive objects in the environment
        this.assets = []; // Loaded 3D assets
        this.isInitialized = false;
    }

    // Initialize the environment system
    async initialize() {
        if (this.isInitialized) return;
        
        // Create grid based on screen size
        this.updateGridSize();
        
        // Initialize grid (0 = walkable, 1 = blocked)
        this.grid = Array(this.gridSize.height).fill().map(() => 
            Array(this.gridSize.width).fill(0)
        );
        
        // Create visual grid helper
        this.createGridHelper();
        
        this.isInitialized = true;
        console.debug(DEBUG_PREFIX, "Environment system initialized");
    }
    
    // Update grid size based on screen dimensions
    updateGridSize() {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        
        // Calculate grid dimensions (keeping it proportional to screen)
        this.gridSize.width = Math.max(5, Math.min(20, Math.floor(screenWidth / 100)));
        this.gridSize.height = Math.max(5, Math.min(20, Math.floor(screenHeight / 100)));
        
        // Calculate cell size to fit screen
        this.cellSize = Math.min(2.0 / this.gridSize.width, 2.0 / this.gridSize.height);
        
        console.debug(DEBUG_PREFIX, `Grid size updated: ${this.gridSize.width}x${this.gridSize.height}, cell size: ${this.cellSize}`);
    }
    
    // Create visual grid helper
    createGridHelper() {
        // Remove existing grid helper if any
        if (this.gridHelper) {
            scene.remove(this.gridHelper);
        }
        
        // Create new grid helper
        this.gridHelper = new THREE.GridHelper(
            this.gridSize.width * this.cellSize,
            this.gridSize.width,
            0x444444,
            0x222222
        );
        this.gridHelper.position.y = -1.0; // Place grid below characters
        this.gridHelper.visible = false; // Hidden by default
        scene.add(this.gridHelper);
    }
    
    // Load a 3D asset into the environment
    async loadAsset(assetPath, position = { x: 0, y: 0, z: 0 }, scale = 1.0) {
        try {
            let asset;
            
            if (assetPath.endsWith('.fbx')) {
                const loader = new FBXLoader();
                asset = await loader.loadAsync(assetPath);
            } else if (assetPath.endsWith('.gltf') || assetPath.endsWith('.glb')) {
                const loader = new GLTFLoader();
                const gltf = await loader.loadAsync(assetPath);
                asset = gltf.scene;
            } else {
                throw new Error(`Unsupported asset format: ${assetPath}`);
            }
            
            // Position and scale the asset
            asset.position.set(position.x, position.y, position.z);
            asset.scale.set(scale, scale, scale);
            
            // Add to scene
            scene.add(asset);
            
            // Store asset reference
            const assetRef = {
                id: this.assets.length,
                object: asset,
                path: assetPath,
                position: { ...position },
                scale: scale,
                boundingBox: new THREE.Box3().setFromObject(asset)
            };
            
            this.assets.push(assetRef);
            
            // Update grid to mark area as blocked
            this.updateGridForAsset(assetRef);
            
            console.debug(DEBUG_PREFIX, `Loaded asset: ${assetPath}`);
            return assetRef;
        } catch (error) {
            console.error(DEBUG_PREFIX, `Failed to load asset ${assetPath}:`, error);
            return null;
        }
    }
    
    // Update grid to mark areas occupied by assets as blocked
    updateGridForAsset(assetRef) {
        // Get asset bounds in grid coordinates
        const bounds = assetRef.boundingBox;
        const minX = Math.floor((bounds.min.x + 1) / this.cellSize);
        const maxX = Math.ceil((bounds.max.x + 1) / this.cellSize);
        const minZ = Math.floor((bounds.min.z + 1) / this.cellSize);
        const maxZ = Math.ceil((bounds.max.z + 1) / this.cellSize);
        
        // Mark grid cells as blocked
        for (let x = Math.max(0, minX); x < Math.min(this.gridSize.width, maxX); x++) {
            for (let z = Math.max(0, minZ); z < Math.min(this.gridSize.height, maxZ); z++) {
                this.grid[z][x] = 1; // Mark as blocked
            }
        }
    }
    
    // Add an interactive object to the environment
    addInteractiveObject(name, position, interactionType = "inspect") {
        const object = {
            id: this.objects.length,
            name: name,
            position: { ...position },
            interactionType: interactionType,
            gridX: Math.floor((position.x + 1) / this.cellSize),
            gridZ: Math.floor((position.z + 1) / this.cellSize)
        };
        
        this.objects.push(object);
        console.debug(DEBUG_PREFIX, `Added interactive object: ${name} at (${position.x}, ${position.z})`);
        return object;
    }
    
    // Find path from start to end position using A* algorithm
    findPath(startPos, endPos) {
        // Convert world positions to grid coordinates
        const start = {
            x: Math.max(0, Math.min(this.gridSize.width - 1, Math.floor((startPos.x + 1) / this.cellSize))),
            z: Math.max(0, Math.min(this.gridSize.height - 1, Math.floor((startPos.z + 1) / this.cellSize)))
        };
        
        const end = {
            x: Math.max(0, Math.min(this.gridSize.width - 1, Math.floor((endPos.x + 1) / this.cellSize))),
            z: Math.max(0, Math.min(this.gridSize.height - 1, Math.floor((endPos.z + 1) / this.cellSize)))
        };
        
        // Validate start and end positions
        if (!this.isWalkable(start.x, start.z) || !this.isWalkable(end.x, end.z)) {
            console.warn(DEBUG_PREFIX, "Start or end position is not walkable");
            return null;
        }
        
        // A* pathfinding implementation
        const openSet = [];
        const closedSet = new Set();
        const cameFrom = {};
        const gScore = {};
        const fScore = {};
        
        // Initialize scores
        for (let z = 0; z < this.gridSize.height; z++) {
            for (let x = 0; x < this.gridSize.width; x++) {
                gScore[`${x},${z}`] = Infinity;
                fScore[`${x},${z}`] = Infinity;
            }
        }
        
        gScore[`${start.x},${start.z}`] = 0;
        fScore[`${start.x},${start.z}`] = this.heuristic(start, end);
        
        openSet.push({ x: start.x, z: start.z });
        
        while (openSet.length > 0) {
            // Find node with lowest fScore
            let current = openSet.reduce((lowest, node) => 
                fScore[`${node.x},${node.z}`] < fScore[`${lowest.x},${lowest.z}`] ? node : lowest
            );
            
            // Check if we reached the end
            if (current.x === end.x && current.z === end.z) {
                // Reconstruct path
                const path = [];
                let currentKey = `${current.x},${current.z}`;
                while (cameFrom[currentKey]) {
                    const [x, z] = currentKey.split(',').map(Number);
                    path.push({ x: x * this.cellSize - 1, z: z * this.cellSize - 1 });
                    currentKey = cameFrom[currentKey];
                }
                path.push({ x: start.x * this.cellSize - 1, z: start.z * this.cellSize - 1 });
                return path.reverse();
            }
            
            // Remove current from open set
            const currentIndex = openSet.findIndex(node => node.x === current.x && node.z === current.z);
            openSet.splice(currentIndex, 1);
            closedSet.add(`${current.x},${current.z}`);
            
            // Check neighbors
            const neighbors = [
                { x: current.x - 1, z: current.z }, // Left
                { x: current.x + 1, z: current.z }, // Right
                { x: current.x, z: current.z - 1 }, // Up
                { x: current.x, z: current.z + 1 }  // Down
            ];
            
            for (const neighbor of neighbors) {
                // Check bounds
                if (neighbor.x < 0 || neighbor.x >= this.gridSize.width ||
                    neighbor.z < 0 || neighbor.z >= this.gridSize.height) {
                    continue;
                }
                
                // Check if walkable
                if (!this.isWalkable(neighbor.x, neighbor.z)) {
                    continue;
                }
                
                // Check if in closed set
                if (closedSet.has(`${neighbor.x},${neighbor.z}`)) {
                    continue;
                }
                
                // Calculate tentative gScore
                const tentativeGScore = gScore[`${current.x},${current.z}`] + 1;
                
                // Check if this path is better
                if (tentativeGScore < gScore[`${neighbor.x},${neighbor.z}`]) {
                    cameFrom[`${neighbor.x},${neighbor.z}`] = `${current.x},${current.z}`;
                    gScore[`${neighbor.x},${neighbor.z}`] = tentativeGScore;
                    fScore[`${neighbor.x},${neighbor.z}`] = tentativeGScore + this.heuristic(neighbor, end);
                    
                    // Add to open set if not already there
                    if (!openSet.some(node => node.x === neighbor.x && node.z === neighbor.z)) {
                        openSet.push(neighbor);
                    }
                }
            }
        }
        
        // No path found
        console.warn(DEBUG_PREFIX, "No path found from start to end");
        return null;
    }
    
    // Heuristic function for A* (Manhattan distance)
    heuristic(pos1, pos2) {
        return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.z - pos2.z);
    }
    
    // Check if a grid cell is walkable
    isWalkable(x, z) {
        if (x < 0 || x >= this.gridSize.width || z < 0 || z >= this.gridSize.height) {
            return false;
        }
        return this.grid[z][x] === 0;
    }
    
    // Get random walkable position
    getRandomWalkablePosition() {
        let attempts = 0;
        while (attempts < 100) {
            const x = Math.floor(Math.random() * this.gridSize.width);
            const z = Math.floor(Math.random() * this.gridSize.height);
            
            if (this.isWalkable(x, z)) {
                return {
                    x: x * this.cellSize - 1,
                    z: z * this.cellSize - 1
                };
            }
            attempts++;
        }
        
        // Fallback to center if no walkable position found
        return { x: 0, z: 0 };
    }
    
    // Find nearest interactive object
    findNearestObject(position) {
        if (this.objects.length === 0) return null;
        
        let nearest = this.objects[0];
        let minDistance = this.distance(position, nearest.position);
        
        for (let i = 1; i < this.objects.length; i++) {
            const distance = this.distance(position, this.objects[i].position);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = this.objects[i];
            }
        }
        
        return nearest;
    }
    
    // Calculate distance between two positions
    distance(pos1, pos2) {
        const dx = pos1.x - pos2.x;
        const dz = pos1.z - pos2.z;
        return Math.sqrt(dx * dx + dz * dz);
    }
    
    // Show/hide grid helper
    toggleGridVisibility(visible) {
        if (this.gridHelper) {
            this.gridHelper.visible = visible;
        }
    }
    
    // Clean up resources
    dispose() {
        // Remove grid helper
        if (this.gridHelper) {
            scene.remove(this.gridHelper);
            this.gridHelper = null;
        }
        
        // Remove assets
        for (const assetRef of this.assets) {
            scene.remove(assetRef.object);
        }
        this.assets = [];
        this.objects = [];
        this.grid = [];
        this.isInitialized = false;
    }
}

// Export singleton instance
export const environmentSystem = new EnvironmentSystem();
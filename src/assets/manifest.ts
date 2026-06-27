/**
 * Asset manifest — catalog of all 15 GLB model files with loading
 * configuration, scaling, collision, and category metadata.
 */

export interface AssetEntry {
  /** Unique identifier used to reference the asset in code */
  id: string;
  /** Exact filename in the models/ directory */
  filename: string;
  /** Functional category for filtering and logic */
  category: 'vehicle' | 'weapon' | 'mob' | 'block' | 'environment' | 'structure' | 'character' | 'item';
  /** Uniform scale multiplier applied on placement */
  scale: number;
  /** If true, don't preload on startup — load on demand */
  lazyLoad: boolean;
  /** Whether this asset should participate in collision detection */
  collidable: boolean;
  /** Human-readable description */
  description: string;
}

export const ASSET_MANIFEST: AssetEntry[] = [
  {
    id: 'motorcycle',
    filename: 'harley_styled_motorcycle_-_minecraft.glb',
    category: 'vehicle',
    scale: 0.5,
    lazyLoad: false,
    collidable: true,
    description: 'Rideable motorcycle',
  },
  {
    id: 'matchlock',
    filename: 'minecraft_matchlock.glb',
    category: 'weapon',
    scale: 0.3,
    lazyLoad: false,
    collidable: false,
    description: 'Matchlock gun',
  },
  {
    id: 'fox',
    filename: 'fox_minecraft.glb',
    category: 'mob',
    scale: 0.8,
    lazyLoad: false,
    collidable: true,
    description: 'Passive fox mob',
  },
  {
    id: 'diamond_sword',
    filename: 'minecraft_diamond-sword.glb',
    category: 'weapon',
    scale: 0.4,
    lazyLoad: false,
    collidable: false,
    description: 'Diamond sword',
  },
  {
    id: 'bench',
    filename: 'bench_minecraft.glb',
    category: 'block',
    scale: 0.8,
    lazyLoad: false,
    collidable: true,
    description: 'Crafting bench',
  },
  {
    id: 'ghast',
    filename: 'ghast_minecraft_sonic_racing_crossworlds.glb',
    category: 'mob',
    scale: 2.0,
    lazyLoad: false,
    collidable: true,
    description: 'Flying ghast',
  },
  {
    id: 'enderman',
    filename: 'enderman_minecraft_sonic_racing_crossworlds.glb',
    category: 'mob',
    scale: 1.5,
    lazyLoad: false,
    collidable: true,
    description: 'Enderman',
  },
  {
    id: 'chest',
    filename: 'minecraft_chest.glb',
    category: 'block',
    scale: 0.8,
    lazyLoad: false,
    collidable: true,
    description: 'Storage chest',
  },
  {
    id: 'selene',
    filename: 'figure_embodying_selene_-_the_moon_goddess.glb',
    category: 'character',
    scale: 1.0,
    lazyLoad: true,
    collidable: true,
    description: 'Moon goddess figure',
  },
  {
    id: 'temple',
    filename: 'greek_temple_scan.glb',
    category: 'structure',
    scale: 0.5,
    lazyLoad: true,
    collidable: true,
    description: 'Greek temple',
  },
  {
    id: 'dirt_road',
    filename: 'free_dirt_road_through_forest.glb',
    category: 'environment',
    scale: 0.3,
    lazyLoad: true,
    collidable: true,
    description: 'Forest dirt road',
  },
  {
    id: 'bed',
    filename: 'bed_minecraft.glb',
    category: 'block',
    scale: 0.8,
    lazyLoad: false,
    collidable: true,
    description: 'Bed for sleeping',
  },
  {
    id: 'tree',
    filename: 'minecraft_tree.glb',
    category: 'environment',
    scale: 1.0,
    lazyLoad: false,
    collidable: true,
    description: 'Minecraft tree',
  },
  {
    id: 'warden',
    filename: 'minecraft_warden.glb',
    category: 'mob',
    scale: 1.5,
    lazyLoad: false,
    collidable: true,
    description: 'Warden boss',
  },
  {
    id: 'torch',
    filename: 'minecraft_torch.glb',
    category: 'item',
    scale: 0.5,
    lazyLoad: false,
    collidable: false,
    description: 'Light-emitting torch',
  },
];

/**
 * Look up an asset entry by its unique id.
 */
export function getAssetById(id: string): AssetEntry | undefined {
  return ASSET_MANIFEST.find((a) => a.id === id);
}

/**
 * Get all assets that should be preloaded on startup (lazyLoad === false).
 */
export function getPreloadAssets(): AssetEntry[] {
  return ASSET_MANIFEST.filter((a) => !a.lazyLoad);
}

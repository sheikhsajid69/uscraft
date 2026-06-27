import { BlockType, BLOCK_DEFS, BlockDefinition } from '../shared/blocks';

export function getBlockDef(type: BlockType): BlockDefinition {
  return BLOCK_DEFS[type] || BLOCK_DEFS[BlockType.AIR];
}

export function isBlockSolid(type: BlockType): boolean {
  return BLOCK_DEFS[type]?.solid ?? false;
}

export function isBlockTransparent(type: BlockType): boolean {
  return BLOCK_DEFS[type]?.transparent ?? true;
}

export { BlockType, BLOCK_DEFS };

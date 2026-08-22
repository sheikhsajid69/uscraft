import { reactive } from 'vue';

export const gameStats = reactive({
  fps: 0,
  chunkCount: 0,
  health: 20,
  maxHealth: 20,
  hunger: 20,
  maxHunger: 20,
  hurtTimer: 0,
  interactionPrompt: null as string | null,
  activeMessage: null as string | null,
});

export function damagePlayer(amount: number): void {
  gameStats.health = Math.max(0, gameStats.health - amount);
  gameStats.hurtTimer = 0.4;
}

export function healPlayer(amount: number): void {
  gameStats.health = Math.min(gameStats.maxHealth, gameStats.health + amount);
}

import { createApp } from 'vue';
import App from './ui/App.vue';
import { startGame } from './engine/GameEngine';

const app = createApp(App);
app.mount('#app');

startGame();

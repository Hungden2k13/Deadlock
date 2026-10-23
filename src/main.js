import '@fontsource/rajdhani/500.css';
import '@fontsource/rajdhani/600.css';
import '@fontsource/rajdhani/700.css';
import '@fontsource/barlow-condensed/600.css';
import './ui/hud.css';
import { Game } from './game/Game.js';
import { Menu, loadSettings, saveSettings } from './ui/Menu.js';
import { Auth } from './ui/Auth.js'; // Import màn hình đăng nhập

const settings = loadSettings();
const canvas = document.getElementById('game');

// Lấy thông tin đăng nhập từ bộ nhớ trình duyệt
const savedToken = localStorage.getItem('deadlock_token');
const savedName = localStorage.getItem('deadlock_name');

function startGameClient(displayName) {
  console.log("Chào mừng trở lại,", displayName);
  settings.playerName = displayName;
  
  const loading = document.getElementById('loading');
  const bar = loading.querySelector('.bar i');
  const msg = loading.querySelector('.msg');
  
  const TIPS = [
    'Nhấn đúp Shift để chạy nước rút chiến thuật, sau đó nhấn C để trượt.',
    'Nhấn Space tại bức tường ngang hông để nhảy qua mà không mất đà.',
    'Gỗ, thạch cao và kim loại mỏng có thể bị xuyên qua. Bê tông thì không.',
    'Bốn mạng hạ gục liên tiếp sẽ gọi UAV trinh sát.',
    'Nạp đạn chiến thuật giữ lại một viên trong buồng và nhanh hơn.',
    'Bot nghe thấy tiếng bước chân và tiếng súng. Hãy đi bộ bằng Alt hoặc ngồi để di chuyển êm ái.',
  ];
  loading.querySelector('.tip').textContent = 'MẸO · ' + TIPS[(Math.random() * TIPS.length) | 0];

  const game = new Game(canvas, settings);
  window.__game = game;

  game.init((p, label) => {
    bar.style.width = `${Math.round(p * 100)}%`;
    if (label) msg.textContent = String(label).split('/').pop().replace(/\.(glb|gltf|jpg|hdr|ogg)$/, '');
  }).then(() => {
    loading.remove();
    const menu = new Menu(game);
    game.menu = menu;
    menu.open(false);

    game.onMatchEnd = (result) => {
      game.paused = true;
      game.input.unlock();
      
      let resultText = result;
      if (result === 'VICTORY') resultText = 'CHIẾN THẮNG';
      if (result === 'DEFEAT') resultText = 'THẤT BẠI';
      if (result === 'DRAW') resultText = 'HÒA';

      game.hud.banner(resultText, game.mode.teams ? `${game.mode.score[game.player.team]} — ${game.mode.score[1 - game.player.team]}` : '', 4, result === 'VICTORY' ? 'ally' : result === 'DEFEAT' ? 'enemy' : '');
      game.audio.ui(result === 'VICTORY' ? 'streak' : 'medal');
      setTimeout(() => { game.started = false; game.hud.show(false); menu.showEnd(resultText); }, 2500);
    };

    game.input.onLockChange = (locked) => {
      menu.clickToPlay.style.display = 'none';
      if (!locked && game.started && game.match.state === 'live' && !menu.isOpen) {
        game.paused = true;
        menu.open(true);
      }
    };
    canvas.addEventListener('click', () => {
      if (game.started && !game.paused && !game.input.locked) game.input.lock();
    });
    addEventListener('keydown', (e) => {
      if (e.code === 'KeyT' && game.started && !game.player.alive) { game.paused = true; game.input.unlock(); menu.open(true, 'gunsmith'); }
    });
    addEventListener('beforeunload', () => saveSettings(settings));

    let last = performance.now();
    const frameErrors = new Set();
    const frame = (now) => {
      const raw = Math.max(0, (now - last) / 1000);
      const dt = window.__qaFixedDt ?? Math.min(0.1, raw);
      last = now;
      requestAnimationFrame(frame);
      try { game.update(dt); } catch (e) {
        const key = e?.message;
        if (!frameErrors.has(key)) { frameErrors.add(key); console.error(e); }
        game.input.endFrame();
      }
    };
    requestAnimationFrame(frame);
  }).catch(e => {
    console.error(e);
    document.querySelector('#loading .msg').textContent = 'Tải thất bại: ' + e.message;
  });
}

// Kiểm tra Token. Nếu có thì vào thẳng, không thì hiện Auth
if (savedToken && savedName) {
  startGameClient(savedName);
} else {
  new Auth((displayName) => {
    startGameClient(displayName);
  });
}
(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const hudLevel = document.getElementById('hud-level');
  const hudAct = document.getElementById('hud-act');
  const hudScore = document.getElementById('hud-score');
  const hudSeeds = document.getElementById('hud-seeds');
  const hudStatus = document.getElementById('hud-status');
  const pauseBtn = document.getElementById('btn-pause');
  const restartBtn = document.getElementById('btn-restart');
  const soundBtn = document.getElementById('btn-sound');
  const overlay = document.getElementById('overlay');
  const overlayCard = document.getElementById('overlay-card');
  const banner = document.getElementById('banner');
  const mobileControls = document.getElementById('mobile-controls');

  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const randRange = (min, max) => min + Math.random() * (max - min);

  const STORAGE_KEY = 'kora-zitouna-save-v1';
  const MEMORY_SAVE = { currentLevel: 1, unlockedLevel: 1, score: 0, seeds: 0, completed: false };
  const stars = Array.from({ length: 120 }, (_, i) => ({
    x: (i * 173) % 1920,
    y: (i * 97) % 1080,
    size: 1 + (i % 3),
    speed: 0.04 + (i % 7) * 0.01,
  }));

  const Storage = {
    read() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? { ...MEMORY_SAVE, ...JSON.parse(raw) } : { ...MEMORY_SAVE };
      } catch (error) {
        return { ...MEMORY_SAVE };
      }
    },
    write(data) {
      const payload = { ...MEMORY_SAVE, ...data };
      Object.assign(MEMORY_SAVE, payload);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (error) {
        // Fallback silently when localStorage is unavailable on file:// origins.
      }
    },
    reset() {
      Object.assign(MEMORY_SAVE, { currentLevel: 1, unlockedLevel: 1, score: 0, seeds: 0, completed: false });
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        // Ignore.
      }
    },
  };

  const Input = {
    left: false,
    right: false,
    jump: false,
    jumpPressed: false,
    pausePressed: false,
    init() {
      const setState = (key, state) => {
        if (key === 'ArrowLeft' || key === 'KeyA') this.left = state;
        if (key === 'ArrowRight' || key === 'KeyD') this.right = state;
        if (key === 'ArrowUp' || key === 'Space' || key === 'KeyW') {
          if (state && !this.jump) this.jumpPressed = true;
          this.jump = state;
        }
      };

      window.addEventListener('keydown', (event) => {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyA', 'KeyD', 'KeyW', 'Escape', 'KeyP'].includes(event.code)) {
          event.preventDefault();
        }
        if (event.code === 'Escape' || event.code === 'KeyP') {
          this.pausePressed = true;
        } else {
          setState(event.code, true);
        }
        AudioSystem.unlock();
      }, { passive: false });

      window.addEventListener('keyup', (event) => setState(event.code, false));

      mobileControls.querySelectorAll('[data-control]').forEach((button) => {
        const control = button.dataset.control;
        const press = (event) => {
          event.preventDefault();
          AudioSystem.unlock();
          button.classList.add('active');
          if (control === 'left') this.left = true;
          if (control === 'right') this.right = true;
          if (control === 'jump') {
            if (!this.jump) this.jumpPressed = true;
            this.jump = true;
          }
        };
        const release = (event) => {
          event.preventDefault();
          button.classList.remove('active');
          if (control === 'left') this.left = false;
          if (control === 'right') this.right = false;
          if (control === 'jump') this.jump = false;
        };
        button.addEventListener('touchstart', press, { passive: false });
        button.addEventListener('touchend', release, { passive: false });
        button.addEventListener('touchcancel', release, { passive: false });
        button.addEventListener('mousedown', press);
        button.addEventListener('mouseup', release);
        button.addEventListener('mouseleave', release);
      });

      window.addEventListener('blur', () => {
        this.left = false;
        this.right = false;
        this.jump = false;
      });
    },
    resetFrameFlags() {
      this.jumpPressed = false;
      this.pausePressed = false;
    },
  };

  const AudioSystem = {
    ctx: null,
    master: null,
    musicGain: null,
    sfxGain: null,
    windGain: null,
    windFilter: null,
    windSource: null,
    unlockedState: false,
    muted: false,
    beatTimer: 0,
    beatIndex: 0,
    themeName: 'grove',
    unlock() {
      if (this.unlockedState || this.muted) {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = this.ctx || new AudioCtx();
      this.master = this.master || this.ctx.createGain();
      this.musicGain = this.musicGain || this.ctx.createGain();
      this.sfxGain = this.sfxGain || this.ctx.createGain();
      this.windGain = this.windGain || this.ctx.createGain();
      this.windFilter = this.windFilter || this.ctx.createBiquadFilter();

      this.master.gain.value = 0.35;
      this.musicGain.gain.value = 0.16;
      this.sfxGain.gain.value = 0.35;
      this.windGain.gain.value = 0;
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 700;
      this.windFilter.Q.value = 0.6;

      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.windGain.connect(this.windFilter);
      this.windFilter.connect(this.master);
      this.master.connect(this.ctx.destination);

      if (!this.windSource) {
        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) {
          data[i] = (Math.random() * 2 - 1) * 0.3;
        }
        this.windSource = this.ctx.createBufferSource();
        this.windSource.buffer = buffer;
        this.windSource.loop = true;
        this.windSource.connect(this.windGain);
        this.windSource.start();
      }
      this.ctx.resume();
      this.unlockedState = true;
    },
    setTheme(themeName) {
      this.themeName = themeName || 'grove';
      this.beatIndex = 0;
      this.beatTimer = 0;
    },
    toggleMute() {
      this.muted = !this.muted;
      if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
      soundBtn.textContent = this.muted ? '🔇' : '🔊';
    },
    tone(freq, duration, type = 'triangle', gainValue = 0.14, glideTo = null) {
      if (!this.ctx || this.muted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, now + duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    },
    click(freq, duration, gainValue = 0.1) {
      this.tone(freq, duration, 'square', gainValue, freq * 0.55);
    },
    jump() {
      this.tone(540, 0.18, 'triangle', 0.15, 820);
    },
    bounce(intensity = 0.5) {
      this.tone(220 + intensity * 90, 0.11, 'sine', 0.08 + intensity * 0.05, 120);
    },
    collect() {
      this.click(820, 0.09, 0.08);
      this.tone(1160, 0.12, 'triangle', 0.06, 1400);
    },
    power() {
      this.tone(370, 0.18, 'sawtooth', 0.08, 620);
      this.tone(740, 0.23, 'triangle', 0.06, 920);
    },
    hit() {
      this.tone(180, 0.22, 'square', 0.1, 70);
    },
    door() {
      this.tone(310, 0.12, 'square', 0.07, 460);
      this.tone(660, 0.17, 'triangle', 0.05, 860);
    },
    setWind(level = 0) {
      if (!this.windGain || this.muted) return;
      const now = this.ctx.currentTime;
      this.windGain.gain.cancelScheduledValues(now);
      this.windGain.gain.linearRampToValueAtTime(level * 0.18, now + 0.08);
      this.windFilter.frequency.setTargetAtTime(500 + level * 1000, now, 0.1);
    },
    updateMusic(dt) {
      if (!this.ctx || this.muted) return;
      this.beatTimer -= dt;
      if (this.beatTimer > 0) return;
      const sequences = {
        grove: [392, 440, 494, 587, 494, 440],
        medina: [330, 392, 440, 392, 349, 294],
        desert: [294, 370, 440, 370, 330, 247],
        ruins: [262, 311, 392, 349, 311, 262],
        eclipse: [220, 294, 330, 392, 330, 294],
        rebirth: [330, 392, 494, 523, 587, 659],
      };
      const sequence = sequences[this.themeName] || sequences.grove;
      const bass = [sequence[0] / 2, sequence[2] / 2, sequence[4] / 2];
      const freq = sequence[this.beatIndex % sequence.length];
      const bassFreq = bass[this.beatIndex % bass.length];
      const now = this.ctx.currentTime;

      const note = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();
      note.type = 'triangle';
      note.frequency.setValueAtTime(freq, now);
      noteGain.gain.setValueAtTime(0.0001, now);
      noteGain.gain.linearRampToValueAtTime(0.03, now + 0.02);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      note.connect(noteGain);
      noteGain.connect(this.musicGain);
      note.start(now);
      note.stop(now + 0.3);

      const bassOsc = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();
      bassOsc.type = 'sine';
      bassOsc.frequency.setValueAtTime(bassFreq, now);
      bassGain.gain.setValueAtTime(0.0001, now);
      bassGain.gain.linearRampToValueAtTime(0.02, now + 0.01);
      bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
      bassOsc.connect(bassGain);
      bassGain.connect(this.musicGain);
      bassOsc.start(now);
      bassOsc.stop(now + 0.38);

      this.beatIndex += 1;
      this.beatTimer = this.themeName === 'desert' ? 0.42 : 0.35;
    },
  };

  const LevelManager = {
    levels: Array.isArray(window.KORA_LEVELS) ? window.KORA_LEVELS : [],
    count() {
      return this.levels.length;
    },
    get(index) {
      return JSON.parse(JSON.stringify(this.levels[index - 1]));
    },
    actName(level) {
      return `Act ${level.act}`;
    },
  };

  const Collision = {
    circleIntersectsRect(circle, rect) {
      const nearestX = clamp(circle.x, rect.x, rect.x + rect.w);
      const nearestY = clamp(circle.y, rect.y, rect.y + rect.h);
      const dx = circle.x - nearestX;
      const dy = circle.y - nearestY;
      return dx * dx + dy * dy <= circle.radius * circle.radius;
    },
    resolveCircleRect(circle, rect) {
      const nearestX = clamp(circle.x, rect.x, rect.x + rect.w);
      const nearestY = clamp(circle.y, rect.y, rect.y + rect.h);
      let dx = circle.x - nearestX;
      let dy = circle.y - nearestY;
      let distSq = dx * dx + dy * dy;
      if (distSq > circle.radius * circle.radius) return null;
      let dist = Math.sqrt(distSq);
      if (dist === 0) {
        const left = Math.abs(circle.x - rect.x);
        const right = Math.abs(rect.x + rect.w - circle.x);
        const top = Math.abs(circle.y - rect.y);
        const bottom = Math.abs(rect.y + rect.h - circle.y);
        const min = Math.min(left, right, top, bottom);
        if (min === top) {
          dx = 0;
          dy = -1;
        } else if (min === bottom) {
          dx = 0;
          dy = 1;
        } else if (min === left) {
          dx = -1;
          dy = 0;
        } else {
          dx = 1;
          dy = 0;
        }
        dist = 1;
      }
      const nx = dx / dist;
      const ny = dy / dist;
      const penetration = circle.radius - dist;
      return { nx, ny, penetration, nearestX, nearestY };
    },
  };

  const Player = {
    spawn(start) {
      return {
        x: start.x,
        y: start.y,
        prevX: start.x,
        prevY: start.y,
        vx: 0,
        vy: 0,
        radius: 18,
        grounded: false,
        coyote: 0,
        jumpBuffer: 0,
        onPlatformId: null,
        onPlatform: null,
        invulnerable: 0,
        shieldTimer: 0,
        speedTimer: 0,
        bounceTimer: 0,
        magnetTimer: 0,
        lastSafeX: start.x,
        lastSafeY: start.y,
      };
    },
    update(game, dt) {
      const player = game.player;
      const level = game.level;
      const acceleration = player.grounded ? 2350 : 1600;
      const friction = player.grounded ? 14 : 3.8;
      const maxSpeed = 320 + (player.speedTimer > 0 ? 135 : 0);
      const jumpForce = 700 + (player.bounceTimer > 0 ? 110 : 0);
      const gravity = 1740;
      let windInfluence = 0;

      player.prevX = player.x;
      player.prevY = player.y;

      if (player.onPlatform && typeof player.onPlatform.dx === 'number') {
        player.x += player.onPlatform.dx;
        player.y += player.onPlatform.dy;
      }
      player.onPlatform = null;
      player.onPlatformId = null;

      player.coyote = player.grounded ? 0.12 : Math.max(0, player.coyote - dt);
      player.jumpBuffer = Input.jumpPressed ? 0.14 : Math.max(0, player.jumpBuffer - dt);
      player.invulnerable = Math.max(0, player.invulnerable - dt);
      player.shieldTimer = Math.max(0, player.shieldTimer - dt);
      player.speedTimer = Math.max(0, player.speedTimer - dt);
      player.bounceTimer = Math.max(0, player.bounceTimer - dt);
      player.magnetTimer = Math.max(0, player.magnetTimer - dt);

      for (const zone of level.windZones) {
        if (player.x + player.radius > zone.x && player.x - player.radius < zone.x + zone.w && player.y + player.radius > zone.y && player.y - player.radius < zone.y + zone.h) {
          player.vx += zone.forceX * dt;
          player.vy += zone.forceY * dt;
          windInfluence = Math.max(windInfluence, Math.min(1, (Math.abs(zone.forceX) + Math.abs(zone.forceY)) / 850));
        }
      }
      AudioSystem.setWind(windInfluence);

      const desired = (Input.right ? 1 : 0) - (Input.left ? 1 : 0);
      if (desired !== 0) {
        player.vx += desired * acceleration * dt;
      } else {
        const drop = Math.min(Math.abs(player.vx), friction * 45 * dt);
        player.vx -= Math.sign(player.vx) * drop;
      }
      player.vx = clamp(player.vx, -maxSpeed, maxSpeed);

      if (player.jumpBuffer > 0 && player.coyote > 0) {
        player.vy = -jumpForce;
        player.grounded = false;
        player.coyote = 0;
        player.jumpBuffer = 0;
        AudioSystem.jump();
        game.spawnBurst(player.x, player.y + player.radius, '#f6e6a2', 8, 90);
      }

      player.vy += gravity * dt;
      if (player.vy > 980) player.vy = 980;
      player.x += player.vx * dt;
      player.y += player.vy * dt;
      player.grounded = false;

      const solids = [];
      level.platforms.forEach((platform) => solids.push(platform));
      level.doors.filter((door) => !door.open).forEach((door) => solids.push(door));

      for (let pass = 0; pass < 3; pass += 1) {
        for (const rect of solids) {
          const hit = Collision.resolveCircleRect(player, rect);
          if (!hit) continue;
          player.x += hit.nx * hit.penetration;
          player.y += hit.ny * hit.penetration;

          if (Math.abs(hit.ny) >= Math.abs(hit.nx)) {
            if (hit.ny < -0.35) {
              if (player.vy > 160) {
                AudioSystem.bounce(clamp(player.vy / 800, 0.15, 1));
              }
              if (rect.type === 'falling') {
                rect.triggered = true;
                rect.fallTimer = rect.fallTimer || rect.delay;
              }
              player.vy = player.vy > 120 ? -Math.min(90, player.vy * 0.08) : 0;
              player.grounded = true;
              player.coyote = 0.12;
              player.lastSafeX = player.x;
              player.lastSafeY = player.y;
              player.onPlatform = rect;
              player.onPlatformId = rect._id;
            } else if (hit.ny > 0.35) {
              player.vy = Math.max(0, player.vy);
            }
          } else {
            player.vx *= 0.45;
          }
        }
      }

      if (player.x < 10) {
        player.x = 10;
        player.vx = Math.max(0, player.vx);
      }
      if (player.x > level.worldWidth - 10) {
        player.x = level.worldWidth - 10;
        player.vx = Math.min(0, player.vx);
      }
      if (player.y > level.worldHeight + 180) {
        game.hurtPlayer('pit');
        return;
      }

      level.collectibles.forEach((seed) => {
        if (seed.collected) return;
        const dx = player.x - seed.x;
        const dy = player.y - seed.y;
        const distance = Math.hypot(dx, dy);
        if (player.magnetTimer > 0 && distance < 180) {
          const force = clamp(1 - distance / 180, 0.05, 1) * 480 * dt;
          seed.x += (player.x - seed.x) * force * 0.015;
          seed.y += (player.y - seed.y) * force * 0.015;
        }
        if (distance < player.radius + seed.r + 4) {
          seed.collected = true;
          game.score += 10;
          game.totalSeeds += 1;
          AudioSystem.collect();
          game.spawnBurst(seed.x, seed.y, '#f1d86a', 10, 120);
          game.persistProgress();
        }
      });

      level.powerups.forEach((item) => {
        if (item.collected) return;
        const distance = Math.hypot(player.x - item.x, player.y - item.y);
        if (distance < player.radius + item.r + 6) {
          item.collected = true;
          if (item.type === 'shield') player.shieldTimer = 12;
          if (item.type === 'speed') player.speedTimer = 10;
          if (item.type === 'bounce') player.bounceTimer = 10;
          if (item.type === 'magnet') player.magnetTimer = 10;
          AudioSystem.power();
          game.spawnBurst(item.x, item.y, '#9fe89e', 14, 150);
        }
      });

      level.switches.forEach((switchObj) => {
        if (switchObj.active) return;
        const rect = { x: switchObj.x, y: switchObj.y, w: switchObj.w, h: switchObj.h };
        if (Collision.circleIntersectsRect(player, rect)) {
          switchObj.active = true;
          level.doors.forEach((door) => {
            if (door.id === switchObj.id) door.open = true;
          });
          AudioSystem.door();
          game.spawnBurst(switchObj.x + switchObj.w / 2, switchObj.y, '#8de5ff', 16, 160);
        }
      });

      for (const spike of level.spikes) {
        if (Collision.circleIntersectsRect(player, spike)) {
          game.hurtPlayer('spike');
          return;
        }
      }

      for (const enemy of level.enemies) {
        if (!enemy.alive) continue;
        const rect = { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h };
        if (Collision.circleIntersectsRect(player, rect)) {
          const stomp = player.prevY + player.radius <= enemy.y + 6 && player.vy > 120;
          if (stomp) {
            enemy.alive = false;
            player.vy = -420;
            AudioSystem.bounce(0.9);
            game.spawnBurst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, '#ffba7a', 12, 150);
            game.score += 15;
          } else if (player.shieldTimer > 0) {
            enemy.alive = false;
            AudioSystem.power();
            game.spawnBurst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, '#a5f1b6', 14, 150);
          } else {
            game.hurtPlayer('enemy');
            return;
          }
        }
      }

      if (Collision.circleIntersectsRect(player, level.goal)) {
        game.reachGoal();
      }
    },
  };

  const UI = {
    hideOverlay() {
      overlay.classList.add('hidden');
    },
    showOverlay(html) {
      overlay.classList.remove('hidden');
      overlayCard.innerHTML = html;
    },
    showBanner(text) {
      banner.textContent = text;
      banner.classList.add('show');
    },
    hideBanner() {
      banner.classList.remove('show');
    },
    updateHud(game) {
      const level = game.level;
      hudLevel.textContent = `Level ${game.currentLevel}`;
      hudAct.textContent = `${LevelManager.actName(level)} · ${level.colors.name}`;
      hudScore.textContent = `Score ${game.score}`;
      const collected = level.collectibles.filter((item) => item.collected).length;
      hudSeeds.textContent = `Seeds ${game.totalSeeds} · ${collected}/${level.collectibles.length}`;
      const statuses = [];
      if (game.player.shieldTimer > 0) statuses.push(`🛡️ ${game.player.shieldTimer.toFixed(1)}s`);
      if (game.player.speedTimer > 0) statuses.push(`💨 ${game.player.speedTimer.toFixed(1)}s`);
      if (game.player.bounceTimer > 0) statuses.push(`🫧 ${game.player.bounceTimer.toFixed(1)}s`);
      if (game.player.magnetTimer > 0) statuses.push(`🧲 ${game.player.magnetTimer.toFixed(1)}s`);
      hudStatus.textContent = statuses.length ? statuses.join('  ') : 'Reach the gate and keep the olive world alive';
    },
    mainMenu(save) {
      const canContinue = save.unlockedLevel > 1 || save.score > 0 || save.completed;
      return `
        <h1>Kora Zitouna 🫒</h1>
        <p class="subtitle">Legacy of Bounce — لعبة منصات 2D كاملة بروح نوكيا الكلاسيكية. اجمع بذور الزيتون، افتح الأبواب القديمة، واركب الرياح لحد الشجرة الأصلية.</p>
        <div class="stat-grid">
          <div class="stat-card"><span>أعلى مرحلة</span><strong>${save.unlockedLevel}/50</strong></div>
          <div class="stat-card"><span>إجمالي السكور</span><strong>${save.score}</strong></div>
          <div class="stat-card"><span>بذور مجمعة</span><strong>${save.seeds}</strong></div>
        </div>
        <div class="menu-grid">
          <button class="menu-btn" data-action="new-game">لعبة جديدة</button>
          ${canContinue ? '<button class="menu-btn secondary" data-action="continue-game">استكمال الرحلة</button>' : ''}
          <button class="menu-btn ghost" data-action="how-to">طريقة اللعب</button>
          <button class="menu-btn ghost" data-action="reset-save">مسح الحفظ</button>
        </div>
        <div class="tip-list">
          <div class="tip-item">⌨️ الكمبيوتر: الأسهم للحركة + Space للقفز</div>
          <div class="tip-item">📱 الموبايل: أزرار لمس على الشاشة</div>
          <div class="tip-item">💾 الحفظ تلقائيًا بالـ localStorage مع استرجاع المستوى والسكور</div>
        </div>
      `;
    },
    helpMenu() {
      return `
        <h2>طريقة اللعب</h2>
        <p class="subtitle">Kora كرة زيتون مرنة. استخدم الزخم والقفز الدقيق لعبور 50 مرحلة موزعين على 5 Acts كاملة.</p>
        <div class="tip-list">
          <div class="tip-item">🫒 اجمع Olive Seeds لرفع السكور وكشف المسارات المخفية</div>
          <div class="tip-item">💣 العقبات تشمل spikes وmoving platforms وfalling platforms وwind zones وأعداء بدوريات</div>
          <div class="tip-item">🧿 القوى: Bounce Boost وSpeed Boost وShield وMagnet</div>
          <div class="tip-item">🌳 المرحلة 50 فيها النهاية السينمائية واستعادة العالم</div>
        </div>
        <div class="menu-grid">
          <button class="menu-btn" data-action="back-menu">رجوع</button>
          <button class="menu-btn secondary" data-action="new-game">ابدأ الآن</button>
        </div>
      `;
    },
    pauseMenu(game) {
      return `
        <h2>إيقاف مؤقت</h2>
        <p class="subtitle">المستوى الحالي: ${game.currentLevel} — ${game.level.title}</p>
        <div class="status-row">
          <span class="status-chip">Score ${game.score}</span>
          <span class="status-chip">Seeds ${game.totalSeeds}</span>
          <span class="status-chip">Deaths ${game.deaths}</span>
        </div>
        <div class="menu-grid">
          <button class="menu-btn" data-action="resume">استكمال</button>
          <button class="menu-btn secondary" data-action="restart-level">إعادة المرحلة</button>
          <button class="menu-btn ghost" data-action="to-menu">القائمة الرئيسية</button>
        </div>
      `;
    },
    victory(game) {
      return `
        <h1>🌳 العالم اخضر من جديد</h1>
        <p class="subtitle">الشجرة الأصلية امتصت Kora وأعادت الحياة للغابات والأسطح والرمال والآثار. خلّصت الرحلة كاملة!</p>
        <div class="stat-grid">
          <div class="stat-card"><span>مراحل مكتملة</span><strong>50 / 50</strong></div>
          <div class="stat-card"><span>السكور النهائي</span><strong>${game.score}</strong></div>
          <div class="stat-card"><span>البذور</span><strong>${game.totalSeeds}</strong></div>
          <div class="stat-card"><span>عدد السقطات</span><strong>${game.deaths}</strong></div>
        </div>
        <div class="menu-grid">
          <button class="menu-btn" data-action="continue-game">إعادة من آخر حفظ</button>
          <button class="menu-btn secondary" data-action="new-game">بداية جديدة</button>
          <button class="menu-btn ghost" data-action="back-menu">القائمة الرئيسية</button>
        </div>
      `;
    },
  };

  const Game = {
    state: 'menu',
    width: window.innerWidth,
    height: window.innerHeight,
    cameraX: 0,
    cameraY: 0,
    currentLevel: 1,
    unlockedLevel: 1,
    score: 0,
    totalSeeds: 0,
    deaths: 0,
    level: null,
    player: null,
    particles: [],
    transitionTimer: 0,
    pendingLevel: null,
    finaleTimer: 0,
    worldBloom: 0,
    messageTimer: 0,
    currentMessage: '',
    init() {
      this.handleResize();
      Input.init();
      this.bindUi();
      const save = Storage.read();
      this.score = save.score;
      this.totalSeeds = save.seeds;
      this.currentLevel = save.currentLevel;
      this.unlockedLevel = save.unlockedLevel;
      UI.showOverlay(UI.mainMenu(save));
      this.attachOverlayEvents();
      requestAnimationFrame(this.loop.bind(this));
    },
    bindUi() {
      pauseBtn.addEventListener('click', () => {
        AudioSystem.unlock();
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') this.resume();
      });
      restartBtn.addEventListener('click', () => {
        AudioSystem.unlock();
        if (this.level) this.restartLevel();
      });
      soundBtn.addEventListener('click', () => AudioSystem.toggleMute());
      window.addEventListener('resize', () => this.handleResize());
      window.addEventListener('pointerdown', () => AudioSystem.unlock(), { passive: true });
    },
    attachOverlayEvents() {
      overlayCard.querySelectorAll('[data-action]').forEach((button) => {
        button.addEventListener('click', () => {
          AudioSystem.unlock();
          const action = button.dataset.action;
          if (action === 'new-game') this.startNewGame();
          if (action === 'continue-game') this.continueGame();
          if (action === 'how-to') UI.showOverlay(UI.helpMenu());
          if (action === 'back-menu') UI.showOverlay(UI.mainMenu(Storage.read()));
          if (action === 'reset-save') {
            Storage.reset();
            this.score = 0;
            this.totalSeeds = 0;
            this.currentLevel = 1;
            this.unlockedLevel = 1;
            UI.showOverlay(UI.mainMenu(Storage.read()));
          }
          if (action === 'resume') this.resume();
          if (action === 'restart-level') this.restartLevel();
          if (action === 'to-menu') this.toMenu();
          this.attachOverlayEvents();
        });
      });
    },
    handleResize() {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      canvas.width = Math.floor(this.width * DPR);
      canvas.height = Math.floor(this.height * DPR);
      canvas.style.width = `${this.width}px`;
      canvas.style.height = `${this.height}px`;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.imageSmoothingEnabled = true;
    },
    startNewGame() {
      this.score = 0;
      this.totalSeeds = 0;
      this.deaths = 0;
      this.currentLevel = 1;
      this.unlockedLevel = 1;
      Storage.write({ currentLevel: 1, unlockedLevel: 1, score: 0, seeds: 0, completed: false });
      this.loadLevel(1);
      this.state = 'playing';
      UI.hideOverlay();
      UI.showBanner('Act 1 · البداية في بساتين الزيتون');
      setTimeout(() => UI.hideBanner(), 1800);
    },
    continueGame() {
      const save = Storage.read();
      this.score = save.score;
      this.totalSeeds = save.seeds;
      this.currentLevel = clamp(save.currentLevel || 1, 1, LevelManager.count());
      this.unlockedLevel = clamp(save.unlockedLevel || 1, 1, LevelManager.count());
      this.loadLevel(this.currentLevel);
      this.state = 'playing';
      UI.hideOverlay();
      UI.showBanner(`استكمال من المستوى ${this.currentLevel}`);
      setTimeout(() => UI.hideBanner(), 1400);
    },
    toMenu() {
      this.state = 'menu';
      UI.showOverlay(UI.mainMenu(Storage.read()));
      this.attachOverlayEvents();
    },
    pause() {
      if (this.state !== 'playing') return;
      this.state = 'paused';
      UI.showOverlay(UI.pauseMenu(this));
      this.attachOverlayEvents();
    },
    resume() {
      this.state = 'playing';
      UI.hideOverlay();
    },
    persistProgress(extra = {}) {
      Storage.write({
        currentLevel: this.currentLevel,
        unlockedLevel: this.unlockedLevel,
        score: this.score,
        seeds: this.totalSeeds,
        completed: extra.completed || false,
      });
    },
    loadLevel(index) {
      this.currentLevel = clamp(index, 1, LevelManager.count());
      this.level = LevelManager.get(this.currentLevel);
      this.level.platforms.forEach((platform, i) => {
        platform._id = `platform-${i}`;
        platform.dx = 0;
        platform.dy = 0;
        platform.fallTimer = platform.fallTimer || 0;
        platform.vy = platform.vy || 0;
      });
      this.level.doors.forEach((door, i) => {
        door._id = `door-${i}`;
        door.dx = 0;
        door.dy = 0;
      });
      this.player = Player.spawn(this.level.start);
      this.particles = [];
      this.cameraX = 0;
      this.cameraY = 0;
      this.transitionTimer = 0;
      this.pendingLevel = null;
      this.finaleTimer = 0;
      this.worldBloom = 0;
      this.currentMessage = this.level.messages[0] || '';
      this.messageTimer = 4.2;
      AudioSystem.setTheme(this.level.colors.key);
      UI.updateHud(this);
      this.persistProgress();
    },
    restartLevel() {
      this.loadLevel(this.currentLevel);
      this.state = 'playing';
      UI.hideOverlay();
      UI.showBanner(`إعادة المستوى ${this.currentLevel}`);
      setTimeout(() => UI.hideBanner(), 1000);
    },
    hurtPlayer(reason) {
      if (this.state !== 'playing' && this.state !== 'finale') return;
      if (this.player.invulnerable > 0) return;
      if (this.player.shieldTimer > 0) {
        this.player.shieldTimer = 0;
        this.player.invulnerable = 0.7;
        AudioSystem.power();
        this.spawnBurst(this.player.x, this.player.y, '#b2ffcc', 12, 170);
        return;
      }
      this.deaths += 1;
      this.player.invulnerable = 1;
      AudioSystem.hit();
      this.spawnBurst(this.player.x, this.player.y, '#ff908a', 18, 180);
      this.loadLevel(this.currentLevel);
      this.currentMessage = reason === 'pit' ? 'سقطة قوية! جرّب تاني.' : 'خطر! ارجع وخد بالك.';
      this.messageTimer = 2.4;
    },
    reachGoal() {
      if (this.state !== 'playing') return;
      if (this.currentLevel === 50 || this.level.goal.type === 'tree') {
        this.state = 'finale';
        this.finaleTimer = 0;
        this.player.vx = 0;
        this.player.vy = 0;
        this.currentMessage = 'الشجرة الأصلية بتنادي Kora...';
        this.messageTimer = 4;
        return;
      }
      this.state = 'transition';
      this.transitionTimer = 1.45;
      this.pendingLevel = this.currentLevel + 1;
      this.unlockedLevel = Math.max(this.unlockedLevel, this.pendingLevel);
      this.persistProgress();
      UI.showBanner(`تم إنهاء المستوى ${this.currentLevel} ✨`);
      this.spawnBurst(this.level.goal.x + this.level.goal.w / 2, this.level.goal.y + 30, '#c9ff7e', 24, 220);
    },
    completeGame() {
      this.unlockedLevel = 50;
      this.currentLevel = 50;
      this.persistProgress({ completed: true });
      this.state = 'victory';
      UI.showOverlay(UI.victory(this));
      this.attachOverlayEvents();
    },
    spawnBurst(x, y, color, count, speed) {
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + randRange(-0.2, 0.2);
        const velocity = speed * randRange(0.35, 1);
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity,
          life: randRange(0.4, 0.9),
          maxLife: randRange(0.4, 0.9),
          color,
          size: randRange(2, 5),
        });
      }
    },
    updateLevel(dt) {
      this.level.platforms.forEach((platform) => {
        const prevX = platform.x;
        const prevY = platform.y;
        if (platform.type === 'moving' || platform.type === 'sand-moving' || platform.type === 'ruin-moving' || platform.type === 'eclipse-moving' || platform.type === 'rebirth-moving') {
          const t = performance.now() / 1000;
          if (platform.axis === 'x') platform.x = platform.baseX + Math.sin(t * platform.speed + platform.phase) * platform.range;
          if (platform.axis === 'y') platform.y = platform.baseY + Math.sin(t * platform.speed + platform.phase) * platform.range;
        } else if (platform.type === 'falling') {
          if (platform.triggered) {
            platform.fallTimer -= dt;
            if (platform.fallTimer <= 0) {
              platform.vy += 1100 * dt;
              platform.y += platform.vy * dt;
            }
          }
        }
        platform.dx = platform.x - prevX;
        platform.dy = platform.y - prevY;
      });

      this.level.enemies.forEach((enemy) => {
        if (!enemy.alive) return;
        enemy.x += enemy.speed * enemy.dir * dt;
        if (enemy.x < enemy.minX) {
          enemy.x = enemy.minX;
          enemy.dir = 1;
        }
        if (enemy.x + enemy.w > enemy.maxX) {
          enemy.x = enemy.maxX - enemy.w;
          enemy.dir = -1;
        }
      });
    },
    updateParticles(dt) {
      this.particles = this.particles.filter((particle) => {
        particle.life -= dt;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vy += 280 * dt;
        particle.vx *= 0.985;
        return particle.life > 0;
      });
    },
    updateCamera(dt) {
      const targetX = clamp(this.player.x - this.width * 0.35, 0, Math.max(0, this.level.worldWidth - this.width));
      const targetY = clamp(this.player.y - this.height * 0.52, 0, Math.max(0, this.level.worldHeight - this.height));
      this.cameraX = lerp(this.cameraX, targetX, 1 - Math.pow(0.001, dt));
      this.cameraY = lerp(this.cameraY, targetY, 1 - Math.pow(0.001, dt));
    },
    update(dt) {
      if (Input.pausePressed) {
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') this.resume();
      }
      if (this.state === 'playing') {
        this.updateLevel(dt);
        Player.update(this, dt);
        this.updateParticles(dt);
        this.updateCamera(dt);
        this.messageTimer = Math.max(0, this.messageTimer - dt);
        AudioSystem.updateMusic(dt);
        UI.updateHud(this);
      } else if (this.state === 'transition') {
        this.updateParticles(dt);
        this.transitionTimer -= dt;
        this.updateCamera(dt);
        AudioSystem.updateMusic(dt);
        if (this.transitionTimer <= 0 && this.pendingLevel) {
          UI.hideBanner();
          this.loadLevel(this.pendingLevel);
          this.state = 'playing';
          UI.showBanner(`${this.level.title}`);
          setTimeout(() => UI.hideBanner(), 1400);
        }
      } else if (this.state === 'finale') {
        this.finaleTimer += dt;
        this.worldBloom = clamp(this.finaleTimer / 5.2, 0, 1);
        const treeCenterX = this.level.goal.x + this.level.goal.w / 2;
        const treeCenterY = this.level.goal.y + this.level.goal.h * 0.55;
        const t = easeInOut(clamp(this.finaleTimer / 3.6, 0, 1));
        this.player.x = lerp(this.player.x, treeCenterX, t * 0.05 + 0.03);
        this.player.y = lerp(this.player.y, treeCenterY, t * 0.05 + 0.03);
        this.player.radius = lerp(this.player.radius, 5, 0.015 + dt * 0.02);
        this.spawnBurst(treeCenterX + randRange(-18, 18), treeCenterY + randRange(-30, 30), this.finaleTimer < 2.6 ? '#f1df78' : '#90f09e', 2, 80);
        this.updateParticles(dt);
        this.updateCamera(dt);
        AudioSystem.updateMusic(dt);
        if (this.finaleTimer > 5.4) {
          this.completeGame();
        }
      } else if (this.state === 'paused' || this.state === 'menu' || this.state === 'victory') {
        this.updateParticles(dt);
      }
      Input.resetFrameFlags();
    },
    loop(now) {
      this.lastTime = this.lastTime || now;
      const dt = Math.min(0.033, (now - this.lastTime) / 1000);
      this.lastTime = now;
      this.update(dt);
      this.render();
      requestAnimationFrame(this.loop.bind(this));
    },
    renderBackground() {
      const theme = this.level ? this.level.colors : { skyTop: '#3b6b48', skyBottom: '#211927', fog: '#d9edc5' };
      const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
      gradient.addColorStop(0, theme.skyTop);
      gradient.addColorStop(1, lerpColor(theme.skyBottom, '#79c765', this.worldBloom));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.width, this.height);

      if (this.level && ['ruins', 'eclipse', 'rebirth'].includes(theme.key)) {
        ctx.save();
        ctx.globalAlpha = 0.6 + this.worldBloom * 0.3;
        stars.forEach((star) => {
          const x = (star.x - this.cameraX * star.speed) % (this.width + 40);
          const y = (star.y - this.cameraY * star.speed * 0.5) % this.height;
          ctx.fillStyle = `rgba(255,255,255,${0.45 + star.size * 0.1})`;
          ctx.fillRect(x, y, star.size, star.size);
        });
        ctx.restore();
      }

      if (!this.level) return;

      const horizon = this.height * 0.66;
      for (let layer = 0; layer < 3; layer += 1) {
        ctx.save();
        const parallax = 0.15 + layer * 0.12;
        const offset = -(this.cameraX * parallax) % 480;
        ctx.globalAlpha = 0.14 + layer * 0.08 + this.worldBloom * 0.05;
        ctx.fillStyle = layer === 0 ? theme.shadow : layer === 1 ? theme.ground : theme.fog;
        for (let x = -500; x < this.width + 500; x += 240) {
          const height = 80 + ((x + layer * 57) % 3) * 40 + layer * 20;
          ctx.beginPath();
          ctx.moveTo(x + offset, this.height);
          ctx.quadraticCurveTo(x + 80 + offset, horizon - height, x + 170 + offset, this.height - 110 + layer * 10);
          ctx.quadraticCurveTo(x + 230 + offset, horizon - height * 0.4, x + 300 + offset, this.height);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      if (this.worldBloom > 0.01) {
        ctx.save();
        ctx.globalAlpha = this.worldBloom * 0.25;
        ctx.fillStyle = '#9de06b';
        ctx.fillRect(0, this.height * 0.55, this.width, this.height * 0.45);
        ctx.restore();
      }
    },
    renderWorld() {
      if (!this.level) return;
      ctx.save();
      ctx.translate(-this.cameraX, -this.cameraY);

      this.level.windZones.forEach((zone, index) => {
        ctx.save();
        ctx.globalAlpha = 0.13;
        const pulse = 0.7 + Math.sin(performance.now() * 0.003 + index) * 0.2;
        ctx.fillStyle = `rgba(145,226,255,${0.16 * pulse})`;
        ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
        ctx.strokeStyle = 'rgba(203,247,255,0.35)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i += 1) {
          const y = zone.y + 18 + i * (zone.h - 32) / 5;
          ctx.beginPath();
          ctx.moveTo(zone.x + 10, y);
          ctx.bezierCurveTo(zone.x + zone.w * 0.3, y - 18, zone.x + zone.w * 0.7, y + 18, zone.x + zone.w - 10, y);
          ctx.stroke();
        }
        ctx.restore();
      });

      this.level.platforms.forEach((platform) => this.drawPlatform(platform));
      this.level.doors.forEach((door) => this.drawDoor(door));
      this.level.switches.forEach((switchObj) => this.drawSwitch(switchObj));
      this.level.spikes.forEach((spike) => this.drawSpikes(spike));
      this.level.collectibles.forEach((seed, index) => this.drawSeed(seed, index));
      this.level.powerups.forEach((item) => this.drawPowerup(item));
      this.level.enemies.forEach((enemy) => this.drawEnemy(enemy));
      this.drawGoal(this.level.goal);
      this.drawPlayer(this.player);
      this.drawParticles();
      ctx.restore();
    },
    drawPlatform(platform) {
      const styleMap = {
        ground: ['#708846', '#516233'],
        stone: ['#8e8b82', '#666057'],
        ledge: ['#a4b365', '#64773b'],
        roof: ['#c8a36d', '#7b5a36'],
        awning: ['#5f8668', '#315642'],
        'roof-goal': ['#8fa669', '#576d3e'],
        sand: ['#d8b26a', '#a67f43'],
        'sand-moving': ['#f2d189', '#b58f52'],
        oasis: ['#76b995', '#487860'],
        ruin: ['#867d90', '#5e5668'],
        'ruin-moving': ['#9d8fb0', '#695d7b'],
        eclipse: ['#69704e', '#404630'],
        'eclipse-moving': ['#97aa64', '#566435'],
        'goal-ground': ['#95b05b', '#5e7537'],
        rebirth: ['#7a9653', '#506837'],
        'rebirth-moving': ['#b4cb72', '#6f8b40'],
        'tree-island': ['#86ad58', '#47622a'],
      };
      const [topColor, sideColor] = styleMap[platform.type] || ['#8e8e8e', '#606060'];
      ctx.fillStyle = sideColor;
      ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
      ctx.fillStyle = topColor;
      ctx.fillRect(platform.x, platform.y, platform.w, Math.max(16, platform.h * 0.18));
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(platform.x + 8, platform.y + 4, platform.w - 16, 4);
      if (platform.type === 'falling') {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;
        ctx.strokeRect(platform.x + 5, platform.y + 3, platform.w - 10, platform.h - 6);
      }
    },
    drawDoor(door) {
      ctx.save();
      ctx.globalAlpha = door.open ? 0.22 : 1;
      ctx.fillStyle = door.open ? '#76b787' : '#4f385e';
      ctx.fillRect(door.x, door.y, door.w, door.h);
      ctx.fillStyle = door.open ? '#a6f2c7' : '#9d8fb0';
      ctx.fillRect(door.x + 4, door.y + 6, door.w - 8, 14);
      ctx.restore();
    },
    drawSwitch(switchObj) {
      ctx.fillStyle = switchObj.active ? '#97f5c5' : '#8de5ff';
      ctx.fillRect(switchObj.x, switchObj.y, switchObj.w, switchObj.h);
      ctx.fillStyle = switchObj.active ? '#5aba7e' : '#4b90ad';
      ctx.fillRect(switchObj.x + 8, switchObj.y - 8, switchObj.w - 16, 10);
    },
    drawSpikes(spike) {
      ctx.fillStyle = '#d7d2dd';
      const teeth = Math.max(2, Math.floor(spike.w / 18));
      for (let i = 0; i < teeth; i += 1) {
        const x = spike.x + (spike.w / teeth) * i;
        ctx.beginPath();
        ctx.moveTo(x, spike.y + spike.h);
        ctx.lineTo(x + spike.w / teeth / 2, spike.y);
        ctx.lineTo(x + spike.w / teeth, spike.y + spike.h);
        ctx.closePath();
        ctx.fill();
      }
    },
    drawSeed(seed, index) {
      if (seed.collected) return;
      const bob = Math.sin(performance.now() * 0.004 + index) * 4;
      ctx.save();
      ctx.translate(seed.x, seed.y + bob);
      ctx.rotate(Math.sin(performance.now() * 0.003 + index) * 0.25);
      ctx.fillStyle = seed.hidden ? '#c6e68a' : '#f0db75';
      ctx.beginPath();
      ctx.ellipse(0, 0, 7, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#9d7b33';
      ctx.fillRect(-1, -8, 2, 16);
      ctx.restore();
    },
    drawPowerup(item) {
      if (item.collected) return;
      const colors = {
        bounce: '#8de5ff',
        speed: '#f2c26a',
        shield: '#b9a0ff',
        magnet: '#ff8d8d',
      };
      ctx.save();
      ctx.translate(item.x, item.y + Math.sin(performance.now() * 0.004 + item.x) * 5);
      ctx.fillStyle = colors[item.type] || '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, item.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(20,20,20,0.22)';
      ctx.beginPath();
      ctx.arc(0, 0, item.r - 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px Trebuchet MS';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const glyph = { bounce: 'B', speed: 'S', shield: '⛨', magnet: 'M' }[item.type] || '?';
      ctx.fillText(glyph, 0, 1);
      ctx.restore();
    },
    drawEnemy(enemy) {
      if (!enemy.alive) return;
      ctx.save();
      ctx.translate(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2);
      ctx.fillStyle = '#c55d54';
      ctx.fillRect(-enemy.w / 2, -enemy.h / 2, enemy.w, enemy.h);
      ctx.fillStyle = '#f6d6c0';
      ctx.fillRect(-enemy.w / 2 + 6, -enemy.h / 2 + 7, enemy.w - 12, 10);
      ctx.fillStyle = '#1e1a24';
      ctx.beginPath();
      ctx.arc(-6, -2, 3, 0, Math.PI * 2);
      ctx.arc(6, -2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-8, 7, 16, 4);
      ctx.restore();
    },
    drawGoal(goal) {
      if (goal.type === 'tree') {
        const sway = Math.sin(performance.now() * 0.0015) * 5;
        ctx.save();
        ctx.translate(goal.x + goal.w / 2, goal.y + goal.h);
        ctx.fillStyle = '#50361f';
        ctx.fillRect(-14, -110, 28, 110);
        ctx.fillStyle = lerpColor('#6e8f47', '#83db60', this.worldBloom);
        for (let i = 0; i < 4; i += 1) {
          ctx.beginPath();
          ctx.arc(-42 + i * 28 + sway * 0.3, -115 - (i % 2) * 20, 42, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(0, -150, 62, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f1df78';
        ctx.beginPath();
        ctx.arc(0, -80, 18 + this.worldBloom * 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.save();
        ctx.fillStyle = '#f0dfa1';
        ctx.fillRect(goal.x, goal.y, goal.w, goal.h);
        ctx.fillStyle = '#6a8c41';
        ctx.fillRect(goal.x + 6, goal.y + 6, goal.w - 12, goal.h - 12);
        ctx.fillStyle = '#f0dfa1';
        ctx.fillRect(goal.x + goal.w * 0.33, goal.y + 18, 8, goal.h - 28);
        ctx.beginPath();
        ctx.arc(goal.x + goal.w * 0.62, goal.y + goal.h * 0.5, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    },
    drawPlayer(player) {
      ctx.save();
      ctx.translate(player.x, player.y);
      const squash = player.grounded ? 1.06 : 0.96;
      const stretch = player.grounded ? 0.94 : 1.04;
      if (player.shieldTimer > 0) {
        ctx.globalAlpha = 0.22 + Math.sin(performance.now() * 0.01) * 0.04;
        ctx.fillStyle = '#9fe7ff';
        ctx.beginPath();
        ctx.arc(0, 0, player.radius + 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (player.speedTimer > 0) {
        ctx.strokeStyle = 'rgba(248,215,123,0.4)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-player.vx * 0.05, 0);
        ctx.lineTo(-player.vx * 0.14, 0);
        ctx.stroke();
      }
      ctx.scale(squash, stretch);
      const gradient = ctx.createRadialGradient(-6, -8, 2, 0, 0, player.radius + 8);
      gradient.addColorStop(0, '#d9e7a2');
      gradient.addColorStop(0.45, '#7ca24c');
      gradient.addColorStop(1, '#38522f');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f6f2cf';
      ctx.beginPath();
      ctx.arc(-5, -6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e271b';
      ctx.beginPath();
      ctx.arc(4, -2, 2.8, 0, Math.PI * 2);
      ctx.arc(10, -2, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
    drawParticles() {
      this.particles.forEach((particle) => {
        ctx.save();
        ctx.globalAlpha = particle.life / particle.maxLife;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    },
    renderUiText() {
      if (!this.level) return;
      if (this.messageTimer > 0 && this.currentMessage) {
        ctx.save();
        ctx.fillStyle = 'rgba(17,13,19,0.7)';
        const width = Math.min(this.width - 40, 460);
        const x = 20;
        const y = this.height - 120;
        roundRect(ctx, x, y, width, 64, 18, true, false);
        ctx.fillStyle = '#f6f1dd';
        ctx.font = 'bold 18px Trebuchet MS';
        ctx.fillText(this.currentMessage, x + 18, y + 38);
        ctx.restore();
      }
      if (this.state === 'finale') {
        ctx.save();
        ctx.fillStyle = `rgba(149, 227, 120, ${this.worldBloom * 0.18})`;
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.fillStyle = '#f5f0d6';
        ctx.font = 'bold 32px Trebuchet MS';
        ctx.textAlign = 'center';
        ctx.fillText('🌳 The Original Olive Tree', this.width / 2, 90);
        ctx.font = '18px Trebuchet MS';
        ctx.fillText('Kora بيعيد الحياة للعالم...', this.width / 2, 120);
        ctx.restore();
      }
    },
    render() {
      ctx.clearRect(0, 0, this.width, this.height);
      this.renderBackground();
      if (this.level) {
        this.renderWorld();
        this.renderUiText();
      } else {
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        for (let i = 0; i < 10; i += 1) {
          const x = 80 + i * 160;
          ctx.beginPath();
          ctx.arc((x + performance.now() * 0.02) % (this.width + 120), 140 + (i % 3) * 70, 10 + (i % 2) * 6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    },
  };

  function roundRect(context, x, y, w, h, r, fill, stroke) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + w - r, y);
    context.quadraticCurveTo(x + w, y, x + w, y + r);
    context.lineTo(x + w, y + h - r);
    context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    context.lineTo(x + r, y + h);
    context.quadraticCurveTo(x, y + h, x, y + h - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
    if (fill) context.fill();
    if (stroke) context.stroke();
  }

  function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    const value = clean.length === 3
      ? clean.split('').map((char) => char + char).join('')
      : clean;
    const number = parseInt(value, 16);
    return {
      r: (number >> 16) & 255,
      g: (number >> 8) & 255,
      b: number & 255,
    };
  }

  function lerpColor(hexA, hexB, amount) {
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    const r = Math.round(lerp(a.r, b.r, amount));
    const g = Math.round(lerp(a.g, b.g, amount));
    const bChannel = Math.round(lerp(a.b, b.b, amount));
    return `rgb(${r}, ${g}, ${bChannel})`;
  }

  Game.init();
})();

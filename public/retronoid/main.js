(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const elScore = document.getElementById("score");
  const elLives = document.getElementById("lives");
  const elLevel = document.getElementById("level");
  const elStatus = document.getElementById("status");

  const btnStart = document.getElementById("btnStart");
  const btnPause = document.getElementById("btnPause");
  const btnReset = document.getElementById("btnReset");

  const btnConnect = document.getElementById("btnConnect");
  const btnInsert = document.getElementById("btnInsert");
  const btnRegister = document.getElementById("btnRegister");
  const creditsPill = document.getElementById("creditsPill");
  const btnHome = document.getElementById("btnHome");

  const soundToggleEl = document.getElementById("soundToggle");
  const soundVolEl = document.getElementById("soundVol");
  const musicToggleEl = document.getElementById("musicToggle");

  const touchPowerupsEl = document.getElementById("touchPowerups");
  const btnPWide = document.getElementById("btnPWide");
  const btnPSlow = document.getElementById("btnPSlow");
  const btnPMult = document.getElementById("btnPMult");

  const bloomToggleEl = document.getElementById("bloomToggle");

  const GAME_ID = "retronoid";
  const DEV_PROFIT_ADDR = "cosmos1us0jjdd5dj0v499g959jatpnh6xuamwhwdrrgq";
  const API_BASE = (window.__RETROCHAIN_REST_BASE__ || "/api").replace(/\/$/, "");

  const IS_TOUCH_DEVICE = (() => {
    try {
      return (
        (typeof navigator !== "undefined" && Number(navigator.maxTouchPoints || 0) > 0) ||
        (typeof window !== "undefined" && "ontouchstart" in window)
      );
    } catch {
      return false;
    }
  })();

  let touchControlsHintDismissed = false;

  const ONCHAIN_ACHIEVEMENT_IDS = [
    "first-game",
    "first-win",
    "coin-collector",
    "quick-start",
    "multi-genre-master",
    "high-scorer",
    "tournament-player",
    "power-user",
    "comeback-kid",
    "high-roller",
    "arcade-legend",
    "top-of-the-world",
    "tournament-champion",
    "ultimate-champion",
    "arcade-mogul",
    "legendary-player",
  ];

  const ONCHAIN_ACHIEVEMENTS_META = {
    "first-game": { title: "First Game", rewardTokens: 10, detail: "Play any arcade game at least once." },
    "first-win": { title: "First Win", rewardTokens: 25, detail: "Complete a session (finish a game run) at least once." },
    "coin-collector": { title: "Coin Collector", rewardTokens: 25, detail: "Insert 10 credits across the arcade." },
    "quick-start": { title: "Quick Start", rewardTokens: 25, detail: "Trigger the arcade quick-start milestone." },
    "multi-genre-master": { title: "Multi-Genre Master", rewardTokens: 75, detail: "Play games spanning 5 different genres." },
    "high-scorer": { title: "High Scorer", rewardTokens: 50, detail: "Get onto any high-score table." },
    "tournament-player": { title: "Tournament Player", rewardTokens: 50, detail: "Participate in a tournament." },
    "power-user": { title: "Power User", rewardTokens: 150, detail: "Collect 50 powerups across your sessions." },
    "comeback-kid": { title: "Comeback Kid", rewardTokens: 150, detail: "Use 10 continues across your sessions." },
    "high-roller": { title: "High Roller", rewardTokens: 150, detail: "Spend 100 credits across your sessions." },
    "arcade-legend": { title: "Arcade Legend", rewardTokens: 250, detail: "Reach top 10 on the global leaderboard." },
    "top-of-the-world": { title: "Top of the World", rewardTokens: 500, detail: "Reach #1 on the global leaderboard." },
    "tournament-champion": { title: "Tournament Champion", rewardTokens: 300, detail: "Win at least 1 tournament." },
    "ultimate-champion": { title: "Ultimate Champion", rewardTokens: 500, detail: "Win 10 tournaments." },
    "arcade-mogul": { title: "Arcade Mogul", rewardTokens: 500, detail: "Accumulate 1,000,000 arcade tokens." },
    "legendary-player": { title: "Legendary Player", rewardTokens: 500, detail: "Play 1,000 sessions." },
  };

  // --- Game constants (simple, deterministic) ---
  // Logical world size (stable gameplay). Canvas pixels may change for HiDPI/fullscreen.
  const WORLD_W = 1100;
  const WORLD_H = 680;

  // Back-compat aliases: older code paths and cached clients may still reference W/H.
  // Keep them defined so the game never hard-crashes.
  const W = WORLD_W;
  const H = WORLD_H;

  let scaleX = 1;
  let scaleY = 1;
  let viewScale = 1;
  let viewOffX = 0;
  let viewOffY = 0;

  function syncCanvasScale() {
    const cw = Number(canvas.width) || WORLD_W;
    const ch = Number(canvas.height) || WORLD_H;

    // Use uniform scale to preserve aspect ratio and center (letterbox). This avoids
    // cropping/zooming surprises when switching between fullscreen and windowed.
    viewScale = Math.min(cw / WORLD_W, ch / WORLD_H);
    viewOffX = Math.floor((cw - WORLD_W * viewScale) * 0.5);
    viewOffY = Math.floor((ch - WORLD_H * viewScale) * 0.5);

    scaleX = viewScale;
    scaleY = viewScale;

    // Center the logical world in the available pixel buffer.
    ctx.setTransform(viewScale, 0, 0, viewScale, viewOffX, viewOffY);
  }

  // Keep scale in sync if canvas internal size is changed by the page (fullscreen/HiDPI).
  syncCanvasScale();

  const paddle = {
    w: 140,
    h: 14,
    x: (WORLD_W - 140) / 2,
    y: WORLD_H - 40,
    speed: 880,
  };

  const ball = {
    r: 8,
    x: WORLD_W / 2,
    y: paddle.y - 8 - 1,
    vx: 0,
    vy: 0,
    speed: 520,
    stuck: true,
  };

  // Multi-ball support: the original `ball` is always balls[0].
  const balls = [ball];

  const levelSpec = {
    rows: 6,
    cols: 12,
    pad: 10,
    top: 70,
    left: 50,
    brickH: 22,
  };

  const state = {
    running: false,
    paused: false,
    score: 0,
    lives: 3,
    level: 1,
    bricks: [],
    keys: {
      left: false,
      right: false,
    },
    pointerActive: false,
    pointerX: 0,
    lastTs: 0,
  };

  // --- On-chain arcade state ---
  let chainId = null;
  let walletAddr = null;
  let walletPubKeyBytes = null;
  let cachedCredits = 0n;
  let cachedArcadeTokens = 0n;
  let currentSessionId = null;
  let onchainBusy = false;
  let protoRootPromise = null;
  let loadingProtobufPromise = null;
  let submittedThisRun = false;

  // Powerups (paid with arcade tokens)
  let cachedPowerUpCost = null; // BigInt or null
  const powerupInventory = { wide: 0, slowball: 0, mult: 0 };
  let powerupBusy = false;

  let wideUntilMs = 0;
  let slowBallUntilMs = 0;
  let scoreMultUntilMs = 0;

  // Menu/store overlay
  let menuOpen = false;
  let menuTab = "leaderboards"; // leaderboards | trophies | stats | details | help
  let storeOpen = false;
  let storePendingNextLevel = false;
  let storePendingStart = false;
  // Falling powerup drops (free pickups)
  const drops = [];
  let stickyUntilMs = 0;
  let shieldCharges = 0;
  let laserUntilMs = 0;
  const laserShots = [];

  // Combo streak (brick-break pacing reward)
  let comboCount = 0;
  let comboUntilMs = 0;

  const BASE_PADDLE_W = paddle.w;
  const UI_FONT_FAMILY = (typeof getComputedStyle === "function" ? getComputedStyle(document.body).fontFamily : "") || "system-ui";

  // --- Bloom / glow post-processing (no libs) ---
  const BLOOM_KEY = `rc1_retronoid_bloom_${GAME_ID}`;
  let bloomEnabled = true;
  const bloomCanvas = document.createElement("canvas");
  const bloomCtx = bloomCanvas.getContext("2d", { alpha: true });

  function loadBloomPref() {
    try {
      const v = localStorage.getItem(BLOOM_KEY);
      if (v != null) bloomEnabled = v !== "0";
    } catch {
      // ignore
    }
  }

  function saveBloomPref() {
    try {
      localStorage.setItem(BLOOM_KEY, bloomEnabled ? "1" : "0");
    } catch {
      // ignore
    }
  }

  function ensureBloomBuffer() {
    if (!bloomCtx) return;
    // Match main canvas pixel resolution.
    if (bloomCanvas.width !== canvas.width) bloomCanvas.width = canvas.width;
    if (bloomCanvas.height !== canvas.height) bloomCanvas.height = canvas.height;
    bloomCtx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function applyBloomPass() {
    if (!bloomEnabled || !bloomCtx) return;
    ensureBloomBuffer();

    try {
      // Copy current framebuffer.
      bloomCtx.clearRect(0, 0, bloomCanvas.width, bloomCanvas.height);
      bloomCtx.globalCompositeOperation = "source-over";
      bloomCtx.filter = "none";
      bloomCtx.drawImage(canvas, 0, 0);
    } catch {
      return;
    }

    // Blur the copied image, then add it back with lighter blending.
    const blurPx = Math.max(6, Math.min(18, Math.round(Math.max(canvas.width, canvas.height) * 0.008)));
    try {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.22;
      ctx.filter = `blur(${blurPx}px) saturate(1.25)`;
      ctx.drawImage(bloomCanvas, 0, 0);
      ctx.filter = "none";
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.restore();
    } catch {
      // ignore
    }
  }

  // --- Sound (no assets): lightweight WebAudio synth ---
  const SOUND_KEY = `rc1_retronoid_sound_${GAME_ID}`;
  const SOUND_VOL_KEY = `rc1_retronoid_sound_vol_${GAME_ID}`;

  let soundEnabled = true;
  let soundVol = 0.45;
  let audioCtx = null;
  let masterGain = null;
  let musicEnabled = true;
  let musicGain = null;
  let musicTimer = null;
  let musicStep = 0;

  const MUSIC_KEY = `rc1_retronoid_music_${GAME_ID}`;

  function readSoundPrefs() {
    try {
      const raw = localStorage.getItem(SOUND_KEY);
      if (raw != null) soundEnabled = raw !== "0";
      const m = localStorage.getItem(MUSIC_KEY);
      if (m != null) musicEnabled = m !== "0";
      const v = Number(localStorage.getItem(SOUND_VOL_KEY));
      if (Number.isFinite(v)) soundVol = Math.max(0, Math.min(1, v));
    } catch {
      // ignore
    }

    // Post: bloom/glow overlay
    applyBloomPass();
  }

  function writeSoundPrefs() {
    try {
      localStorage.setItem(SOUND_KEY, soundEnabled ? "1" : "0");
      localStorage.setItem(SOUND_VOL_KEY, String(soundVol));
      localStorage.setItem(MUSIC_KEY, musicEnabled ? "1" : "0");
    } catch {
      // ignore
    }
  }

  function ensureAudio() {
    if (!soundEnabled) return null;
    if (audioCtx) return audioCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = Math.max(0, Math.min(1, soundVol));
    masterGain.connect(audioCtx.destination);

    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0.18;
    musicGain.connect(masterGain);
    return audioCtx;
  }

  function stopMusic() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  function musicNote(freq, dur, type, gainVal) {
    if (!musicEnabled || !soundEnabled) return;
    const ctx = ensureAudio();
    if (!ctx || !musicGain || ctx.state === "suspended") return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || "triangle";
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainVal || 0.06), now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.03, dur || 0.12));
    osc.connect(g);
    g.connect(musicGain);
    osc.start(now);
    osc.stop(now + Math.max(0.05, dur || 0.12) + 0.02);
  }

  function startMusic() {
    stopMusic();
    if (!musicEnabled || !soundEnabled) return;
    const ctx = ensureAudio();
    if (!ctx) return;

    // Simple 16-step loop. Tempo bumps slightly with level.
    musicStep = 0;
    const baseBpm = 120;
    const bpm = Math.min(155, baseBpm + Math.max(0, (state.level | 0) - 1) * 3);
    const stepMs = Math.round((60_000 / bpm) / 4); // 16th notes

    // Scales in Hz
    const C2 = 65.41;
    const C3 = 130.81;

    // Pattern (minor-ish): degrees multiplied by semitone ratio.
    const semitone = (n) => Math.pow(2, n / 12);
    const bass = [0, 0, 3, 0, 5, 5, 3, 0, 0, 0, 7, 0, 5, 5, 3, 0];
    const lead = [12, 15, 12, 19, 12, 15, 22, 19, 12, 15, 12, 24, 19, 17, 15, 12];

    musicTimer = setInterval(() => {
      // Only play while actually running and not paused/menu/store.
      if (!state.running || state.paused || storeOpen || menuOpen) {
        musicStep = (musicStep + 1) % 16;
        return;
      }

      const i = musicStep % 16;
      const bSemi = bass[i];
      const lSemi = lead[i];

      // Bass on 8th-ish
      if (i % 2 === 0) {
        musicNote(C2 * semitone(bSemi), 0.10, "square", 0.05);
      }

      // Lead on 16th with rests when repeating
      if (i % 4 !== 3) {
        musicNote(C3 * semitone(lSemi), 0.08, "triangle", 0.028);
      }

      musicStep = (musicStep + 1) % 16;
    }, stepMs);
  }

  async function unlockAudio() {
    const ctx = ensureAudio();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        // ignore
      }
    }
  }

  function sfx(type) {
    if (!soundEnabled) return;
    const ctx = ensureAudio();
    if (!ctx || !masterGain) return;
    if (ctx.state === "suspended") return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.connect(masterGain);
    osc.connect(gain);

    const env = (a, d, peak) => {
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), now + a);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + a + d);
    };

    switch (type) {
      case "paddle":
        osc.type = "triangle";
        osc.frequency.setValueAtTime(290, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.06);
        env(0.002, 0.08, 0.14);
        break;
      case "brick":
        osc.type = "square";
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(620, now + 0.04);
        env(0.001, 0.06, 0.11);
        break;
      case "powerup":
        osc.type = "sine";
        osc.frequency.setValueAtTime(740, now);
        osc.frequency.exponentialRampToValueAtTime(1110, now + 0.10);
        env(0.002, 0.14, 0.10);
        break;
      case "laser":
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(980, now);
        osc.frequency.exponentialRampToValueAtTime(720, now + 0.05);
        env(0.001, 0.06, 0.06);
        break;
      case "life":
        osc.type = "sine";
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.12);
        env(0.004, 0.22, 0.18);
        break;
      case "level":
        osc.type = "triangle";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(660, now + 0.06);
        osc.frequency.setValueAtTime(880, now + 0.12);
        env(0.003, 0.18, 0.12);
        break;
      case "gameover":
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.35);
        env(0.004, 0.45, 0.14);
        break;
      default:
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, now);
        env(0.001, 0.05, 0.08);
    }

    osc.start(now);
    osc.stop(now + 0.6);
  }

  function setSoundEnabled(v) {
    soundEnabled = !!v;
    if (!soundEnabled && audioCtx) {
      stopMusic();
      try { audioCtx.close(); } catch {}
      audioCtx = null;
      masterGain = null;
      musicGain = null;
    }
    writeSoundPrefs();
    if (soundToggleEl) soundToggleEl.checked = soundEnabled;
  }

  function setMusicEnabled(v) {
    musicEnabled = !!v;
    writeSoundPrefs();
    if (musicToggleEl) musicToggleEl.checked = musicEnabled;
    if (!musicEnabled) {
      stopMusic();
      return;
    }
    void unlockAudio().then(() => startMusic());
  }

  function setSoundVolume01(v) {
    soundVol = Math.max(0, Math.min(1, Number(v)));
    if (masterGain) masterGain.gain.value = soundVol;
    writeSoundPrefs();
    if (soundVolEl) soundVolEl.value = String(Math.round(soundVol * 100));
  }

  // --- Local stats (RetroNoid-only, stored in localStorage) ---
  function localStatsStorageKey() {
    return `rc1_retronoid_localstats_${GAME_ID}_${walletAddr || "anon"}`;
  }

  let localStats = { runs: 0, bestScore: 0, bestLevel: 0, totalBricks: 0, totalDrops: 0 };
  let runBricksBroken = 0;
  let runDropsCollected = 0;

  function loadLocalStats() {
    try {
      const raw = localStorage.getItem(localStatsStorageKey());
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== "object") return;
      localStats = {
        runs: Math.max(0, Math.floor(Number(parsed.runs || 0))),
        bestScore: Math.max(0, Math.floor(Number(parsed.bestScore || 0))),
        bestLevel: Math.max(0, Math.floor(Number(parsed.bestLevel || 0))),
        totalBricks: Math.max(0, Math.floor(Number(parsed.totalBricks || 0))),
        totalDrops: Math.max(0, Math.floor(Number(parsed.totalDrops || 0))),
      };
    } catch {
      // ignore
    }
  }

  function saveLocalStats() {
    try {
      localStorage.setItem(localStatsStorageKey(), JSON.stringify(localStats));
    } catch {
      // ignore
    }
  }

  // Load anon stats by default; load wallet stats after connect.
  loadLocalStats();

  function recordRunStart() {
    localStats.runs = Math.max(0, (localStats.runs || 0) + 1);
    runBricksBroken = 0;
    runDropsCollected = 0;
    saveLocalStats();
  }

  function recordRunEnd() {
    localStats.bestScore = Math.max(localStats.bestScore || 0, Math.max(0, state.score | 0));
    localStats.bestLevel = Math.max(localStats.bestLevel || 0, Math.max(0, state.level | 0));
    localStats.totalBricks = Math.max(0, (localStats.totalBricks || 0) + Math.max(0, runBricksBroken | 0));
    localStats.totalDrops = Math.max(0, (localStats.totalDrops || 0) + Math.max(0, runDropsCollected | 0));
    saveLocalStats();
  }

  // --- Visual FX (minimal, deterministic-ish) ---
  const fx = {
    particles: [],
    trail: [],
    shakeMs: 0,
    shakeAmp: 0,
    flashMs: 0,
  };

  function fxNow() {
    return performance.now();
  }

  function fxKickShake(ms, amp) {
    fx.shakeMs = Math.max(fx.shakeMs, ms);
    fx.shakeAmp = Math.max(fx.shakeAmp, amp);
  }

  function fxFlash(ms) {
    fx.flashMs = Math.max(fx.flashMs, ms);
  }

  function fxEmitParticles(x, y, color, count, baseSpeed) {
    const n = Math.max(0, Math.min(40, count | 0));
    const sp = Math.max(40, Math.min(520, baseSpeed || 220));
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + randSeeded((state.level * 100000 + state.score + i) | 0) * 0.35;
      const v = sp * (0.45 + 0.55 * randSeeded((state.level * 999 + i * 17) | 0));
      fx.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.55,
        age: 0,
        r: 1.6 + 1.8 * randSeeded((state.level * 777 + i * 23) | 0),
        c: color,
      });
    }
    if (fx.particles.length > 220) fx.particles.splice(0, fx.particles.length - 220);
  }

  function fxStep(dt) {
    // particles
    for (let i = fx.particles.length - 1; i >= 0; i--) {
      const p = fx.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        fx.particles.splice(i, 1);
        continue;
      }
      p.vy += 520 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.985;
      p.vy *= 0.985;
    }

    // trail
    if (state.running) {
      for (const b of balls) {
        if (b.stuck) continue;
        fx.trail.push({ x: b.x, y: b.y, t: 0 });
      }
      if (fx.trail.length > 18) fx.trail.shift();
    } else {
      fx.trail.length = 0;
    }
    for (const t of fx.trail) t.t += dt;

    // shake + flash timers
    fx.shakeMs = Math.max(0, fx.shakeMs - dt * 1000);
    if (fx.shakeMs === 0) fx.shakeAmp = 0;
    fx.flashMs = Math.max(0, fx.flashMs - dt * 1000);
  }

  function stepDrops(dt) {
    if (!drops.length) return;
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      if (!d.alive) {
        drops.splice(i, 1);
        continue;
      }
      d.y += d.vy * dt;
      if (d.y - d.h > WORLD_H + 30) {
        drops.splice(i, 1);
        continue;
      }

      // Paddle catch
      const withinX = d.x + d.w >= paddle.x && d.x <= paddle.x + paddle.w;
      const withinY = d.y + d.h >= paddle.y && d.y <= paddle.y + paddle.h;
      if (withinX && withinY) {
        applyLocalPowerUp(d.id);
        runDropsCollected += 1;
        sfx("powerup");
        fxEmitParticles(d.x + d.w / 2, d.y + d.h / 2, dropColor(d.id), 16, 240);
        fxKickShake(90, 4);
        setStatus(`${String(d.id).toUpperCase()} collected`);
        drops.splice(i, 1);
      }
    }
  }

  function fireLaser() {
    const now = performance.now();
    if (!state.running || state.paused) return;
    if (laserUntilMs <= now) return;
    if (ball.stuck && !balls.some((b) => !b.stuck)) {
      // allow firing while balls are stuck
    }

    const y = paddle.y - 6;
    laserShots.push({ x: paddle.x + 10, y, vy: -720, alive: true });
    laserShots.push({ x: paddle.x + paddle.w - 10, y, vy: -720, alive: true });
    if (laserShots.length > 12) laserShots.splice(0, laserShots.length - 12);
    sfx("laser");
    fxKickShake(60, 2);
  }

  function stepLasers(dt) {
    if (!laserShots.length) return;
    for (let i = laserShots.length - 1; i >= 0; i--) {
      const s = laserShots[i];
      if (!s.alive) {
        laserShots.splice(i, 1);
        continue;
      }
      s.y += s.vy * dt;
      if (s.y < -20) {
        laserShots.splice(i, 1);
        continue;
      }

      // Hit first alive brick
      let hit = null;
      let hitIdx = -1;
      for (let bi = 0; bi < state.bricks.length; bi++) {
        const b = state.bricks[bi];
        if (!b.alive) continue;
        if (s.x >= b.x && s.x <= b.x + b.w && s.y >= b.y && s.y <= b.y + b.h) {
          hit = b;
          hitIdx = bi;
          break;
        }
      }

      if (hit) {
        applyBrickDamage(hitIdx, 1, { source: "laser" });
        updateHud();
        laserShots.splice(i, 1);

        const remaining = state.bricks.reduce((n, br) => n + (br.alive ? 1 : 0), 0);
        if (remaining === 0) {
          state.level += 1;
          updateBestLevelLive();
          updateHud();
          balls.length = 0;
          balls.push(ball);
          resetBallToPaddle();
          sfx("level");
          fxFlash(180);
          fxKickShake(220, 6);
          setStatus("Level cleared — store open");
          openStore({ pendingNextLevel: true });
        }
      }
    }
  }

  function powerupStorageKey() {
    return `rc1_retronoid_powerups_${GAME_ID}_${walletAddr || "anon"}`;
  }

  function loadPowerupInventory() {
    try {
      const raw = localStorage.getItem(powerupStorageKey());
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== "object") return;
      for (const k of Object.keys(powerupInventory)) {
        const v = Number(parsed[k]);
        powerupInventory[k] = Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
      }
    } catch {
      // ignore
    }
  }

  function savePowerupInventory() {
    try {
      localStorage.setItem(
        powerupStorageKey(),
        JSON.stringify({
          wide: Math.max(0, Number(powerupInventory.wide || 0)),
          slowball: Math.max(0, Number(powerupInventory.slowball || 0)),
          mult: Math.max(0, Number(powerupInventory.mult || 0)),
        })
      );
    } catch {
      // ignore
    }
  }

  function applyLocalPowerUp(powerUpId) {
    const now = performance.now();
    if (powerUpId === "wide") {
      wideUntilMs = Math.max(wideUntilMs, now + 15000);
      paddle.w = Math.min(WORLD_W - 20, Math.max(paddle.w, BASE_PADDLE_W * 1.35));
    } else if (powerUpId === "slowball") {
      slowBallUntilMs = Math.max(slowBallUntilMs, now + 12000);
    } else if (powerUpId === "mult") {
      scoreMultUntilMs = Math.max(scoreMultUntilMs, now + 12000);
    } else if (powerUpId === "sticky") {
      stickyUntilMs = Math.max(stickyUntilMs, now + 14000);
    } else if (powerUpId === "life") {
      state.lives = Math.min(9, state.lives + 1);
      sfx("powerup");
      updateHud();
    } else if (powerUpId === "shield") {
      shieldCharges = Math.min(3, shieldCharges + 1);
    } else if (powerUpId === "multiball") {
      // Spawn two extra balls off the paddle/closest stuck position.
      const base = balls.find((b) => b.stuck) || balls[0];
      const spawnX = base ? base.x : paddle.x + paddle.w / 2;
      const spawnY = base ? base.y : paddle.y - ball.r - 1;
      if (balls.length < 3) {
        for (let i = balls.length; i < 3; i++) {
          balls.push({ r: ball.r, x: spawnX, y: spawnY, vx: 0, vy: 0, speed: ball.speed, stuck: true });
        }
      }
      setStatus("MULTIBALL — press Space");
    } else if (powerUpId === "laser") {
      laserUntilMs = Math.max(laserUntilMs, now + 16000);
    }
  }

  function updatePowerupExpiry() {
    const now = performance.now();
    if (wideUntilMs <= now) {
      paddle.w = BASE_PADDLE_W;
      wideUntilMs = 0;
    }
    if (slowBallUntilMs <= now) slowBallUntilMs = 0;
    if (scoreMultUntilMs <= now) scoreMultUntilMs = 0;
    if (stickyUntilMs <= now) stickyUntilMs = 0;
    if (laserUntilMs <= now) laserUntilMs = 0;
  }

  function dropColor(powerUpId) {
    if (powerUpId === "wide" || powerUpId === "mult" || powerUpId === "shield" || powerUpId === "laser") return "rgba(132,87,255,0.95)";
    if (powerUpId === "slowball" || powerUpId === "life") return "rgba(80,220,140,0.95)";
    if (powerUpId === "sticky") return "rgba(255,255,255,0.95)";
    if (powerUpId === "multiball") return "rgba(255,255,255,0.95)";
    return "rgba(255,255,255,0.95)";
  }

  function dropLabel(powerUpId) {
    if (powerUpId === "wide") return "W";
    if (powerUpId === "slowball") return "S";
    if (powerUpId === "mult") return "2X";
    if (powerUpId === "life") return "+1";
    if (powerUpId === "sticky") return "ST";
    if (powerUpId === "shield") return "SH";
    if (powerUpId === "multiball") return "MB";
    if (powerUpId === "laser") return "L";
    return "?";
  }

  function spawnDropAt(x, y, seed) {
    // 10–14% chance, slightly higher as levels increase
    const chance = Math.min(0.16, 0.10 + 0.01 * Math.min(6, state.level));
    if (randSeeded(seed) > chance) return;

    const r = randSeeded(seed * 31 + 7);
    // Weighted positive powerups
    // life rarer, shield medium, sticky medium, laser + multiball rarer
    let powerUpId = "wide";
    if (r < 0.22) powerUpId = "wide";
    else if (r < 0.44) powerUpId = "slowball";
    else if (r < 0.62) powerUpId = "mult";
    else if (r < 0.74) powerUpId = "sticky";
    else if (r < 0.86) powerUpId = "shield";
    else if (r < 0.92) powerUpId = "multiball";
    else if (r < 0.97) powerUpId = "laser";
    else powerUpId = "life";

    drops.push({
      x,
      y,
      vy: 140 + 18 * Math.min(10, state.level),
      w: 34,
      h: 18,
      id: powerUpId,
      alive: true,
    });
    if (drops.length > 18) drops.shift();
  }

  function scoreAdd(points) {
    const now = performance.now();
    const mult = scoreMultUntilMs > now ? 2 : 1;
    state.score += points * mult;

    // Update best score live so Stats reflects active runs.
    const s = Math.max(0, Math.floor(Number(state.score || 0)));
    if (s > (localStats.bestScore || 0)) {
      localStats.bestScore = s;
      saveLocalStats();
    }
  }

  function setStatus(text) {
    elStatus.textContent = text;
  }

  function shortAddr(addr) {
    if (!addr) return "";
    return addr.length > 14 ? `${addr.slice(0, 10)}…${addr.slice(-4)}` : addr;
  }

  function apiUrl(path) {
    return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  }

  async function apiGetJson(path) {
    const res = await fetch(apiUrl(path), { headers: { accept: "application/json" } });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText}${body ? `: ${body}` : ""}`);
    }
    return res.json();
  }

  async function apiPostJson(path, bodyObj) {
    const res = await fetch(apiUrl(path), {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(bodyObj ?? {}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.message || json?.error || "";
      throw new Error(msg ? `HTTP ${res.status} ${res.statusText}: ${msg}` : `HTTP ${res.status} ${res.statusText}`);
    }
    return json;
  }

  function bytesToBase64(bytes) {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function base64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function ensureProtobufJs() {
    if (window.protobuf) return;
    if (!loadingProtobufPromise) {
      loadingProtobufPromise = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/protobufjs@7.4.0/dist/protobuf.min.js";
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Failed to load protobufjs"));
        document.head.appendChild(s);
      });
    }
    await loadingProtobufPromise;
  }

  async function getProtoRoot() {
    await ensureProtobufJs();
    if (protoRootPromise) return protoRootPromise;
    protoRootPromise = (async () => {
      const protobuf = window.protobuf;
      const root = new protobuf.Root();

      const protoAny = `syntax = "proto3";\npackage google.protobuf;\nmessage Any { string type_url = 1; bytes value = 2; }\n`;
      const protoCoin = `syntax = "proto3";\npackage cosmos.base.v1beta1;\nmessage Coin { string denom = 1; string amount = 2; }\n`;
      const protoSecp = `syntax = "proto3";\npackage cosmos.crypto.secp256k1;\nmessage PubKey { bytes key = 1; }\n`;
      const protoSigning = `syntax = "proto3";\npackage cosmos.tx.signing.v1beta1;\nenum SignMode { SIGN_MODE_UNSPECIFIED = 0; SIGN_MODE_DIRECT = 1; }\n`;
      const protoTx = `syntax = "proto3";\npackage cosmos.tx.v1beta1;\n\nmessage TxBody {\n  repeated google.protobuf.Any messages = 1;\n  string memo = 2;\n  uint64 timeout_height = 3;\n}\n\nmessage TxRaw {\n  bytes body_bytes = 1;\n  bytes auth_info_bytes = 2;\n  repeated bytes signatures = 3;\n}\n\nmessage AuthInfo {\n  repeated SignerInfo signer_infos = 1;\n  Fee fee = 2;\n}\n\nmessage SignerInfo {\n  google.protobuf.Any public_key = 1;\n  ModeInfo mode_info = 2;\n  uint64 sequence = 3;\n}\n\nmessage ModeInfo {\n  message Single { cosmos.tx.signing.v1beta1.SignMode mode = 1; }\n  oneof sum {\n    Single single = 1;\n  }\n}\n\nmessage Fee {\n  repeated cosmos.base.v1beta1.Coin amount = 1;\n  uint64 gas_limit = 2;\n  string payer = 3;\n  string granter = 4;\n}\n\nmessage SignDoc {\n  bytes body_bytes = 1;\n  bytes auth_info_bytes = 2;\n  string chain_id = 3;\n  uint64 account_number = 4;\n}\n`;
      const protoArcade = `syntax = "proto3";
package retrochain.arcade.v1;

message ArcadeGame {
  string game_id = 1;
  string name = 2;
  string description = 3;
  int32 genre = 4;
  uint64 credits_per_play = 5;
  uint64 max_players = 6;
  bool multiplayer_enabled = 7;
  string developer = 8;
  bool active = 10;
  uint64 base_difficulty = 12;
}

message MsgInsertCoin {
  string creator = 1;
  uint64 credits = 2;
  string game_id = 3;
}

message MsgStartSession {
  string creator = 1;
  string game_id = 2;
  uint64 difficulty = 3;
}

message MsgSubmitScore {
  string creator = 1;
  uint64 session_id = 2;
  uint64 score = 3;
  uint64 level = 4;
  bool game_over = 5;
}

message MsgRegisterGame {
  string creator = 1;
  ArcadeGame game = 2;
}

message MsgUsePowerUp {
  string creator = 1;
  uint64 session_id = 2;
  string power_up_id = 3;
}
`;

      protobuf.parse(protoAny, root);
      protobuf.parse(protoCoin, root);
      protobuf.parse(protoSecp, root);
      protobuf.parse(protoSigning, root);
      protobuf.parse(protoTx, root);
      protobuf.parse(protoArcade, root);
      return root;
    })();

    return protoRootPromise;
  }

  async function detectChainId() {
    const override = String(window.__RETROCHAIN_CHAIN_ID__ || "").trim();
    if (override) return override;

    // Allow passing chain id via query string (useful for static hosting).
    try {
      const qs = new URLSearchParams(window.location.search || "");
      const q = String(qs.get("chainId") || "").trim();
      if (q) return q;
    } catch {
      // ignore
    }

    try {
      const data = await apiGetJson("/cosmos/base/tendermint/v1beta1/node_info");
      const id = data?.default_node_info?.network || data?.defaultNodeInfo?.network || data?.node_info?.network || data?.nodeInfo?.network;
      if (id) return id;
    } catch {
      // ignore
    }
    try {
      const data = await apiGetJson("/cosmos/base/tendermint/v1beta1/blocks/latest");
      const id =
        data?.block?.header?.chain_id ||
        data?.block?.header?.chainId ||
        data?.sdk_block?.header?.chain_id ||
        data?.sdkBlock?.header?.chainId;
      if (id) return id;
    } catch {
      // ignore
    }

    // Last resort: ask Keplr for available chains.
    try {
      if (window.keplr?.getChainInfosWithoutEndpoints) {
        const infos = await window.keplr.getChainInfosWithoutEndpoints();
        if (Array.isArray(infos) && infos.length === 1 && infos[0]?.chainId) return String(infos[0].chainId);
      }
    } catch {
      // ignore
    }
    return "";
  }

  function extractBaseAccount(account) {
    if (!account || typeof account !== "object") return null;
    if (account.account_number != null || account.accountNumber != null) return account;
    const baseAccount = account.base_account || account.baseAccount;
    if (baseAccount) return baseAccount;
    const baseVesting = account.base_vesting_account || account.baseVestingAccount;
    if (baseVesting?.base_account || baseVesting?.baseAccount) return baseVesting.base_account || baseVesting.baseAccount;
    const permanentLocked = account.base_permanent_locked_account || account.basePermanentLockedAccount;
    const permanentBaseVesting = permanentLocked?.base_vesting_account || permanentLocked?.baseVestingAccount;
    if (permanentBaseVesting?.base_account || permanentBaseVesting?.baseAccount) {
      return permanentBaseVesting.base_account || permanentBaseVesting.baseAccount;
    }
    const periodic = account.base_periodic_vesting_account || account.basePeriodicVestingAccount;
    const periodicBaseVesting = periodic?.base_vesting_account || periodic?.baseVestingAccount;
    if (periodicBaseVesting?.base_account || periodicBaseVesting?.baseAccount) {
      return periodicBaseVesting.base_account || periodicBaseVesting.baseAccount;
    }
    return null;
  }

  async function getAccountInfo(address) {
    const data = await apiGetJson(`/cosmos/auth/v1beta1/accounts/${address}`);
    const acct = data?.account;
    const base = extractBaseAccount(acct);
    if (!base) {
      const t = acct?.["@type"] || acct?.type || "unknown";
      throw new Error(`Unsupported account type from auth query (${t}).`);
    }
    const accountNumber = String(base.account_number ?? base.accountNumber ?? "0");
    const sequence = String(base.sequence ?? "0");
    return { accountNumber, sequence };
  }

  async function ensureWallet() {
    if (!window.keplr) throw new Error("Keplr not found. Install the Keplr extension.");
    if (!chainId) chainId = await detectChainId();
    if (!chainId) {
      throw new Error(
        "Could not detect chain id from REST. Set window.__RETROCHAIN_CHAIN_ID__, or open /retronoid/?chainId=<your-chain-id>, or ensure /api exposes /cosmos/base/tendermint/v1beta1/node_info."
      );
    }

    await window.keplr.enable(chainId);
    const key = await window.keplr.getKey(chainId);
    walletAddr = key.bech32Address;
    walletPubKeyBytes = key.pubKey;

    loadLocalStats();

    if (btnInsert) btnInsert.disabled = false;
    if (btnRegister) btnRegister.disabled = false;
    setStatus(`Wallet: ${shortAddr(walletAddr)}`);
    loadPowerupInventory();
    updateTouchPowerupsUi();
    await refreshArcadeParams();
    await refreshCredits();

    try {
      const res = await fetch(apiUrl(`/arcade/v1/games/${encodeURIComponent(GAME_ID)}`), { headers: { accept: "application/json" } });
      if (btnRegister) btnRegister.style.display = res.ok ? "none" : "";
    } catch {
      if (btnRegister) btnRegister.style.display = "none";
    }
  }

  async function refreshCredits() {
    if (!creditsPill) return;
    if (!walletAddr) {
      creditsPill.textContent = "Credits: —";
      return;
    }
    try {
      const data = await apiGetJson(`/arcade/v1/credits/${walletAddr}`);
      cachedCredits = BigInt(data?.credits ?? "0");
      cachedArcadeTokens = BigInt(data?.arcade_tokens ?? data?.arcadeTokens ?? "0");
      creditsPill.textContent = `Credits: ${cachedCredits.toString()} • Tokens: ${cachedArcadeTokens.toString()}`;
    } catch {
      creditsPill.textContent = "Credits: ?";
    }
  }

  async function refreshArcadeParams() {
    try {
      const data = await apiGetJson("/arcade/v1/params");
      const cost = data?.params?.power_up_cost ?? data?.params?.powerUpCost ?? data?.power_up_cost ?? data?.powerUpCost;
      if (cost != null) cachedPowerUpCost = BigInt(cost);
    } catch {
      if (cachedPowerUpCost == null) cachedPowerUpCost = 5n;
    }
  }

  const GAS_PRICE_NUM = 1n; // 0.01 uretro/gas
  const GAS_PRICE_DEN = 100n;
  function feeAmountForGas(gasLimit) {
    const gl = BigInt(gasLimit || 0);
    if (gl <= 0n) return "0";
    return ((gl * GAS_PRICE_NUM + (GAS_PRICE_DEN - 1n)) / GAS_PRICE_DEN).toString();
  }

  async function simulateGasUsed({ root, messages, memo, sequence }) {
    const TxBody = root.lookupType("cosmos.tx.v1beta1.TxBody");
    const AuthInfo = root.lookupType("cosmos.tx.v1beta1.AuthInfo");
    const TxRaw = root.lookupType("cosmos.tx.v1beta1.TxRaw");
    const PubKey = root.lookupType("cosmos.crypto.secp256k1.PubKey");
    const SignMode = root.lookupEnum("cosmos.tx.signing.v1beta1.SignMode");
    const SIM_GAS_LIMIT = 2000000;

    const bodyBytes = TxBody.encode({ messages, memo: memo || "" }).finish();
    const pubKeyAny = {
      typeUrl: "/cosmos.crypto.secp256k1.PubKey",
      value: PubKey.encode({ key: walletPubKeyBytes }).finish(),
    };
    const authInfoBytes = AuthInfo.encode({
      signerInfos: [
        {
          publicKey: pubKeyAny,
          modeInfo: { single: { mode: SignMode.values.SIGN_MODE_DIRECT } },
          sequence: sequence,
        },
      ],
      fee: {
        amount: [{ denom: "uretro", amount: feeAmountForGas(SIM_GAS_LIMIT) }],
        gasLimit: SIM_GAS_LIMIT,
      },
    }).finish();

    const dummySig = new Uint8Array(64);
    const txRawBytes = TxRaw.encode({ bodyBytes, authInfoBytes, signatures: [dummySig] }).finish();
    const sim = await apiPostJson("/cosmos/tx/v1beta1/simulate", { tx_bytes: bytesToBase64(txRawBytes) });
    const used = Number(sim?.gas_info?.gas_used ?? sim?.gasInfo?.gasUsed ?? 0);
    if (!Number.isFinite(used) || used <= 0) throw new Error("simulate returned invalid gas_used");
    return used;
  }

  async function estimateGasLimitFor(messages, memo, root, sequence) {
    const FALLBACK_BASE = 550000;
    const FALLBACK_PER_MSG = 120000;
    try {
      const used = await simulateGasUsed({ root, messages, memo, sequence });
      const buffered = Math.ceil(used * 1.25 + 5000);
      return Math.max(buffered, FALLBACK_BASE);
    } catch {
      return FALLBACK_BASE + Math.max(0, (messages?.length || 1) - 1) * FALLBACK_PER_MSG;
    }
  }

  // Cosmos account sequence caching: prevents "account sequence mismatch" when submitting txs quickly.
  // Keyed by wallet address; only valid within a single page load.
  const accountSeqCache = new Map(); // addr -> { accountNumber: string, sequence: bigint }

  function parseSequenceMismatch(errMsg) {
    const s = String(errMsg || "");
    const m = s.match(/account sequence mismatch[^\d]*expected\s+(\d+)[^\d]*got\s+(\d+)/i);
    if (!m) return null;
    const expected = BigInt(m[1]);
    const got = BigInt(m[2]);
    return { expected, got };
  }

  async function signAndBroadcastMulti(messages, memo) {
    if (onchainBusy) throw new Error("On-chain action in progress.");
    if (!Array.isArray(messages) || messages.length === 0) throw new Error("No messages to broadcast.");
    onchainBusy = true;
    try {
      await ensureWallet();
      const root = await getProtoRoot();
      const TxBody = root.lookupType("cosmos.tx.v1beta1.TxBody");
      const AuthInfo = root.lookupType("cosmos.tx.v1beta1.AuthInfo");
      const TxRaw = root.lookupType("cosmos.tx.v1beta1.TxRaw");
      const PubKey = root.lookupType("cosmos.crypto.secp256k1.PubKey");
      const SignMode = root.lookupEnum("cosmos.tx.signing.v1beta1.SignMode");

      let attempt = 0;
      let lastErr = null;
      while (attempt < 2) {
        attempt++;
        try {
          const { accountNumber, sequence } = await getAccountInfo(walletAddr);
          let seq = BigInt(sequence || "0");
          const cached = accountSeqCache.get(walletAddr);
          if (cached && cached.accountNumber === accountNumber && cached.sequence > seq) seq = cached.sequence;

          const seqStr = seq.toString();
          const gasLimit = await estimateGasLimitFor(messages, memo || "", root, seqStr);
          const feeAmount = feeAmountForGas(gasLimit);

          const bodyBytes = TxBody.encode({ messages, memo: memo || "" }).finish();
          const pubKeyAny = {
            typeUrl: "/cosmos.crypto.secp256k1.PubKey",
            value: PubKey.encode({ key: walletPubKeyBytes }).finish(),
          };
          const authInfoBytes = AuthInfo.encode({
            signerInfos: [
              {
                publicKey: pubKeyAny,
                modeInfo: { single: { mode: SignMode.values.SIGN_MODE_DIRECT } },
                sequence: seqStr,
              },
            ],
            fee: {
              amount: [{ denom: "uretro", amount: feeAmount }],
              gasLimit: gasLimit,
            },
          }).finish();

          const signDoc = { bodyBytes, authInfoBytes, chainId, accountNumber };
          const { signed, signature } = await window.keplr.signDirect(chainId, walletAddr, signDoc);
          const sigBytes = base64ToBytes(signature.signature);
          const txRawBytes = TxRaw.encode({ bodyBytes: signed.bodyBytes, authInfoBytes: signed.authInfoBytes, signatures: [sigBytes] }).finish();

          const broadcastRes = await fetch(apiUrl("/cosmos/tx/v1beta1/txs"), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ tx_bytes: bytesToBase64(txRawBytes), mode: "BROADCAST_MODE_SYNC" }),
          });
          const broadcastJson = await broadcastRes.json().catch(() => ({}));
          if (!broadcastRes.ok) throw new Error(broadcastJson?.message || `Broadcast failed (${broadcastRes.status})`);

          const code = broadcastJson?.tx_response?.code;
          if (typeof code === "number" && code !== 0) {
            const rawLog = broadcastJson?.tx_response?.raw_log || "";
            throw new Error(rawLog || `Tx failed with code ${code}`);
          }

          // Optimistically bump cached sequence after successful CheckTx.
          accountSeqCache.set(walletAddr, { accountNumber, sequence: seq + 1n });
          return broadcastJson;
        } catch (e) {
          lastErr = e;
          const mismatch = parseSequenceMismatch(e?.message || e);
          if (!mismatch || attempt >= 2) throw e;

          // Sync expected sequence and retry once.
          try {
            const { accountNumber } = await getAccountInfo(walletAddr);
            accountSeqCache.set(walletAddr, { accountNumber, sequence: mismatch.expected });
          } catch {
            accountSeqCache.delete(walletAddr);
          }
          await new Promise((r) => setTimeout(r, 250));
        }
      }
      throw lastErr || new Error("Broadcast failed.");
    } finally {
      onchainBusy = false;
    }
  }

  async function signAndBroadcast(typeUrl, msgBytes, memo) {
    return signAndBroadcastMulti([{ typeUrl, value: msgBytes }], memo);
  }

  function isActiveSessionStatus(status) {
    if (status == null) return false;
    if (typeof status === "number") return status === 1;
    const s = String(status).toUpperCase();
    return s.includes("ACTIVE") && !s.includes("INACTIVE");
  }

  async function fetchMySessions({ limit = 25 } = {}) {
    if (!walletAddr) return [];
    const data = await apiGetJson(`/arcade/v1/sessions/player/${walletAddr}?limit=${encodeURIComponent(String(limit))}`);
    return data?.sessions || [];
  }

  function pickLatestSessionIdForGame({ sessions, requireActive } = {}) {
    const list = Array.isArray(sessions) ? sessions : [];
    const mine = list.filter((s) => (s?.game_id || s?.gameId) === GAME_ID);
    if (mine.length === 0) return null;

    const active = mine.filter((s) => isActiveSessionStatus(s?.status));
    if (requireActive && active.length === 0) return null;

    const pickFrom = requireActive ? active : active.length ? active : mine;
    pickFrom.sort((a, b) => Number(b?.session_id || b?.sessionId || 0) - Number(a?.session_id || a?.sessionId || 0));
    return pickFrom[0]?.session_id || pickFrom[0]?.sessionId || null;
  }

  async function discoverLatestSessionId({ requireActive = true } = {}) {
    if (!walletAddr) return null;
    const sessions = await fetchMySessions({ limit: 50 });
    return pickLatestSessionIdForGame({ sessions, requireActive });
  }

  async function waitForLatestSessionId({ timeoutMs = 12000, pollMs = 800, requireActive = true } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const sid = await discoverLatestSessionId({ requireActive });
        if (sid != null && sid !== "") return sid;
      } catch {
        // ignore transient REST errors
      }
      await new Promise((r) => setTimeout(r, pollMs));
    }
    return null;
  }

  async function ensureActiveSessionId({ hintSessionId = null } = {}) {
    if (!walletAddr) throw new Error("Wallet not connected.");

    const sessions = await fetchMySessions({ limit: 60 });
    if (hintSessionId != null && hintSessionId !== "") {
      const hit = sessions.find((s) => String(s?.session_id || s?.sessionId || "") === String(hintSessionId));
      if (hit && isActiveSessionStatus(hit?.status)) return String(hintSessionId);
    }

    const sid = pickLatestSessionIdForGame({ sessions, requireActive: true });
    if (sid == null || sid === "") throw new Error("No active session found. Press Start to begin a new session.");
    return String(sid);
  }

  async function chargeCredit() {
    await ensureWallet();
    const root = await getProtoRoot();
    const MsgInsertCoin = root.lookupType("retrochain.arcade.v1.MsgInsertCoin");
    const msgBytes = MsgInsertCoin.encode({ creator: walletAddr, credits: "1", gameId: GAME_ID }).finish();
    const res = await signAndBroadcast("/retrochain.arcade.v1.MsgInsertCoin", msgBytes, "Insert Coin (RetroNoid)");
    const txhash = res?.tx_response?.txhash;
    setStatus(txhash ? `Inserted coin. Tx: ${txhash}` : "Inserted coin.");
    await refreshCredits();
  }

  async function registerGame() {
    await ensureWallet();
    const root = await getProtoRoot();
    const MsgRegisterGame = root.lookupType("retrochain.arcade.v1.MsgRegisterGame");
    const msgBytes = MsgRegisterGame.encode({
      creator: walletAddr,
      game: {
        gameId: GAME_ID,
        name: "RetroNoid",
        description: "Arkanoid-style brick breaker on RetroChain Arcade.",
        genre: 8, // GENRE_PINBALL
        creditsPerPlay: "1",
        maxPlayers: "1",
        multiplayerEnabled: false,
        developer: DEV_PROFIT_ADDR,
        active: true,
        baseDifficulty: "1",
      },
    }).finish();

    const res = await signAndBroadcast("/retrochain.arcade.v1.MsgRegisterGame", msgBytes, "Register RetroNoid");
    const txhash = res?.tx_response?.txhash;
    setStatus(txhash ? `Registered RetroNoid. Tx: ${txhash}` : "Registered RetroNoid.");
    if (btnRegister) btnRegister.style.display = "none";
  }

  async function startOnchainSession() {
    await ensureWallet();
    await refreshCredits();
    if (cachedCredits < 1n) {
      setStatus("No credits. Insert Coin to play.");
      return null;
    }

    let difficulty = 1;
    try {
      const data = await apiGetJson("/arcade/v1/params");
      const min = Number(data?.params?.min_difficulty ?? data?.params?.minDifficulty ?? data?.min_difficulty ?? data?.minDifficulty ?? 1);
      if (Number.isFinite(min) && min > 0) difficulty = min;
    } catch {
      // ignore
    }

    const root = await getProtoRoot();
    const MsgStartSession = root.lookupType("retrochain.arcade.v1.MsgStartSession");
    const msgBytes = MsgStartSession.encode({ creator: walletAddr, gameId: GAME_ID, difficulty: String(difficulty) }).finish();
    await signAndBroadcast("/retrochain.arcade.v1.MsgStartSession", msgBytes, "Start RetroNoid");
    currentSessionId = await waitForLatestSessionId({ requireActive: true });
    return currentSessionId;
  }

  async function submitScore(finalScore) {
    await ensureWallet();
    try {
      currentSessionId = await ensureActiveSessionId({ hintSessionId: currentSessionId });
    } catch (e) {
      throw new Error(`Session expired or inactive. Press Start and finish the run to submit. (${e?.message || e})`);
    }

    const root = await getProtoRoot();
    const MsgSubmitScore = root.lookupType("retrochain.arcade.v1.MsgSubmitScore");
    const msgBytes = MsgSubmitScore.encode({
      creator: walletAddr,
      sessionId: String(currentSessionId),
      score: String(finalScore),
      level: String(state.level),
      gameOver: true,
    }).finish();

    const res = await signAndBroadcast("/retrochain.arcade.v1.MsgSubmitScore", msgBytes, "Submit RetroNoid Score");
    const txhash = res?.tx_response?.txhash;
    setStatus(txhash ? `Score submitted. Tx: ${txhash}` : "Score submitted.");
    await refreshCredits();
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // --- Overlay UI (menu + store) ---
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.display = "none";
  overlay.style.alignItems = "flex-start";
  overlay.style.justifyContent = "center";
  overlay.style.background = "rgba(0,0,0,0.78)";
  overlay.style.zIndex = "50";
  overlay.style.overflowY = "auto";
  overlay.style.padding = "24px 0";

  const overlayCard = document.createElement("div");
  overlayCard.style.width = "min(720px, 94vw)";
  overlayCard.style.maxHeight = "calc(100vh - 48px)";
  overlayCard.style.overflowY = "auto";
  overlayCard.style.background = "var(--panel)";
  overlayCard.style.border = "1px solid var(--border)";
  overlayCard.style.borderRadius = "14px";
  overlayCard.style.padding = "16px";
  overlay.appendChild(overlayCard);
  document.body.appendChild(overlay);

  const menuView = document.createElement("div");
  menuView.style.display = "none";
  menuView.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
      <div>
        <div style="font-weight:900;font-size:18px;letter-spacing:0.2px">RetroNoid</div>
        <div style="margin-top:4px;font-size:13px;color:var(--muted)">Main screen</div>
      </div>
      <button id="menu-close" title="Close">Close</button>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
      <button id="tab-leaderboards" title="Top scores">Leaderboards</button>
      <button id="tab-trophies" title="On-chain achievements">Trophies</button>
      <button id="tab-stats" title="Local stats on this device">Stats</button>
      <button id="tab-details" title="Game + chain details">Details</button>
      <button id="tab-help" title="How to play">Help</button>
    </div>
    <div id="menu-body" style="margin-top:12px;font-size:13px;color:var(--text);line-height:1.55"></div>
    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px">
      <button id="menu-play">Play</button>
    </div>
  `;

  const storeView = document.createElement("div");
  storeView.style.display = "none";
  storeView.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
      <div>
        <div style="font-weight:900;font-size:18px;letter-spacing:0.2px">Store</div>
        <div style="margin-top:4px;font-size:13px;color:var(--muted)">Between levels: spend Arcade Tokens on powerups.</div>
      </div>
      <button id="store-close" title="Close">Close</button>
    </div>
    <div id="store-meta" style="margin-top:10px;font-size:13px;color:var(--text)"></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
      <button id="buy-wide" title="Widen Paddle: 15s">Buy Wide Paddle (1)</button>
      <button id="buy-slowball" title="Slow Ball: 12s">Buy Slow Ball (2)</button>
      <button id="buy-mult" title="2x Score: 12s">Buy 2x Score (3)</button>
    </div>
    <div style="margin-top:12px;font-size:13px;color:var(--muted)">Tip: use 1/2/3 during a run if you have inventory.</div>
    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px">
      <button id="store-continue">Continue</button>
    </div>
  `;

  overlayCard.appendChild(menuView);
  overlayCard.appendChild(storeView);

  const menuCloseBtn = menuView.querySelector("#menu-close");
  const menuPlayBtn = menuView.querySelector("#menu-play");
  const menuBodyEl = menuView.querySelector("#menu-body");
  const tabLeaderboardsBtn = menuView.querySelector("#tab-leaderboards");
  const tabTrophiesBtn = menuView.querySelector("#tab-trophies");
  const tabStatsBtn = menuView.querySelector("#tab-stats");
  const tabDetailsBtn = menuView.querySelector("#tab-details");
  const tabHelpBtn = menuView.querySelector("#tab-help");

  const storeCloseBtn = storeView.querySelector("#store-close");
  const storeContinueBtn = storeView.querySelector("#store-continue");
  const storeMetaEl = storeView.querySelector("#store-meta");
  const buyWideBtn = storeView.querySelector("#buy-wide");
  const buySlowBallBtn = storeView.querySelector("#buy-slowball");
  const buyMultBtn = storeView.querySelector("#buy-mult");

  function showOverlay(view) {
    overlay.style.display = "flex";
    menuView.style.display = view === "menu" ? "" : "none";
    storeView.style.display = view === "store" ? "" : "none";
  }

  function hideOverlay() {
    overlay.style.display = "none";
    menuView.style.display = "none";
    storeView.style.display = "none";
  }

  function styleTab(btn, active) {
    if (!btn) return;
    btn.style.background = active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)";
    btn.style.borderColor = active ? "rgba(132,87,255,0.45)" : "var(--border)";
  }

  function setMenuTab(tab) {
    menuTab = tab;
    styleTab(tabLeaderboardsBtn, tab === "leaderboards");
    styleTab(tabTrophiesBtn, tab === "trophies");
    styleTab(tabStatsBtn, tab === "stats");
    styleTab(tabDetailsBtn, tab === "details");
    styleTab(tabHelpBtn, tab === "help");
    void renderMenuBody();
  }

  function openMenu() {
    if (storeOpen) return;
    menuOpen = true;
    if (state.running) state.paused = true;
    showOverlay("menu");
    setMenuTab(menuTab || "leaderboards");
  }

  function closeMenu() {
    menuOpen = false;
    hideOverlay();
    if (state.running && !storeOpen) {
      state.paused = false;
      setStatus(ball.stuck ? "Press Space" : "Playing");
    }
  }

  async function fetchHighScores({ limit = 10 } = {}) {
    const data = await apiGetJson(`/arcade/v1/highscores/${encodeURIComponent(GAME_ID)}?limit=${encodeURIComponent(String(limit))}`);
    return data?.scores || [];
  }

  async function fetchGlobalLeaderboard({ limit = 100 } = {}) {
    const data = await apiGetJson(`/arcade/v1/leaderboard?pagination.limit=${encodeURIComponent(String(limit))}`);
    return data?.entries || [];
  }

  async function fetchPlayerAchievements({ player, limit = 200 } = {}) {
    const data = await apiGetJson(
      `/arcade/v1/achievements/${encodeURIComponent(String(player || ""))}?pagination.limit=${encodeURIComponent(String(limit))}`
    );
    return data?.achievements || [];
  }

  function renderMenuStats() {
    if (!menuBodyEl) return;
    const addr = walletAddr ? shortAddr(walletAddr) : "anon";
    menuBodyEl.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr;gap:12px">
        <div style="padding:12px;border:1px solid var(--border);border-radius:12px;background:rgba(0,0,0,0.12)">
          <div style="font-weight:900;letter-spacing:0.2px">Local Stats</div>
          <div style="margin-top:6px;color:var(--muted)">Profile: ${esc(addr)}</div>
          <div style="margin-top:10px">
            <div>Runs: <span style="font-weight:800">${esc(localStats.runs || 0)}</span></div>
            <div>Best score: <span style="font-weight:800">${esc(localStats.bestScore || 0)}</span></div>
            <div>Best level: <span style="font-weight:800">${esc(localStats.bestLevel || 0)}</span></div>
            <div>Total bricks broken: <span style="font-weight:800">${esc(localStats.totalBricks || 0)}</span></div>
            <div>Total drops collected: <span style="font-weight:800">${esc(localStats.totalDrops || 0)}</span></div>
          </div>
          <div style="margin-top:10px;color:var(--muted)">This run: bricks ${esc(runBricksBroken)} • drops ${esc(runDropsCollected)}</div>
        </div>
      </div>
    `;
  }

  function renderMenuTrophies({ claimedOnchain } = {}) {
    if (!menuBodyEl) return;
    const claimedSet = new Set(
      Array.isArray(claimedOnchain)
        ? claimedOnchain
            .map((a) => a?.achievement_id || a?.achievementId)
            .filter((x) => typeof x === "string" && x)
        : []
    );

    const cards = ONCHAIN_ACHIEVEMENT_IDS.map((id) => {
      const meta = ONCHAIN_ACHIEVEMENTS_META[id] || null;
      const title = meta?.title || id;
      const reward = meta?.rewardTokens != null ? `${meta.rewardTokens} tokens` : "tokens";
      const detail = meta?.detail || "";

      const status = !walletAddr ? "UNKNOWN" : claimedSet.has(id) ? "CLAIMED" : "LOCKED";
      const badgeBorder = status === "CLAIMED" ? "rgba(80,220,140,0.70)" : "var(--border)";
      const badgeText = status === "CLAIMED" ? "rgba(80,220,140,0.95)" : "var(--muted)";
      const cardBorder = status === "CLAIMED" ? "rgba(80,220,140,0.70)" : "var(--border)";

      return `
        <div style="padding:12px;border:1px solid ${cardBorder};border-radius:12px;background:rgba(0,0,0,0.12)">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
            <div style="font-weight:900;letter-spacing:0.2px">${esc(title)}</div>
            <div style="padding:2px 8px;border-radius:999px;border:1px solid ${badgeBorder};color:${badgeText};font-weight:900;font-size:11px">${esc(status)}</div>
          </div>
          <div style="margin-top:6px;color:var(--muted);font-size:12px">ID: ${esc(id)} • Reward: ${esc(reward)}</div>
          ${detail ? `<div style=\"margin-top:8px\">${esc(detail)}</div>` : ""}
        </div>
      `;
    }).join("\n");

    menuBodyEl.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr;gap:12px">
        <div style="padding:12px;border:1px solid var(--border);border-radius:12px;background:rgba(0,0,0,0.12)">
          <div style="font-weight:900;letter-spacing:0.2px">Trophies</div>
          <div style="margin-top:6px;color:var(--muted)">${walletAddr ? "On-chain achievements for your wallet." : "Connect Keplr to load claimed status."}</div>
          <div style="margin-top:8px;color:var(--muted)">Claimed: ${walletAddr ? esc(claimedSet.size) : "—"} • Total: ${esc(ONCHAIN_ACHIEVEMENT_IDS.length)}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr;gap:10px">${cards}</div>
      </div>
    `;
  }

  async function renderMenuBody() {
    if (!menuBodyEl) return;

    if (menuTab === "stats") {
      renderMenuStats();
      return;
    }

    if (menuTab === "trophies") {
      menuBodyEl.textContent = walletAddr ? "Loading trophies..." : "Trophies (connect Keplr to load claim status).";
      let claimedOnchain = [];
      if (walletAddr) {
        try {
          claimedOnchain = await fetchPlayerAchievements({ player: walletAddr, limit: 500 });
        } catch {
          claimedOnchain = [];
        }
      }
      renderMenuTrophies({ claimedOnchain });
      return;
    }

    if (menuTab === "help") {
      menuBodyEl.innerHTML = `
        <div style="font-weight:900">Controls</div>
        <div style="color:var(--muted)">Move: ← / → • Launch: Space • Pause: P • Home: H • Laser: F</div>
        <div style="margin-top:10px;font-weight:900">Powerups</div>
        <div style="color:var(--muted)">Drops: some bricks spawn falling powerups you can catch with the paddle (free). Store: buy between levels (Arcade Tokens).</div>
        <div style="margin-top:6px;color:var(--muted)">Hotkeys: 1 Wide, 2 Slow Ball, 3 2x Score. Extra drops: Sticky, Shield, +1 Life, MultiBall (extra balls), Laser (press F).</div>
      `;
      return;
    }

    if (menuTab === "details") {
      const costStr = cachedPowerUpCost != null ? cachedPowerUpCost.toString() : "?";
      menuBodyEl.innerHTML = `
        <div><span style="font-weight:900">Game:</span> ${esc(GAME_ID)}</div>
        <div style="margin-top:6px"><span style="font-weight:900">Wallet:</span> ${walletAddr ? esc(walletAddr) : "(not connected)"}</div>
        <div style="margin-top:6px"><span style="font-weight:900">Credits:</span> ${cachedCredits.toString()}</div>
        <div style="margin-top:6px"><span style="font-weight:900">Arcade Tokens:</span> ${cachedArcadeTokens.toString()}</div>
        <div style="margin-top:6px"><span style="font-weight:900">Powerup base cost:</span> ${esc(costStr)}</div>
        <div style="margin-top:6px"><span style="font-weight:900">Session:</span> ${currentSessionId != null ? esc(String(currentSessionId)) : "(none)"}</div>
        <div style="margin-top:10px;color:var(--muted)">Connect Keplr • Insert Coin • Start. Final score submits on Game Over.</div>
      `;
      return;
    }

    // leaderboards
    menuBodyEl.textContent = "Loading leaderboards...";
    try {
      const [scores, global] = await Promise.all([fetchHighScores({ limit: 10 }), fetchGlobalLeaderboard({ limit: 50 })]);
      const scoreLines = Array.isArray(scores) && scores.length
        ? scores.map((s, i) => {
            const p = s?.player || "";
            const sc = s?.score ?? 0;
            const initials = String(s?.initials || "").trim();
            const tag = initials ? ` (${initials.toUpperCase()})` : "";
            return `${i + 1}. ${shortAddr(p)}${tag} • ${sc}`;
          })
        : ["No scores yet."];

      const globalLines = Array.isArray(global) && global.length
        ? global.slice(0, 10).map((e, i) => {
            const rank = e.rank ?? (i + 1);
            const p = e.player || e.address || "";
            const sc = e.score ?? e.best_score ?? e.total_score ?? 0;
            return `${rank}. ${shortAddr(p)} • ${sc}`;
          })
        : ["Global leaderboard unavailable."];

      menuBodyEl.innerHTML = `
        <div style="font-weight:900">Top Scores (RetroNoid)</div>
        <div style="margin-top:6px;white-space:pre-line">${esc(scoreLines.join("\n"))}</div>
        <div style="margin-top:12px;font-weight:900">Global Leaderboard (Top 10)</div>
        <div style="margin-top:6px;white-space:pre-line">${esc(globalLines.join("\n"))}</div>
      `;
    } catch (e) {
      menuBodyEl.textContent = "Leaderboards unavailable.";
      console.warn("menu leaderboard fetch failed", e);
    }
  }

  function updateStoreUi() {
    if (!storeMetaEl) return;
    const costStr = cachedPowerUpCost != null ? cachedPowerUpCost.toString() : "?";
    storeMetaEl.textContent = walletAddr
      ? `Tokens: ${cachedArcadeTokens.toString()} • Base cost: ${costStr} • Inventory: Wide ${powerupInventory.wide}, Slow ${powerupInventory.slowball}, 2x ${powerupInventory.mult}`
      : "Connect Keplr to buy powerups.";

    updateTouchPowerupsUi();
  }

  function updateTouchPowerupsUi() {
    if (!touchPowerupsEl || !btnPWide || !btnPSlow || !btnPMult) return;
    if (!IS_TOUCH_DEVICE) {
      touchPowerupsEl.style.display = "none";
      return;
    }

    touchPowerupsEl.style.display = "";

    const nWide = Number(powerupInventory.wide || 0);
    const nSlow = Number(powerupInventory.slowball || 0);
    const nMult = Number(powerupInventory.mult || 0);

    btnPWide.textContent = `Wide (${nWide})`;
    btnPSlow.textContent = `Slow (${nSlow})`;
    btnPMult.textContent = `2× (${nMult})`;

    const canUseNow = !!walletAddr && state.running && !state.paused && !storeOpen && !menuOpen && !onchainBusy && !powerupBusy;
    btnPWide.disabled = !canUseNow || nWide <= 0;
    btnPSlow.disabled = !canUseNow || nSlow <= 0;
    btnPMult.disabled = !canUseNow || nMult <= 0;
  }

  async function buyPowerUp(powerUpId) {
    if (powerupBusy || onchainBusy) return;
    if (!walletAddr) {
      setStatus("Connect Keplr to buy powerups.");
      return;
    }
    if (!state.running || !currentSessionId) {
      setStatus("Start a run first.");
      return;
    }

    try {
      currentSessionId = await ensureActiveSessionId({ hintSessionId: currentSessionId });
    } catch (e) {
      setStatus(e?.message || String(e));
      return;
    }

    await refreshArcadeParams();
    await refreshCredits();

    const cost = cachedPowerUpCost != null ? cachedPowerUpCost : 0n;
    if (cost > 0n && cachedArcadeTokens < cost) {
      setStatus(`Not enough Arcade Tokens (${cachedArcadeTokens.toString()}).`);
      return;
    }

    powerupBusy = true;
    try {
      setStatus(`Buying ${powerUpId} (confirm in Keplr)...`);
      const root = await getProtoRoot();
      const MsgUsePowerUp = root.lookupType("retrochain.arcade.v1.MsgUsePowerUp");
      const msgBytes = MsgUsePowerUp.encode({ creator: walletAddr, sessionId: String(currentSessionId), powerUpId }).finish();
      await signAndBroadcast("/retrochain.arcade.v1.MsgUsePowerUp", msgBytes, `Buy power-up: ${powerUpId}`);

      powerupInventory[powerUpId] = (powerupInventory[powerUpId] || 0) + 1;
      savePowerupInventory();
      await refreshCredits();
      updateStoreUi();
      updateTouchPowerupsUi();
      setStatus(`${powerUpId} purchased.`);
    } catch (e) {
      setStatus(`Purchase failed: ${e?.message || e}`);
    } finally {
      powerupBusy = false;
    }
  }

  async function activatePowerUp(powerUpId) {
    if (powerupBusy || onchainBusy) return;
    if (!state.running || storeOpen || menuOpen) return;
    if (!walletAddr) {
      setStatus("Connect Keplr to use powerups.");
      return;
    }
    if ((powerupInventory[powerUpId] || 0) <= 0) {
      setStatus("No stored powerups. Buy in the Store between levels.");
      return;
    }
    powerupInventory[powerUpId] -= 1;
    savePowerupInventory();
    applyLocalPowerUp(powerUpId);
    setStatus(`${powerUpId} used.`);
    updateStoreUi();
    updateTouchPowerupsUi();
  }

  function openStore({ pendingStart = false, pendingNextLevel = false } = {}) {
    storeOpen = true;
    menuOpen = false;
    storePendingStart = !!pendingStart;
    storePendingNextLevel = !!pendingNextLevel;
    state.paused = true;
    updateStoreUi();
    showOverlay("store");
  }

  function closeStoreAndContinue() {
    storeOpen = false;
    hideOverlay();

    if (storePendingStart) {
      storePendingStart = false;
      state.paused = false;
      setStatus("Press Space");
      sfx("level");
      return;
    }

    if (storePendingNextLevel) {
      storePendingNextLevel = false;
      rebuildBricks();
      resetBallToPaddle();
      state.paused = false;
      setStatus("Press Space");
      sfx("level");
      return;
    }

    if (state.running) {
      state.paused = false;
      setStatus("Playing");
    }
  }

  if (menuCloseBtn) menuCloseBtn.addEventListener("click", closeMenu);
  if (menuPlayBtn) menuPlayBtn.addEventListener("click", closeMenu);
  if (tabLeaderboardsBtn) tabLeaderboardsBtn.addEventListener("click", () => setMenuTab("leaderboards"));
  if (tabTrophiesBtn) tabTrophiesBtn.addEventListener("click", () => setMenuTab("trophies"));
  if (tabStatsBtn) tabStatsBtn.addEventListener("click", () => setMenuTab("stats"));
  if (tabDetailsBtn) tabDetailsBtn.addEventListener("click", () => setMenuTab("details"));
  if (tabHelpBtn) tabHelpBtn.addEventListener("click", () => setMenuTab("help"));

  if (storeCloseBtn) storeCloseBtn.addEventListener("click", closeStoreAndContinue);
  if (storeContinueBtn) storeContinueBtn.addEventListener("click", closeStoreAndContinue);
  if (buyWideBtn) buyWideBtn.addEventListener("click", () => void buyPowerUp("wide"));
  if (buySlowBallBtn) buySlowBallBtn.addEventListener("click", () => void buyPowerUp("slowball"));
  if (buyMultBtn) buyMultBtn.addEventListener("click", () => void buyPowerUp("mult"));

  if (btnHome) btnHome.addEventListener("click", openMenu);

  function randSeeded(x) {
    // Tiny deterministic PRNG based on level.
    let t = (x + 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // --- Rendering-only visuals (deterministic, lightweight) ---
  const STARFIELD = (() => {
    const stars = [];
    const seed0 = 424242;
    const count = 170;
    for (let i = 0; i < count; i++) {
      const s = seed0 + i * 11;
      const x = randSeeded(s + 0) * WORLD_W;
      const y = randSeeded(s + 1) * WORLD_H;
      const r = 0.6 + randSeeded(s + 2) * 2.2;
      const a = 0.03 + randSeeded(s + 3) * 0.22;
      const tw = 0.35 + randSeeded(s + 4) * 1.8;
      const phase = randSeeded(s + 5) * Math.PI * 2;
      const drift = 2 + randSeeded(s + 6) * 14;
      stars.push({ x, y, r, a, tw, phase, drift });
    }

    // A few large stars with subtle spikes.
    const big = [];
    for (let i = 0; i < 16; i++) {
      const s = seed0 + 9000 + i * 17;
      big.push({
        x: randSeeded(s + 0) * WORLD_W,
        y: randSeeded(s + 1) * WORLD_H,
        r: 1.8 + randSeeded(s + 2) * 2.6,
        a: 0.08 + randSeeded(s + 3) * 0.18,
        phase: randSeeded(s + 4) * Math.PI * 2,
        tw: 0.20 + randSeeded(s + 5) * 1.1,
      });
    }

    return { stars, big };
  })();

  function resetBallToPaddle() {
    for (const b of balls) {
      b.stuck = true;
      b.vx = 0;
      b.vy = 0;
      b.x = paddle.x + paddle.w / 2;
      b.y = paddle.y - b.r - 1;
    }
  }

  function rebuildBricks() {
    const { rows, cols, pad, top, left, brickH } = levelSpec;
    const availableW = W - left * 2;
    const brickW = (availableW - pad * (cols - 1)) / cols;

    const bricks = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = left + c * (brickW + pad);
        const y = top + r * (brickH + pad);

        const seed = state.level * 1000 + r * 100 + c;
        const roll = randSeeded(seed);

        // Brick types:
        // - normal: 1-2 hit
        // - steel: 3 hit (no drops)
        // - bomb: 1 hit (explodes neighbors)
        let kind = "normal";
        if (roll < Math.min(0.05 + 0.004 * state.level, 0.10)) kind = "bomb";
        else if (roll < Math.min(0.12 + 0.006 * state.level, 0.22)) kind = "steel";

        const twoHit = kind === "normal" && randSeeded(seed * 17 + 3) < Math.min(0.25 + 0.02 * state.level, 0.55);
        const hp = kind === "steel" ? 3 : twoHit ? 2 : 1;

        bricks.push({ x, y, w: brickW, h: brickH, r, c, kind, hp, alive: true });
      }
    }
    state.bricks = bricks;
  }

  function updateBestLevelLive() {
    if ((state.level | 0) > (localStats.bestLevel || 0)) {
      localStats.bestLevel = state.level | 0;
      saveLocalStats();
    }
  }

  function brickDestroyPoints(source, kind, isExplosion) {
    if (isExplosion) return 18;
    if (kind === "steel") return source === "laser" ? 22 : 32;
    if (kind === "bomb") return source === "laser" ? 40 : 55;
    return source === "laser" ? 35 : 50;
  }

  function brickHitPoints(source, kind) {
    if (kind === "steel") return source === "laser" ? 6 : 9;
    if (kind === "bomb") return source === "laser" ? 12 : 18;
    return source === "laser" ? 10 : 15;
  }

  function onBrickDestroyed(brick, idx, { source = "ball", isExplosion = false } = {}) {
    runBricksBroken += 1;

    // Combo window only for direct hits (not explosion chain).
    const now = performance.now();
    if (!isExplosion) {
      comboCount = now < comboUntilMs ? comboCount + 1 : 1;
      comboUntilMs = now + 2200;
      if (comboCount >= 3) {
        setStatus(`Combo x${comboCount}`);
        fxKickShake(60, 2 + Math.min(6, Math.floor(comboCount / 2)));
      }
      const bonus = comboCount >= 2 ? Math.min(260, 6 * comboCount) : 0;
      if (bonus) scoreAdd(bonus);
    }

    // Drops: skip for steel and explosion chain.
    if (brick?.kind !== "steel" && !isExplosion) {
      spawnDropAt(brick.x + brick.w / 2 - 17, brick.y + brick.h / 2 - 9, (state.level * 100000 + idx * 97 + state.score) | 0);
    }

    scoreAdd(brickDestroyPoints(source, brick?.kind || "normal", isExplosion));
    fxEmitParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, "rgba(80,220,140,0.95)", 14, 240);
  }

  function onBrickHit(brick, { source = "ball" } = {}) {
    scoreAdd(brickHitPoints(source, brick?.kind || "normal"));
    fxEmitParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, "rgba(132,87,255,0.95)", 10, 200);
    fxKickShake(70, 3);
  }

  function applyBrickDamage(idx, dmg, { source = "ball", isExplosion = false, bombVisited = null } = {}) {
    if (idx < 0 || idx >= state.bricks.length) return;
    const b = state.bricks[idx];
    if (!b || !b.alive) return;

    b.hp -= Math.max(1, dmg | 0);
    if (b.hp > 0) {
      onBrickHit(b, { source });
      state.bricks[idx] = b;
      return;
    }

    b.alive = false;
    state.bricks[idx] = b;
    onBrickDestroyed(b, idx, { source, isExplosion });

    if (b.kind === "bomb" && !isExplosion) {
      const visited = bombVisited || new Set();
      if (!visited.has(idx)) {
        visited.add(idx);
        fxFlash(120);
        explodeNeighbors(b.r, b.c, { source, visited });
      }
    }
  }

  function explodeNeighbors(r0, c0, { source = "ball", visited } = {}) {
    for (let i = 0; i < state.bricks.length; i++) {
      const b = state.bricks[i];
      if (!b || !b.alive) continue;
      const dr = Math.abs((b.r ?? 999) - r0);
      const dc = Math.abs((b.c ?? 999) - c0);
      if (dr > 1 || dc > 1) continue;
      if (dr === 0 && dc === 0) continue;
      // Explosion does not chain other bombs.
      applyBrickDamage(i, 9999, { source, isExplosion: true, bombVisited: visited });
    }
  }

  function updateHud() {
    elScore.textContent = String(state.score);
    elLives.textContent = String(state.lives);
    elLevel.textContent = String(state.level);
    updateTouchPowerupsUi();
  }

  function startRunLocalFresh() {
    recordRunStart();
    state.running = true;
    state.paused = true;
    state.score = 0;
    state.lives = 3;
    state.level = 1;
    paddle.w = BASE_PADDLE_W;
    wideUntilMs = 0;
    slowBallUntilMs = 0;
    scoreMultUntilMs = 0;
    stickyUntilMs = 0;
    shieldCharges = 0;
    laserUntilMs = 0;
    laserShots.length = 0;
    drops.length = 0;
    paddle.x = (WORLD_W - paddle.w) / 2;
    rebuildBricks();
    resetBallToPaddle();
    updateHud();
    setStatus("Store open");
    openStore({ pendingStart: true });
  }

  function togglePause() {
    if (!state.running) return;
    if (storeOpen || menuOpen) return;
    state.paused = !state.paused;
    setStatus(state.paused ? "Paused" : "Playing");
  }

  function resetAll() {
    hideOverlay();
    menuOpen = false;
    storeOpen = false;
    storePendingNextLevel = false;
    storePendingStart = false;

    state.running = false;
    state.paused = false;
    state.score = 0;
    state.lives = 3;
    state.level = 1;
    paddle.w = BASE_PADDLE_W;
    wideUntilMs = 0;
    slowBallUntilMs = 0;
    scoreMultUntilMs = 0;
    stickyUntilMs = 0;
    shieldCharges = 0;
    laserUntilMs = 0;
    laserShots.length = 0;
    drops.length = 0;
    paddle.x = (W - paddle.w) / 2;
    rebuildBricks();
    resetBallToPaddle();
    updateHud();
    setStatus("Ready");

    currentSessionId = null;
    submittedThisRun = false;
    runBricksBroken = 0;
    runDropsCollected = 0;
    comboCount = 0;
    comboUntilMs = 0;
  }

  function launchBall() {
    if (!balls.some((b) => b.stuck)) return;
    if (!state.running) {
      setStatus("Press Start");
      return;
    }

    // Launch angle based on paddle position (centered = straight up).
    const baseSpeed = ball.speed + (state.level - 1) * 30;
    let launched = 0;
    for (const b of balls) {
      if (!b.stuck) continue;
      const t = ((b.x - paddle.x) / paddle.w) * 2 - 1; // [-1..1]
      const spread = launched === 0 ? 0 : (launched % 2 ? 0.10 : -0.10) * Math.min(1.6, launched);
      const angle = (-Math.PI / 2) + t * (Math.PI * 0.35) + spread;
      const speed = baseSpeed;
      b.vx = Math.cos(angle) * speed;
      b.vy = Math.sin(angle) * speed;
      b.stuck = false;
      launched++;
    }

    if (launched > 0 && IS_TOUCH_DEVICE) touchControlsHintDismissed = true;
    setStatus("Playing");
    sfx("paddle");
  }

  function rectCircleCollide(rx, ry, rw, rh, cx, cy, cr) {
    const closestX = clamp(cx, rx, rx + rw);
    const closestY = clamp(cy, ry, ry + rh);
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy <= cr * cr;
  }

  function reflectBallOnRect(b, rx, ry, rw, rh) {
    // Determine which side we hit (cheap but works for brick-breaker).
    const prevX = b.x - b.vx * 0.016;
    const prevY = b.y - b.vy * 0.016;

    const wasLeft = prevX < rx;
    const wasRight = prevX > rx + rw;
    const wasAbove = prevY < ry;
    const wasBelow = prevY > ry + rh;

    if ((wasLeft && !wasAbove && !wasBelow) || (wasRight && !wasAbove && !wasBelow)) {
      b.vx = -b.vx;
    } else if ((wasAbove && !wasLeft && !wasRight) || (wasBelow && !wasLeft && !wasRight)) {
      b.vy = -b.vy;
    } else {
      // Corner-ish: flip the dominant component.
      if (Math.abs(b.vx) > Math.abs(b.vy)) b.vx = -b.vx;
      else b.vy = -b.vy;
    }

    // Nudge out to avoid re-collide.
    b.x = clamp(b.x, b.r + 1, W - b.r - 1);
    b.y = clamp(b.y, b.r + 1, H - b.r - 1);
  }

  function step(dt) {
    if (!state.running) return;
    updatePowerupExpiry();
    fxStep(dt);
    if (state.paused) return;

    stepDrops(dt);
    stepLasers(dt);

    // Paddle movement
    if (state.pointerActive) {
      paddle.x = clamp(state.pointerX - paddle.w / 2, 10, W - paddle.w - 10);
    } else {
      const dx = (state.keys.right ? 1 : 0) - (state.keys.left ? 1 : 0);
      paddle.x = clamp(paddle.x + dx * paddle.speed * dt, 10, W - paddle.w - 10);
    }

    // Keep any stuck balls attached to the paddle.
    for (const b of balls) {
      if (!b.stuck) continue;
      b.x = paddle.x + paddle.w / 2;
      b.y = paddle.y - b.r - 1;

        sfx("paddle");
    }

    const now = performance.now();
    const baseSpeed = ball.speed + (state.level - 1) * 30;
    const speedScale = slowBallUntilMs > now ? 0.7 : 1.0;

    // Step each ball
    for (let bi = balls.length - 1; bi >= 0; bi--) {
      const b = balls[bi];
      if (b.stuck) continue;

      // Normalize speed (handles Slow Ball powerup)
      {
        const desired = baseSpeed * speedScale;
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > 0.001) {
          const k = desired / sp;
          b.vx *= k;
          b.vy *= k;
        }
      }

      // Move
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Walls
      if (b.x - b.r <= 0) {
        b.x = b.r;
        b.vx = Math.abs(b.vx);
      }
      if (b.x + b.r >= W) {
        b.x = W - b.r;
        b.vx = -Math.abs(b.vx);
      }
      if (b.y - b.r <= 0) {
        b.y = b.r;
        b.vy = Math.abs(b.vy);
      }

      // Bottom = lose ball
      if (b.y - b.r > H) {
        balls.splice(bi, 1);
        if (balls.length === 0) {
          // Shield prevents a life loss once.
          if (shieldCharges > 0) {
            shieldCharges -= 1;
            balls.push(ball);
            fxFlash(160);
            fxKickShake(180, 7);
            setStatus("Shield saved you — press Space");
            resetBallToPaddle();
            updateHud();
            return;
          }

          state.lives = Math.max(0, state.lives - 1);
          updateHud();

          fxKickShake(240, 8);
          fxFlash(140);

          if (state.lives <= 0) {
            recordRunEnd();
            state.running = false;
            setStatus("Game Over");
            balls.length = 0;
            balls.push(ball);
            resetBallToPaddle();

            if (!submittedThisRun) {
              submittedThisRun = true;
              void (async () => {
                try {
                  if (!walletAddr) {
                    setStatus("Game Over. Connect Keplr to submit score.");
                    return;
                  }
                  await submitScore(state.score);
                } catch (e) {
                  setStatus(`Score submit failed: ${e?.message || e}`);
                }
              })();
            }
          } else {
            setStatus("Life lost — press Space");
            balls.push(ball);
            resetBallToPaddle();
          }
          return;
        }
        continue;
      }

      // Paddle collision
      if (rectCircleCollide(paddle.x, paddle.y, paddle.w, paddle.h, b.x, b.y, b.r) && b.vy > 0) {
        const t = ((b.x - paddle.x) / paddle.w) * 2 - 1;
        const angle = (-Math.PI / 2) + t * (Math.PI * 0.55);
        const speed = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(angle) * speed;
        b.vy = Math.sin(angle) * speed;
        b.y = paddle.y - b.r - 1;

        // Sticky paddle powerup
        if (stickyUntilMs > now) {
          b.stuck = true;
          b.vx = 0;
          b.vy = 0;
          setStatus("Sticky catch — press Space");
        }
      }

      // Brick collisions (1 per ball per frame)
      let hit = null;
      let hitIdx = -1;
      for (let i = 0; i < state.bricks.length; i++) {
        const brick = state.bricks[i];
        if (!brick.alive) continue;
        if (rectCircleCollide(brick.x, brick.y, brick.w, brick.h, b.x, b.y, b.r)) {
          hit = brick;
          hitIdx = i;
          break;
        }
      }

      if (hit) {
        reflectBallOnRect(b, hit.x, hit.y, hit.w, hit.h);
        applyBrickDamage(hitIdx, 1, { source: "ball" });
        updateHud();

        sfx("brick");

        const remaining = state.bricks.reduce((n, br) => n + (br.alive ? 1 : 0), 0);
        if (remaining === 0) {
          state.level += 1;
          updateBestLevelLive();
          updateHud();
          balls.length = 0;
          balls.push(ball);
          resetBallToPaddle();
          sfx("level");
          fxFlash(180);
          fxKickShake(220, 6);
          setStatus("Level cleared — store open");
          openStore({ pendingNextLevel: true });
          return;
        }
      }
    }

  }

  function draw() {
    // Resync transform (canvas internal size can change due to fullscreen/HiDPI fit).
    syncCanvasScale();

    // Clear the full pixel buffer (letterbox area) before drawing the world.
    // Temporarily reset transform so fill covers the entire canvas.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Background
    const t = fxNow() * 0.001;
    {
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "rgba(6,8,16,1)");
      bg.addColorStop(0.55, "rgba(10,8,22,1)");
      bg.addColorStop(1, "rgba(0,0,0,1)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Soft aurora glow near the top.
      const gx = W * (0.45 + 0.10 * Math.sin(t * 0.17));
      const gy = H * (0.18 + 0.04 * Math.cos(t * 0.13));
      const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(W, H) * 0.75);
      rg.addColorStop(0, "rgba(132,87,255,0.16)");
      rg.addColorStop(0.40, "rgba(80,220,140,0.06)");
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
    }

    // Camera shake
    if (fx.shakeMs > 0 && fx.shakeAmp > 0) {
      const tt = fxNow() * 0.018;
      const amp = fx.shakeAmp * (fx.shakeMs / 300);
      const ox = Math.sin(tt * 2.1) * amp;
      const oy = Math.cos(tt * 1.7) * amp;
      ctx.save();
      ctx.translate(ox, oy);
    } else {
      ctx.save();
    }

    // Starfield (deterministic, lightly animated)
    {
      ctx.fillStyle = "rgba(255,255,255,1)";
      for (const s of STARFIELD.stars) {
        const tw = 0.65 + 0.35 * Math.sin(t * s.tw + s.phase);
        ctx.globalAlpha = s.a * tw;
      const x = (s.x + (t * s.drift)) % WORLD_W;
      const y = (s.y + (t * s.drift * 0.35)) % WORLD_H;
        if (s.r <= 1.2) {
          ctx.fillRect(x, y, 1, 1);
        } else {
          ctx.beginPath();
          ctx.arc(x, y, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      for (const s of STARFIELD.big) {
        const tw = 0.65 + 0.35 * Math.sin(t * s.tw + s.phase);
        ctx.globalAlpha = s.a * tw;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = s.a * 0.35 * tw;
        ctx.fillRect(s.x - (8 + s.r), s.y, 16 + s.r * 2, 1);
        ctx.fillRect(s.x, s.y - (8 + s.r), 1, 16 + s.r * 2);
      }

      ctx.globalAlpha = 1;
    }

    // Bricks
    for (const b of state.bricks) {
      if (!b.alive) continue;
      let base = b.hp >= 2 ? "rgba(132,87,255,0.74)" : "rgba(80,220,140,0.72)";
      let stroke = "rgba(255,255,255,0.14)";
      let glow = null;
      if (b.kind === "steel") {
        base = "rgba(255,255,255,0.18)";
        stroke = "rgba(255,255,255,0.24)";
        glow = "rgba(255,255,255,0.10)";
      } else if (b.kind === "bomb") {
        base = "rgba(132,87,255,0.80)";
        stroke = "rgba(80,220,140,0.22)";
        glow = "rgba(132,87,255,0.35)";
      } else if (b.hp >= 2) {
        glow = "rgba(132,87,255,0.22)";
      } else {
        glow = "rgba(80,220,140,0.14)";
      }

      const glint = 0.5 + 0.5 * Math.sin(t * 1.25 + (b.r * 0.9 + b.c * 0.7));

      const grad = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
      grad.addColorStop(0, base);
      grad.addColorStop(0.65, "rgba(0,0,0,0.08)");
      grad.addColorStop(1, "rgba(0,0,0,0.18)");

      if (glow) {
        ctx.shadowColor = glow;
        ctx.shadowBlur = 12;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = grad;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 8);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;

      // Shine band
      ctx.fillStyle = `rgba(255,255,255,${(0.10 + 0.06 * glint).toFixed(4)})`;
      ctx.beginPath();
      ctx.roundRect(b.x + 3, b.y + 3, b.w - 6, Math.max(6, b.h * 0.22), 6);
      ctx.fill();

      // Inner edge highlight
      ctx.strokeStyle = `rgba(255,255,255,${(0.08 + 0.06 * glint).toFixed(4)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2, 7);
      ctx.stroke();

      // Steel: show remaining hp pips.
      if (b.kind === "steel") {
        const pips = Math.max(0, Math.min(3, b.hp | 0));
        const pipW = 8;
        const pipH = 4;
        const gap = 4;
        const totalW = pips * pipW + Math.max(0, pips - 1) * gap;
        let px = b.x + (b.w - totalW) / 2;
        const py = b.y + b.h - 8;
        for (let i = 0; i < pips; i++) {
          ctx.fillStyle = "rgba(132,87,255,0.70)";
          ctx.beginPath();
          ctx.roundRect(px, py, pipW, pipH, 2);
          ctx.fill();
          px += pipW + gap;
        }
      }

      // Bomb: a little "core" dot.
      if (b.kind === "bomb") {
        const pulse = 0.55 + 0.45 * Math.sin(t * 3.2 + (b.r + b.c) * 0.2);
        ctx.shadowColor = "rgba(80,220,140,0.65)";
        ctx.shadowBlur = 14;
        ctx.fillStyle = `rgba(80,220,140,${(0.70 + 0.25 * pulse).toFixed(4)})`;
        ctx.beginPath();
        ctx.arc(b.x + b.w / 2, b.y + b.h / 2, Math.max(3, Math.min(7, b.h * 0.22)), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // Paddle
    // subtle glow when wide powerup active
    if (wideUntilMs > performance.now()) {
      ctx.shadowColor = "rgba(132,87,255,0.55)";
      ctx.shadowBlur = 16;
    } else {
      ctx.shadowBlur = 0;
    }
    {
      const pg = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x, paddle.y + paddle.h);
      pg.addColorStop(0, "rgba(255,255,255,0.95)");
      pg.addColorStop(0.45, "rgba(255,255,255,0.78)");
      pg.addColorStop(1, "rgba(220,220,240,0.78)");
      ctx.fillStyle = pg;
    }
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 10);
    ctx.fill();
    ctx.stroke();

    // Paddle highlight band
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.beginPath();
    ctx.roundRect(paddle.x + 4, paddle.y + 3, paddle.w - 8, Math.max(4, paddle.h * 0.32), 8);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Ball
    // Ball trail
    if (fx.trail.length) {
      for (let i = 0; i < fx.trail.length; i++) {
        const t = fx.trail[i];
        const a = 0.18 * (1 - i / fx.trail.length);
        const tint = scoreMultUntilMs > performance.now() ? "132,87,255" : "255,255,255";
        ctx.fillStyle = `rgba(${tint},${a.toFixed(4)})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, Math.max(2.5, ball.r * (0.55 + 0.25 * (1 - i / fx.trail.length))), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Balls
    for (const b of balls) {
      const now = performance.now();
      const isMult = scoreMultUntilMs > now;
      const tint = isMult ? "132,87,255" : "255,255,255";
      const g = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.35, 1, b.x, b.y, b.r + 2);
      g.addColorStop(0, `rgba(${tint},0.98)`);
      g.addColorStop(0.55, `rgba(${tint},0.86)`);
      g.addColorStop(1, `rgba(${tint},0.18)`);
      ctx.shadowColor = `rgba(${tint},0.55)`;
      ctx.shadowBlur = 14;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Specular dot
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.28, b.y - b.r * 0.28, Math.max(1.5, b.r * 0.22), 0, Math.PI * 2);
      ctx.fill();
    }

    // Laser shots
    if (laserShots.length) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = "rgba(132,87,255,0.85)";
      ctx.lineWidth = 2;
      ctx.shadowColor = "rgba(132,87,255,0.65)";
      ctx.shadowBlur = 10;
      for (const s of laserShots) {
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x, s.y + 12);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Falling powerups
    if (drops.length) {
      for (const d of drops) {
        const c = dropColor(d.id);
        const g = ctx.createLinearGradient(d.x, d.y, d.x + d.w, d.y + d.h);
        g.addColorStop(0, "rgba(255,255,255,0.08)");
        g.addColorStop(1, "rgba(0,0,0,0.25)");
        ctx.fillStyle = g;
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.lineWidth = 1;
        ctx.shadowColor = c;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(d.x, d.y, d.w, d.h, 8);
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;

        ctx.fillStyle = c;
        ctx.font = `900 12px ${UI_FONT_FAMILY}`;
        const label = dropLabel(d.id);
        const tw = ctx.measureText(label).width;
        ctx.fillText(label, d.x + (d.w - tw) / 2, d.y + 13);
      }
    }

    // Particles
    for (const p of fx.particles) {
      const k = 1 - p.age / p.life;
      ctx.fillStyle = p.c;
      ctx.globalAlpha = Math.max(0, Math.min(1, k)) * 0.75;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.75 + 0.55 * k), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Flash overlay (hit/lose-life)
    if (fx.flashMs > 0) {
      const a = Math.min(0.22, 0.22 * (fx.flashMs / 180));
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Vignette (post)
    {
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.10, W / 2, H / 2, Math.max(W, H) * 0.72);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.45)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }

    // Powerup tints + badges
    {
      const now = performance.now();
      const slowOn = slowBallUntilMs > now;
      const multOn = scoreMultUntilMs > now;
      const stickyOn = stickyUntilMs > now;

      if (slowOn) {
        ctx.fillStyle = "rgba(80,220,140,0.06)";
        ctx.fillRect(0, 0, W, H);
      }
      if (multOn) {
        ctx.fillStyle = "rgba(132,87,255,0.07)";
        ctx.fillRect(0, 0, W, H);
      }

      const badges = [];
      if (wideUntilMs > now) badges.push({ label: "WIDE", c: "rgba(132,87,255,0.95)" });
      if (slowOn) badges.push({ label: "SLOW", c: "rgba(80,220,140,0.95)" });
      if (multOn) badges.push({ label: "2X", c: "rgba(132,87,255,0.95)" });
      if (stickyOn) badges.push({ label: "STICKY", c: "rgba(255,255,255,0.95)" });
      if (shieldCharges > 0) badges.push({ label: `SHIELD×${shieldCharges}`, c: "rgba(132,87,255,0.95)" });
      if (laserUntilMs > now) badges.push({ label: "LASER (F)", c: "rgba(132,87,255,0.95)" });
      if (balls.length > 1) badges.push({ label: `BALLS×${balls.length}`, c: "rgba(255,255,255,0.95)" });
      if (comboCount >= 2 && now < comboUntilMs) badges.push({ label: `COMBO×${comboCount}`, c: "rgba(80,220,140,0.95)" });

      if (badges.length) {
        const pad = 10;
        let x = pad;
        const y = pad;
        ctx.font = `700 12px ${UI_FONT_FAMILY}`;
        for (const b of badges) {
          const w = Math.ceil(ctx.measureText(b.label).width) + 16;
          ctx.fillStyle = "rgba(0,0,0,0.30)";
          ctx.strokeStyle = "rgba(255,255,255,0.14)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(x, y, w, 22, 10);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = b.c;
          ctx.fillText(b.label, x + 8, y + 15);
          x += w + 8;
        }
      }
    }

    // Center hint
    if (!state.running && !ball.stuck) {
      // no-op
    }

    ctx.restore();

    // Overlay text
    if (!state.running && (state.lives <= 0)) {
      ctx.fillStyle = "rgba(255,90,120,0.95)";
      ctx.font = "900 28px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
        ctx.fillText("GAME OVER", WORLD_W / 2, WORLD_H / 2);
      ctx.font = "600 14px ui-sans-serif, system-ui";
      ctx.fillStyle = "rgba(255,255,255,0.65)";
        ctx.fillText("Press Reset to try again", WORLD_W / 2, WORLD_H / 2 + 24);
    } else if (ball.stuck && state.running && !state.paused) {
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.font = "700 14px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      if (IS_TOUCH_DEVICE && !touchControlsHintDismissed) {
        ctx.fillText("Drag to move", WORLD_W / 2, WORLD_H / 2);
        ctx.fillText("Tap to launch", WORLD_W / 2, WORLD_H / 2 + 20);
      } else {
        ctx.fillText(IS_TOUCH_DEVICE ? "Tap to launch" : "Press Space to launch", WORLD_W / 2, WORLD_H / 2);
      }
    } else if (state.paused) {
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "900 24px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.fillText("PAUSED", WORLD_W / 2, WORLD_H / 2);
    } else if (!state.running) {
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.font = "800 16px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Press Start", WORLD_W / 2, WORLD_H / 2);
    }
  }

  function loop(ts) {
    const dt = state.lastTs ? Math.min(0.033, (ts - state.lastTs) / 1000) : 0;
    state.lastTs = ts;

    step(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      if (storeOpen) {
        e.preventDefault();
        closeStoreAndContinue();
        return;
      }
      if (menuOpen) {
        e.preventDefault();
        closeMenu();
        return;
      }
    }

    if (e.key === "h" || e.key === "H") {
      e.preventDefault();
      openMenu();
      return;
    }

    if (e.key === "1") {
      e.preventDefault();
      void activatePowerUp("wide");
      return;
    }
    if (e.key === "2") {
      e.preventDefault();
      void activatePowerUp("slowball");
      return;
    }
    if (e.key === "3") {
      e.preventDefault();
      void activatePowerUp("mult");
      return;
    }

    if (e.key === "f" || e.key === "F") {
      e.preventDefault();
      fireLaser();
      return;
    }

    if (e.key === "ArrowLeft") state.keys.left = true;
    if (e.key === "ArrowRight") state.keys.right = true;
    if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      if (storeOpen) {
        closeStoreAndContinue();
        return;
      }
      if (menuOpen) {
        closeMenu();
        return;
      }
      launchBall();
    }
    if (e.key === "p" || e.key === "P") togglePause();
  }

  function onKeyUp(e) {
    if (e.key === "ArrowLeft") state.keys.left = false;
    if (e.key === "ArrowRight") state.keys.right = false;
  }

  function canvasPointFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    // Map from CSS pixels -> canvas pixels -> logical world units.
    const px = (e.clientX - rect.left) * (canvas.width / rect.width);
    const py = (e.clientY - rect.top) * (canvas.height / rect.height);
    const x = px / (scaleX || 1);
    const y = py / (scaleY || 1);
    return { x, y };
  }

  function bindPointer() {
    // Touch UX: drag to move paddle; tap to launch.
    let downTs = 0;
    let downX = 0;
    let downY = 0;
    let moved = false;

    const down = (e) => {
      // Prevent mobile page scrolling/zooming while playing.
      if (e.pointerType === "touch" || e.pointerType === "pen") e.preventDefault();
      state.pointerActive = true;
      const p = canvasPointFromEvent(e);
      state.pointerX = p.x;

      downTs = performance.now();
      downX = p.x;
      downY = p.y;
      moved = false;

      canvas.setPointerCapture?.(e.pointerId);
    };
    const move = (e) => {
      if (e.pointerType === "touch" || e.pointerType === "pen") e.preventDefault();
      if (!state.pointerActive) return;
      const p = canvasPointFromEvent(e);
      state.pointerX = p.x;
      if (!moved) {
        const dx = p.x - downX;
        const dy = p.y - downY;
        if (dx * dx + dy * dy > 12 * 12) moved = true;
      }
    };
    const up = (e) => {
      if (e.pointerType === "touch" || e.pointerType === "pen") e.preventDefault();
      const isTouchLike = e.pointerType === "touch" || e.pointerType === "pen";

      state.pointerActive = false;
      canvas.releasePointerCapture?.(e.pointerId);

      // Tap-to-launch on mobile: if the player taps (not drags) and the ball is stuck,
      // launch it without requiring Space.
      if (isTouchLike) {
        const now = performance.now();
        const dt = now - downTs;
        if (!moved && dt <= 320 && state.running && !state.paused && !storeOpen && !menuOpen) {
          if (balls.some((b) => b.stuck)) launchBall();
        }
      }
    };

    const leave = () => {
      state.pointerActive = false;
    };

    canvas.addEventListener("pointerdown", down, { passive: false });
    canvas.addEventListener("pointermove", move, { passive: false });
    canvas.addEventListener("pointerup", up, { passive: false });
    canvas.addEventListener("pointercancel", up, { passive: false });
    canvas.addEventListener("pointerleave", leave);

    // Prevent long-press context menu on mobile.
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  btnStart.addEventListener("click", () => {
    void (async () => {
      if (state.running || onchainBusy) return;
      submittedThisRun = false;
      setStatus("Connecting wallet...");
      try {
        await unlockAudio();
        await ensureWallet();
        startMusic();
        setStatus("Starting session on-chain...");
        const sid = await startOnchainSession();
        if (!sid) return;
        startRunLocalFresh();
      } catch (e) {
        setStatus(e?.message || String(e));
      }
    })();
  });

  btnPause.addEventListener("click", () => togglePause());

  btnReset.addEventListener("click", () => resetAll());

  if (btnConnect) btnConnect.addEventListener("click", () => void ensureWallet().catch((e) => setStatus(e?.message || String(e))));
  if (btnInsert) btnInsert.addEventListener("click", () => void chargeCredit().catch((e) => setStatus(e?.message || String(e))));
  if (btnRegister) btnRegister.addEventListener("click", () => void registerGame().catch((e) => setStatus(e?.message || String(e))));

  if (btnPWide) btnPWide.addEventListener("click", () => void activatePowerUp("wide"));
  if (btnPSlow) btnPSlow.addEventListener("click", () => void activatePowerUp("slowball"));
  if (btnPMult) btnPMult.addEventListener("click", () => void activatePowerUp("mult"));

  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp);
  bindPointer();

  // Bloom toggle wiring
  loadBloomPref();
  if (bloomToggleEl) {
    bloomToggleEl.checked = !!bloomEnabled;
    bloomToggleEl.addEventListener("change", () => {
      bloomEnabled = !!bloomToggleEl.checked;
      saveBloomPref();
      sfx("powerup");
    });
  }

  // Sound UI wiring
  readSoundPrefs();
  if (soundToggleEl) {
    soundToggleEl.checked = !!soundEnabled;
    soundToggleEl.addEventListener("change", () => {
      setSoundEnabled(!!soundToggleEl.checked);
      void unlockAudio();
      sfx("powerup");
    });
  }

  if (musicToggleEl) {
    musicToggleEl.checked = !!musicEnabled;
    musicToggleEl.addEventListener("change", () => {
      setMusicEnabled(!!musicToggleEl.checked);
    });
  }
  if (soundVolEl) {
    soundVolEl.value = String(Math.round(soundVol * 100));
    soundVolEl.addEventListener("input", () => {
      const v = Number(soundVolEl.value) / 100;
      setSoundVolume01(v);
    });
  }

  // Autounlock on first user gesture
  window.addEventListener(
    "pointerdown",
    () => {
      void unlockAudio();
    },
    { once: true, passive: true }
  );

  // CanvasRoundRect support (fallback)
  if (!ctx.roundRect) {
    ctx.roundRect = function (x, y, w, h, r) {
      const rr = Math.max(0, Math.min(r || 0, Math.min(w, h) / 2));
      this.moveTo(x + rr, y);
      this.arcTo(x + w, y, x + w, y + h, rr);
      this.arcTo(x + w, y + h, x, y + h, rr);
      this.arcTo(x, y + h, x, y, rr);
      this.arcTo(x, y, x + w, y, rr);
      this.closePath();
    };
  }

  resetAll();

  // Match RetroVaders: show Home/Menu overlay on first load.
  openMenu();
  requestAnimationFrame(loop);
})();

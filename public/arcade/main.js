(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const startBtn = document.getElementById("start");
  const pauseBtn = document.getElementById("pause");
  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const levelEl = document.getElementById("level");
  const statusEl = document.getElementById("status");

  const GAME_ID = "retrovaders";

  // Expose a tiny debug hook so we can verify the script is executing in production.
  window.__RETROVADERS_LOADED__ = true;
  const DEV_PROFIT_ADDR = "cosmos1us0jjdd5dj0v499g959jatpnh6xuamwhwdrrgq";
  const API_BASE = (window.__RETROCHAIN_REST_BASE__ || "/api").replace(/\/$/, "");

  const canvasWrap = canvas.closest(".canvas-wrap") || canvas.parentElement;

  if (!canvas || !ctx) {
    try {
      const el = document.getElementById("status");
      if (el) el.textContent = "Canvas init failed.";
    } catch {
      // ignore
    }
    return;
  }

  let W = canvas.width;
  let H = canvas.height;

  // Mobile/touch ergonomics
  canvas.style.touchAction = "none";

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

  function resizeCanvasToFit() {
    const wrap = canvasWrap || canvas.parentElement;
    if (!wrap) return;

    const cs = getComputedStyle(wrap);
    const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const availW = Math.max(240, wrap.clientWidth - padX);
    const availH = Math.max(200, wrap.clientHeight - padY);

    const baseAspect = 720 / 480;
    let cssW = availW;
    let cssH = cssW / baseAspect;
    if (cssH > availH) {
      cssH = availH;
      cssW = cssH * baseAspect;
    }
    cssW = Math.max(240, Math.floor(cssW));
    cssH = Math.max(200, Math.floor(cssH));

    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    W = cssW;
    H = cssH;

    // Rebuild any cached, size-dependent textures.
    scanlinesCanvas = null;
    scanlinesCtx = null;

    // Re-seed background for new bounds.
    initStars();

    // Keep gameplay entities within bounds.
    if (player) {
      player.y = H - 60;
      player.x = Math.max(8, Math.min(W - player.w - 8, player.x));
    }
    if (aliens && aliens.length) {
      for (const a of aliens) {
        a.x = Math.max(8, Math.min(W - a.w - 8, a.x));
      }
    }
  }

  // Game state
  let running = false;
  let paused = false;
  let lastTime = 0;
  let player;
  let aliens = [];
  let bullets = [];
  let alienBullets = [];
  let score = 0;
  let lives = 3;
  let level = 1;
  let difficultyId = 2; // 1 easy, 2 normal, 3 hard, 4 nightmare
  const MAX_LIVES = 9;
  let alienDir = 1;
  let alienSpeed = 32; // pixels per second horizontally
  let dropStep = 24;
  let shootCooldown = 0;
  let keys = {};

  // Wave scoring + streak tracking
  let waveStartMs = 0;
  let waveNearMisses = 0;
  let shotSeq = 0;
  const shotState = new Map(); // shotId -> { remaining: number, hit: boolean }

  // On-chain state
  let chainId = null;
  let walletAddr = null;
  let walletPubKeyBytes = null;
  let cachedCredits = 0n;
  let cachedArcadeTokens = 0n;
  let currentSessionId = null;
  let protoRootPromise = null;
  let loadingProtobufPromise = null;
  let onchainBusy = false;

  // Powerups (paid with arcade tokens earned after games)
  let cachedPowerUpCost = null; // BigInt or null
  let tokensAtRunStart = null; // BigInt or null
  let shieldUntilMs = 0;
  let rapidUntilMs = 0;
  let scoreMultUntilMs = 0;
  let tripleUntilMs = 0;
  let pierceUntilMs = 0;
  let slowUntilMs = 0;
  let magnetUntilMs = 0;
  let powerupBusy = false;

  // Between-level store + settings
  let storeOpen = false;
  let storePendingNextWave = false;
  let settingsOpen = false;
  let settingsWasPaused = false;
  let menuOpen = false;
  let menuWasPaused = false;
  let trophyOpen = false;
  let menuTab = "leaderboards"; // leaderboards | trophies | stats | details | help

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
    "first-game": {
      title: "First Game",
      rewardTokens: 10,
      detail: "Play any arcade game at least once.",
    },
    "first-win": {
      title: "First Win",
      rewardTokens: 25,
      detail: "Complete a session (finish a game run) at least once.",
    },
    "coin-collector": {
      title: "Coin Collector",
      rewardTokens: 25,
      detail: "Insert 10 credits across the arcade.",
    },
    "quick-start": {
      title: "Quick Start",
      rewardTokens: 25,
      detail: "Trigger the arcade quick-start milestone.",
    },
    "multi-genre-master": {
      title: "Multi-Genre Master",
      rewardTokens: 75,
      detail: "Play games spanning 5 different genres.",
    },
    "high-scorer": {
      title: "High Scorer",
      rewardTokens: 50,
      detail: "Get onto any high-score table.",
    },
    "tournament-player": {
      title: "Tournament Player",
      rewardTokens: 50,
      detail: "Participate in a tournament.",
    },
    "power-user": {
      title: "Power User",
      rewardTokens: 150,
      detail: "Collect 50 powerups across your sessions.",
    },
    "comeback-kid": {
      title: "Comeback Kid",
      rewardTokens: 150,
      detail: "Use 10 continues across your sessions.",
    },
    "high-roller": {
      title: "High Roller",
      rewardTokens: 150,
      detail: "Spend 100 credits across your sessions.",
    },
    "arcade-legend": {
      title: "Arcade Legend",
      rewardTokens: 250,
      detail: "Reach top 10 on the global leaderboard.",
    },
    "top-of-the-world": {
      title: "Top of the World",
      rewardTokens: 500,
      detail: "Reach #1 on the global leaderboard.",
    },
    "tournament-champion": {
      title: "Tournament Champion",
      rewardTokens: 300,
      detail: "Win at least 1 tournament.",
    },
    "ultimate-champion": {
      title: "Ultimate Champion",
      rewardTokens: 500,
      detail: "Win 10 tournaments.",
    },
    "arcade-mogul": {
      title: "Arcade Mogul",
      rewardTokens: 500,
      detail: "Accumulate 1,000,000 arcade tokens.",
    },
    "legendary-player": {
      title: "Legendary Player",
      rewardTokens: 500,
      detail: "Play 1,000 sessions.",
    },
  };
  const settings = { shake: true, fx: true, sound: true, music: true };

  // --- Procedural audio (no external assets) ---
  let audioCtx = null;
  let masterGain = null;
  let musicGain = null;
  let musicBusGain = null;
  let masterVol = 0.95;
  let musicTimer = null;
  let musicStep = 0;

  const SOUND_KEY = `rc1_retrv_sound_${GAME_ID}`;
  const MUSIC_KEY = `rc1_retrv_music_${GAME_ID}`;
  const VOL_KEY = `rc1_retrv_vol_${GAME_ID}`;

  function readAudioPrefs() {
    try {
      const s = localStorage.getItem(SOUND_KEY);
      const m = localStorage.getItem(MUSIC_KEY);
      const v = localStorage.getItem(VOL_KEY);
      if (s != null) settings.sound = s !== "0";
      if (m != null) settings.music = m !== "0";
      if (v != null) {
        const n = Number(v);
        if (Number.isFinite(n)) masterVol = Math.max(0, Math.min(1.25, n));
      }
    } catch {
      // ignore
    }
  }

  function writeAudioPrefs() {
    try {
      localStorage.setItem(SOUND_KEY, settings.sound ? "1" : "0");
      localStorage.setItem(MUSIC_KEY, settings.music ? "1" : "0");
      localStorage.setItem(VOL_KEY, String(masterVol));
    } catch {
      // ignore
    }
  }

  readAudioPrefs();

  function ensureAudio() {
    if (!settings.sound && !settings.music) return null;
    if (audioCtx) return audioCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = Math.max(0, Math.min(1.25, masterVol));
    masterGain.connect(audioCtx.destination);

    // Music routing: per-voice notes -> musicGain (per-note envelopes) -> musicBusGain (ducking) -> masterGain.
    musicBusGain = audioCtx.createGain();
    musicBusGain.gain.value = 0.55;
    musicBusGain.connect(masterGain);

    musicGain = audioCtx.createGain();
    musicGain.gain.value = 1.0;
    musicGain.connect(musicBusGain);
    return audioCtx;
  }

  function resumeAudioFromGesture() {
    const ctx = ensureAudio();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => void 0);
  }

  function sfx(type) {
    if (!settings.sound) return;
    const ctx = ensureAudio();
    if (!ctx || !masterGain) return;
    if (ctx.state === "suspended") return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(masterGain);

    const env = (a, d, peak) => {
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), now + a);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + a + d);
    };

    switch (type) {
      case "shoot":
        osc.type = "square";
        osc.frequency.setValueAtTime(720, now);
        osc.frequency.exponentialRampToValueAtTime(420, now + 0.06);
        env(0.005, 0.10, 0.18);
        break;
      case "alien":
        osc.type = "square";
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);
        env(0.002, 0.16, 0.16);
        break;
      case "alienShot":
        osc.type = "square";
        osc.frequency.setValueAtTime(330, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.10);
        env(0.002, 0.12, 0.10);
        break;
      case "power":
        osc.type = "triangle";
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.setValueAtTime(990, now + 0.04);
        osc.frequency.setValueAtTime(1320, now + 0.08);
        env(0.003, 0.14, 0.14);
        break;
      case "wave":
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.setValueAtTime(330, now + 0.06);
        osc.frequency.setValueAtTime(440, now + 0.12);
        env(0.01, 0.22, 0.18);
        break;
      case "pause":
        osc.type = "sine";
        osc.frequency.setValueAtTime(310, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.10);
        env(0.003, 0.12, 0.10);
        break;
      case "hit":
        osc.type = "triangle";
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.16);
        env(0.002, 0.22, 0.22);
        break;
      case "explode":
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(55, now + 0.22);
        env(0.001, 0.28, 0.28);
        break;
      case "coin":
        osc.type = "square";
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1320, now + 0.06);
        env(0.004, 0.12, 0.20);
        break;
      case "ui":
      default:
        osc.type = "sine";
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(760, now + 0.04);
        env(0.003, 0.06, 0.10);
        break;
    }

    osc.start(now);
    osc.stop(now + 0.40);
  }

  function stopMusic() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  function startMusic() {
    stopMusic();
    if (!settings.music) return;
    const ctx = ensureAudio();
    if (!ctx || !musicGain) return;
    if (ctx.state === "suspended") return;
    musicStep = 0;
    const bpm = 120;
    const stepMs = (60_000 / bpm) / 4; // 16th

    const base = 220; // A3
    const hz = (semi) => base * Math.pow(2, semi / 12);

    const playPulse = (freq, dur, vol, duty = 0.5) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      // Approximate pulse width with a periodic wave.
      const real = new Float32Array(2);
      const imag = new Float32Array(2);
      real[0] = 0;
      imag[0] = 0;
      real[1] = duty;
      imag[1] = 1 - duty;
      try {
        osc.setPeriodicWave(ctx.createPeriodicWave(real, imag, { disableNormalization: true }));
      } catch {
        osc.type = "square";
      }
      osc.frequency.setValueAtTime(freq, now);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(g);
      g.connect(musicGain);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    };

    const playTri = (freq, dur, vol) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), now + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(g);
      g.connect(musicGain);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    };

    const playNoise = (dur, vol) => {
      const now = ctx.currentTime;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), now + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      src.connect(g);
      g.connect(musicGain);
      src.start(now);
      src.stop(now + dur + 0.02);
    };

    // 4-bar NES-ish attract theme.
    // Bars are 16 steps (16th notes). Loop every 64 steps.
    const bass = [
      -24, -24, -19, -24, -17, -24, -19, -24, -24, -24, -19, -24, -17, -24, -12, -24,
      -24, -24, -19, -24, -17, -24, -19, -24, -24, -24, -19, -24, -17, -24, -10, -24,
      -22, -22, -17, -22, -15, -22, -17, -22, -22, -22, -17, -22, -15, -22, -10, -22,
      -24, -24, -19, -24, -17, -24, -19, -24, -24, -24, -19, -24, -17, -24, -12, -24,
    ];

    const lead = [
      12, null, 15, null, 19, null, 15, null, 12, null, 10, null, 7, null, 10, null,
      12, null, 15, null, 19, null, 22, null, 19, null, 15, null, 12, null, 10, null,
      12, null, 15, null, 19, null, 15, null, 12, null, 10, null, 7, null, 10, null,
      19, null, 15, null, 12, null, 10, null, 7, null, 10, null, 12, null, 15, null,
    ];

    musicTimer = setInterval(() => {
      if (!audioCtx || audioCtx.state !== "running" || !settings.music) return;

      // Slight ducking during actual gameplay.
      if (musicBusGain) musicBusGain.gain.value = running ? 0.42 : 0.62;

      const step = musicStep % 64;

      // Bass on every 8th note.
      if (step % 2 === 0) {
        playTri(hz(bass[step]), 0.11, 0.085);
      }

      // Lead on every 16th where defined.
      const l = lead[step];
      if (l != null) {
        playPulse(hz(l), 0.07, 0.070, step % 8 === 0 ? 0.35 : 0.5);
      }

      // Noise “snare” on 2 and 4.
      const beat16 = step % 16;
      if (beat16 === 4 || beat16 === 12) {
        playNoise(0.045, 0.040);
      }

      musicStep += 1;
    }, stepMs);
  }

  const prefsStorageKey = () => `rc1_arcade_prefs_${GAME_ID}`;

  function loadPrefs() {
    try {
      const raw = localStorage.getItem(prefsStorageKey());
      const p = raw ? JSON.parse(raw) : null;
      if (!p || typeof p !== "object") return;
      const d = Number(p.difficultyId);
      if ([1, 2, 3, 4].includes(d)) difficultyId = d;
      if (typeof p.shake === "boolean") settings.shake = p.shake;
      if (typeof p.fx === "boolean") settings.fx = p.fx;
    } catch {
      // ignore
    }
  }

  function savePrefs() {
    try {
      localStorage.setItem(
        prefsStorageKey(),
        JSON.stringify({
          difficultyId,
          shake: !!settings.shake,
          fx: !!settings.fx,
        })
      );
    } catch {
      // ignore
    }
  }

  // Restore persisted settings early (before UI renders).
  loadPrefs();

  const powerupInventory = {
    shield: 0,
    rapid: 0,
    bomb: 0,
    life: 0,
    mult: 0,
    cont: 0,
    triple: 0,
    pierce: 0,
    slow: 0,
    magnet: 0,
  };

  function powerupInventoryStorageKey() {
    return `rc1_arcade_powerups_${GAME_ID}_${walletAddr || "anon"}`;
  }

  function loadPowerupInventory() {
    if (!walletAddr) return;
    try {
      const raw = localStorage.getItem(powerupInventoryStorageKey());
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== "object") return;
      for (const k of ["shield", "rapid", "bomb", "life", "mult", "cont", "triple", "pierce", "slow", "magnet"]) {
        const v = Number(parsed[k] ?? 0);
        powerupInventory[k] = Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
      }
    } catch {
      // ignore
    }
  }

  function savePowerupInventory() {
    if (!walletAddr) return;
    try {
      localStorage.setItem(
        powerupInventoryStorageKey(),
        JSON.stringify({
          shield: Math.max(0, Number(powerupInventory.shield || 0)),
          rapid: Math.max(0, Number(powerupInventory.rapid || 0)),
          bomb: Math.max(0, Number(powerupInventory.bomb || 0)),
          life: Math.max(0, Number(powerupInventory.life || 0)),
          mult: Math.max(0, Number(powerupInventory.mult || 0)),
          cont: Math.max(0, Number(powerupInventory.cont || 0)),
          triple: Math.max(0, Number(powerupInventory.triple || 0)),
          pierce: Math.max(0, Number(powerupInventory.pierce || 0)),
          slow: Math.max(0, Number(powerupInventory.slow || 0)),
          magnet: Math.max(0, Number(powerupInventory.magnet || 0)),
        })
      );
    } catch {
      // ignore
    }
  }

  // Powerup prices are multiples of the chain param `power_up_cost`.
  // (Chain currently enforces a single cost; we batch multiple spends into one tx.)
  const powerupPriceUnits = {
    shield: 1,
    rapid: 2,
    bomb: 3,
    life: 4,
    mult: 4,
    cont: 12,
    triple: 6,
    pierce: 7,
    slow: 6,
    magnet: 5,
  };

  // Achievements + local stats (client-side)
  const achievementDefs = [
    { id: "first_kill", name: "First Kill", desc: "Destroy your first alien." },
    { id: "first_clear", name: "Wave Clear", desc: "Clear a wave." },
    { id: "clean_wave", name: "Flawless Wave", desc: "Clear a wave without losing a life." },
    { id: "score_10k", name: "10,000 Points", desc: "Reach 10,000 score in a run." },
    { id: "nightmare", name: "Nightmare", desc: "Start a run on Nightmare difficulty." },
    { id: "big_spender", name: "Big Spender", desc: "Spend 50 Arcade Tokens on powerups." },
  ];
  let achievementsState = { unlocked: {}, stats: { tokensSpent: "0" } };
  let achievementsEl = null;

  // Per-run tracking for achievements
  let waveTookHit = false;
  let killsThisRun = 0;

  // Store can open at run start ("pre-run")
  let storePendingStart = false;

  const colors = {
    player: "#22d3ee",
    bullet: "#a855f7",
    alien: "#7dd3fc",
    alienBullet: "#f97316",
    text: "#e2e8f0",
  };

  const difficultyOptions = [
    { id: 1, name: "Easy", mult: 1.0, speed: 0.75, shoot: 0.55, bullet: 0.8 },
    { id: 2, name: "Normal", mult: 1.25, speed: 1.0, shoot: 1.0, bullet: 1.0 },
    { id: 3, name: "Hard", mult: 1.6, speed: 1.15, shoot: 1.25, bullet: 1.15 },
    { id: 4, name: "Nightmare", mult: 2.0, speed: 1.3, shoot: 1.55, bullet: 1.35 },
  ];

  function getDifficulty() {
    return difficultyOptions.find((d) => d.id === difficultyId) || difficultyOptions[1];
  }

  function fmtMult(n) {
    const s = (Math.round(n * 100) / 100).toFixed(2);
    return s.replace(/\.00$/, "").replace(/0$/, "");
  }

  // Combo meter (client-side)
  let comboCount = 0;
  let comboTimeLeft = 0;
  const comboWindowSec = 2.4;

  function resetCombo() {
    comboCount = 0;
    comboTimeLeft = 0;
  }

  function bumpCombo() {
    comboCount = Math.min(25, comboCount + 1);
    comboTimeLeft = comboWindowSec;
  }

  function comboMultiplier() {
    if (comboCount < 2 || comboTimeLeft <= 0) return 1;
    return Math.min(2.0, 1 + 0.10 * (comboCount - 1));
  }

  function addScore(basePoints, { ignoreCombo = false } = {}) {
    const d = getDifficulty();
    const c = ignoreCombo ? 1 : comboMultiplier();
    const now = performance.now();
    const sm = scoreMultUntilMs > now ? 2 : 1;
    const pts = Math.max(0, Math.round(basePoints * d.mult * c * sm));
    score += pts;
    updateHud();
    if (score >= 10000) unlockAchievement("score_10k");
  }

  function beginShot(nBullets) {
    shotSeq += 1;
    shotState.set(shotSeq, { remaining: Math.max(1, nBullets | 0), hit: false });
    return shotSeq;
  }

  function markShotHit(shotId) {
    const st = shotState.get(shotId);
    if (st) st.hit = true;
  }

  function markShotBulletGone(shotId) {
    const st = shotState.get(shotId);
    if (!st) return;
    st.remaining -= 1;
    if (st.remaining > 0) return;
    // Risk/reward: big streaks break on a full whiff.
    if (!st.hit && comboCount >= 5) resetCombo();
    shotState.delete(shotId);
  }

  // In-run powerup drops (local-only; no on-chain tx)
  let drops = [];
  let dropCooldown = 0;

  function dropColor(kind) {
    if (kind === "shield") return "rgba(34,211,238,0.92)";
    if (kind === "rapid") return "rgba(168,85,247,0.92)";
    return "rgba(249,115,22,0.92)"; // bomb
  }

  function dropLabel(kind) {
    if (kind === "shield") return "S";
    if (kind === "rapid") return "R";
    return "B";
  }

  function pickDropKind() {
    const r = Math.random();
    if (r < 0.5) return "shield";
    if (r < 0.82) return "rapid";
    return "bomb";
  }

  function maybeSpawnDrop(x, y) {
    if (dropCooldown > 0) return;
    if (drops.length >= 3) return;
    const d = getDifficulty();
    const chance = d.id === 1 ? 0.085 : d.id === 2 ? 0.060 : d.id === 3 ? 0.050 : 0.042;
    if (Math.random() > chance) return;
    const kind = pickDropKind();
    drops.push({ x, y, r: 10, vy: 80 + level * 6, kind, life: 9.0 });
    dropCooldown = 1.1;
  }

  // Graphics polish
  let stars = [];
  let farStars = [];
  let nebulae = [];
  let planets = [];
  let particles = [];
  let shockwaves = [];
  let muzzleFlashes = [];
  let shakeTime = 0;
  let flashTime = 0;
  let bgParallaxX = 0;
  let scanlinesCanvas = null;
  let scanlinesCtx = null;
  let grainCanvas = null;
  let grainCtx = null;
  let alienShootAcc = 0;

  function ensureScanlines() {
    if (scanlinesCanvas) return;
    scanlinesCanvas = document.createElement("canvas");
    scanlinesCanvas.width = W;
    scanlinesCanvas.height = H;
    scanlinesCtx = scanlinesCanvas.getContext("2d");
    scanlinesCtx.clearRect(0, 0, W, H);
    scanlinesCtx.globalAlpha = 0.06;
    scanlinesCtx.fillStyle = "#000";
    for (let y = 0; y < H; y += 3) {
      scanlinesCtx.fillRect(0, y, W, 1);
    }
    scanlinesCtx.globalAlpha = 1;
  }

  function ensureGrain() {
    if (grainCanvas) return;
    const s = 160;
    grainCanvas = document.createElement("canvas");
    grainCanvas.width = s;
    grainCanvas.height = s;
    grainCtx = grainCanvas.getContext("2d", { willReadFrequently: true });
    const img = grainCtx.createImageData(s, s);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = (10 + Math.random() * 26) | 0;
    }
    grainCtx.putImageData(img, 0, 0);
  }

  function drawFilmGrain(ts) {
    if (!settings.fx) return;
    ensureGrain();
    const ox = ((ts * 0.04) | 0) % grainCanvas.width;
    const oy = ((ts * 0.03) | 0) % grainCanvas.height;
    ctx.save();
    ctx.globalAlpha = 0.045;
    ctx.globalCompositeOperation = "overlay";
    for (let y = -grainCanvas.height; y < H + grainCanvas.height; y += grainCanvas.height) {
      for (let x = -grainCanvas.width; x < W + grainCanvas.width; x += grainCanvas.width) {
        ctx.drawImage(grainCanvas, x + ox, y + oy);
      }
    }
    ctx.restore();
  }

  function wrapX(x) {
    if (x >= 0 && x <= W) return x;
    const m = x % W;
    return m < 0 ? m + W : m;
  }

  function initStars(count = 140) {
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 0.6 + Math.random() * 1.8,
      v: 10 + Math.random() * 50,
      a: 0.25 + Math.random() * 0.65,
      tw: 0.5 + Math.random() * 2.0,
      ph: Math.random() * Math.PI * 2,
    }));

    farStars = Array.from({ length: Math.floor(count * 0.55) }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 0.4 + Math.random() * 1.0,
      v: 6 + Math.random() * 18,
      a: 0.12 + Math.random() * 0.35,
      tw: 0.3 + Math.random() * 1.1,
      ph: Math.random() * Math.PI * 2,
    }));

    nebulae = Array.from({ length: 4 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H * 0.75,
      r: 120 + Math.random() * 220,
      c: Math.random() < 0.5 ? "rgba(168,85,247,0.20)" : "rgba(34,211,238,0.18)",
      dx: (Math.random() * 2 - 1) * 10,
      dy: (Math.random() * 2 - 1) * 6,
      ph: Math.random() * Math.PI * 2,
    }));

    planets = Array.from({ length: 2 }, () => ({
      x: Math.random() * W,
      y: 80 + Math.random() * (H * 0.45),
      r: 80 + Math.random() * 140,
      c1: Math.random() < 0.5 ? "rgba(34,211,238,0.20)" : "rgba(168,85,247,0.22)",
      c2: "rgba(0,0,0,0)",
      dx: (Math.random() * 2 - 1) * 8,
      dy: (Math.random() * 2 - 1) * 4,
      ph: Math.random() * Math.PI * 2,
    }));
  }

  function spawnExplosion(x, y, color) {
    if (settings.fx) {
      for (let i = 0; i < 22; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 80 + Math.random() * 220;
        particles.push({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 0.35 + Math.random() * 0.35,
          max: 0.7,
          r: 1 + Math.random() * 2.5,
          c: color,
        });
      }
      if (particles.length > 900) particles = particles.slice(particles.length - 900);

      shockwaves.push({
        x,
        y,
        r: 8 + Math.random() * 6,
        life: 0.22 + Math.random() * 0.10,
        max: 0.32,
        c: color,
      });
      if (shockwaves.length > 18) shockwaves = shockwaves.slice(shockwaves.length - 18);
    }
    if (settings.shake) shakeTime = Math.max(shakeTime, 0.12);
  }

  function spawnMuzzleFlash(x, y, color) {
    muzzleFlashes.push({ x, y, life: 0.05, max: 0.05, c: color });
    if (muzzleFlashes.length > 12) muzzleFlashes = muzzleFlashes.slice(muzzleFlashes.length - 12);
  }

  function updateFx(dt) {
    farStars.forEach((s) => {
      s.y += (s.v + level) * dt;
      if (s.y > H + 4) {
        s.y = -4;
        s.x = Math.random() * W;
      }
    });

    stars.forEach((s) => {
      s.y += (s.v + level * 2) * dt;
      if (s.y > H + 4) {
        s.y = -4;
        s.x = Math.random() * W;
      }
    });

    particles.forEach((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy = p.vy * 0.92 + 260 * dt;
    });
    particles = particles.filter((p) => p.life > 0);

    shockwaves.forEach((s) => {
      s.life -= dt;
      s.r += 260 * dt;
    });
    shockwaves = shockwaves.filter((s) => s.life > 0);

    muzzleFlashes.forEach((m) => {
      m.life -= dt;
    });
    muzzleFlashes = muzzleFlashes.filter((m) => m.life > 0);

    shakeTime = Math.max(0, shakeTime - dt);
    flashTime = Math.max(0, flashTime - dt);
  }

  function drawBackground(ts) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#050815");
    g.addColorStop(1, "#04070f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    if (settings.fx) {
      // Distant planets
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const p of planets) {
        const wob = 0.7 + 0.3 * Math.sin(ts * 0.00018 + p.ph);
        const px = p.x + Math.sin(ts * 0.00012 + p.ph) * p.dx + bgParallaxX * 0.18;
        const py = p.y + Math.cos(ts * 0.00010 + p.ph) * p.dy;
        const rr = p.r * wob;
        const rg = ctx.createRadialGradient(px - rr * 0.15, py - rr * 0.15, rr * 0.1, px, py, rr);
        rg.addColorStop(0, p.c1);
        rg.addColorStop(1, p.c2);
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(px, py, rr, 0, Math.PI * 2);
        ctx.fill();
        // subtle ring
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = "rgba(226,232,240,0.25)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(px, py + rr * 0.15, rr * 0.95, rr * 0.30, -0.25, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // Nebulae (soft blobs)
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const n of nebulae) {
        const wob = 0.6 + 0.4 * Math.sin(ts * 0.00035 + n.ph);
        const gx = n.x + Math.sin(ts * 0.00015 + n.ph) * n.dx + bgParallaxX * 0.22;
        const gy = n.y + Math.cos(ts * 0.00012 + n.ph) * n.dy;
        const rr = n.r * wob;
        const rg = ctx.createRadialGradient(gx, gy, rr * 0.1, gx, gy, rr);
        rg.addColorStop(0, n.c);
        rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(gx, gy, rr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const streak = settings.fx && (level >= 6 || getDifficulty().id >= 4) ? Math.min(1, (level - 5) / 8) : 0;

    for (const s of farStars) {
      const tw = 0.6 + 0.4 * Math.sin(ts * 0.001 * s.tw + s.ph);
      ctx.globalAlpha = s.a * tw;
      ctx.fillStyle = "#94a3b8";
      const sx = wrapX(s.x + bgParallaxX * 0.30);
      if (streak > 0) {
        ctx.fillRect(sx, s.y, Math.max(1, s.r), 1 + 6 * streak);
      } else {
        ctx.beginPath();
        ctx.arc(sx, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const s of stars) {
      const tw = 0.6 + 0.4 * Math.sin(ts * 0.001 * s.tw + s.ph);
      ctx.globalAlpha = s.a * tw;
      ctx.fillStyle = "#c7d2fe";
      const sx = wrapX(s.x + bgParallaxX * 0.55);
      if (streak > 0) {
        ctx.fillRect(sx, s.y, Math.max(1, s.r + 0.5), 1 + 10 * streak);
      } else {
        ctx.beginPath();
        ctx.arc(sx, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();

        // tiny sparkle on larger stars
        if (s.r > 1.35 && tw > 0.85) {
          ctx.globalAlpha = Math.min(0.20, s.a * tw * 0.25);
          ctx.fillRect(sx - 0.5, s.y - 4, 1, 8);
          ctx.fillRect(sx - 4, s.y - 0.5, 8, 1);
        }
      }
    }
    ctx.restore();

    if (settings.fx) {
      // Subtle scanlines (cached)
      ensureScanlines();
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.drawImage(scanlinesCanvas, 0, 0);
      ctx.restore();
    }

    if (settings.fx) {
      // Level flash
      if (flashTime > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.35 * (flashTime / 0.25);
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }

    if (settings.fx) {
      // Vignette
      ctx.save();
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.8);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.45)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // Subtle film grain (cached, tiled)
    drawFilmGrain(ts);
  }

  function drawParticles() {
    if (particles.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of particles) {
      const t = Math.max(0, Math.min(1, p.life / p.max));
      ctx.globalAlpha = t;
      ctx.fillStyle = p.c;
      ctx.shadowColor = p.c;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawShockwaves() {
    if (!settings.fx || shockwaves.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const s of shockwaves) {
      const t = Math.max(0, Math.min(1, s.life / s.max));
      ctx.globalAlpha = 0.6 * t;
      ctx.strokeStyle = s.c;
      ctx.shadowColor = s.c;
      ctx.shadowBlur = 16;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.12 * t;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 1.03, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMuzzleFlashes() {
    if (muzzleFlashes.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const m of muzzleFlashes) {
      const t = Math.max(0, Math.min(1, m.life / m.max));
      ctx.globalAlpha = 0.9 * t;
      ctx.shadowColor = m.c;
      ctx.shadowBlur = 22;
      ctx.fillStyle = m.c;
      ctx.beginPath();
      ctx.ellipse(m.x, m.y, 5 + 6 * (1 - t), 3 + 3 * (1 - t), 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.22 * t;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.ellipse(m.x, m.y, 2.2 + 2.6 * (1 - t), 1.4 + 1.8 * (1 - t), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  initStars();

  // Fit the game into the available viewport area (no page scroll).
  // Called after graphics globals are initialized (it resets size-dependent caches).
  resizeCanvasToFit();
  window.addEventListener("resize", () => resizeCanvasToFit());

  // Draw once immediately so the canvas isn't blank before Start/wallet.
  function drawBootScreen() {
    try {
      drawBackground(performance.now());
      ctx.save();
      ctx.fillStyle = "rgba(226,232,240,0.92)";
      ctx.font = "700 28px Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("RetroVaders", W / 2, H / 2 - 18);
      ctx.font = "14px Segoe UI, sans-serif";
      ctx.fillStyle = "rgba(138,155,181,0.92)";
      ctx.fillText("Press Start to play", W / 2, H / 2 + 14);
      ctx.restore();
    } catch {
      // ignore
    }
  }

  drawBootScreen();
  setTimeout(() => {
    resizeCanvasToFit();
    drawBootScreen();
  }, 0);

  // Keep an animated start screen running until a session starts.
  let bootAnimating = true;
  function bootLoop(ts) {
    if (!bootAnimating) return;
    if (running) {
      bootAnimating = false;
      return;
    }
    // Animate background elements a bit.
    updateFx(1 / 60);
    drawBootScreen();
    requestAnimationFrame(bootLoop);
  }
  requestAnimationFrame(bootLoop);

  // ---- On-chain UI (no HTML edits required) ----
  const controlsEl = document.querySelector(".controls");
  const pillEl = controlsEl ? controlsEl.querySelector(".pill") : null;

  // Mobile/touch controls (injected)
  if (canvasWrap) {
    canvasWrap.style.position = "relative";
  }

  const isCoarsePointer = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  const touchCapable = !!(isCoarsePointer || IS_TOUCH_DEVICE);
  const mobileControls = document.createElement("div");
  mobileControls.style.position = "absolute";
  mobileControls.style.left = "10px";
  mobileControls.style.right = "10px";
  mobileControls.style.bottom = "calc(10px + env(safe-area-inset-bottom, 0px))";
  mobileControls.style.display = isCoarsePointer ? "flex" : "none";
  mobileControls.style.alignItems = "flex-end";
  mobileControls.style.justifyContent = "space-between";
  mobileControls.style.gap = "12px";
  mobileControls.style.pointerEvents = "none";
  mobileControls.style.userSelect = "none";
  mobileControls.style.webkitUserSelect = "none";
  mobileControls.style.webkitTapHighlightColor = "transparent";

  const touchPad = document.createElement("div");
  touchPad.style.display = "flex";
  touchPad.style.gap = "10px";
  touchPad.style.pointerEvents = "auto";

  function makeTouchBtn(label, sub) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = sub ? `${label}\n${sub}` : label;
    b.style.whiteSpace = "pre-line";
    b.style.padding = "10px 12px";
    b.style.borderRadius = "12px";
    b.style.minWidth = "64px";
    b.style.minHeight = "44px";
    b.style.fontSize = "13px";
    b.style.lineHeight = "1.1";
    b.style.touchAction = "none";
    return b;
  }

  const btnLeft = makeTouchBtn("◀", "Move");
  const btnRight = makeTouchBtn("▶", "Move");
  touchPad.appendChild(btnLeft);
  touchPad.appendChild(btnRight);

  const touchActions = document.createElement("div");
  touchActions.style.display = "flex";
  touchActions.style.gap = "10px";
  touchActions.style.pointerEvents = "auto";

  const btnFire = makeTouchBtn("FIRE", "Shoot");
  btnFire.style.minWidth = "86px";

  const btnP1 = makeTouchBtn("Shield", "1");
  const btnP2 = makeTouchBtn("Rapid", "2");
  const btnP3 = makeTouchBtn("Bomb", "3");

  const btnPauseTouch = makeTouchBtn("Pause", "P");
  btnPauseTouch.style.minWidth = "74px";

  touchActions.appendChild(btnP1);
  touchActions.appendChild(btnP2);
  touchActions.appendChild(btnP3);
  touchActions.appendChild(btnFire);
  touchActions.appendChild(btnPauseTouch);

  mobileControls.appendChild(touchPad);
  mobileControls.appendChild(touchActions);

  if (canvasWrap) canvasWrap.appendChild(mobileControls);

  function touchEnabled() {
    return touchCapable && running && !storeOpen && !settingsOpen && !menuOpen;
  }

  // Touch drag-to-move on the gameplay area (more playable than left/right buttons).
  // Only affects touch/pen pointers; desktop mouse still uses keyboard.
  let touchMoveActive = false;
  let touchMoveX = 0;

  function canvasPointFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    const y = (e.clientY - rect.top) * (H / rect.height);
    return { x, y };
  }

  function bindTouchMove() {
    const down = (e) => {
      if (!touchEnabled()) return;
      if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
      e.preventDefault();
      touchMoveActive = true;
      const p = canvasPointFromEvent(e);
      touchMoveX = p.x;
      canvas.setPointerCapture?.(e.pointerId);
    };
    const move = (e) => {
      if (!touchMoveActive) return;
      if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
      e.preventDefault();
      const p = canvasPointFromEvent(e);
      touchMoveX = p.x;
    };
    const up = (e) => {
      if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
      e.preventDefault();
      touchMoveActive = false;
      canvas.releasePointerCapture?.(e.pointerId);
    };

    canvas.addEventListener("pointerdown", down, { passive: false });
    canvas.addEventListener("pointermove", move, { passive: false });
    canvas.addEventListener("pointerup", up, { passive: false });
    canvas.addEventListener("pointercancel", up, { passive: false });
    canvas.addEventListener("pointerleave", () => {
      touchMoveActive = false;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  function bindHold(btn, keyName) {
    const down = (e) => {
      if (!touchEnabled()) return;
      e.preventDefault();
      keys[keyName] = true;
    };
    const up = (e) => {
      e.preventDefault();
      keys[keyName] = false;
    };
    btn.addEventListener("pointerdown", down, { passive: false });
    btn.addEventListener("pointerup", up, { passive: false });
    btn.addEventListener("pointercancel", up, { passive: false });
    btn.addEventListener("pointerleave", up, { passive: false });
  }

  bindHold(btnLeft, "ArrowLeft");
  bindHold(btnRight, "ArrowRight");
  bindHold(btnFire, " ");

  btnPauseTouch.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    pause();
  }, { passive: false });
  btnP1.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (!touchEnabled()) return;
    void activatePowerUp("shield");
  }, { passive: false });
  btnP2.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (!touchEnabled()) return;
    void activatePowerUp("rapid");
  }, { passive: false });
  btnP3.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (!touchEnabled()) return;
    void activatePowerUp("bomb");
  }, { passive: false });

  function updateMobileControlsVisibility() {
    mobileControls.style.display = touchCapable ? "flex" : "none";
  }
  updateMobileControlsVisibility();
  try {
    const mq = window.matchMedia ? window.matchMedia("(pointer: coarse)") : null;
    if (mq && typeof mq.addEventListener === "function") mq.addEventListener("change", updateMobileControlsVisibility);
  } catch {
    // ignore
  }

  bindTouchMove();

  // Fullscreen: if `.shell` becomes the fullscreen element, ensure our overlay stays inside it.
  document.addEventListener("fullscreenchange", () => {
    try {
      const fsEl = document.fullscreenElement;
      if (!fsEl) return;
      if (overlay && overlay.parentElement !== fsEl && fsEl.classList && fsEl.classList.contains("shell")) {
        const cs = getComputedStyle(fsEl);
        if (cs.position === "static") fsEl.style.position = "relative";
        fsEl.appendChild(overlay);
      }
      if (mobileControls && mobileControls.style) {
        mobileControls.style.zIndex = "20";
      }
    } catch {
      // ignore
    }
  });

  function setPill(text) {
    if (pillEl) pillEl.textContent = text;
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function shortAddr(addr) {
    if (!addr) return "";
    return addr.length > 14 ? `${addr.slice(0, 10)}…${addr.slice(-4)}` : addr;
  }

  const connectBtn = document.createElement("button");
  connectBtn.textContent = "Connect Keplr";
  connectBtn.id = "connect";

  const insertBtn = document.createElement("button");
  insertBtn.textContent = "Insert Coin";
  insertBtn.id = "insert";
  insertBtn.disabled = true;

  const registerBtn = document.createElement("button");
  registerBtn.textContent = "Register RetroVaders";
  registerBtn.id = "register-game";
  registerBtn.disabled = true;
  registerBtn.style.display = "none";

  const creditsPill = document.createElement("span");
  creditsPill.className = "pill";
  creditsPill.textContent = "Credits: — • Tokens: —";

  const settingsBtn = document.createElement("button");
  settingsBtn.textContent = "Settings";
  settingsBtn.id = "settings";

  const menuBtn = document.createElement("button");
  menuBtn.textContent = "Home";
  menuBtn.id = "home";

  if (controlsEl) {
    controlsEl.appendChild(connectBtn);
    controlsEl.appendChild(insertBtn);
    controlsEl.appendChild(registerBtn);
    controlsEl.appendChild(menuBtn);
    controlsEl.appendChild(settingsBtn);
    controlsEl.appendChild(creditsPill);
  }

  const aside = document.querySelector("aside");
  const lbWrap = document.createElement("div");
  lbWrap.className = "legend";
  lbWrap.innerHTML = `
    <h4>Leaderboard</h4>
    <div id="leaderboard" style="font-size:13px;color:var(--text);line-height:1.55"></div>
  `;
  if (aside) aside.appendChild(lbWrap);

  const lbEl = lbWrap.querySelector("#leaderboard");

  const powerWrap = document.createElement("div");
  powerWrap.className = "legend";
  powerWrap.innerHTML = `
    <h4>Powerups (Arcade Tokens)</h4>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
      <button id="pu-shield" title="Shield: 5s invulnerability">Shield (1)</button>
      <button id="pu-rapid" title="Rapid Fire: faster shots for 8s">Rapid (2)</button>
      <button id="pu-bomb" title="Bomb: clears the wave">Bomb (3)</button>
      <button id="pu-life" title="Extra Life: +1 life instantly">Life (4)</button>
      <button id="pu-mult" title="Score Boost: 2x points for 12s">2x Score (5)</button>
      <button id="pu-triple" title="Triple Shot: spread fire for 10s">Triple (6)</button>
      <button id="pu-pierce" title="Piercing Shots: bullets pass through 2 aliens for 10s">Pierce (7)</button>
      <button id="pu-slow" title="Time Slow: enemies + enemy bullets slowed for 8s">Slow (8)</button>
      <button id="pu-magnet" title="Magnet: pulls powerup drops toward you for 12s">Magnet (9)</button>
    </div>
    <div id="pu-meta" style="margin-top:8px;font-size:13px;color:var(--muted)">Connect Keplr to use tokens.</div>
    <div id="pu-active" style="margin-top:6px;font-size:13px;color:var(--text)"></div>
  `;
  if (aside) aside.appendChild(powerWrap);
  const puShieldBtn = powerWrap.querySelector("#pu-shield");
  const puRapidBtn = powerWrap.querySelector("#pu-rapid");
  const puBombBtn = powerWrap.querySelector("#pu-bomb");
  const puLifeBtn = powerWrap.querySelector("#pu-life");
  const puMultBtn = powerWrap.querySelector("#pu-mult");
  const puTripleBtn = powerWrap.querySelector("#pu-triple");
  const puPierceBtn = powerWrap.querySelector("#pu-pierce");
  const puSlowBtn = powerWrap.querySelector("#pu-slow");
  const puMagnetBtn = powerWrap.querySelector("#pu-magnet");
  const puMetaEl = powerWrap.querySelector("#pu-meta");
  const puActiveEl = powerWrap.querySelector("#pu-active");

  const achWrap = document.createElement("div");
  achWrap.className = "legend";
  achWrap.innerHTML = `
    <h4>Achievements</h4>
    <div id="achievements" style="font-size:13px;color:var(--text);line-height:1.55"></div>
  `;
  if (aside) aside.appendChild(achWrap);
  achievementsEl = achWrap.querySelector("#achievements");
  loadAchievements();
  renderAchievements();

  // Fullscreen overlays (store + settings)
  // NOTE: When `.shell` is fullscreen, DOM outside it is not rendered.
  // So the overlay must live inside the fullscreen element.
  const overlay = document.createElement("div");
  overlay.style.position = "absolute";
  overlay.style.inset = "0";
  overlay.style.display = "none";
  overlay.style.alignItems = "flex-start";
  overlay.style.justifyContent = "center";
  overlay.style.background = "rgba(0,0,0,0.55)";
  overlay.style.zIndex = "9999";
  overlay.style.overflowY = "auto";
  overlay.style.padding = "24px 0";

  const overlayCard = document.createElement("div");
  overlayCard.style.width = "min(520px, 92vw)";
  overlayCard.style.maxHeight = "calc(100vh - 48px)";
  overlayCard.style.overflowY = "auto";
  overlayCard.style.background = "var(--panel)";
  overlayCard.style.border = "1px solid #1b2436";
  overlayCard.style.borderRadius = "14px";
  overlayCard.style.boxShadow = "0 25px 80px rgba(0,0,0,0.55)";
  overlayCard.style.padding = "16px";

  overlay.appendChild(overlayCard);
  const shellEl = document.querySelector(".shell") || document.body;
  try {
    if (shellEl && shellEl !== document.body) {
      const cs = getComputedStyle(shellEl);
      if (cs.position === "static") shellEl.style.position = "relative";
      shellEl.appendChild(overlay);
    } else {
      document.body.appendChild(overlay);
    }
  } catch {
    document.body.appendChild(overlay);
  }

  const menuView = document.createElement("div");
  menuView.style.display = "none";
  menuView.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
      <div>
        <div style="font-weight:900;font-size:18px;letter-spacing:0.2px">RetroVaders</div>
        <div style="margin-top:4px;font-size:13px;color:var(--muted)">Main screen</div>
      </div>
      <button id="menu-close" title="Close">Close</button>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
      <button id="tab-leaderboards" title="Top scores + filtered players">Leaderboards</button>
      <button id="tab-trophies" title="On-chain trophies">Trophies</button>
      <button id="tab-stats" title="Your stats">Stats</button>
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
        <div style="font-weight:800;font-size:16px;letter-spacing:0.2px">Store</div>
        <div id="store-sub" style="margin-top:4px;font-size:13px;color:var(--muted)">Between waves: spend Arcade Tokens on powerups.</div>
      </div>
      <button id="store-close" title="Close">Close</button>
    </div>
    <div id="store-meta" style="margin-top:10px;font-size:13px;color:var(--text)"></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
      <button id="buy-shield" title="Adds 1 Shield use (5s invulnerability)">Buy Shield (x${powerupPriceUnits.shield})</button>
      <button id="buy-rapid" title="Adds 1 Rapid use (8s faster fire)">Buy Rapid (x${powerupPriceUnits.rapid})</button>
      <button id="buy-bomb" title="Adds 1 Bomb use (clears a wave)">Buy Bomb (x${powerupPriceUnits.bomb})</button>
      <button id="buy-life" title="Adds 1 Extra Life use (+1 life instantly)">Buy Life (x${powerupPriceUnits.life})</button>
      <button id="buy-mult" title="Adds 1 Score Boost use (2x for 12s)">Buy 2x Score (x${powerupPriceUnits.mult})</button>
      <button id="buy-triple" title="Adds 1 Triple Shot use (spread for 10s)">Buy Triple (x${powerupPriceUnits.triple})</button>
      <button id="buy-pierce" title="Adds 1 Piercing Shots use (10s)">Buy Pierce (x${powerupPriceUnits.pierce})</button>
      <button id="buy-slow" title="Adds 1 Time Slow use (8s)">Buy Slow (x${powerupPriceUnits.slow})</button>
      <button id="buy-magnet" title="Adds 1 Magnet use (12s)">Buy Magnet (x${powerupPriceUnits.magnet})</button>
      <button id="buy-cont" title="Adds 1 Continue token (auto-triggers at 0 lives; restores 3 lives)">Buy Continue (x${powerupPriceUnits.cont})</button>
    </div>
    <div style="margin-top:12px;font-size:13px;color:var(--muted)">Tip: powerups you buy show up as uses on the right panel.</div>
    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px">
      <button id="store-continue">Continue</button>
    </div>
  `;

  const settingsView = document.createElement("div");
  settingsView.style.display = "none";
  settingsView.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
      <div>
        <div style="font-weight:800;font-size:16px;letter-spacing:0.2px">Settings</div>
        <div style="margin-top:4px;font-size:13px;color:var(--muted)">Applies instantly.</div>
      </div>
      <button id="settings-close" title="Close">Close</button>
    </div>
    <label style="display:flex;align-items:center;gap:10px;margin-top:14px;font-size:14px;color:var(--text)">
      <input id="set-shake" type="checkbox" checked /> Screen shake
    </label>
    <label style="display:flex;align-items:center;gap:10px;margin-top:10px;font-size:14px;color:var(--text)">
      <input id="set-fx" type="checkbox" checked /> Visual FX (particles/scanlines/flash)
    </label>
    <label style="display:flex;align-items:center;gap:10px;margin-top:10px;font-size:14px;color:var(--text)">
      <input id="set-sound" type="checkbox" checked /> Sound FX
    </label>
    <label style="display:flex;align-items:center;gap:10px;margin-top:10px;font-size:14px;color:var(--text)">
      <input id="set-music" type="checkbox" checked /> Music
    </label>
    <div style="margin-top:12px;font-size:14px;color:var(--text)">
      <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Master Volume</div>
      <input id="set-vol" type="range" min="0" max="125" value="95" style="width:100%" />
      <div id="set-vol-hint" style="margin-top:6px;font-size:12px;color:var(--muted)"></div>
    </div>
    <div style="margin-top:12px;font-size:14px;color:var(--text)">
      <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Difficulty (affects multipliers + enemy aggression)</div>
      <select id="set-difficulty" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid #1b2436;background:var(--panel);color:var(--text);font-weight:700">
        <option value="1">Easy</option>
        <option value="2" selected>Normal</option>
        <option value="3">Hard</option>
        <option value="4">Nightmare</option>
      </select>
      <div id="set-diff-hint" style="margin-top:6px;font-size:12px;color:var(--muted)"></div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
      <button id="settings-done">Done</button>
    </div>
  `;

  const trophyView = document.createElement("div");
  trophyView.style.display = "none";
  trophyView.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
      <div>
        <div style="font-weight:900;font-size:18px;letter-spacing:0.2px">Trophy Unlocked</div>
        <div style="margin-top:4px;font-size:13px;color:var(--muted)">Your on-chain achievements were claimed.</div>
      </div>
      <button id="trophy-close" title="Back">Back</button>
    </div>
    <div id="trophy-body" style="margin-top:12px;font-size:13px;color:var(--text);line-height:1.55"></div>
    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px">
      <button id="trophy-view" title="Go to trophies tab">View Trophies</button>
      <button id="trophy-play">Play</button>
    </div>
  `;

  overlayCard.appendChild(menuView);
  overlayCard.appendChild(storeView);
  overlayCard.appendChild(settingsView);
  overlayCard.appendChild(trophyView);

  const menuBodyEl = menuView.querySelector("#menu-body");
  const menuCloseBtn = menuView.querySelector("#menu-close");
  const menuPlayBtn = menuView.querySelector("#menu-play");
  const tabLeaderboardsBtn = menuView.querySelector("#tab-leaderboards");
  const tabTrophiesBtn = menuView.querySelector("#tab-trophies");
  const tabStatsBtn = menuView.querySelector("#tab-stats");
  const tabDetailsBtn = menuView.querySelector("#tab-details");
  const tabHelpBtn = menuView.querySelector("#tab-help");

  const trophyBodyEl = trophyView.querySelector("#trophy-body");
  const trophyCloseBtn = trophyView.querySelector("#trophy-close");
  const trophyViewBtn = trophyView.querySelector("#trophy-view");
  const trophyPlayBtn = trophyView.querySelector("#trophy-play");

  const storeMetaEl = storeView.querySelector("#store-meta");
  const buyShieldBtn = storeView.querySelector("#buy-shield");
  const buyRapidBtn = storeView.querySelector("#buy-rapid");
  const buyBombBtn = storeView.querySelector("#buy-bomb");
  const buyLifeBtn = storeView.querySelector("#buy-life");
  const buyMultBtn = storeView.querySelector("#buy-mult");
  const buyTripleBtn = storeView.querySelector("#buy-triple");
  const buyPierceBtn = storeView.querySelector("#buy-pierce");
  const buySlowBtn = storeView.querySelector("#buy-slow");
  const buyMagnetBtn = storeView.querySelector("#buy-magnet");
  const buyContBtn = storeView.querySelector("#buy-cont");
  const storeCloseBtn = storeView.querySelector("#store-close");
  const storeContinueBtn = storeView.querySelector("#store-continue");

  const setShake = settingsView.querySelector("#set-shake");
  const setFx = settingsView.querySelector("#set-fx");
  const setSound = settingsView.querySelector("#set-sound");
  const setMusic = settingsView.querySelector("#set-music");
  const setVol = settingsView.querySelector("#set-vol");
  const setVolHint = settingsView.querySelector("#set-vol-hint");
  const setDifficulty = settingsView.querySelector("#set-difficulty");
  const setDiffHint = settingsView.querySelector("#set-diff-hint");
  const settingsCloseBtn = settingsView.querySelector("#settings-close");
  const settingsDoneBtn = settingsView.querySelector("#settings-done");

  // Apply persisted settings to the UI once controls exist.
  if (setShake) setShake.checked = !!settings.shake;
  if (setFx) setFx.checked = !!settings.fx;
  if (setSound) setSound.checked = !!settings.sound;
  if (setMusic) setMusic.checked = !!settings.music;
  if (setVol) setVol.value = String(Math.round(Math.max(0, Math.min(125, masterVol * 100))));
  const renderVolHint = () => {
    if (!setVolHint) return;
    setVolHint.textContent = `${Math.round(masterVol * 100)}%`;
  };
  renderVolHint();

  const onAudioSettingChange = () => {
    settings.sound = !!(setSound && setSound.checked);
    settings.music = !!(setMusic && setMusic.checked);
    if (setVol) {
      const v = Number(setVol.value);
      if (Number.isFinite(v)) masterVol = Math.max(0, Math.min(1.25, v / 100));
    }
    writeAudioPrefs();
    resumeAudioFromGesture();

    if (masterGain) {
      masterGain.gain.value = Math.max(0, Math.min(1.25, masterVol));
    }
    if (musicBusGain) {
      // musicBusGain is managed by ducking in the music timer; keep it within a sane range on updates.
      const v = Math.max(0, Math.min(1.25, masterVol));
      musicBusGain.gain.value = Math.min(0.80, Math.max(0.20, 0.62 * v));
    }
    if (settings.music) startMusic();
    else stopMusic();
    renderVolHint();
  };

  if (setSound) setSound.addEventListener("change", onAudioSettingChange);
  if (setMusic) setMusic.addEventListener("change", onAudioSettingChange);
  if (setVol) setVol.addEventListener("input", onAudioSettingChange);

  function showOverlay(view) {
    overlay.style.display = "flex";
    menuView.style.display = view === "menu" ? "block" : "none";
    storeView.style.display = view === "store" ? "block" : "none";
    settingsView.style.display = view === "settings" ? "block" : "none";
    trophyView.style.display = view === "trophy" ? "block" : "none";
  }

  function hideOverlay() {
    overlay.style.display = "none";
    menuView.style.display = "none";
    storeView.style.display = "none";
    settingsView.style.display = "none";
    trophyView.style.display = "none";
  }

  function localStatsStorageKey() {
    return `rc1_arcade_localstats_${GAME_ID}_${walletAddr || "anon"}`;
  }

  let localStats = { runs: 0, bestScore: 0, bestLevel: 0, totalKills: 0 };

  function loadLocalStats() {
    try {
      const raw = localStorage.getItem(localStatsStorageKey());
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== "object") return;
      localStats = {
        runs: Math.max(0, Math.floor(Number(parsed.runs || 0))),
        bestScore: Math.max(0, Math.floor(Number(parsed.bestScore || 0))),
        bestLevel: Math.max(0, Math.floor(Number(parsed.bestLevel || 0))),
        totalKills: Math.max(0, Math.floor(Number(parsed.totalKills || 0))),
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
    saveLocalStats();
  }

  function recordRunEnd({ finalScore, finalLevel, kills } = {}) {
    const s = Math.max(0, Math.floor(Number(finalScore || 0)));
    const l = Math.max(0, Math.floor(Number(finalLevel || 0)));
    const k = Math.max(0, Math.floor(Number(kills || 0)));
    localStats.bestScore = Math.max(localStats.bestScore || 0, s);
    localStats.bestLevel = Math.max(localStats.bestLevel || 0, l);
    localStats.totalKills = Math.max(0, (localStats.totalKills || 0) + k);
    saveLocalStats();
  }

  function setMenuTab(tab) {
    menuTab = tab;
    const is = (t) => menuTab === t;
    const styleTab = (btn, on) => {
      if (!btn) return;
      btn.style.borderColor = on ? "var(--accent)" : "#1b2436";
    };
    styleTab(tabLeaderboardsBtn, is("leaderboards"));
    styleTab(tabTrophiesBtn, is("trophies"));
    styleTab(tabStatsBtn, is("stats"));
    styleTab(tabDetailsBtn, is("details"));
    styleTab(tabHelpBtn, is("help"));
    void renderMenuBody();
  }

  async function fetchGameDetails() {
    try {
      return await apiGetJson(`/arcade/v1/games/${encodeURIComponent(GAME_ID)}`);
    } catch {
      return null;
    }
  }

  async function fetchGlobalLeaderboard({ limit = 50 } = {}) {
    const data = await apiGetJson(`/arcade/v1/leaderboard?pagination.limit=${encodeURIComponent(String(limit))}`);
    return data?.entries || [];
  }

  async function fetchRecentSessions({ limit = 200 } = {}) {
    const data = await apiGetJson(`/arcade/v1/sessions?limit=${encodeURIComponent(String(limit))}`);
    return data?.sessions || [];
  }

  function playersWhoPlayedThisGameFromSessions(sessions) {
    const set = new Set();
    if (!Array.isArray(sessions)) return set;
    for (const s of sessions) {
      if (!s) continue;
      const gid = s.game_id || s.gameId;
      if (gid !== GAME_ID) continue;
      const p = s.player || s.creator || s.address;
      if (typeof p === "string" && p) set.add(p.toLowerCase());
    }
    return set;
  }

  function renderMenuLeaderboards({ scores, filteredPlayers }) {
    if (!menuBodyEl) return;
    const scoreLines = Array.isArray(scores) && scores.length
      ? scores.slice(0, 10).map((e, i) => {
          const rank = e.rank ?? (i + 1);
          const p = e.player || e.address || "";
          const s = e.score ?? e.best_score ?? e.total_score ?? 0;
          const initials = (e.initials || "").trim();
          const tag = initials ? ` (${initials.toUpperCase()})` : "";
          return `${rank}. ${shortAddr(p)}${tag} — ${s}`;
        })
      : ["No scores yet."];

    const playerLines = Array.isArray(filteredPlayers) && filteredPlayers.length
      ? filteredPlayers.slice(0, 10).map((e, i) => {
          const rank = i + 1;
          const p = e.player || e.address || "";
          const total = e.total_score ?? e.totalScore ?? 0;
          const played = e.games_played ?? e.gamesPlayed ?? "?";
          const ach = e.achievements_unlocked ?? e.achievementsUnlocked;
          const achText = ach != null ? ` • ach ${ach}` : "";
          return `${rank}. ${shortAddr(p)} — total ${total} • games ${played}${achText}`;
        })
      : ["No RetroVaders players found yet."];

    menuBodyEl.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr;gap:12px">
        <div style="padding:12px;border:1px solid #1b2436;border-radius:12px;background:rgba(0,0,0,0.15)">
          <div style="font-weight:900;letter-spacing:0.2px">Top Scores (RetroVaders)</div>
          <div style="margin-top:8px;white-space:pre-line">${scoreLines.join("\n")}</div>
        </div>
        <div style="padding:12px;border:1px solid #1b2436;border-radius:12px;background:rgba(0,0,0,0.15)">
          <div style="font-weight:900;letter-spacing:0.2px">Top Players (filtered to RetroVaders)</div>
          <div style="margin-top:6px;color:var(--muted)">Filtered from the global leaderboard by players with recent RetroVaders sessions.</div>
          <div style="margin-top:8px;white-space:pre-line">${playerLines.join("\n")}</div>
        </div>
      </div>
    `;
  }

  function renderMenuStats({ chainStats, claimedOnchain, claimableOnchain }) {
    if (!menuBodyEl) return;
    const spent = achievementsState?.stats?.tokensSpent ?? "0";
    const addr = walletAddr ? shortAddr(walletAddr) : "Not connected";

    const chain = chainStats && typeof chainStats === "object" ? chainStats : null;
    const totalScore = chain?.total_score ?? chain?.totalScore;
    const gamesPlayed = chain?.games_played ?? chain?.gamesPlayed;
    const achievementsUnlocked = chain?.achievements_unlocked ?? chain?.achievementsUnlocked;
    const tournamentsWon = chain?.tournaments_won ?? chain?.tournamentsWon;
    const arcadeTokens = chain?.arcade_tokens ?? chain?.arcadeTokens;

    const chainLines = chain
      ? [
          totalScore != null ? `Total score: ${totalScore}` : null,
          gamesPlayed != null ? `Games played: ${gamesPlayed}` : null,
          achievementsUnlocked != null ? `Achievements unlocked: ${achievementsUnlocked}` : null,
          tournamentsWon != null ? `Tournaments won: ${tournamentsWon}` : null,
          arcadeTokens != null ? `Arcade tokens: ${arcadeTokens}` : null,
        ].filter(Boolean)
      : [];

    const claimedSet = new Set(
      Array.isArray(claimedOnchain)
        ? claimedOnchain
            .map((a) => a?.achievement_id || a?.achievementId)
            .filter((x) => typeof x === "string" && x)
        : []
    );
    const claimableSet = new Set(Array.isArray(claimableOnchain) ? claimableOnchain.filter(Boolean) : []);

    const achLines = ONCHAIN_ACHIEVEMENT_IDS.map((id) => {
      if (!walletAddr) return `[UNKNOWN] ${id}`;
      const status = claimedSet.has(id) ? "CLAIMED" : claimableSet.has(id) ? "CLAIMABLE" : "LOCKED";
      return `[${status}] ${id}`;
    });
    const claimableList = Array.isArray(claimableOnchain) ? claimableOnchain.filter(Boolean) : [];
    const canClaim = walletAddr && claimableList.length > 0;

    menuBodyEl.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr;gap:12px">
        <div style="padding:12px;border:1px solid #1b2436;border-radius:12px;background:rgba(0,0,0,0.15)">
          <div style="font-weight:900;letter-spacing:0.2px">Local Stats</div>
          <div style="margin-top:6px;color:var(--muted)">Profile: ${addr}</div>
          <div style="margin-top:8px">
            <div>Runs: <span style="font-weight:800">${localStats.runs || 0}</span></div>
            <div>Best score: <span style="font-weight:800">${localStats.bestScore || 0}</span></div>
            <div>Best level: <span style="font-weight:800">${localStats.bestLevel || 0}</span></div>
            <div>Total kills: <span style="font-weight:800">${localStats.totalKills || 0}</span></div>
            <div>Tokens spent (powerups): <span style="font-weight:800">${spent}</span></div>
          </div>
        </div>
        <div style="padding:12px;border:1px solid #1b2436;border-radius:12px;background:rgba(0,0,0,0.15)">
          <div style="font-weight:900;letter-spacing:0.2px">On-chain Stats</div>
          <div style="margin-top:6px;color:var(--muted)">${walletAddr ? "From /arcade/v1/stats/{player}" : "Connect Keplr to load."}</div>
          <div style="margin-top:8px;white-space:pre-line">${chainLines.length ? chainLines.join("\n") : (walletAddr ? "No stats available." : "—")}</div>
        </div>
        <div style="padding:12px;border:1px solid #1b2436;border-radius:12px;background:rgba(0,0,0,0.15)">
          <div style="font-weight:900;letter-spacing:0.2px">On-chain Achievements</div>
          <div style="margin-top:6px;color:var(--muted)">${walletAddr ? "Claiming is what updates leaderboard achievement counts." : "Listed below. Connect Keplr to show CLAIMED/CLAIMABLE status."}</div>
          ${walletAddr ? `<div style=\"margin-top:8px;color:var(--muted)\">Claimed: ${claimedSet.size} • Claimable now: ${claimableList.length} • Total: ${ONCHAIN_ACHIEVEMENT_IDS.length}</div>` : `<div style=\"margin-top:8px;color:var(--muted)\">Total: ${ONCHAIN_ACHIEVEMENT_IDS.length}</div>`}
          <div style="margin-top:8px;white-space:pre-line">${achLines.join("\n")}</div>
          ${canClaim ? `<div style=\"margin-top:10px\"><button id=\"onchain-claim-btn\" class=\"btn\">Claim ${claimableList.length} achievement${claimableList.length === 1 ? "" : "s"}</button></div>` : ""}
        </div>
      </div>
    `;

    const claimBtn = menuBodyEl.querySelector("#onchain-claim-btn");
    if (claimBtn) {
      claimBtn.addEventListener("click", async () => {
        try {
          claimBtn.disabled = true;
          const res = await claimOnchainAchievements(claimableList);
          const txhash = res?.tx_response?.txhash;
          setStatus(txhash ? `Claimed achievements. Tx: ${txhash}` : "Claimed achievements.");
          openTrophyCelebration({ achievementIds: claimableList, txhash });
          await refreshLeaderboard();
          void renderMenuBody();
        } catch (e) {
          setStatus(e?.message || String(e));
        } finally {
          claimBtn.disabled = false;
        }
      });
    }
  }

  function renderMenuTrophies({ claimedOnchain, claimableOnchain }) {
    if (!menuBodyEl) return;
    const claimedSet = new Set(
      Array.isArray(claimedOnchain)
        ? claimedOnchain
            .map((a) => a?.achievement_id || a?.achievementId)
            .filter((x) => typeof x === "string" && x)
        : []
    );
    const claimableList = Array.isArray(claimableOnchain) ? claimableOnchain.filter(Boolean) : [];
    const claimableSet = new Set(claimableList);
    const canClaim = walletAddr && claimableList.length > 0;

    const cards = ONCHAIN_ACHIEVEMENT_IDS.map((id) => {
      const meta = ONCHAIN_ACHIEVEMENTS_META[id] || null;
      const title = meta?.title || id;
      const reward = meta?.rewardTokens != null ? `${meta.rewardTokens} tokens` : "tokens";
      const detail = meta?.detail || "";

      const status = !walletAddr ? "UNKNOWN" : claimedSet.has(id) ? "CLAIMED" : claimableSet.has(id) ? "CLAIMABLE" : "LOCKED";
      const badgeBorder = status === "CLAIMABLE" ? "var(--accent)" : "#1b2436";
      const badgeText = status === "CLAIMABLE" ? "var(--accent)" : "var(--muted)";
      const cardBorder = status === "CLAIMED" ? "var(--accent)" : "#1b2436";

      return `
        <div style="padding:12px;border:1px solid ${cardBorder};border-radius:12px;background:rgba(0,0,0,0.15)">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
            <div style="font-weight:900;letter-spacing:0.2px">${escapeHtml(title)}</div>
            <div style="padding:2px 8px;border-radius:999px;border:1px solid ${badgeBorder};color:${badgeText};font-weight:900;font-size:11px">${status}</div>
          </div>
          <div style="margin-top:6px;color:var(--muted);font-size:12px">ID: ${escapeHtml(id)} • Reward: ${escapeHtml(reward)}</div>
          ${detail ? `<div style=\"margin-top:8px\">${escapeHtml(detail)}</div>` : ""}
        </div>
      `;
    }).join("\n");

    menuBodyEl.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr;gap:12px">
        <div style="padding:12px;border:1px solid #1b2436;border-radius:12px;background:rgba(0,0,0,0.15)">
          <div style="font-weight:900;letter-spacing:0.2px">Trophies</div>
          <div style="margin-top:6px;color:var(--muted)">${walletAddr ? "On-chain trophy status for your wallet." : "Connect Keplr to show CLAIMED/CLAIMABLE status."}</div>
          <div style="margin-top:8px;color:var(--muted)">Claimed: ${walletAddr ? claimedSet.size : "—"} • Claimable now: ${walletAddr ? claimableList.length : "—"} • Total: ${ONCHAIN_ACHIEVEMENT_IDS.length}</div>
          ${canClaim ? `<div style=\"margin-top:10px\"><button id=\"trophies-claim-btn\" class=\"btn\">Claim ${claimableList.length} achievement${claimableList.length === 1 ? "" : "s"}</button></div>` : ""}
        </div>
        <div style="display:grid;grid-template-columns:1fr;gap:10px">${cards}</div>
      </div>
    `;

    const claimBtn = menuBodyEl.querySelector("#trophies-claim-btn");
    if (claimBtn) {
      claimBtn.addEventListener("click", async () => {
        try {
          claimBtn.disabled = true;
          const res = await claimOnchainAchievements(claimableList);
          const txhash = res?.tx_response?.txhash;
          setStatus(txhash ? `Claimed achievements. Tx: ${txhash}` : "Claimed achievements.");
          openTrophyCelebration({ achievementIds: claimableList, txhash });
          await refreshLeaderboard();
          void renderMenuBody();
        } catch (e) {
          setStatus(e?.message || String(e));
        } finally {
          claimBtn.disabled = false;
        }
      });
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function openTrophyCelebration({ achievementIds, txhash } = {}) {
    const ids = Array.isArray(achievementIds) ? achievementIds.filter((x) => typeof x === "string" && x) : [];
    if (!trophyBodyEl) return;

    const lines = ids.length
      ? ids.map((id) => {
          const meta = ONCHAIN_ACHIEVEMENTS_META[id] || null;
          const title = meta?.title || id;
          const reward = meta?.rewardTokens != null ? `${meta.rewardTokens} arcade tokens` : "arcade tokens";
          return `• ${escapeHtml(title)} (${escapeHtml(id)}) — ${escapeHtml(reward)}`;
        })
      : ["• Achievements claimed."];

    trophyBodyEl.innerHTML = `
      <div style="padding:12px;border:1px solid var(--accent);border-radius:12px;background:rgba(0,0,0,0.15)">
        <div style="font-weight:900;letter-spacing:0.2px">Celebration</div>
        <div style="margin-top:6px;color:var(--muted)">Nice work — trophies are now recorded on-chain.</div>
        ${txhash ? `<div style=\"margin-top:8px;color:var(--muted)\">Tx: ${escapeHtml(txhash)}</div>` : ""}
        <div style="margin-top:10px;white-space:pre-line">${lines.join("\n")}</div>
      </div>
    `;

    trophyOpen = true;
    if (running) paused = true;
    showOverlay("trophy");
  }

  function closeTrophyCelebration({ goToTrophiesTab = false } = {}) {
    trophyOpen = false;
    if (goToTrophiesTab) {
      menuOpen = true;
      if (running) paused = true;
      showOverlay("menu");
      setMenuTab("trophies");
      return;
    }

    if (menuOpen) {
      showOverlay("menu");
      setMenuTab(menuTab || "leaderboards");
      return;
    }

    hideOverlay();
    if (running) paused = false;
  }

  function renderMenuHelp() {
    if (!menuBodyEl) return;
    menuBodyEl.innerHTML = `
      <div style="padding:12px;border:1px solid #1b2436;border-radius:12px;background:rgba(0,0,0,0.15)">
        <div style="font-weight:900;letter-spacing:0.2px">Help</div>
        <div style="margin-top:8px">
          <div style="font-weight:800">Controls</div>
          <div style="color:var(--muted)">Move: Left/Right • Shoot: Space • Pause: P • Powerups: 1-9</div>
          <div style="margin-top:10px;font-weight:800">On-chain</div>
          <div style="color:var(--muted)">Connect Keplr → Insert Coin → Play. Sessions and final score submit on-chain.</div>
          <div style="margin-top:10px;font-weight:800">Powerups</div>
          <div style="color:var(--muted)">Earn Arcade Tokens from runs, then buy powerups between waves (or use stored inventory). Continue tokens auto-trigger at 0 lives and restore 3 lives.</div>
        </div>
      </div>
    `;
  }

  async function renderMenuDetails() {
    if (!menuBodyEl) return;
    const game = await fetchGameDetails();
    const g = game?.game || game;
    const title = g?.name || "RetroVaders";
    const desc = g?.description || "";
    const dev = g?.developer || "";
    const creditsPerPlay = g?.credits_per_play ?? g?.creditsPerPlay;
    const active = g?.active;

    const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    menuBodyEl.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr;gap:12px">
        <div style="padding:12px;border:1px solid #1b2436;border-radius:12px;background:rgba(0,0,0,0.15)">
          <div style="font-weight:900;letter-spacing:0.2px">Game</div>
          <div style="margin-top:8px">
            <div><span style="font-weight:800">Name:</span> ${esc(title)}</div>
            ${desc ? `<div style=\"margin-top:6px;color:var(--muted)\">${esc(desc)}</div>` : ""}
            ${creditsPerPlay != null ? `<div style=\"margin-top:8px\"><span style=\"font-weight:800\">Credits/play:</span> ${esc(creditsPerPlay)}</div>` : ""}
            ${dev ? `<div style=\"margin-top:6px\"><span style=\"font-weight:800\">Developer:</span> ${esc(shortAddr(dev))}</div>` : ""}
            ${active != null ? `<div style=\"margin-top:6px\"><span style=\"font-weight:800\">Active:</span> ${esc(active)}</div>` : ""}
          </div>
        </div>
        <div style="padding:12px;border:1px solid #1b2436;border-radius:12px;background:rgba(0,0,0,0.15)">
          <div style="font-weight:900;letter-spacing:0.2px">Client</div>
          <div style="margin-top:8px;color:var(--muted)">GAME_ID: ${esc(GAME_ID)}</div>
          <div style="margin-top:4px;color:var(--muted)">REST base: ${esc(API_BASE)}</div>
          <div style="margin-top:4px;color:var(--muted)">Chain ID: ${esc(chainId || "(auto-detect)")}</div>
        </div>
      </div>
    `;
  }

  async function renderMenuBody() {
    if (!menuBodyEl) return;
    if (!menuOpen) return;

    if (menuTab === "help") {
      renderMenuHelp();
      return;
    }

    if (menuTab === "details") {
      menuBodyEl.textContent = "Loading...";
      await renderMenuDetails();
      return;
    }

    if (menuTab === "stats") {
      menuBodyEl.textContent = walletAddr ? "Loading..." : "Connect Keplr to load on-chain stats.";
      let chainStats = null;
      let claimedOnchain = [];
      let claimableOnchain = [];
      if (walletAddr) {
        try {
          const data = await apiGetJson(`/arcade/v1/stats/${encodeURIComponent(walletAddr)}`);
          chainStats = data?.stats || data;
        } catch {
          chainStats = null;
        }

        try {
          [claimedOnchain, claimableOnchain] = await Promise.all([
            fetchAllClaimedAchievements(walletAddr),
            computeClaimableOnchainAchievements(),
          ]);
        } catch {
          claimedOnchain = [];
          claimableOnchain = [];
        }
      }
      renderMenuStats({ chainStats, claimedOnchain, claimableOnchain });
      return;
    }

    if (menuTab === "trophies") {
      menuBodyEl.textContent = walletAddr ? "Loading trophies..." : "Trophies (connect Keplr to load claim status).";
      let claimedOnchain = [];
      let claimableOnchain = [];
      if (walletAddr) {
        try {
          [claimedOnchain, claimableOnchain] = await Promise.all([
            fetchAllClaimedAchievements(walletAddr),
            computeClaimableOnchainAchievements(),
          ]);
        } catch {
          claimedOnchain = [];
          claimableOnchain = [];
        }
      }
      renderMenuTrophies({ claimedOnchain, claimableOnchain });
      return;
    }

    // leaderboards
    menuBodyEl.textContent = "Loading leaderboards...";
    try {
      const [scores, sessions, globalLb] = await Promise.all([
        fetchHighScores(),
        fetchRecentSessions({ limit: 300 }),
        fetchGlobalLeaderboard({ limit: 100 }),
      ]);
      const players = playersWhoPlayedThisGameFromSessions(sessions);
      const filteredPlayers = Array.isArray(globalLb)
        ? globalLb.filter((e) => players.has(String(e?.player || "").toLowerCase()))
        : [];
      renderMenuLeaderboards({ scores, filteredPlayers });
    } catch (e) {
      menuBodyEl.textContent = "Leaderboards unavailable.";
      console.warn("menu leaderboard fetch failed", e);
    }
  }

  function openMenu() {
    if (storeOpen || settingsOpen) return;
    menuOpen = true;
    menuWasPaused = paused;
    if (running) paused = true;
    showOverlay("menu");
    setMenuTab(menuTab || "leaderboards");
  }

  function closeMenu() {
    menuOpen = false;
    hideOverlay();
    if (running) paused = menuWasPaused;
    sfx("ui");
  }

  if (menuBtn) {
    menuBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (menuOpen) return;
      openMenu();
    });

  if (menuCloseBtn) {
    menuCloseBtn.addEventListener("click", (e) => {
      e.preventDefault();
      resumeAudioFromGesture();
      sfx("ui");
      closeMenu();
    });
  }

  if (menuPlayBtn) {
    menuPlayBtn.addEventListener("click", (e) => {
      e.preventDefault();
      resumeAudioFromGesture();
      sfx("ui");
      hideOverlay();
      menuOpen = false;
      if (running) paused = menuWasPaused;
    });
  }

  if (settingsCloseBtn) {
    settingsCloseBtn.addEventListener("click", (e) => {
      e.preventDefault();
      resumeAudioFromGesture();
      sfx("ui");
    });
  }

  if (settingsDoneBtn) {
    settingsDoneBtn.addEventListener("click", (e) => {
      e.preventDefault();
      resumeAudioFromGesture();
      sfx("ui");
    });
  }

  if (storeCloseBtn) {
    storeCloseBtn.addEventListener("click", (e) => {
      e.preventDefault();
      resumeAudioFromGesture();
      sfx("ui");
    });
  }

  if (storeContinueBtn) {
    storeContinueBtn.addEventListener("click", (e) => {
      e.preventDefault();
      resumeAudioFromGesture();
      sfx("ui");
    });
  }

  if (trophyCloseBtn) {
    trophyCloseBtn.addEventListener("click", (e) => {
      e.preventDefault();
      resumeAudioFromGesture();
      sfx("ui");
    });
  }

  if (trophyViewBtn) {
    trophyViewBtn.addEventListener("click", (e) => {
      e.preventDefault();
      resumeAudioFromGesture();
      sfx("ui");
    });
  }

  if (trophyPlayBtn) {
    trophyPlayBtn.addEventListener("click", (e) => {
      e.preventDefault();
      resumeAudioFromGesture();
      sfx("ui");
    });
  }
  }

  if (menuCloseBtn) {
    menuCloseBtn.addEventListener("click", (e) => {
      e.preventDefault();
      closeMenu();
    });
  }

  if (menuPlayBtn) {
    menuPlayBtn.addEventListener("click", (e) => {
      e.preventDefault();
      closeMenu();
      if (!running) void start();
    });
  }

  if (trophyCloseBtn) trophyCloseBtn.addEventListener("click", () => closeTrophyCelebration());
  if (trophyViewBtn) trophyViewBtn.addEventListener("click", () => closeTrophyCelebration({ goToTrophiesTab: true }));
  if (trophyPlayBtn) {
    trophyPlayBtn.addEventListener("click", () => {
      closeTrophyCelebration();
      if (!running) void start();
    });
  }

  if (tabLeaderboardsBtn) tabLeaderboardsBtn.addEventListener("click", () => setMenuTab("leaderboards"));
  if (tabTrophiesBtn) tabTrophiesBtn.addEventListener("click", () => setMenuTab("trophies"));
  if (tabStatsBtn) tabStatsBtn.addEventListener("click", () => setMenuTab("stats"));
  if (tabDetailsBtn) tabDetailsBtn.addEventListener("click", () => setMenuTab("details"));
  if (tabHelpBtn) tabHelpBtn.addEventListener("click", () => setMenuTab("help"));

  function updatePowerupButtons() {
    const s = powerupInventory.shield || 0;
    const r = powerupInventory.rapid || 0;
    const b = powerupInventory.bomb || 0;
    const l = powerupInventory.life || 0;
    const m = powerupInventory.mult || 0;
    const c = powerupInventory.cont || 0;
    const t = powerupInventory.triple || 0;
    const p = powerupInventory.pierce || 0;
    const sl = powerupInventory.slow || 0;
    const mg = powerupInventory.magnet || 0;
    if (puShieldBtn) puShieldBtn.textContent = `Shield (1) x${s}`;
    if (puRapidBtn) puRapidBtn.textContent = `Rapid (2) x${r}`;
    if (puBombBtn) puBombBtn.textContent = `Bomb (3) x${b}`;
    if (puLifeBtn) puLifeBtn.textContent = `Life (4) x${l}`;
    if (puMultBtn) puMultBtn.textContent = `2x Score (5) x${m}`;
    if (puTripleBtn) puTripleBtn.textContent = `Triple (6) x${t}`;
    if (puPierceBtn) puPierceBtn.textContent = `Pierce (7) x${p}`;
    if (puSlowBtn) puSlowBtn.textContent = `Slow (8) x${sl}`;
    if (puMagnetBtn) puMagnetBtn.textContent = `Magnet (9) x${mg}`;
    if (puMetaEl && walletAddr) {
      const baseText = puMetaEl.textContent || "";
      const cleaned = baseText.replace(/\s*•\s*Continue x\d+\s*$/, "");
      puMetaEl.textContent = `${cleaned} • Continue x${c}`;
    }
  }

  function updateStoreUi() {
    if (!storeMetaEl) return;
    const costStr = cachedPowerUpCost != null ? cachedPowerUpCost.toString() : "?";
    storeMetaEl.textContent = `Tokens: ${cachedArcadeTokens.toString()} • Base cost: ${costStr} • Shield x${powerupPriceUnits.shield}, Rapid x${powerupPriceUnits.rapid}, Bomb x${powerupPriceUnits.bomb}, Life x${powerupPriceUnits.life}, 2x x${powerupPriceUnits.mult}, Triple x${powerupPriceUnits.triple}, Pierce x${powerupPriceUnits.pierce}, Slow x${powerupPriceUnits.slow}, Magnet x${powerupPriceUnits.magnet}, Continue x${powerupPriceUnits.cont} • Level: ${level}`;
    updatePowerupButtons();
  }

  function achievementsStorageKey() {
    return `rc1_arcade_achievements_${GAME_ID}_${walletAddr || "anon"}`;
  }

  function loadAchievements() {
    try {
      const raw = localStorage.getItem(achievementsStorageKey());
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === "object") {
        achievementsState = {
          unlocked: parsed.unlocked && typeof parsed.unlocked === "object" ? parsed.unlocked : {},
          stats: parsed.stats && typeof parsed.stats === "object" ? parsed.stats : { tokensSpent: "0" },
        };
      }
    } catch {
      // ignore
    }
  }

  function saveAchievements() {
    try {
      localStorage.setItem(achievementsStorageKey(), JSON.stringify(achievementsState));
    } catch {
      // ignore
    }
  }

  function renderAchievements() {
    if (!achievementsEl) return;
    const unlocked = achievementsState?.unlocked || {};
    const nUnlocked = achievementDefs.filter((a) => unlocked[a.id]).length;
    const total = achievementDefs.length;
    const spent = achievementsState?.stats?.tokensSpent ?? "0";
    achievementsEl.innerHTML = `
      <div style="color:var(--muted)">${nUnlocked}/${total} unlocked • Tokens spent: ${spent}</div>
      <div style="margin-top:8px;display:flex;flex-direction:column;gap:6px">
        ${achievementDefs
          .map((a) => {
            const ok = !!unlocked[a.id];
            return `<div style="display:flex;gap:8px;align-items:flex-start">
              <div style="width:14px;opacity:${ok ? 1 : 0.35}">${ok ? "✓" : "□"}</div>
              <div>
                <div style="font-weight:800;opacity:${ok ? 1 : 0.7}">${a.name}</div>
                <div style="color:var(--muted);font-size:12px">${a.desc}</div>
              </div>
            </div>`;
          })
          .join("")}
      </div>
    `;
  }

  function unlockAchievement(id) {
    if (!id) return;
    if (!achievementsState.unlocked) achievementsState.unlocked = {};
    if (achievementsState.unlocked[id]) return;
    achievementsState.unlocked[id] = Date.now();
    saveAchievements();
    renderAchievements();
  }

  function addTokensSpent(delta) {
    try {
      const prev = asBigInt(achievementsState?.stats?.tokensSpent ?? "0");
      const next = prev + asBigInt(delta);
      if (!achievementsState.stats) achievementsState.stats = {};
      achievementsState.stats.tokensSpent = next.toString();
      saveAchievements();
      renderAchievements();
      if (next >= 50n) unlockAchievement("big_spender");
    } catch {
      // ignore
    }
  }

  function getPowerupUnits(powerUpId) {
    return powerupPriceUnits[powerUpId] || 1;
  }

  function updateDifficultyUi() {
    const d = getDifficulty();
    if (setDifficulty) {
      setDifficulty.value = String(difficultyId);
      setDifficulty.disabled = !!running;
    }
    if (setDiffHint) {
      setDiffHint.textContent = running
        ? `Locked during a run. Current: ${d.name} (x${fmtMult(d.mult)} points).`
        : `${d.name}: x${fmtMult(d.mult)} points.`;
    }
  }

  function asBigInt(v) {
    if (v == null) return 0n;
    try {
      return BigInt(typeof v === "string" ? v : String(v));
    } catch {
      return 0n;
    }
  }

  function fmtInt(n) {
    try {
      return BigInt(n).toString();
    } catch {
      return String(n ?? "0");
    }
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

      // Minimal proto set to signDirect + TxRaw broadcast + Arcade msgs.
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

message MsgSetHighScoreInitials {
  string creator = 1;
  string game_id = 2;
  string initials = 3;
}

message MsgUsePowerUp {
  string creator = 1;
  uint64 session_id = 2;
  string power_up_id = 3;
}

message MsgClaimAchievement {
  string creator = 1;
  string achievement_id = 2;
  string game_id = 3;
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
    // Allow explicit override (useful behind custom proxies).
    const override = String(window.__RETROCHAIN_CHAIN_ID__ || "").trim();
    if (override) return override;

    // 1) node_info (tendermint service)
    try {
      const data = await apiGetJson("/cosmos/base/tendermint/v1beta1/node_info");
      const id = data?.default_node_info?.network || data?.defaultNodeInfo?.network || data?.node_info?.network || data?.nodeInfo?.network;
      if (id) return id;
    } catch {
      // ignore
    }

    // 2) latest block header
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

    return "";
  }

  function extractBaseAccount(account) {
    if (!account || typeof account !== "object") return null;

    // BaseAccount may be returned directly.
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

  async function ensureWallet() {
    if (!window.keplr) throw new Error("Keplr not found. Install the Keplr extension.");
    if (!chainId) chainId = await detectChainId();
    if (!chainId) {
      throw new Error(
        `Could not detect chain id from REST. Tried: ` +
          `${apiUrl("/cosmos/base/tendermint/v1beta1/node_info")}, ` +
          `${apiUrl("/cosmos/base/tendermint/v1beta1/blocks/latest")}. ` +
          `If you're behind a proxy, set window.__RETROCHAIN_CHAIN_ID__ before loading the page.`
      );
    }
    await window.keplr.enable(chainId);
    const key = await window.keplr.getKey(chainId);
    walletAddr = key.bech32Address;
    walletPubKeyBytes = key.pubKey;
    insertBtn.disabled = false;
    registerBtn.disabled = false;
    setPill(`Wallet: ${shortAddr(walletAddr)}`);
    await refreshArcadeParams();
    await refreshCredits();
    await refreshLeaderboard();

    loadAchievements();
    renderAchievements();

    // Switch local stats scope from anon -> wallet.
    loadLocalStats();

    loadPowerupInventory();
    updatePowerupButtons();

    // If the menu is open, refresh panels that depend on wallet.
    void renderMenuBody();

    try {
      const res = await fetch(apiUrl(`/arcade/v1/games/${encodeURIComponent(GAME_ID)}`), { headers: { accept: "application/json" } });
      registerBtn.style.display = res.ok ? "none" : "";
    } catch {
      // if we can't check, don't nag
      registerBtn.style.display = "none";
    }
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

  async function signAndBroadcast(typeUrl, msgBytes, memo) {
    return signAndBroadcastMulti([{ typeUrl, value: msgBytes }], memo);
  }

  const GAS_PRICE_NUM = 1n; // 0.01 uretro/gas
  const GAS_PRICE_DEN = 100n;
  function feeAmountForGas(gasLimit) {
    const gl = BigInt(gasLimit || 0);
    if (gl <= 0n) return "0";
    // ceil(gl * 1 / 100)
    return ((gl * GAS_PRICE_NUM + (GAS_PRICE_DEN - 1n)) / GAS_PRICE_DEN).toString();
  }

  async function simulateGasUsed({ root, messages, memo, accountNumber, sequence }) {
    // No Keplr popup: use REST simulate with a dummy signature.
    const TxBody = root.lookupType("cosmos.tx.v1beta1.TxBody");
    const AuthInfo = root.lookupType("cosmos.tx.v1beta1.AuthInfo");
    const TxRaw = root.lookupType("cosmos.tx.v1beta1.TxRaw");
    const PubKey = root.lookupType("cosmos.crypto.secp256k1.PubKey");
    const SignMode = root.lookupEnum("cosmos.tx.signing.v1beta1.SignMode");

    const SIM_GAS_LIMIT = 2000000;

    const bodyBytes = TxBody.encode({
      messages,
      memo: memo || "",
    }).finish();

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

    // 64-byte dummy signature (simulate skips verification).
    const dummySig = new Uint8Array(64);
    const txRawBytes = TxRaw.encode({
      bodyBytes,
      authInfoBytes,
      signatures: [dummySig],
    }).finish();

    const sim = await apiPostJson("/cosmos/tx/v1beta1/simulate", { tx_bytes: bytesToBase64(txRawBytes) });
    const used = Number(sim?.gas_info?.gas_used ?? sim?.gasInfo?.gasUsed ?? 0);
    if (!Number.isFinite(used) || used <= 0) throw new Error("simulate returned invalid gas_used");
    return used;
  }

  async function estimateGasLimitFor(messages, memo, root, accountNumber, sequence) {
    // Buffer to avoid ValuePerByte / ReadPerByte edge cases.
    const FALLBACK_BASE = 550000;
    const FALLBACK_PER_MSG = 120000;
    try {
      const used = await simulateGasUsed({ root, messages, memo, accountNumber, sequence });
      const buffered = Math.ceil(used * 1.25 + 5000);
      return Math.max(buffered, FALLBACK_BASE);
    } catch (e) {
      console.warn("gas simulate failed; falling back", e);
      return FALLBACK_BASE + Math.max(0, (messages?.length || 1) - 1) * FALLBACK_PER_MSG;
    }
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

      const { accountNumber, sequence } = await getAccountInfo(walletAddr);

      const gasLimit = await estimateGasLimitFor(messages, memo || "", root, accountNumber, sequence);
      const feeAmount = feeAmountForGas(gasLimit);

      const bodyBytes = TxBody.encode({
        messages,
        memo: memo || "",
      }).finish();

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
          // Simulated with buffer. Keep gas price at 0.01 uretro/gas.
          amount: [{ denom: "uretro", amount: feeAmount }],
          gasLimit: gasLimit,
        },
      }).finish();

      const signDoc = {
        bodyBytes,
        authInfoBytes,
        chainId,
        accountNumber: accountNumber,
      };

      const { signed, signature } = await window.keplr.signDirect(chainId, walletAddr, signDoc);
      const sigBytes = base64ToBytes(signature.signature);

      const txRawBytes = TxRaw.encode({
        bodyBytes: signed.bodyBytes,
        authInfoBytes: signed.authInfoBytes,
        signatures: [sigBytes],
      }).finish();

      const broadcastRes = await fetch(apiUrl("/cosmos/tx/v1beta1/txs"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tx_bytes: bytesToBase64(txRawBytes),
          mode: "BROADCAST_MODE_SYNC",
        }),
      });

      const broadcastJson = await broadcastRes.json().catch(() => ({}));
      if (!broadcastRes.ok) {
        throw new Error(broadcastJson?.message || `Broadcast failed (${broadcastRes.status})`);
      }

      const code = broadcastJson?.tx_response?.code;
      if (typeof code === "number" && code !== 0) {
        const rawLog = broadcastJson?.tx_response?.raw_log || "";
        throw new Error(rawLog || `Tx failed with code ${code}`);
      }

      return broadcastJson;
    } finally {
      onchainBusy = false;
    }
  }

  async function waitForTxCommitted(txhash, { timeoutMs = 12000, pollMs = 650 } = {}) {
    if (!txhash) return null;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const data = await apiGetJson(`/cosmos/tx/v1beta1/txs/${encodeURIComponent(txhash)}`);
        const code = data?.tx_response?.code;
        if (typeof code === "number") return data;
      } catch {
        // not indexed yet
      }
      await new Promise((r) => setTimeout(r, pollMs));
    }
    return null;
  }

  async function fetchAllClaimedAchievements(player) {
    if (!player) return [];
    const out = [];
    let nextKey = "";
    for (let page = 0; page < 6; page++) {
      const qs = new URLSearchParams();
      qs.set("pagination.limit", "200");
      if (nextKey) qs.set("pagination.key", nextKey);
      const data = await apiGetJson(`/arcade/v1/achievements/${encodeURIComponent(player)}?${qs.toString()}`);
      const arr = data?.achievements || [];
      if (Array.isArray(arr)) out.push(...arr);
      nextKey = data?.pagination?.next_key || data?.pagination?.nextKey || "";
      if (!nextKey) break;
    }
    return out;
  }

  async function fetchAllPlayerSessions(player) {
    if (!player) return [];
    const out = [];
    let nextKey = "";
    for (let page = 0; page < 10; page++) {
      const qs = new URLSearchParams();
      qs.set("pagination.limit", "500");
      if (nextKey) qs.set("pagination.key", nextKey);
      const data = await apiGetJson(`/arcade/v1/sessions/player/${encodeURIComponent(player)}?${qs.toString()}`);
      const arr = data?.sessions || [];
      if (Array.isArray(arr)) out.push(...arr);
      nextKey = data?.pagination?.next_key || data?.pagination?.nextKey || "";
      if (!nextKey) break;
    }
    return out;
  }

  function sessionStatusIsCompleted(s) {
    const st = s?.status;
    if (typeof st === "number") return st === 2;
    const t = String(st || "").toUpperCase();
    return t.includes("COMPLETED");
  }

  function sumSessionUint(sessions, keySnake, keyCamel) {
    let total = 0;
    for (const s of sessions) {
      const v = s?.[keySnake] ?? s?.[keyCamel];
      const n = Number(v ?? 0);
      if (Number.isFinite(n)) total += Math.max(0, Math.floor(n));
    }
    return total;
  }

  function sumSessionArrayLen(sessions, keySnake, keyCamel) {
    let total = 0;
    for (const s of sessions) {
      const arr = s?.[keySnake] ?? s?.[keyCamel];
      if (Array.isArray(arr)) total += arr.length;
    }
    return total;
  }

  async function computeClaimableOnchainAchievements() {
    if (!walletAddr) return [];

    const [claimed, sessions, lb, scores] = await Promise.all([
      fetchAllClaimedAchievements(walletAddr),
      fetchAllPlayerSessions(walletAddr),
      fetchGlobalLeaderboard({ limit: 250 }),
      fetchHighScores().catch(() => []),
    ]);

    const claimedSet = new Set(
      Array.isArray(claimed)
        ? claimed
            .map((a) => a?.achievement_id || a?.achievementId)
            .filter((x) => typeof x === "string" && x)
        : []
    );

    const sessionsCount = Array.isArray(sessions) ? sessions.length : 0;
    const hasCompleted = Array.isArray(sessions) ? sessions.some((s) => sessionStatusIsCompleted(s)) : false;
    const powerUpsUsed = sumSessionArrayLen(sessions || [], "power_ups_collected", "powerUpsCollected");
    const continuesUsed = sumSessionUint(sessions || [], "continues_used", "continuesUsed");
    const creditsUsed = sumSessionUint(sessions || [], "credits_used", "creditsUsed");

    const me = Array.isArray(lb) ? lb.find((e) => String(e?.player || "").toLowerCase() === walletAddr.toLowerCase()) : null;
    const rank = Number(me?.rank ?? 0);
    const arcadeTokens = Number(me?.arcade_tokens ?? me?.arcadeTokens ?? 0);

    const hasHighScoreForThisGame = Array.isArray(scores)
      ? scores.some((s) => String(s?.player || "").toLowerCase() === walletAddr.toLowerCase())
      : false;

    const claimable = [];
    const maybeAdd = (id, ok) => {
      if (!ok) return;
      if (claimedSet.has(id)) return;
      claimable.push(id);
    };

    maybeAdd("first-game", sessionsCount >= 1);
    maybeAdd("first-win", hasCompleted);
    maybeAdd("high-scorer", hasHighScoreForThisGame);
    maybeAdd("power-user", powerUpsUsed >= 50);
    maybeAdd("comeback-kid", continuesUsed >= 10);
    maybeAdd("high-roller", creditsUsed >= 100);
    maybeAdd("arcade-legend", Number.isFinite(rank) && rank > 0 && rank <= 10);
    maybeAdd("top-of-the-world", Number.isFinite(rank) && rank === 1);
    maybeAdd("arcade-mogul", Number.isFinite(arcadeTokens) && arcadeTokens >= 1_000_000);
    maybeAdd("legendary-player", sessionsCount >= 1000);

    return claimable;
  }

  async function claimOnchainAchievements(achievementIds) {
    await ensureWallet();
    const ids = Array.isArray(achievementIds) ? achievementIds.filter(Boolean) : [];
    if (ids.length === 0) return null;

    const root = await getProtoRoot();
    const MsgClaimAchievement = root.lookupType("retrochain.arcade.v1.MsgClaimAchievement");
    const messages = ids.map((id) => ({
      typeUrl: "/retrochain.arcade.v1.MsgClaimAchievement",
      value: MsgClaimAchievement.encode({ creator: walletAddr, achievementId: id, gameId: GAME_ID }).finish(),
    }));

    return signAndBroadcastMulti(messages, `Claim achievements (${GAME_ID})`);
  }

  async function refreshCredits() {
    if (!walletAddr) {
      creditsPill.textContent = "Credits: — • Tokens: —";
      return;
    }
    try {
      const data = await apiGetJson(`/arcade/v1/credits/${walletAddr}/game/${GAME_ID}`);
      cachedCredits = asBigInt(data?.credits ?? "0");
      cachedArcadeTokens = asBigInt(data?.arcade_tokens ?? data?.arcadeTokens ?? "0");
      creditsPill.textContent = `Credits: ${cachedCredits.toString()} • Tokens: ${cachedArcadeTokens.toString()}`;

      const cost = cachedPowerUpCost != null ? cachedPowerUpCost : null;
      const costStr = cost != null ? cost.toString() : "?";
      if (puMetaEl) {
        puMetaEl.textContent = walletAddr
          ? `Tokens: ${cachedArcadeTokens.toString()} • Base: ${costStr} • Shield x${powerupPriceUnits.shield}, Rapid x${powerupPriceUnits.rapid}, Bomb x${powerupPriceUnits.bomb} • Use 1/2/3 during a run.`
          : "Connect Keplr to use tokens.";
      }

      updateStoreUi();
      updatePowerupButtons();
    } catch (e) {
      creditsPill.textContent = "Credits: ? • Tokens: ?";
      console.warn("credits fetch failed", e);
    }
  }

  async function refreshArcadeParams() {
    try {
      const data = await apiGetJson("/arcade/v1/params");
      const cost = data?.params?.power_up_cost ?? data?.params?.powerUpCost ?? data?.power_up_cost ?? data?.powerUpCost;
      if (cost != null) cachedPowerUpCost = asBigInt(cost);
    } catch {
      // fall back to chain default if query isn't available
      if (cachedPowerUpCost == null) cachedPowerUpCost = 5n;
    }

    const costStr = cachedPowerUpCost != null ? cachedPowerUpCost.toString() : "?";
    if (puMetaEl) {
      puMetaEl.textContent = walletAddr
        ? `Tokens: ${cachedArcadeTokens.toString()} • Base: ${costStr} • Shield x${powerupPriceUnits.shield}, Rapid x${powerupPriceUnits.rapid}, Bomb x${powerupPriceUnits.bomb}, Life x${powerupPriceUnits.life}, 2x x${powerupPriceUnits.mult}, Triple x${powerupPriceUnits.triple}, Pierce x${powerupPriceUnits.pierce}, Slow x${powerupPriceUnits.slow}, Magnet x${powerupPriceUnits.magnet}, Continue x${powerupPriceUnits.cont} • Use 1-9 during a run.`
        : "Connect Keplr to use tokens.";
    }
  }

  function isShieldActive() {
    return performance.now() < shieldUntilMs;
  }

  function isRapidActive() {
    return performance.now() < rapidUntilMs;
  }

  function isTripleActive() {
    return performance.now() < tripleUntilMs;
  }

  function isPierceActive() {
    return performance.now() < pierceUntilMs;
  }

  function isSlowActive() {
    return performance.now() < slowUntilMs;
  }

  function isMagnetActive() {
    return performance.now() < magnetUntilMs;
  }

  function updateActivePowerupHud() {
    if (!puActiveEl) return;
    const now = performance.now();
    const parts = [];
    if (shieldUntilMs > now) parts.push(`Shield ${Math.ceil((shieldUntilMs - now) / 1000)}s`);
    if (rapidUntilMs > now) parts.push(`Rapid ${Math.ceil((rapidUntilMs - now) / 1000)}s`);
    if (scoreMultUntilMs > now) parts.push(`2x Score ${Math.ceil((scoreMultUntilMs - now) / 1000)}s`);
    if (tripleUntilMs > now) parts.push(`Triple ${Math.ceil((tripleUntilMs - now) / 1000)}s`);
    if (pierceUntilMs > now) parts.push(`Pierce ${Math.ceil((pierceUntilMs - now) / 1000)}s`);
    if (slowUntilMs > now) parts.push(`Slow ${Math.ceil((slowUntilMs - now) / 1000)}s`);
    if (magnetUntilMs > now) parts.push(`Magnet ${Math.ceil((magnetUntilMs - now) / 1000)}s`);
    puActiveEl.textContent = parts.length ? `Active: ${parts.join(" • ")}` : "";
  }

  function applyLocalPowerUp(powerUpId) {
    const now = performance.now();
    if (powerUpId === "shield") {
      shieldUntilMs = Math.max(shieldUntilMs, now + 5000);
      spawnExplosion(player.x + player.w / 2, player.y + player.h / 2, "rgba(34,211,238,0.9)");
    } else if (powerUpId === "rapid") {
      rapidUntilMs = Math.max(rapidUntilMs, now + 8000);
      spawnExplosion(player.x + player.w / 2, player.y + player.h / 2, "rgba(168,85,247,0.9)");
    } else if (powerUpId === "bomb") {
      applyBomb();
    } else if (powerUpId === "life") {
      lives = Math.min(MAX_LIVES, Math.max(0, lives) + 1);
      spawnExplosion(player.x + player.w / 2, player.y + player.h / 2, "rgba(34,197,94,0.9)");
      updateHud();
    } else if (powerUpId === "mult") {
      scoreMultUntilMs = Math.max(scoreMultUntilMs, now + 12000);
      spawnExplosion(player.x + player.w / 2, player.y + player.h / 2, "rgba(250,204,21,0.9)");
    } else if (powerUpId === "triple") {
      tripleUntilMs = Math.max(tripleUntilMs, now + 10000);
      spawnExplosion(player.x + player.w / 2, player.y + player.h / 2, "rgba(168,85,247,0.9)");
    } else if (powerUpId === "pierce") {
      pierceUntilMs = Math.max(pierceUntilMs, now + 10000);
      spawnExplosion(player.x + player.w / 2, player.y + player.h / 2, "rgba(226,232,240,0.9)");
    } else if (powerUpId === "slow") {
      slowUntilMs = Math.max(slowUntilMs, now + 8000);
      spawnExplosion(player.x + player.w / 2, player.y + player.h / 2, "rgba(34,211,238,0.9)");
    } else if (powerUpId === "magnet") {
      magnetUntilMs = Math.max(magnetUntilMs, now + 12000);
      spawnExplosion(player.x + player.w / 2, player.y + player.h / 2, "rgba(249,115,22,0.9)");
    }
    updateActivePowerupHud();
  }

  async function purchasePowerUp(powerUpId) {
    if (powerupBusy || onchainBusy) return;
    if (!walletAddr) {
      setStatus("Connect Keplr to buy powerups.");
      sfx("pause");
      return;
    }
    if (!running || !currentSessionId) {
      setStatus("Start a run first.");
      sfx("pause");
      return;
    }

    await refreshArcadeParams();
    await refreshCredits();
    const units = getPowerupUnits(powerUpId);
    const cost = cachedPowerUpCost != null ? cachedPowerUpCost : 0n;
    const totalCost = cost * BigInt(units);
    if (totalCost > 0n && cachedArcadeTokens < totalCost) {
      setStatus(`Not enough Arcade Tokens (${cachedArcadeTokens.toString()}).`);
      sfx("pause");
      return;
    }

    powerupBusy = true;
    try {
      resumeAudioFromGesture();
      setStatus(`Buying ${powerUpId} x${units} (confirm in Keplr)...`);
      const root = await getProtoRoot();
      const MsgUsePowerUp = root.lookupType("retrochain.arcade.v1.MsgUsePowerUp");
      const msgBytes = MsgUsePowerUp.encode({ creator: walletAddr, sessionId: String(currentSessionId), powerUpId }).finish();
      const msgs = Array.from({ length: units }, () => ({ typeUrl: "/retrochain.arcade.v1.MsgUsePowerUp", value: msgBytes }));
      await signAndBroadcastMulti(msgs, `Buy power-up: ${powerUpId} x${units}`);

      // Life is an instant effect. If you're already at max lives, store it instead.
      if (powerUpId === "life" && running && lives < MAX_LIVES) {
        applyLocalPowerUp("life");
        setStatus("Extra life granted (+1).");
        sfx("power");
      } else {
        powerupInventory[powerUpId] = (powerupInventory[powerUpId] || 0) + 1;
        sfx("power");
      }

      savePowerupInventory();
      if (totalCost > 0n) addTokensSpent(totalCost);
      await refreshCredits();
      updateStoreUi();
      if (powerUpId !== "life") {
        setStatus(`${powerUpId} purchased.`);
      } else if (lives >= MAX_LIVES) {
        setStatus(`Extra life stored (already at ${MAX_LIVES} lives). Use Life (4) later.`);
      }
    } catch (e) {
      setStatus(`Purchase failed: ${e?.message || e}`);
      sfx("pause");
    } finally {
      powerupBusy = false;
    }
  }

  function applyBomb() {
    const alive = aliens.filter((a) => a.alive);
    if (alive.length === 0) return;
    alive.forEach((a) => {
      a.alive = false;
      spawnExplosion(a.x + a.w / 2, a.y + a.h / 2, colors.alien);
      addScore(20, { ignoreCombo: true });
    });
    alienBullets = [];
    flashTime = Math.max(flashTime, 0.18);
    shakeTime = Math.max(shakeTime, 0.18);
    sfx("explode");
  }

  async function activatePowerUp(powerUpId) {
    if (powerupBusy || onchainBusy) return;
    if (!running) {
      setStatus("Start a run first.");
      sfx("pause");
      return;
    }
    if (storeOpen || settingsOpen) return;
    // Powerups are consumed from local inventory during gameplay.
    // On-chain spending is done only in the store to avoid Keplr popups mid-run.

    if ((powerupInventory[powerUpId] || 0) > 0) {
      if (powerUpId === "life" && lives >= MAX_LIVES) {
        setStatus(`Already at max lives (${MAX_LIVES}).`);
        sfx("pause");
        return;
      }
      powerupInventory[powerUpId] -= 1;
      savePowerupInventory();
      updatePowerupButtons();
      applyLocalPowerUp(powerUpId);
      setStatus(`${powerUpId} used.`);
      sfx("power");
      return;
    }

    // If empty, guide the user to the store where Arcade Tokens are spent on-chain.
    try {
      if (walletAddr) await refreshCredits();
    } catch {
      // ignore
    }
    setStatus("No stored powerups. Buy between waves in the store (Arcade Tokens). ");
    sfx("pause");
  }

  function renderLeaderboard(entries) {
    if (!lbEl) return;
    if (!entries || entries.length === 0) {
      lbEl.textContent = "No entries yet.";
      return;
    }
    const lines = entries.slice(0, 10).map((e, i) => {
      const rank = e.rank ?? (i + 1);
      const p = e.player || e.address || "";
      const s = e.score ?? e.best_score ?? e.total_score ?? 0;
      const initials = (e.initials || "").trim();
      const tag = initials ? ` (${initials.toUpperCase()})` : "";
      return `${rank}. ${shortAddr(p)}${tag} — ${s}`;
    });
    lbEl.textContent = lines.join("\n");
    lbEl.style.whiteSpace = "pre-line";
  }

  async function fetchHighScores() {
    const data = await apiGetJson(`/arcade/v1/highscores/${encodeURIComponent(GAME_ID)}?limit=10`);
    return data?.scores || [];
  }

  async function refreshLeaderboard() {
    try {
      const scores = await fetchHighScores();
      renderLeaderboard(Array.isArray(scores) ? scores : []);
    } catch (e) {
      if (lbEl) lbEl.textContent = "Leaderboard unavailable.";
      console.warn("leaderboard fetch failed", e);
    }
  }

  function isActiveSessionStatus(status) {
    if (status == null) return false;
    if (typeof status === "number") return status === 1;
    const s = String(status).toUpperCase();
    return s.includes("ACTIVE") && !s.includes("INACTIVE");
  }

  async function discoverLatestSessionId() {
    if (!walletAddr) return null;
    const data = await apiGetJson(`/arcade/v1/sessions/player/${walletAddr}?limit=25`);
    const sessions = data?.sessions || [];
    const mine = sessions.filter((s) => s.game_id === GAME_ID);
    if (mine.length === 0) return null;

    const active = mine.filter((s) => isActiveSessionStatus(s.status));
    const pickFrom = active.length ? active : mine;
    pickFrom.sort((a, b) => Number(b.session_id || 0) - Number(a.session_id || 0));
    return pickFrom[0].session_id;
  }

  async function waitForLatestSessionId({ timeoutMs = 12000, pollMs = 800 } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const sid = await discoverLatestSessionId();
        if (sid != null && sid !== "") return sid;
      } catch {
        // ignore transient REST errors during polling
      }
      await new Promise((r) => setTimeout(r, pollMs));
    }
    return null;
  }

  function resetPlayer() {
    player = {
      x: W / 2 - 20,
      y: H - 60,
      w: 40,
      h: 16,
      speed: 240,
    };
    bullets = [];
  }

  function spawnAliens(rows = 5, cols = 10) {
    aliens = [];
    const padding = 20;
    const cellW = (W - padding * 2) / cols;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        aliens.push({
          x: padding + c * cellW + 6,
          y: 40 + r * 36,
          w: 24,
          h: 16,
          alive: true,
          row: r,
          col: c,
          kind: r % 3,
        });
      }
    }
    alienDir = 1;
    const d = getDifficulty();
    alienSpeed = (28 + level * 4) * d.speed;
    dropStep = d.id === 1 ? 20 : 24;
  }

  function resetGame() {
    score = 0;
    lives = 3;
    level = 1;
    waveTookHit = false;
    waveStartMs = performance.now();
    waveNearMisses = 0;
    shotSeq = 0;
    shotState.clear();
    killsThisRun = 0;
    resetCombo();
    drops = [];
    dropCooldown = 0;
    bgParallaxX = 0;
    alienShootAcc = 0;
    shieldUntilMs = 0;
    rapidUntilMs = 0;
    scoreMultUntilMs = 0;
    tripleUntilMs = 0;
    pierceUntilMs = 0;
    slowUntilMs = 0;
    magnetUntilMs = 0;
    resetPlayer();
    spawnAliens();
    alienBullets = [];
    bullets = [];
    statusEl.textContent = "Ready.";
    updateHud();
  }

  function updateHud() {
    scoreEl.textContent = score;
    livesEl.textContent = lives;
    levelEl.textContent = level;
  }

  function rect(a, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = typeof color === "string" ? color : "rgba(34,211,238,0.8)";
    ctx.shadowBlur = 14;
    ctx.fillRect(a.x, a.y, a.w, a.h);
    ctx.restore();
  }

  function roundRectPath(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawAlienSprite(a, ts, tint) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = tint;
    ctx.shadowBlur = 16;

    const wob = 0.5 + 0.5 * Math.sin(ts * 0.006 + (a.col || 0) * 0.9 + (a.row || 0) * 1.3);
    const k = a.kind ?? 0;
    const cx = a.x + a.w / 2;
    const cy = a.y + a.h / 2;

    // Head
    const head = ctx.createRadialGradient(cx, a.y + a.h * 0.35, 2, cx, a.y + a.h * 0.35, a.w * 0.75);
    head.addColorStop(0, `rgba(125,211,252,${0.70 + 0.25 * wob})`);
    head.addColorStop(1, "rgba(59,130,246,0.55)");
    ctx.fillStyle = head;
    ctx.beginPath();
    ctx.ellipse(cx, a.y + a.h * 0.42, a.w * 0.55, a.h * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body + legs/tentacles variants
    ctx.shadowBlur = 10;
    ctx.strokeStyle = "rgba(226,232,240,0.18)";
    ctx.lineWidth = 1.2;

    if (k === 0) {
      // squid
      ctx.beginPath();
      ctx.moveTo(a.x + a.w * 0.18, a.y + a.h * 0.70);
      ctx.quadraticCurveTo(cx, a.y + a.h * (0.92 + 0.04 * wob), a.x + a.w * 0.82, a.y + a.h * 0.70);
      ctx.quadraticCurveTo(cx, a.y + a.h * 0.60, a.x + a.w * 0.18, a.y + a.h * 0.70);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // tentacles
      for (let i = 0; i < 3; i++) {
        const tx = a.x + a.w * (0.30 + i * 0.20);
        ctx.beginPath();
        ctx.moveTo(tx, a.y + a.h * 0.82);
        ctx.quadraticCurveTo(tx + (i - 1) * 2, a.y + a.h * 1.05, tx + (i - 1) * 3, a.y + a.h * 1.20);
        ctx.stroke();
      }
    } else if (k === 1) {
      // crab
      roundRectPath(a.x + a.w * 0.10, a.y + a.h * 0.55, a.w * 0.80, a.h * 0.42, 6);
      ctx.fill();
      ctx.stroke();
      // claws
      ctx.beginPath();
      ctx.moveTo(a.x + a.w * 0.10, cy);
      ctx.quadraticCurveTo(a.x - a.w * 0.05, cy + 2, a.x + a.w * 0.05, cy + a.h * 0.25);
      ctx.moveTo(a.x + a.w * 0.90, cy);
      ctx.quadraticCurveTo(a.x + a.w * 1.05, cy + 2, a.x + a.w * 0.95, cy + a.h * 0.25);
      ctx.stroke();
      // legs
      for (let i = 0; i < 4; i++) {
        const lx = a.x + a.w * (0.20 + i * 0.18);
        ctx.beginPath();
        ctx.moveTo(lx, a.y + a.h * 0.92);
        ctx.lineTo(lx + (i % 2 ? 4 : -4), a.y + a.h * 1.15);
        ctx.stroke();
      }
    } else {
      // saucer-eyed blob
      roundRectPath(a.x + a.w * 0.12, a.y + a.h * 0.52, a.w * 0.76, a.h * 0.48, 8);
      ctx.fill();
      ctx.stroke();
      // little spikes
      for (let i = 0; i < 5; i++) {
        const sx = a.x + a.w * (0.18 + i * 0.16);
        ctx.beginPath();
        ctx.moveTo(sx, a.y + a.h * 0.54);
        ctx.lineTo(sx, a.y + a.h * 0.40);
        ctx.stroke();
      }
    }

    // Eyes
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.ellipse(cx - a.w * 0.18, a.y + a.h * 0.42, a.w * 0.12, a.h * 0.16, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + a.w * 0.18, a.y + a.h * 0.42, a.w * 0.12, a.h * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(226,232,240,0.7)";
    ctx.beginPath();
    ctx.ellipse(cx - a.w * 0.20, a.y + a.h * 0.40, a.w * 0.04, a.h * 0.06, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + a.w * 0.16, a.y + a.h * 0.40, a.w * 0.04, a.h * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mouth
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(cx, a.y + a.h * 0.56, a.w * 0.16, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    ctx.restore();
  }

  function drawPlayerSprite(p) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const cx = p.x + p.w / 2;
    const hull = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y);
    hull.addColorStop(0, "rgba(14,165,233,0.95)");
    hull.addColorStop(0.55, "rgba(34,211,238,0.95)");
    hull.addColorStop(1, "rgba(165,243,252,0.95)");
    ctx.fillStyle = hull;
    ctx.shadowColor = "rgba(34,211,238,0.9)";
    ctx.shadowBlur = 18;

    // Main hull (arrow-ish)
    ctx.beginPath();
    ctx.moveTo(cx, p.y - 10);
    ctx.lineTo(p.x + p.w * 0.92, p.y + p.h * 0.55);
    ctx.lineTo(p.x + p.w * 0.70, p.y + p.h);
    ctx.lineTo(p.x + p.w * 0.30, p.y + p.h);
    ctx.lineTo(p.x + p.w * 0.08, p.y + p.h * 0.55);
    ctx.closePath();
    ctx.fill();

    // Wings
    ctx.shadowBlur = 10;
    ctx.fillStyle = "rgba(34,211,238,0.55)";
    ctx.beginPath();
    ctx.moveTo(p.x + p.w * 0.06, p.y + p.h * 0.65);
    ctx.lineTo(p.x - p.w * 0.18, p.y + p.h);
    ctx.lineTo(p.x + p.w * 0.20, p.y + p.h);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(p.x + p.w * 0.94, p.y + p.h * 0.65);
    ctx.lineTo(p.x + p.w * 1.18, p.y + p.h);
    ctx.lineTo(p.x + p.w * 0.80, p.y + p.h);
    ctx.closePath();
    ctx.fill();

    // Cockpit
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(226,232,240,0.85)";
    ctx.beginPath();
    ctx.ellipse(cx, p.y + p.h * 0.52, p.w * 0.14, p.h * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(cx, p.y + p.h * 0.52, p.w * 0.10, p.h * 0.20, 0, 0, Math.PI * 2);
    ctx.fill();

    // Engine glow
    if (settings.fx) {
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = "rgba(168,85,247,0.9)";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "rgba(168,85,247,0.35)";
      ctx.beginPath();
      ctx.ellipse(cx, p.y + p.h + 4, p.w * 0.20, p.h * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function draw() {
    const ts = performance.now();
    drawBackground(ts);

    // Screen shake
    ctx.save();
    if (settings.shake && shakeTime > 0) {
      const mag = 5 * (shakeTime / 0.2);
      ctx.translate((Math.random() * 2 - 1) * mag, (Math.random() * 2 - 1) * mag);
    }

    // Player
    drawPlayerSprite(player);

    // Shield
    if (isShieldActive()) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = "rgba(34,211,238,0.75)";
      ctx.lineWidth = 3;
      ctx.shadowColor = "rgba(34,211,238,0.9)";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.ellipse(player.x + player.w / 2, player.y + player.h / 2, player.w * 0.85, player.h * 1.8, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Muzzle flash (kept lightweight so it shows even if FX is off)
    drawMuzzleFlashes();

    // Bullets
    bullets.forEach((b) => {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      // trail
      const tail = 18;
      const gx = b.x + b.w / 2;
      const gy = b.y + b.h;
      const grad = ctx.createLinearGradient(gx, gy + tail, gx, gy - 2);
      grad.addColorStop(0, "rgba(34,211,238,0)");
      grad.addColorStop(0.55, "rgba(34,211,238,0.25)");
      grad.addColorStop(1, "rgba(34,211,238,0.55)");
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = grad;
      ctx.fillRect(b.x - 2, b.y, b.w + 4, b.h + tail);

      ctx.fillStyle = colors.bullet;
      ctx.shadowColor = colors.bullet;
      ctx.shadowBlur = 18;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.globalAlpha = 0.25;
      ctx.fillRect(b.x - 1, b.y + 6, b.w + 2, b.h);
      ctx.restore();
    });
    alienBullets.forEach((b) => {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      // trail
      const tail = 14;
      const gx = b.x + b.w / 2;
      const gy = b.y;
      const grad = ctx.createLinearGradient(gx, gy - tail, gx, gy + b.h + 2);
      grad.addColorStop(0, "rgba(248,113,113,0)");
      grad.addColorStop(0.55, "rgba(248,113,113,0.20)");
      grad.addColorStop(1, "rgba(248,113,113,0.50)");
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = grad;
      ctx.fillRect(b.x - 2, b.y - tail, b.w + 4, b.h + tail);

      ctx.fillStyle = colors.alienBullet;
      ctx.shadowColor = colors.alienBullet;
      ctx.shadowBlur = 12;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.restore();
    });

    // Aliens
    const bob = Math.sin(ts * 0.004) * 1.2;
    aliens
      .filter((a) => a.alive)
      .forEach((a) => {
        ctx.save();
        ctx.translate(0, bob);
        drawAlienSprite(a, ts, colors.alien);
        ctx.restore();
      });

    // Drops
    if (drops.length) {
      for (const d of drops) {
        const c = dropColor(d.kind);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowColor = c;
        ctx.shadowBlur = 18;
        ctx.globalAlpha = Math.max(0, Math.min(1, d.life / 2.5));
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.font = "bold 10px 'Segoe UI', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(dropLabel(d.kind), d.x, d.y + 0.5);
        ctx.restore();
      }
    }

    // Particles
    if (settings.fx) drawParticles();

    // Shockwaves (impact rings)
    drawShockwaves();

    // HUD overlay
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(0, 0, W, 40);
    ctx.fillStyle = colors.text;
    ctx.font = "14px 'Segoe UI', sans-serif";
    const d = getDifficulty();
    ctx.fillText(`Score: ${score}`, 14, 24);
    ctx.fillText(`Lives: ${lives}`, 140, 24);
    ctx.fillText(`Level: ${level}`, 250, 24);
    ctx.fillText(`${d.name} x${fmtMult(d.mult)}`, 360, 24);
    if (comboCount > 1 && comboTimeLeft > 0) {
      const x = Math.max(14, W - 220);
      const y = 24;
      ctx.fillText(`Streak x${comboCount}`, x, y);
      const barW = 90;
      const barH = 6;
      const barX = x + 92;
      const barY = 16;
      const t = Math.max(0, Math.min(1, comboTimeLeft / comboWindowSec));
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = "rgba(168,85,247,0.85)";
      ctx.fillRect(barX, barY, Math.max(1, barW * t), barH);
      ctx.restore();
    }
    ctx.fillText(paused ? "Paused" : running ? "" : "Ready", W - 100, 24);

    ctx.restore();
  }

  function update(dt) {
    if (paused) return;

    const nowMs = performance.now();
    const slowFactor = nowMs < slowUntilMs ? 0.55 : 1;
    const magnetOn = nowMs < magnetUntilMs;

    updateFx(dt);

    if (comboTimeLeft > 0) {
      comboTimeLeft = Math.max(0, comboTimeLeft - dt);
      if (comboTimeLeft === 0) comboCount = 0;
    }
    dropCooldown = Math.max(0, dropCooldown - dt);

    // Drops movement + pickup
    drops.forEach((d) => {
      d.life -= dt;
      if (magnetOn) {
        const px = player.x + player.w / 2;
        const pull = Math.max(-1, Math.min(1, (px - d.x) / 80));
        d.x = Math.max(10, Math.min(W - 10, d.x + pull * 240 * dt));
      }
      d.y += d.vy * dt;
    });
    drops = drops.filter((d) => d.life > 0 && d.y < H + 40);
    for (const d of drops) {
      const box = { x: d.x - d.r, y: d.y - d.r, w: d.r * 2, h: d.r * 2 };
      if (overlap(box, player)) {
        powerupInventory[d.kind] = (powerupInventory[d.kind] || 0) + 1;
        savePowerupInventory();
        updatePowerupButtons();
        spawnExplosion(d.x, d.y, dropColor(d.kind));
        setStatus(`Drop collected: ${d.kind} +1`);
        d.life = -1;
      }
    }
    drops = drops.filter((d) => d.life > 0);

    // Player move
    const prevX = player.x;
    const movingLeft = !!keys["ArrowLeft"];
    const movingRight = !!keys["ArrowRight"];
    if (touchMoveActive && touchEnabled()) {
      player.x = Math.max(8, Math.min(W - player.w - 8, touchMoveX - player.w / 2));
      // Don't mix with keyboard drift while touch-dragging.
      keys["ArrowLeft"] = false;
      keys["ArrowRight"] = false;
    } else {
      if (movingLeft) player.x -= player.speed * dt;
      if (movingRight) player.x += player.speed * dt;
      player.x = Math.max(8, Math.min(W - player.w - 8, player.x));
    }

    const dx = player.x - prevX;
    bgParallaxX = Math.max(-22, Math.min(22, bgParallaxX + dx * 0.12));
    bgParallaxX *= 0.92;

    // Thruster particles
    if (settings.fx && (movingLeft || movingRight) && Math.random() < 0.55) {
      const dir = movingLeft ? 1 : -1;
      particles.push({
        x: player.x + player.w / 2 + dir * (10 + Math.random() * 6),
        y: player.y + player.h + 2,
        vx: dir * (30 + Math.random() * 60),
        vy: 80 + Math.random() * 120,
        life: 0.18 + Math.random() * 0.18,
        max: 0.35,
        r: 0.8 + Math.random() * 1.8,
        c: Math.random() < 0.5 ? "rgba(34,211,238,0.85)" : "rgba(168,85,247,0.85)",
      });
    }

    // Shoot
    shootCooldown -= dt;
    if (keys[" "] && shootCooldown <= 0) {
      const triple = nowMs < tripleUntilMs;
      const pierce = nowMs < pierceUntilMs;
      const shotId = beginShot(triple ? 3 : 1);
      const base = { y: player.y - 10, w: 4, h: 10, vy: -360, hit: false, dead: false, shotId, pierceLeft: pierce ? 2 : 0 };
      const cx = player.x + player.w / 2 - 2;
      bullets.push({ ...base, x: cx, vx: 0 });
      if (triple) {
        bullets.push({ ...base, x: cx - 8, vx: -140 });
        bullets.push({ ...base, x: cx + 8, vx: 140 });
      }
      // muzzle flash
      spawnMuzzleFlash(player.x + player.w / 2, player.y - 10, colors.bullet);
      spawnExplosion(player.x + player.w / 2, player.y - 10, colors.bullet);
      sfx("shoot");
      shootCooldown = isRapidActive() ? 0.12 : 0.25;
    }

    // Bullets move
    bullets.forEach((b) => {
      b.y += b.vy * dt;
      b.x += (b.vx || 0) * dt;
    });
    {
      const next = [];
      for (const b of bullets) {
        if (b.dead || b.y + b.h <= 0 || b.x < -40 || b.x > W + 40) {
          markShotBulletGone(b.shotId);
          continue;
        }
        next.push(b);
      }
      bullets = next;
    }
    if (bullets.length > 30) bullets = bullets.slice(bullets.length - 30);

    // Alien bullets
    alienBullets.forEach((b) => (b.y += b.vy * dt * slowFactor));
    alienBullets = alienBullets.filter((b) => b.y < H + 30);

    // Risk/reward: near-miss bonus (bullet passes close without hit)
    {
      const pcx = player.x + player.w / 2;
      const pcy = player.y + player.h / 2;
      for (const b of alienBullets) {
        if (b.nearMiss) continue;
        if (b.y < player.y - 26 || b.y > player.y + player.h + 18) continue;
        const bcx = b.x + b.w / 2;
        const bcy = b.y + b.h / 2;
        const dx = bcx - pcx;
        const dy = bcy - pcy;
        if (Math.hypot(dx, dy) < 22 && !overlap(b, player)) {
          b.nearMiss = true;
          waveNearMisses += 1;
          addScore(10, { ignoreCombo: true });
        }
      }
    }

    // Aliens move
    let minX = Infinity,
      maxX = -Infinity;
    aliens.filter((a) => a.alive).forEach((a) => {
      a.x += alienDir * alienSpeed * dt * slowFactor;
      minX = Math.min(minX, a.x);
      maxX = Math.max(maxX, a.x + a.w);
    });
    if (minX !== Infinity) {
      let pushX = 0;
      if (minX < 8) pushX = 8 - minX;
      else if (maxX > W - 8) pushX = (W - 8) - maxX;

      if (pushX !== 0) {
        // Clamp the formation back inside bounds before dropping.
        aliens.filter((a) => a.alive).forEach((a) => (a.x += pushX));
        alienDir *= -1;
        aliens.filter((a) => a.alive).forEach((a) => (a.y += dropStep));
      }
    }

    // Alien shooting (rate-limited + stable)
    const d = getDifficulty();
    const aliveAliens = aliens.filter((a) => a.alive);
    const shotsPerSec = (0.75 + level * 0.10) * d.shoot;
    alienShootAcc += dt * shotsPerSec * slowFactor;
    const maxBurst = 3;
    let fired = 0;
    while (alienShootAcc >= 1 && fired < maxBurst) {
      alienShootAcc -= 1;
      fired += 1;

      if (aliveAliens.length === 0) break;
      const cols = Array.from(new Set(aliveAliens.map((a) => a.col)));
      const col = cols[Math.floor(Math.random() * cols.length)];
      let shooter = null;
      for (const a of aliveAliens) {
        if (a.col !== col) continue;
        if (!shooter || a.y > shooter.y) shooter = a;
      }
      if (!shooter) shooter = aliveAliens[Math.floor(Math.random() * aliveAliens.length)];

      alienBullets.push({
        x: shooter.x + shooter.w / 2 - 2,
        y: shooter.y + shooter.h,
        w: 4,
        h: 10,
        vy: (250 + level * 10) * d.bullet,
      });
    }
    if (alienBullets.length > 45) alienBullets = alienBullets.slice(alienBullets.length - 45);

    // Collisions: bullet vs alien
    bullets.forEach((b) => {
      if (b.dead) return;
     aliens.forEach((a) => {
        if (b.dead) return;
        if (!a.alive) return;
        if (overlap(b, a)) {
          a.alive = false;
          b.hit = true;
          markShotHit(b.shotId);
          bumpCombo();
          addScore(50);
          sfx("alien");
          maybeSpawnDrop(a.x + a.w / 2, a.y + a.h / 2);
          killsThisRun += 1;
          unlockAchievement("first_kill");
          spawnExplosion(a.x + a.w / 2, a.y + a.h / 2, colors.alien);

          if (b.pierceLeft > 0) {
            b.pierceLeft -= 1;
          } else {
            b.dead = true;
          }
        }
      });
    });

    // Collisions: alien bullet vs player
    alienBullets.forEach((b) => {
      if (overlap(b, player)) {
        b.y = H + 999;
        if (!isShieldActive()) {
          shakeTime = Math.max(shakeTime, 0.2);
          loseLife();
        } else {
          spawnExplosion(player.x + player.w / 2, player.y + player.h / 2, "rgba(34,211,238,0.9)");
        }
      }
    });

    // Lose if aliens reach player row
    if (aliens.some((a) => a.alive && a.y + a.h >= player.y - 6)) {
      if (!isShieldActive()) {
        shakeTime = Math.max(shakeTime, 0.25);
        loseLife();
      }
    }

    // Next wave (open store between waves)
    if (aliens.every((a) => !a.alive)) {
       sfx("wave");
      if (!storePendingNextWave) {
        storePendingNextWave = true;
        resetCombo();
        storeOpen = true;
        paused = true;
        void (async () => {
          unlockAchievement("first_clear");
          if (!waveTookHit) unlockAchievement("clean_wave");

          // Risk/reward: bonuses for clearing fast and/or taking no damage.
          let bonusPts = 0;
          const waveSec = waveStartMs > 0 ? (performance.now() - waveStartMs) / 1000 : 0;
          if (!waveTookHit) {
            const clean = 150 + level * 12;
            bonusPts += clean;
            addScore(clean, { ignoreCombo: true });
          }
          const target = Math.max(8, 18 - level * 0.8);
          if (waveSec > 0 && waveSec < target) {
            const speed = Math.min(320, Math.round((target - waveSec) * 35 + 90));
            bonusPts += speed;
            addScore(speed, { ignoreCombo: true });
          }

          await refreshArcadeParams();
          await refreshCredits();
          updateStoreUi();
          menuOpen = false;
          showOverlay("store");
          setStatus(bonusPts > 0 ? `Wave cleared (+${bonusPts} bonus). Visit the store, then continue.` : "Wave cleared. Visit the store, then continue.");
        })();
      }
      return;
    }

    updateActivePowerupHud();
  }

  function loseLife() {
    lives -= 1;
    waveTookHit = true;
    resetCombo();
    updateHud();
    if (lives <= 0) {
      if ((powerupInventory.cont || 0) > 0) {
        powerupInventory.cont -= 1;
        savePowerupInventory();
        lives = 3;
        shieldUntilMs = Math.max(shieldUntilMs, performance.now() + 2500);
        resetPlayer();
        bullets = [];
        alienBullets = [];
        updateHud();
        updatePowerupButtons();
        setStatus("Continue! +3 lives.");
        return;
      }
      gameOver();
      return;
    }
    if (settings.shake) shakeTime = Math.max(shakeTime, 0.25);
    sfx("hit");
    resetPlayer();
    bullets = [];
    alienBullets = [];
    statusEl.textContent = "Hit! Lives remaining: " + lives;
  }

  function gameOver() {
    running = false;
    paused = false;
    sfx("explode");

    // Record local stats immediately.
    recordRunEnd({ finalScore: score, finalLevel: level, kills: killsThisRun });

    statusEl.textContent = "Game over. Submitting score...";
    void (async () => {
      try {
        if (!walletAddr) {
          statusEl.textContent = "Game over. Connect Keplr to submit score.";
          return;
        }
        if (!currentSessionId) {
          currentSessionId = await waitForLatestSessionId({ timeoutMs: 8000, pollMs: 700 });
        }
        if (!currentSessionId) {
          statusEl.textContent = "Game over. No session found to submit.";
          return;
        }
        const before = cachedArcadeTokens;
        await submitScore(score);
        await refreshCredits();
        const after = cachedArcadeTokens;
        const earned = after > before ? after - before : 0n;
        statusEl.textContent = earned > 0n ? `Score submitted. +${earned.toString()} Arcade Tokens earned.` : "Score submitted. Press Start to play again.";
      } catch (e) {
        statusEl.textContent = `Score submit failed: ${e?.message || e}`;
      }
    })();
  }

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function loop(ts) {
    if (!running) return;
    const dt = Math.min(0.05, (ts - lastTime) / 1000);
    lastTime = ts;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }


  async function start() {
    if (running || onchainBusy) return;
    try {
      setStatus("Connecting wallet...");
      await ensureWallet();
      await refreshCredits();

      if (cachedCredits < 1n) {
        setStatus("No credits. Insert Coin to play.");
        return;
      }

      const d = getDifficulty();
      setStatus(`Starting session (${d.name}, x${fmtMult(d.mult)}) on-chain...`);
      tokensAtRunStart = cachedArcadeTokens;
      const root = await getProtoRoot();
      const MsgStartSession = root.lookupType("retrochain.arcade.v1.MsgStartSession");
      const msgBytes = MsgStartSession.encode({ creator: walletAddr, gameId: GAME_ID, difficulty: String(difficultyId) }).finish();
      await signAndBroadcast("/retrochain.arcade.v1.MsgStartSession", msgBytes, "Start RetroVaders");

      // Broadcast is async (SYNC), so wait briefly for the session to appear via REST.
      currentSessionId = await waitForLatestSessionId();
      if (!currentSessionId) {
        setStatus("Session started, but couldn't confirm session id yet. Try again in a moment.");
        return;
      }

      if (difficultyId === 4) unlockAchievement("nightmare");

      resetGame();
      running = true;
      paused = true;
      recordRunStart();
      menuOpen = false;
      if (mobileControls) mobileControls.style.display = isCoarsePointer ? "flex" : "none";
      lastTime = performance.now();
      storeOpen = true;
      storePendingStart = true;
      await refreshArcadeParams();
      await refreshCredits();
      updateStoreUi();
      showOverlay("store");
      setStatus("Stock up in the store, then Continue.");
      requestAnimationFrame(loop);
    } catch (e) {
      setStatus(e?.message || "Failed to start session.");
    }
  }

  function pause() {
    if (!running) return;
    paused = !paused;
    sfx(paused ? "pause" : "ui");
    statusEl.textContent = paused ? "Paused" : "Go!";
    if (!paused) {
      lastTime = performance.now();
    }
  }

  // Input
  window.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "ArrowRight", " ", "p", "P", "1", "2", "3", "4", "5", "6", "7", "8", "9", "s", "S", "Escape"].includes(e.key)) e.preventDefault();
    keys[e.key] = true;
    if (e.key === "p" || e.key === "P") pause();
    if (e.key === "Escape") {
      if (menuOpen) {
        closeMenu();
        return;
      }
      if (storeOpen || settingsOpen) {
        if (storeOpen && storePendingStart) {
          continueFromStore();
          return;
        }
        if (storeOpen && storePendingNextWave) {
          // Treat as continue to avoid getting stuck.
          hideOverlay();
          storeOpen = false;
          startNextWave();
          storePendingNextWave = false;
          paused = false;
          setStatus("Go!");
          return;
        }
        if (settingsOpen) {
          settingsOpen = false;
          hideOverlay();
          if (running && !settingsWasPaused && !storePendingNextWave) {
            paused = false;
            setStatus("Go!");
          }
          return;
        }
        storeOpen = false;
        settingsOpen = false;
        hideOverlay();
        return;
      }
    }
    if (menuOpen) return;
    if (e.key === "s" || e.key === "S") {
      settingsOpen = !settingsOpen;
      storeOpen = false;
      if (settingsOpen) {
        settingsWasPaused = paused;
        paused = true;
        showOverlay("settings");
        setShake.checked = !!settings.shake;
        setFx.checked = !!settings.fx;
      } else {
        hideOverlay();
        if (running && !settingsWasPaused && !storePendingNextWave) {
          paused = false;
          setStatus("Go!");
        }
      }
      return;
    }
    if (!storeOpen && !settingsOpen) {
      if (e.key === "1") void activatePowerUp("shield");
      if (e.key === "2") void activatePowerUp("rapid");
      if (e.key === "3") void activatePowerUp("bomb");
      if (e.key === "4") void activatePowerUp("life");
      if (e.key === "5") void activatePowerUp("mult");
      if (e.key === "6") void activatePowerUp("triple");
      if (e.key === "7") void activatePowerUp("pierce");
      if (e.key === "8") void activatePowerUp("slow");
      if (e.key === "9") void activatePowerUp("magnet");
    }
  });
  window.addEventListener("keyup", (e) => {
    keys[e.key] = false;
  });

  startBtn.addEventListener("click", () => void start());
  pauseBtn.addEventListener("click", pause);
  startBtn.addEventListener("pointerdown", () => {
    resumeAudioFromGesture();
    if (settings.music) startMusic();
    sfx("ui");
  });

  if (puShieldBtn) puShieldBtn.addEventListener("click", () => void activatePowerUp("shield"));
  if (puRapidBtn) puRapidBtn.addEventListener("click", () => void activatePowerUp("rapid"));
  if (puBombBtn) puBombBtn.addEventListener("click", () => void activatePowerUp("bomb"));
  if (puLifeBtn) puLifeBtn.addEventListener("click", () => void activatePowerUp("life"));
  if (puMultBtn) puMultBtn.addEventListener("click", () => void activatePowerUp("mult"));
  if (puTripleBtn) puTripleBtn.addEventListener("click", () => void activatePowerUp("triple"));
  if (puPierceBtn) puPierceBtn.addEventListener("click", () => void activatePowerUp("pierce"));
  if (puSlowBtn) puSlowBtn.addEventListener("click", () => void activatePowerUp("slow"));
  if (puMagnetBtn) puMagnetBtn.addEventListener("click", () => void activatePowerUp("magnet"));

  settingsBtn.addEventListener("click", () => {
    resumeAudioFromGesture();
    sfx("ui");
    menuOpen = false;
    settingsOpen = true;
    storeOpen = false;
    settingsWasPaused = paused;
    paused = true;
    showOverlay("settings");
    setShake.checked = !!settings.shake;
    setFx.checked = !!settings.fx;
    updateDifficultyUi();
  });

  function startNextWave() {
    level += 1;
    resetCombo();
    addScore(250, { ignoreCombo: true });
    waveTookHit = false;
    waveStartMs = performance.now();
    waveNearMisses = 0;
    shotState.clear();
    if (settings.fx) flashTime = Math.max(flashTime, 0.25);
    bullets = [];
    alienBullets = [];
    spawnAliens(Math.min(6, 4 + level), Math.min(12, 8 + level));
    resetPlayer();
    updateHud();
  }

  function continueFromStore() {
    hideOverlay();
    storeOpen = false;
    if (storePendingStart) {
      storePendingStart = false;
      paused = false;
      setStatus("Go!");
      return;
    }
    if (storePendingNextWave) {
      startNextWave();
      storePendingNextWave = false;
    }
    paused = false;
    setStatus("Go!");
  }

  storeCloseBtn.addEventListener("click", continueFromStore);
  storeContinueBtn.addEventListener("click", () => {
    continueFromStore();
  });
  buyShieldBtn.addEventListener("click", () => void purchasePowerUp("shield"));
  buyRapidBtn.addEventListener("click", () => void purchasePowerUp("rapid"));
  buyBombBtn.addEventListener("click", () => void purchasePowerUp("bomb"));
  if (buyLifeBtn) buyLifeBtn.addEventListener("click", () => void purchasePowerUp("life"));
  if (buyMultBtn) buyMultBtn.addEventListener("click", () => void purchasePowerUp("mult"));
  if (buyTripleBtn) buyTripleBtn.addEventListener("click", () => void purchasePowerUp("triple"));
  if (buyPierceBtn) buyPierceBtn.addEventListener("click", () => void purchasePowerUp("pierce"));
  if (buySlowBtn) buySlowBtn.addEventListener("click", () => void purchasePowerUp("slow"));
  if (buyMagnetBtn) buyMagnetBtn.addEventListener("click", () => void purchasePowerUp("magnet"));
  if (buyContBtn) buyContBtn.addEventListener("click", () => void purchasePowerUp("cont"));

  function closeSettings() {
    settingsOpen = false;
    hideOverlay();
    if (running && !settingsWasPaused && !storePendingNextWave) {
      paused = false;
      setStatus("Go!");
    }
  }
  settingsCloseBtn.addEventListener("click", closeSettings);
  settingsDoneBtn.addEventListener("click", closeSettings);
  setShake.addEventListener("change", () => {
    settings.shake = !!setShake.checked;
    if (!settings.shake) shakeTime = 0;
    savePrefs();
  });
  setFx.addEventListener("change", () => {
    settings.fx = !!setFx.checked;
    if (!settings.fx) {
      particles = [];
      flashTime = 0;
    }
    savePrefs();
  });
  if (setDifficulty) {
    setDifficulty.addEventListener("change", () => {
      const v = Number(setDifficulty.value || "2");
      difficultyId = [1, 2, 3, 4].includes(v) ? v : 2;
      updateDifficultyUi();
      savePrefs();
      // Recompute speeds immediately for the next spawn.
      if (!running) {
        spawnAliens();
      }
    });
  }

  // Placeholder hooks for chain integration
  // TODO: wire these to your REST/gRPC tx calls
  async function chargeCredit() {
    await ensureWallet();
    const root = await getProtoRoot();
    const MsgInsertCoin = root.lookupType("retrochain.arcade.v1.MsgInsertCoin");
    const msgBytes = MsgInsertCoin.encode({ creator: walletAddr, credits: "1", gameId: GAME_ID }).finish();
    const res = await signAndBroadcast("/retrochain.arcade.v1.MsgInsertCoin", msgBytes, "Insert Coin");
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
        name: "RetroVaders",
        description: "Classic alien-blasting shooter on RetroChain Arcade.",
        genre: 1, // GENRE_SHOOTER
        creditsPerPlay: "1",
        maxPlayers: "1",
        multiplayerEnabled: false,
        developer: DEV_PROFIT_ADDR,
        active: true,
        baseDifficulty: "1",
      },
    }).finish();

    const res = await signAndBroadcast("/retrochain.arcade.v1.MsgRegisterGame", msgBytes, "Register RetroVaders");
    const txhash = res?.tx_response?.txhash;
    setStatus(txhash ? `Registered RetroVaders. Tx: ${txhash}` : "Registered RetroVaders.");
    registerBtn.style.display = "none";
  }

  async function submitScore(finalScore) {
    await ensureWallet();
    if (!currentSessionId) currentSessionId = await waitForLatestSessionId({ timeoutMs: 8000, pollMs: 700 });
    if (!currentSessionId) throw new Error("No session id available.");
    const root = await getProtoRoot();
    const MsgSubmitScore = root.lookupType("retrochain.arcade.v1.MsgSubmitScore");
    const msgBytes = MsgSubmitScore.encode({
      creator: walletAddr,
      sessionId: String(currentSessionId),
      score: String(finalScore),
      level: String(level),
      gameOver: true,
    }).finish();
    const res = await signAndBroadcast("/retrochain.arcade.v1.MsgSubmitScore", msgBytes, "Submit RetroVaders Score");
    const txhash = res?.tx_response?.txhash;
    setStatus(txhash ? `Score submitted. Tx: ${txhash}` : "Score submitted.");

    // If this landed on the high score table and initials are missing, prompt once.
    try {
      const scores = await fetchHighScores();
      const mine = Array.isArray(scores)
        ? scores.find((s) => (s?.player || "").toLowerCase() === walletAddr.toLowerCase() && String(s?.score ?? "") === String(finalScore))
        : null;
      const initials = (mine?.initials || "").trim();
      if (mine && (!initials || initials.length !== 3)) {
        const entered = window.prompt("New high score! Enter 3-letter initials:", "AAA");
        const cleaned = (entered || "").trim().toUpperCase();
        if (cleaned && /^[A-Z]{3}$/.test(cleaned)) {
          const MsgSetHighScoreInitials = root.lookupType("retrochain.arcade.v1.MsgSetHighScoreInitials");
          const initBytes = MsgSetHighScoreInitials.encode({ creator: walletAddr, gameId: GAME_ID, initials: cleaned }).finish();
          await signAndBroadcast("/retrochain.arcade.v1.MsgSetHighScoreInitials", initBytes, "Set High Score Initials");
        }
      }
    } finally {
      await refreshLeaderboard();
    }

    // Achievements are only reflected on the global leaderboard after claiming.
    // Auto-claim a safe subset that we can pre-check via existing REST endpoints.
    try {
      if (txhash) await waitForTxCommitted(txhash);
      const claimable = await computeClaimableOnchainAchievements();
      if (claimable.length) {
        const claimRes = await claimOnchainAchievements(claimable);
        const claimHash = claimRes?.tx_response?.txhash;
        setStatus(
          claimHash
            ? `Claimed achievements: ${claimable.join(", ")}. Tx: ${claimHash}`
            : `Claimed achievements: ${claimable.join(", ")}.`
        );
        openTrophyCelebration({ achievementIds: claimable, txhash: claimHash });
        await refreshLeaderboard();
        void renderMenuBody();
      }
    } catch (e) {
      console.warn("auto-claim achievements failed", e);
    }
  }

  connectBtn.addEventListener("click", () => {
    resumeAudioFromGesture();
    sfx("ui");
    if (settings.music) startMusic();
    return void ensureWallet().catch((e) => setStatus(e?.message || String(e)));
  });
  insertBtn.addEventListener("click", () => {
    resumeAudioFromGesture();
    sfx("coin");
    return void chargeCredit().catch((e) => setStatus(e?.message || String(e)));
  });
  registerBtn.addEventListener("click", () => void registerGame().catch((e) => setStatus(e?.message || String(e))));

  window.retrochainArcade = window.retrochainArcade || {};
  window.retrochainArcade.registerSpaceInvaders = registerGame;

  // Kick off reads if already connected
  setPill("Offline: connect Keplr");
  void refreshLeaderboard();
  void refreshArcadeParams();
  updateActivePowerupHud();
  updatePowerupButtons();
  updateDifficultyUi();

  // New main screen (leaderboards/help/stats/details)
  openMenu();

  resetGame();
  draw();
})();

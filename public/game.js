(() => {
  "use strict";

  // Elements
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const hudAvatar = document.getElementById("hudAvatar");
  const hudName = document.getElementById("hudName");
  const hudScoreVal = document.getElementById("hudScoreVal");
  const hudKillsVal = document.getElementById("hudKillsVal");
  const hudRankBadge = document.getElementById("hudRankBadge");
  const hudTotalPlayers = document.getElementById("hudTotalPlayers");
  const lbList = document.getElementById("lbList");
  const btnSoundToggle = document.getElementById("btnSoundToggle");

  const miniMapCanvas = document.getElementById("miniMapCanvas");
  const miniCtx = miniMapCanvas ? miniMapCanvas.getContext("2d") : null;

  const killBanner = document.getElementById("killBanner");
  const killBannerText = document.getElementById("killBannerText");

  const welcomeModal = document.getElementById("welcomeModal");
  const previewAvatar = document.getElementById("previewAvatar");
  const previewName = document.getElementById("previewName");
  const previewRoom = document.getElementById("previewRoom");
  const authStatusNotice = document.getElementById("authStatusNotice");
  const skinListEl = document.getElementById("skinList");
  const btnStartGame = document.getElementById("btnStartGame");

  const deathModal = document.getElementById("deathModal");
  const deathScore = document.getElementById("deathScore");
  const deathKills = document.getElementById("deathKills");
  const deathRank = document.getElementById("deathRank");
  const btnRespawn = document.getElementById("btnRespawn");

  // Touch Controls
  const joystickZone = document.getElementById("joystickZone");
  const joystickBase = document.getElementById("joystickBase");
  const joystickThumb = document.getElementById("joystickThumb");
  const btnBoost = document.getElementById("btnBoost");

  // ══════════════════════════════════════════════════
  // SLITHER.IO AUTHENTIC SKINS (Stripes & Patterns)
  // ══════════════════════════════════════════════════
  const SKINS = [
    {
      id: 0,
      name: "Classic Slither",
      head: "#22c55e",
      pattern: ["#22c55e", "#16a34a", "#22c55e", "#15803d"],
      glow: "rgba(34, 197, 94, 0.45)"
    },
    {
      id: 1,
      name: "Rainbow Serpent",
      head: "#ef4444",
      pattern: ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#a855f7"],
      glow: "rgba(239, 68, 68, 0.45)"
    },
    {
      id: 2,
      name: "Cyber Neon",
      head: "#00f5d4",
      pattern: ["#00f5d4", "#00bbf9", "#7209b7", "#f72585"],
      glow: "rgba(0, 245, 212, 0.5)"
    },
    {
      id: 3,
      name: "Candy Cane",
      head: "#dc2626",
      pattern: ["#dc2626", "#ffffff", "#dc2626", "#ffffff"],
      glow: "rgba(220, 38, 38, 0.45)"
    },
    {
      id: 4,
      name: "Bumblebee",
      head: "#facc15",
      pattern: ["#facc15", "#1e293b", "#facc15", "#1e293b"],
      glow: "rgba(250, 204, 21, 0.5)"
    },
    {
      id: 5,
      name: "Solar Dragon",
      head: "#ff5400",
      pattern: ["#ff5400", "#ff0054", "#9e0059", "#ffbd00"],
      glow: "rgba(255, 84, 0, 0.5)"
    },
    {
      id: 6,
      name: "Ice Phantom",
      head: "#38bdf8",
      pattern: ["#38bdf8", "#0284c7", "#e0f2fe", "#0369a1"],
      glow: "rgba(56, 189, 248, 0.5)"
    }
  ];

  let selectedSkinIdx = 0;

  function renderSkinSelector() {
    if (!skinListEl) return;
    skinListEl.innerHTML = "";
    SKINS.forEach((s, idx) => {
      const circle = document.createElement("div");
      circle.className = `skin-circle ${idx === selectedSkinIdx ? 'selected' : ''}`;
      circle.style.background = `radial-gradient(circle at 35% 35%, ${s.head}, ${s.pattern[1] || s.head})`;
      circle.style.color = s.head;
      circle.addEventListener("click", () => {
        selectedSkinIdx = idx;
        renderSkinSelector();
      });
      skinListEl.appendChild(circle);
    });
  }
  renderSkinSelector();

  // ══════════════════════════════════════════════════
  // SYNTHESIZED SOUND EFFECTS (Web Audio API)
  // ══════════════════════════════════════════════════
  let audioCtx = null;
  let isSoundEnabled = true;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  function playSound(type) {
    if (!isSoundEnabled || !audioCtx) return;
    try {
      const now = audioCtx.currentTime;

      if (type === "eat") {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(600 + Math.random() * 200, now);
        osc.frequency.exponentialRampToValueAtTime(950, now + 0.07);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
      }

      if (type === "kill") {
        const notes = [523, 659, 784, 1046];
        notes.forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);
          gain.gain.setValueAtTime(0.12, now + idx * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.18);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + idx * 0.06);
          osc.stop(now + idx * 0.06 + 0.2);
        });
      }

      if (type === "death") {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(65, now + 0.35);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.36);
      }
    } catch (_) {}
  }

  if (btnSoundToggle) {
    btnSoundToggle.addEventListener("click", () => {
      isSoundEnabled = !isSoundEnabled;
      btnSoundToggle.textContent = isSoundEnabled ? "🔊" : "🔇";
      if (isSoundEnabled) initAudio();
    });
  }

  // ══════════════════════════════════════════════════
  // GAME STATE & CONSTANTS
  // ══════════════════════════════════════════════════
  let viewWidth = window.innerWidth;
  let viewHeight = window.innerHeight;
  let mapSize = 4000;
  let mapCenter = 2000;
  let mapRadius = 1850;

  function resize() {
    viewWidth = window.innerWidth;
    viewHeight = window.innerHeight;
    canvas.width = viewWidth;
    canvas.height = viewHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  // Network & Entities
  let ws = null;
  let myId = null;
  let myPlayer = null;
  let players = [];
  const playerEntities = new Map();
  let foods = [];
  let leaderboard = [];
  let isAlive = false;

  let currentAngle = 0;
  let isBoosting = false;
  let currentZoom = 0.95;

  const boostParticles = [];

  // Parse Game Token from URL (Hỗ trợ cả query ?token=... và clean path /play/TOKEN)
  const urlParams = new URLSearchParams(window.location.search);
  let token = urlParams.get("token") || "";

  if (!token) {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts.length >= 2 && (parts[0] === "play" || parts[0] === "p")) {
      token = parts[1];
    }
  }

  // Tự động khôi phục token từ localStorage nếu truy cập thẳng vào trang chủ
  if (!token) {
    try {
      token = localStorage.getItem("ruaxbonz_token") || "";
    } catch (_) {}
  } else {
    try {
      localStorage.setItem("ruaxbonz_token", token);
    } catch (_) {}
  }

  let playerProfile = {
    name: "Đang nhận diện danh tính...",
    roomId: "ruaxbonz_arena",
    roomName: "Đấu trường ruaxbonz.com",
    uid: ""
  };

  let hasValidAuth = false;

  // Xác thực token với server để lấy chính xác Tên Zalo thật
  if (token) {
    fetch(`/api/verify-token?token=${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.player && data.player.name) {
          playerProfile.name = String(data.player.name).trim();
          playerProfile.uid = data.player.uid || "";
          playerProfile.roomId = "ruaxbonz_arena";
          playerProfile.roomName = data.player.roomName || "Đấu trường ruaxbonz.com";
          hasValidAuth = true;
          try {
            localStorage.setItem("ruaxbonz_player_name", playerProfile.name);
          } catch (_) {}
        } else {
          hasValidAuth = false;
        }
        updateProfileUI();
      })
      .catch(() => {
        try {
          const cachedName = localStorage.getItem("ruaxbonz_player_name");
          if (cachedName) {
            playerProfile.name = cachedName;
            hasValidAuth = true;
          }
        } catch (_) {}
        updateProfileUI();
      });
  } else {
    hasValidAuth = false;
    updateProfileUI();
  }

  function updateProfileUI() {
    if (hasValidAuth && playerProfile.name) {
      if (previewName) previewName.textContent = playerProfile.name;
      if (previewRoom) previewRoom.textContent = `📍 ${playerProfile.roomName}`;
      if (hudName) hudName.textContent = playerProfile.name;
      if (authStatusNotice) authStatusNotice.style.display = "none";
      if (btnStartGame) {
        btnStartGame.disabled = false;
        btnStartGame.classList.remove("btn-disabled");
        const btnContent = btnStartGame.querySelector(".btn-content");
        if (btnContent) btnContent.textContent = "PLAY / VÀO CHIẾN 🚀";
      }
    } else {
      if (previewName) previewName.textContent = "Chưa nhận diện danh tính";
      if (authStatusNotice) {
        authStatusNotice.style.display = "block";
        authStatusNotice.innerHTML = "⚠️ <b>Chưa có link xác thực tài khoản!</b><br>Vui lòng vào nhóm Zalo gõ lệnh <code>!giun</code> để bot cấp link xác thực theo đúng tên nick của bạn!";
      }
      if (btnStartGame) {
        btnStartGame.disabled = true;
        btnStartGame.classList.add("btn-disabled");
        const btnContent = btnStartGame.querySelector(".btn-content");
        if (btnContent) btnContent.textContent = "GÕ !GIUN TRONG ZALO ĐỂ VÀO ⚠️";
      }
    }
  }

  // ══════════════════════════════════════════════════
  // SLITHER.IO HONEYCOMB (HEXAGON) PATTERN TILE
  // ══════════════════════════════════════════════════
  let hexPattern = null;

  function createHexPattern() {
    const hexCanvas = document.createElement("canvas");
    const hexCtx = hexCanvas.getContext("2d");
    const r = 26; // radius of hex cell
    const w = Math.round(r * Math.sqrt(3));
    const h = r * 3;

    hexCanvas.width = w;
    hexCanvas.height = h;

    // Slither.io dark slate background
    hexCtx.fillStyle = "#161c22";
    hexCtx.fillRect(0, 0, w, h);

    // Slither.io subtle hex lines
    hexCtx.strokeStyle = "rgba(40, 56, 75, 0.45)";
    hexCtx.lineWidth = 1.2;

    function drawHex(cx, cy, radius) {
      hexCtx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        if (i === 0) hexCtx.moveTo(x, y);
        else hexCtx.lineTo(x, y);
      }
      hexCtx.closePath();
      hexCtx.stroke();
    }

    const dy = r * 1.5;
    const dx = w;
    for (let y = -dy; y <= h + dy; y += dy) {
      const isOdd = Math.round(y / dy) % 2 !== 0;
      const xOffset = isOdd ? dx / 2 : 0;
      for (let x = -dx; x <= w + dx; x += dx) {
        drawHex(x + xOffset, y, r);
      }
    }

    hexPattern = ctx.createPattern(hexCanvas, "repeat");
  }

  // ══════════════════════════════════════════════════
  // WEBSOCKET COMMUNICATION
  // ══════════════════════════════════════════════════
  function connectWebSocket() {
    if (!hasValidAuth || !token) {
      updateProfileUI();
      return;
    }

    initAudio();
    welcomeModal.style.display = "none";

    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${location.host}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "join",
        token: token,
        skin: SKINS[selectedSkinIdx]
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "init") {
          myId = data.playerId;
          mapSize = data.mapSize || mapSize;
          mapCenter = data.mapCenter || mapSize / 2;
          mapRadius = data.mapRadius || 1850;
          isAlive = true;
          updateProfileUI();
        }

        if (data.type === "tick") {
          const rawPlayers = data.players || [];
          foods = data.foods || [];
          leaderboard = data.leaderboard || [];

          const currentIds = new Set();
          for (const rp of rawPlayers) {
            currentIds.add(rp.id);
            let p = playerEntities.get(rp.id);
            if (!p) {
              p = {
                ...rp,
                targetX: rp.x,
                targetY: rp.y,
                targetAngle: rp.angle,
                body: rp.body || []
              };
              playerEntities.set(rp.id, p);
            } else {
              p.targetX = rp.x;
              p.targetY = rp.y;
              p.targetAngle = rp.angle;
              p.radius = rp.radius;
              p.score = rp.score;
              p.kills = rp.kills;
              p.isBoosting = rp.isBoosting;
              p.name = rp.name;
              p.color = rp.color;
              p.body = rp.body;
            }
          }

          for (const id of playerEntities.keys()) {
            if (!currentIds.has(id)) {
              playerEntities.delete(id);
            }
          }

          players = Array.from(playerEntities.values());
          myPlayer = playerEntities.get(myId) || null;

          if (myPlayer) {
            hudScoreVal.textContent = myPlayer.score.toLocaleString();
            hudKillsVal.textContent = myPlayer.kills || 0;

            const myRankIdx = leaderboard.findIndex(p => p.id === myId);
            hudRankBadge.textContent = myRankIdx !== -1 ? (myRankIdx + 1) : players.length;
            hudTotalPlayers.textContent = players.length;
          }

          updateLeaderboardUI();
          renderMiniMap();
        }

        if (data.type === "dead") {
          isAlive = false;
          playSound("death");
          deathScore.textContent = (data.score || 0).toLocaleString();
          deathKills.textContent = data.kills || 0;
          const myRank = leaderboard.findIndex(p => p.id === myId);
          deathRank.textContent = myRank !== -1 ? `#${myRank + 1}` : "#--";
          deathModal.style.display = "flex";

          if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
        }

      } catch (e) {
        console.error("WS error:", e);
      }
    };

    ws.onclose = () => {
      setTimeout(connectWebSocket, 3000);
    };
  }

  btnStartGame.addEventListener("click", () => {
    connectWebSocket();
  });

  btnRespawn.addEventListener("click", () => {
    deathModal.style.display = "none";
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "respawn" }));
      isAlive = true;
    }
  });

  // ══════════════════════════════════════════════════
  // LEADERBOARD UI (Exact Slither.io Style)
  // ══════════════════════════════════════════════════
  function updateLeaderboardUI() {
    let html = "";
    leaderboard.forEach((p, idx) => {
      const isMe = p.id === myId;
      let medalClass = "";
      if (idx === 0) medalClass = "gold";
      else if (idx === 1) medalClass = "silver";
      else if (idx === 2) medalClass = "bronze";

      html += `
        <div class="lb-item ${medalClass} ${isMe ? 'me' : ''}">
          <span class="name">${idx + 1}. ${escapeHtml(p.name)}</span>
          <span class="score">${p.score.toLocaleString()}</span>
        </div>
      `;
    });
    lbList.innerHTML = html;
  }

  function escapeHtml(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ══════════════════════════════════════════════════
  // SLITHER.IO BOTTOM-RIGHT RADAR MINI MAP
  // ══════════════════════════════════════════════════
  function renderMiniMap() {
    if (!miniCtx) return;
    miniCtx.clearRect(0, 0, 94, 94);

    const centerX = 47;
    const centerY = 47;
    const radarRadius = 42;
    const scale = radarRadius / mapRadius;

    // Draw circular arena boundary on radar
    miniCtx.beginPath();
    miniCtx.arc(centerX, centerY, radarRadius, 0, Math.PI * 2);
    miniCtx.strokeStyle = "rgba(239, 68, 68, 0.4)";
    miniCtx.lineWidth = 1.5;
    miniCtx.stroke();

    // Subtle center crosshair
    miniCtx.fillStyle = "rgba(255, 255, 255, 0.08)";
    miniCtx.beginPath();
    miniCtx.arc(centerX, centerY, 1.5, 0, Math.PI * 2);
    miniCtx.fill();

    // Draw snakes on radar
    for (const p of players) {
      const isMe = p.id === myId;
      const rx = centerX + (p.x - mapCenter) * scale;
      const ry = centerY + (p.y - mapCenter) * scale;

      miniCtx.beginPath();
      miniCtx.arc(rx, ry, isMe ? 3.5 : 2, 0, Math.PI * 2);
      miniCtx.fillStyle = isMe ? "#22c55e" : "rgba(255, 255, 255, 0.65)";
      miniCtx.fill();
    }
  }

  // ══════════════════════════════════════════════════
  // TOUCH & MOUSE CONTROLS (Smooth Steering & Boost)
  // ══════════════════════════════════════════════════
  let joystickTouchId = null;
  let joystickCenter = { x: 0, y: 0 };
  const maxDistance = 55;

  joystickZone.addEventListener("touchstart", (e) => {
    e.preventDefault();
    initAudio();
    if (joystickTouchId !== null) return;

    const touch = e.changedTouches[0];
    joystickTouchId = touch.identifier;

    joystickCenter = { x: touch.clientX, y: touch.clientY };
    joystickBase.style.left = `${joystickCenter.x}px`;
    joystickBase.style.top = `${joystickCenter.y}px`;
    joystickBase.classList.add("active");
    joystickThumb.style.transform = `translate(0px, 0px)`;
  }, { passive: false });

  joystickZone.addEventListener("touchmove", (e) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchId) {
        const dx = touch.clientX - joystickCenter.x;
        const dy = touch.clientY - joystickCenter.y;
        const dist = Math.hypot(dx, dy);
        currentAngle = Math.atan2(dy, dx);

        const clampedDist = Math.min(dist, maxDistance);
        const thumbX = (dx / (dist || 1)) * clampedDist;
        const thumbY = (dy / (dist || 1)) * clampedDist;

        joystickThumb.style.transform = `translate(${thumbX}px, ${thumbY}px)`;
        sendInput();
        break;
      }
    }
  }, { passive: false });

  function resetJoystick() {
    joystickTouchId = null;
    joystickBase.classList.remove("active");
    joystickThumb.style.transform = `translate(0px, 0px)`;
  }

  joystickZone.addEventListener("touchend", (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchId) {
        resetJoystick();
        break;
      }
    }
  });

  joystickZone.addEventListener("touchcancel", resetJoystick);

  // Boost Button
  btnBoost.addEventListener("touchstart", (e) => {
    e.preventDefault();
    initAudio();
    isBoosting = true;
    btnBoost.classList.add("boosting");
    sendInput();
    if (navigator.vibrate) navigator.vibrate(25);
  }, { passive: false });

  btnBoost.addEventListener("touchend", (e) => {
    e.preventDefault();
    isBoosting = false;
    btnBoost.classList.remove("boosting");
    sendInput();
  }, { passive: false });

  btnBoost.addEventListener("touchcancel", () => {
    isBoosting = false;
    btnBoost.classList.remove("boosting");
    sendInput();
  });

  // Desktop Mouse Guide (Snake follows cursor smoothly like real Slither.io)
  window.addEventListener("mousemove", (e) => {
    if (joystickTouchId === null && myPlayer) {
      const screenCenterX = viewWidth / 2;
      const screenCenterY = viewHeight / 2;
      currentAngle = Math.atan2(e.clientY - screenCenterY, e.clientX - screenCenterX);
      sendInput();
    }
  });

  window.addEventListener("mousedown", (e) => {
    if (e.target.closest(".modal-glass-card") || e.target.closest("#boostZone")) return;
    isBoosting = true;
    sendInput();
  });

  window.addEventListener("mouseup", () => {
    isBoosting = false;
    sendInput();
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      isBoosting = true;
      sendInput();
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.code === "Space") {
      isBoosting = false;
      sendInput();
    }
  });

  // Throttled Send Input
  let lastSendTime = 0;
  function sendInput() {
    const now = performance.now();
    if (now - lastSendTime < 32) return;
    lastSendTime = now;

    if (ws && ws.readyState === WebSocket.OPEN && isAlive) {
      ws.send(JSON.stringify({
        type: "input",
        angle: currentAngle,
        boost: isBoosting
      }));
    }
  }

  // ══════════════════════════════════════════════════
  // RENDER GAME (60 FPS SLITHER.IO CANVAS ENGINE)
  // ══════════════════════════════════════════════════
  function render() {
    requestAnimationFrame(render);

    ctx.clearRect(0, 0, viewWidth, viewHeight);

    // Smooth Lerp positions & angles for all players at 60 FPS
    for (const p of playerEntities.values()) {
      if (typeof p.targetX === "number") p.x += (p.targetX - p.x) * 0.35;
      if (typeof p.targetY === "number") p.y += (p.targetY - p.y) * 0.35;
      if (typeof p.targetAngle === "number") {
        let diff = p.targetAngle - p.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        p.angle += diff * 0.35;
      }
    }

    // Camera follow & Dynamic Zoom
    let camX = mapCenter;
    let camY = mapCenter;
    if (myPlayer) {
      camX = myPlayer.x;
      camY = myPlayer.y;

      const targetZoom = Math.max(0.48, Math.min(1.0, 0.95 / (1 + (myPlayer.score * 0.00045))));
      currentZoom += (targetZoom - currentZoom) * 0.04;
    }

    ctx.save();
    ctx.translate(viewWidth / 2, viewHeight / 2);
    ctx.scale(currentZoom, currentZoom);
    ctx.translate(-camX, -camY);

    // 1. Dark Slither.io Honeycomb Background
    drawHexBackground();

    // 2. Circular Glowing Forcefield Border
    drawMapBorders();

    // 3. Glowing Energy Orbs (Foods) with Viewport Culling
    drawFoods(camX, camY);

    // 4. Boost Sparks & Tail Mass
    drawBoostParticles();

    // 5. Authentic Slither Snakes (Fast 3D spheres without blur)
    drawSnakes();

    ctx.restore();
  }

  function drawHexBackground() {
    if (!hexPattern) createHexPattern();

    // Fill the circular arena with hexagonal pattern
    ctx.save();
    ctx.beginPath();
    ctx.arc(mapCenter, mapCenter, mapRadius, 0, Math.PI * 2);
    ctx.fillStyle = hexPattern;
    ctx.fill();
    ctx.restore();
  }

  function drawMapBorders() {
    ctx.beginPath();
    ctx.arc(mapCenter, mapCenter, mapRadius, 0, Math.PI * 2);
    ctx.strokeStyle = "#ff1744";
    ctx.lineWidth = 12;
    ctx.stroke();

    // Outer dark abyss
    ctx.beginPath();
    ctx.arc(mapCenter, mapCenter, mapRadius + 500, 0, Math.PI * 2);
    ctx.arc(mapCenter, mapCenter, mapRadius, 0, Math.PI * 2, true);
    ctx.fillStyle = "#0c1015";
    ctx.fill();
  }

  function drawFoods(camX, camY) {
    const time = Date.now() * 0.004;

    // Viewport frustum culling: Chỉ render các hạt mồi nằm trong khung nhìn màn hình
    const halfW = (viewWidth / 2) / currentZoom + 70;
    const halfH = (viewHeight / 2) / currentZoom + 70;
    const minX = camX - halfW;
    const maxX = camX + halfW;
    const minY = camY - halfH;
    const maxY = camY + halfH;

    for (let i = 0; i < foods.length; i++) {
      const food = foods[i];
      const fx = food[0];
      const fy = food[1];
      if (fx < minX || fx > maxX || fy < minY || fy > maxY) continue;

      const val = food[2];
      const color = food[3] || "#22c55e";
      const pulse = 1 + Math.sin(time + fx * 0.15 + fy * 0.1) * 0.15;
      const r = (val > 2 ? 6.5 + Math.min(val, 5) : 4.5) * pulse;

      // 1. Soft glowing outer ring (Tăng tốc phần cứng GPU, không tốn shadowBlur)
      ctx.beginPath();
      ctx.arc(fx, fy, r * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = color + "40";
      ctx.fill();

      // 2. Shiny solid orb core
      ctx.beginPath();
      ctx.arc(fx, fy, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // 3. Crisp white center highlight
      ctx.beginPath();
      ctx.arc(fx - r * 0.28, fy - r * 0.28, r * 0.32, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
  }

  function drawBoostParticles() {
    for (let i = boostParticles.length - 1; i >= 0; i--) {
      const p = boostParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.04;
      p.radius *= 0.95;

      if (p.alpha <= 0) {
        boostParticles.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.rgb}, ${p.alpha})`;
      ctx.fill();
    }
  }

  function drawSnakes() {
    for (const p of players) {
      const body = p.body || [];
      const skin = p.color || SKINS[0];
      const pattern = skin.pattern || [skin.head || "#22c55e", skin.body1 || "#16a34a"];
      const radius = p.radius || 16;

      // Boost particles dropped behind tail
      if (p.isBoosting && body.length > 2 && Math.random() < 0.45) {
        const tail = body[body.length - 1];
        boostParticles.push({
          x: tail[0] + (Math.random() - 0.5) * radius,
          y: tail[1] + (Math.random() - 0.5) * radius,
          vx: -Math.cos(p.angle) * 2.5 + (Math.random() - 0.5),
          vy: -Math.sin(p.angle) * 2.5 + (Math.random() - 0.5),
          radius: Math.random() * 4 + 2,
          alpha: 0.85,
          rgb: "34, 197, 94"
        });
      }

      // 1. Draw Body Segments (3D Glossy Striped Spheres)
      for (let i = body.length - 1; i >= 0; i--) {
        const seg = body[i];
        const segRadius = Math.max(7, radius * (0.65 + 0.35 * (1 - i / body.length)));
        const colorIdx = i % pattern.length;
        const baseColor = pattern[colorIdx];

        // Body sphere
        ctx.beginPath();
        ctx.arc(seg[0], seg[1], segRadius, 0, Math.PI * 2);
        ctx.fillStyle = baseColor;
        ctx.fill();

        // 3D Glossy highlight dot
        ctx.beginPath();
        ctx.arc(seg[0] - segRadius * 0.25, seg[1] - segRadius * 0.25, segRadius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.32)";
        ctx.fill();
      }

      // 2. Snake Head & Cartoon Googly Eyes
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      // Head circle
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = skin.head || "#22c55e";
      ctx.fill();

      // Head 3D sheen
      ctx.beginPath();
      ctx.arc(-radius * 0.25, -radius * 0.25, radius * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.fill();

      // Slither.io Cartoon Googly Eyes
      const eyeOffsetX = radius * 0.35;
      const eyeOffsetY = radius * 0.45;
      const eyeRadius = radius * 0.28;
      const pupilRadius = radius * 0.15;

      [-eyeOffsetY, eyeOffsetY].forEach(offsetY => {
        // Eye White
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(eyeOffsetX, offsetY, eyeRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#161c22";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Eye Pupil
        const lookX = eyeOffsetX + pupilRadius * 0.55;
        ctx.fillStyle = "#0c1015";
        ctx.beginPath();
        ctx.arc(lookX, offsetY, pupilRadius, 0, Math.PI * 2);
        ctx.fill();

        // Catchlight
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(lookX + 1, offsetY - 1, pupilRadius * 0.35, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();

      // 3. Name Tag Floating Label (Crisp Outlined Text)
      ctx.save();
      ctx.font = "bold 13px 'Nunito', 'Outfit', sans-serif";
      ctx.textAlign = "center";
      const nameY = p.y - radius - 10;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
      ctx.lineWidth = 3;
      ctx.strokeText(p.name, p.x, nameY);
      ctx.fillStyle = p.id === myId ? "#22c55e" : "#ffffff";
      ctx.fillText(p.name, p.x, nameY);
      ctx.restore();
    }
  }

  // Khởi động Canvas Engine
  render();

})();
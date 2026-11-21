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
  // CÁC MÀU GIUN ĐƠN GIẢN, TƯƠI SÁNG, DỄ THƯƠNG
  // ══════════════════════════════════════════════════
  const SKINS = [
    {
      id: 0,
      name: "Xanh Lá",
      head: "#22c55e",
      pattern: ["#22c55e", "#16a34a"],
      glow: "rgba(34, 197, 94, 0.35)"
    },
    {
      id: 1,
      name: "Xanh Biển",
      head: "#06b6d4",
      pattern: ["#06b6d4", "#0284c7"],
      glow: "rgba(6, 182, 212, 0.35)"
    },
    {
      id: 2,
      name: "Đỏ",
      head: "#ef4444",
      pattern: ["#ef4444", "#b91c1c"],
      glow: "rgba(239, 68, 68, 0.35)"
    },
    {
      id: 3,
      name: "Vàng",
      head: "#eab308",
      pattern: ["#eab308", "#ca8a04"],
      glow: "rgba(234, 179, 8, 0.35)"
    },
    {
      id: 4,
      name: "Tím",
      head: "#a855f7",
      pattern: ["#a855f7", "#7e22ce"],
      glow: "rgba(168, 85, 247, 0.35)"
    },
    {
      id: 5,
      name: "Cam",
      head: "#f97316",
      pattern: ["#f97316", "#c2410c"],
      glow: "rgba(249, 115, 22, 0.35)"
    },
    {
      id: 6,
      name: "Hồng",
      head: "#ec4899",
      pattern: ["#ec4899", "#be185d"],
      glow: "rgba(236, 72, 153, 0.35)"
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

  // Parse Game Token / Session Code from URL
  const urlParams = new URLSearchParams(window.location.search);
  let sessionCode = (urlParams.get("c") || urlParams.get("code") || "").trim();
  let token = (urlParams.get("token") || "").trim();

  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts.length >= 2) {
    if (parts[0] === "p") {
      sessionCode = parts[1];
    } else if (parts[0] === "play") {
      token = parts[1];
    }
  }

  // Tự động khôi phục danh tính từ localStorage nếu vào trực tiếp trang chủ
  if (!sessionCode && !token) {
    try {
      sessionCode = localStorage.getItem("ruaxbonz_code") || "";
      token = localStorage.getItem("ruaxbonz_token") || "";
    } catch (_) {}
  } else {
    try {
      if (sessionCode) localStorage.setItem("ruaxbonz_code", sessionCode);
      if (token) localStorage.setItem("ruaxbonz_token", token);
    } catch (_) {}
  }

  const cachedLastName = (() => {
    try { return localStorage.getItem("ruaxbonz_player_name") || ""; } catch (_) { return ""; }
  })();

  let playerProfile = {
    name: cachedLastName || "Chiến Thần",
    roomId: "ruaxbonz_arena",
    roomName: "Đấu trường ruaxbonz.com",
    uid: ""
  };

  let isZaloVerified = Boolean(cachedLastName);

  // 1. Kiểm tra session code ngắn trước (nếu có)
  if (sessionCode) {
    fetch(`/api/get-session?code=${encodeURIComponent(sessionCode)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.player && data.player.name) {
          playerProfile.name = String(data.player.name).trim();
          playerProfile.uid = data.player.uid || "";
          playerProfile.roomId = "ruaxbonz_arena";
          playerProfile.roomName = data.player.roomName || "Đấu trường ruaxbonz.com";
          isZaloVerified = true;
          try {
            localStorage.setItem("ruaxbonz_player_name", playerProfile.name);
          } catch (_) {}
        }
        updateProfileUI();
      })
      .catch(() => updateProfileUI());
  } else if (token) {
    // 2. Kiểm tra token mã hóa nếu không có session code
    fetch(`/api/verify-token?token=${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.player && data.player.name) {
          playerProfile.name = String(data.player.name).trim();
          playerProfile.uid = data.player.uid || "";
          playerProfile.roomId = "ruaxbonz_arena";
          playerProfile.roomName = data.player.roomName || "Đấu trường ruaxbonz.com";
          isZaloVerified = true;
          try {
            localStorage.setItem("ruaxbonz_player_name", playerProfile.name);
          } catch (_) {}
        }
        updateProfileUI();
      })
      .catch(() => updateProfileUI());
  } else {
    updateProfileUI();
  }

  function updateProfileUI() {
    if (previewName) previewName.textContent = playerProfile.name;
    if (previewRoom) previewRoom.textContent = `📍 ${playerProfile.roomName}`;
    if (hudName) hudName.textContent = playerProfile.name;

    // Không bao giờ khóa người chơi!
    if (btnStartGame) {
      btnStartGame.disabled = false;
      btnStartGame.classList.remove("btn-disabled");
      const btnContent = btnStartGame.querySelector(".btn-content");
      if (btnContent) btnContent.textContent = "PLAY / VÀO CHIẾN 🚀";
    }

    if (authStatusNotice) {
      if (!isZaloVerified) {
        authStatusNotice.style.display = "block";
        authStatusNotice.innerHTML = "💡 Muốn hiển thị <b>tên nick Zalo thật</b>? Vào nhóm Zalo gõ lệnh <code>!giun</code> để bot cấp link xác thực riêng nhé!";
      } else {
        authStatusNotice.style.display = "none";
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
    initAudio();
    welcomeModal.style.display = "none";

    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${location.host}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "join",
        code: sessionCode,
        token: token,
        name: playerProfile.name,
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
    // Viewport frustum culling: Chỉ render các hạt mồi nằm trong khung nhìn màn hình
    const halfW = (viewWidth / 2) / currentZoom + 50;
    const halfH = (viewHeight / 2) / currentZoom + 50;
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
      const r = val > 2 ? 6 + Math.min(val, 4) : 4.5;

      // Hạt mồi tròn đơn giản, rõ ràng, không giật lag
      ctx.beginPath();
      ctx.arc(fx, fy, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Điểm tâm mồi trắng nhỏ nhẹ
      ctx.beginPath();
      ctx.arc(fx, fy, r * 0.38, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
      ctx.fill();
    }
  }

  function drawBoostParticles() {
    for (let i = boostParticles.length - 1; i >= 0; i--) {
      const p = boostParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.05;
      p.radius *= 0.94;

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
      const radius = p.radius || 15;

      // Boost particle nhẹ nhàng sau đuôi
      if (p.isBoosting && body.length > 2 && Math.random() < 0.35) {
        const tail = body[body.length - 1];
        boostParticles.push({
          x: tail[0],
          y: tail[1],
          vx: -Math.cos(p.angle) * 1.5,
          vy: -Math.sin(p.angle) * 1.5,
          radius: 3,
          alpha: 0.6,
          rgb: "255, 255, 255"
        });
      }

      // 1. Thân con giun - Đơn giản, tròn trịa, mượt mà
      for (let i = body.length - 1; i >= 0; i--) {
        const seg = body[i];
        const segRadius = Math.max(7, radius * (0.7 + 0.3 * (1 - i / body.length)));
        const colorIdx = i % pattern.length;
        const baseColor = pattern[colorIdx];

        // Đốt tròn trơn sạch sẽ
        ctx.beginPath();
        ctx.arc(seg[0], seg[1], segRadius, 0, Math.PI * 2);
        ctx.fillStyle = baseColor;
        ctx.fill();

        // Viền đốt nhẹ giúp thân giun mềm mại rõ nét
        ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // 2. Đầu con giun tròn & 2 mắt tròn xoe hoạt hình đơn giản
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      // Đầu tròn đơn giản cùng màu thân
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = skin.head || pattern[0] || "#22c55e";
      ctx.fill();
      ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 2 mắt tròn hoạt hình ngộ nghĩnh
      const eyeOffsetX = radius * 0.32;
      const eyeOffsetY = radius * 0.42;
      const eyeRadius = radius * 0.32;
      const pupilRadius = radius * 0.16;

      [-eyeOffsetY, eyeOffsetY].forEach(offsetY => {
        // Tròng trắng
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(eyeOffsetX, offsetY, eyeRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Con ngươi đen nhìn về phía trước theo hướng đi
        const lookX = eyeOffsetX + pupilRadius * 0.55;
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.arc(lookX, offsetY, pupilRadius, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();

      // 3. Tên người chơi nổi trên đầu giun
      ctx.save();
      ctx.font = "bold 13px 'Nunito', 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      const nameY = p.y - radius - 8;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
      ctx.lineWidth = 3;
      ctx.strokeText(p.name, p.x, nameY);
      ctx.fillStyle = p.id === myId ? "#4ade80" : "#ffffff";
      ctx.fillText(p.name, p.x, nameY);
      ctx.restore();
    }
  }

  // Khởi động Canvas Engine
  render();

})();
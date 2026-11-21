const express = require("express");
const http = require("http");
const path = require("path");
const { WebSocketServer, WebSocket } = require("ws");
const { verifyGameToken } = require("./tokenHelper");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3150;
const MAP_SIZE = 7000;
const MAP_CENTER = 3500;
const MAP_RADIUS = 3200;
const TICK_RATE = 20; // 20 fps ticks (50ms interval)
const TICK_INTERVAL = 1000 / TICK_RATE;
const GLOBAL_ROOM_ID = "ruaxbonz_arena";
const MAX_FOODS = 220; // Giới hạn tối đa 220 hạt mồi, tuyệt đối không phình to gây nghẽn mạng
const MAX_BODY_SEGMENTS = 90; // Giới hạn 90 đốt thân, đảm bảo nhẹ nhàng 60 FPS mà thân giun dài đẹp

// Bộ nhớ lưu các phiên chơi tạo từ Bot Zalo (Session ngắn 6 ký tự)
const activeSessions = new Map();
const usedTokens = new Set();

// Hàng đợi sự kiện game để bot Zalo nhận và gửi tin nhắn chúc mừng (Atomic Consume)
const gameEventsQueue = [];

function pushGameEvent(evt) {
  evt.id = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  evt.ts = Date.now();
  evt.consumed = false;
  gameEventsQueue.push(evt);

  // Giữ tối đa 50 sự kiện trong 2 phút
  const cutoff = Date.now() - 120000;
  while (gameEventsQueue.length > 50 || (gameEventsQueue.length > 0 && gameEventsQueue[0].ts < cutoff)) {
    gameEventsQueue.shift();
  }
}

// Endpoint lấy và tiêu thụ sự kiện (Chỉ bot tương ứng xử lý, tránh cướp event của nhau)
app.post("/api/consume-game-events", (req, res) => {
  const filterBotKey = String(req.body?.botKey || "main").trim();
  const unconsumed = [];
  const now = Date.now();

  for (const evt of gameEventsQueue) {
    const evtBotKey = String(evt.botKey || "main").trim();
    if (!evt.consumed && evtBotKey === filterBotKey && (now - evt.ts < 60000)) {
      evt.consumed = true;
      unconsumed.push(evt);
    }
  }

  return res.json({ success: true, events: unconsumed });
});

// Endpoint GET lịch sử sự kiện
app.get("/api/game-events", (req, res) => {
  const since = Number(req.query.since || 0);
  const events = gameEventsQueue.filter(e => e.ts > since);
  return res.json({ success: true, events });
});

// Trang 404 tự hủy chuẩn Cyberpunk khi link đã hết hạn hoặc đã được sử dụng
const RENDER_404_HTML = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>404 - Link đã tự hủy | ruaxbonz.com</title>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #111822;
      color: #fff;
      font-family: 'Nunito', -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
      text-align: center;
    }
    .card {
      background: rgba(22, 28, 34, 0.92);
      border: 1.5px solid rgba(239, 68, 68, 0.45);
      border-radius: 24px;
      padding: 36px 24px;
      max-width: 380px;
      width: 100%;
      box-shadow: 0 12px 35px rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(12px);
    }
    .skull-icon {
      font-size: 52px;
      margin-bottom: 12px;
      animation: float 2.5s ease-in-out infinite;
    }
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }
    .code-badge {
      display: inline-block;
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 1.5px;
      padding: 4px 14px;
      border-radius: 12px;
      margin-bottom: 14px;
      border: 1px solid rgba(239, 68, 68, 0.35);
    }
    .title {
      font-size: 22px;
      font-weight: 900;
      margin-bottom: 12px;
      color: #f8fafc;
    }
    .desc {
      font-size: 14px;
      color: #94a3b8;
      line-height: 1.6;
      margin-bottom: 24px;
      font-weight: 600;
    }
    .instruction-box {
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 14px;
      padding: 14px;
      font-size: 13px;
      color: #cbd5e1;
      line-height: 1.5;
    }
    .instruction-box code {
      background: #22c55e;
      color: #0c1015;
      padding: 2px 8px;
      border-radius: 6px;
      font-weight: 900;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="skull-icon">💀</div>
    <div class="code-badge">ERROR 404</div>
    <h1 class="title">LINK ĐÃ TỰ HỦY!</h1>
    <p class="desc">Link này chỉ sử dụng 1 lần và đã tự động hủy sau khi vào game hoặc khi có người gõ lệnh mới.</p>
    <div class="instruction-box">
      👉 Vào nhóm Zalo gõ lệnh <code>!giun</code> để bot cấp link mới chính chủ!
    </div>
  </div>
</body>
</html>
`;

// Tự động dọn dẹp session quá 24h
setInterval(() => {
  const now = Date.now();
  for (const [code, s] of activeSessions.entries()) {
    if (now - s.ts > 86400000) activeSessions.delete(code);
  }
}, 3600000);

// Log incoming requests for easy debugging
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

// Serve static frontend FIRST so /style.css, /game.js, etc. never get intercepted
app.use(express.static(path.join(__dirname, "public")));

// Route trang chủ
app.get(["/", "/play", "/p"], (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Route link ngắn /p/:code - Tự hủy trả về 404 nếu session không tồn tại hoặc đã dùng
app.get("/p/:code", (req, res) => {
  const code = String(req.params.code || "").trim().toLowerCase();
  const session = activeSessions.get(code);

  if (!session || session.used) {
    return res.status(404).send(RENDER_404_HTML);
  }

  return res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Route /play/:token - Tự hủy trả về 404 nếu token không hợp lệ hoặc đã dùng
app.get("/play/:token", (req, res) => {
  const token = String(req.params.token || "").trim();
  if (usedTokens.has(token)) {
    return res.status(404).send(RENDER_404_HTML);
  }
  const decoded = verifyGameToken(token);
  if (!decoded) {
    return res.status(404).send(RENDER_404_HTML);
  }
  return res.sendFile(path.join(__dirname, "public", "index.html"));
});

// API tạo session ngắn từ Bot Zalo - TỰ HỦY LINK CŨ CỦA NGƯỜI ĐÓ
app.post("/api/create-session", (req, res) => {
  const { uid, name, roomName, threadId, threadType, botKey } = req.body || {};
  const cleanName = String(name || "Chiến Thần").trim().slice(0, 25);
  const cleanUid = String(uid || "").trim();
  const cleanThreadId = String(threadId || "").trim();
  const cleanThreadType = threadType !== undefined ? Number(threadType) : 1;
  const cleanBotKey = String(botKey || "main").trim();

  // 1. Tự hủy tất cả link cũ của UID này nếu họ gõ lại lệnh !giun
  if (cleanUid) {
    for (const [oldCode, s] of activeSessions.entries()) {
      if (s.uid === cleanUid) {
        activeSessions.delete(oldCode);
      }
    }
  }

  // 2. Tạo mã ngắn 6 ký tự ngẫu nhiên mới
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  activeSessions.set(code.toLowerCase(), {
    uid: cleanUid,
    name: cleanName,
    roomName: roomName || "ruaxbonz.com",
    threadId: cleanThreadId,
    threadType: cleanThreadType,
    botKey: cleanBotKey,
    ts: Date.now(),
    used: false
  });

  return res.json({
    success: true,
    code,
    name: cleanName,
    url: `https://giun.ruaxbonz.com/p/${code}`
  });
});

// API lấy thông tin session theo mã ngắn
app.get("/api/get-session", (req, res) => {
  const code = String(req.query.code || "").trim().toLowerCase();
  const session = activeSessions.get(code);
  if (session && !session.used) {
    return res.json({ success: true, player: session });
  }
  return res.status(404).json({ success: false, message: "Link đã tự hủy hoặc đã hết hạn" });
});

// API verify token endpoint (for backward compatibility)
app.get("/api/verify-token", (req, res) => {
  const token = (req.query.token || "").trim();
  if (!token) {
    return res.json({ success: false, message: "Thiếu token" });
  }
  const decoded = verifyGameToken(token);
  if (decoded) {
    return res.json({ success: true, player: decoded });
  }
  return res.json({ success: false, message: "Token không hợp lệ hoặc đã hết hạn" });
});

// Proxy avatar endpoint để tránh lỗi CORS khi load ảnh Zalo avatar lên Canvas
app.get("/api/avatar-proxy", async (req, res) => {
  const url = req.query.url;
  if (!url || !url.startsWith("http")) {
    return res.status(400).send("Invalid url");
  }
  try {
    const axios = require("axios");
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 5000,
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://chat.zalo.me/"
      }
    });
    res.set("Content-Type", response.headers["content-type"] || "image/jpeg");
    res.set("Cache-Control", "public, max-age=86400");
    return res.send(Buffer.from(response.data));
  } catch (err) {
    return res.status(404).send("Error fetching avatar");
  }
});

// ========================================================
// GAME ROOM & PHYSICS LOGIC
// ========================================================

const SNAKE_COLORS = [
  // 1. Việt Nam 🇻🇳 (Cờ đỏ sao vàng)
  { head: "#ef4444", pattern: ["#ef4444", "#facc15", "#ef4444"], special: "star", name: "Việt Nam 🇻🇳" },
  // 2. Cầu Vồng 🌈 (Rainbow Slither)
  { head: "#ef4444", pattern: ["#ef4444", "#f97316", "#facc15", "#22c55e", "#06b6d4", "#3b82f6", "#a855f7"], name: "Cầu Vồng 🌈" },
  // 3. Ong Vàng 🐝 (Bumblebee sọc đen vàng)
  { head: "#fbbf24", pattern: ["#fbbf24", "#fbbf24", "#18181b", "#18181b"], name: "Ong Vàng 🐝" },
  // 4. Dưa Hấu 🍉 (Watermelon sọc xanh đỏ)
  { head: "#15803d", pattern: ["#16a34a", "#22c55e", "#ef4444", "#dc2626"], name: "Dưa Hấu 🍉" },
  // 5. Kẹo Bạc Hà 🍬 (Candy Cane trắng đỏ)
  { head: "#ef4444", pattern: ["#ef4444", "#ffffff", "#ef4444", "#ffffff"], name: "Kẹo Bạc Hà 🍬" },
  // 6. Băng Tuyết ❄️ (Ice Frost xanh băng)
  { head: "#38bdf8", pattern: ["#38bdf8", "#7dd3fc", "#e0f2fe", "#0284c7"], name: "Băng Tuyết ❄️" },
  // 7. Hắc Ám 🥷 (Shadow Ninja đen tím)
  { head: "#1e1e24", pattern: ["#18181b", "#27272a", "#7c3aed", "#18181b"], special: "ninja", name: "Hắc Ám 🥷" },
  // 8. Hoàng Gia 👑 (Royal Gold vàng kim)
  { head: "#eab308", pattern: ["#eab308", "#ca8a04", "#fef08a", "#eab308"], special: "crown", name: "Hoàng Gia 👑" },
  // 9. Lửa Đỏ 🔥 (Fire Flame đỏ cam vàng)
  { head: "#dc2626", pattern: ["#dc2626", "#ea580c", "#f59e0b", "#f97316"], name: "Lửa Đỏ 🔥" },
  // 10. Độc Dược 🧪 (Toxic Neon tím xanh lá)
  { head: "#9333ea", pattern: ["#9333ea", "#22c55e", "#7e22ce", "#16a34a"], name: "Độc Dược 🧪" },
  // 11. Captain 🇺🇸 (Cờ Mỹ xanh trắng đỏ)
  { head: "#2563eb", pattern: ["#2563eb", "#ffffff", "#dc2626", "#ffffff"], name: "Captain 🇺🇸" },
  // 12. Xanh Lục 🌱 (Classic Green Slither gốc)
  { head: "#22c55e", pattern: ["#22c55e", "#16a34a", "#22c55e", "#15803d"], name: "Xanh Lục 🌱" }
];

const rooms = new Map();

const TARGET_BOT_COUNT = 8;

const BOT_NAMES = [
  "Bé Giun 🐛", "Giun Nhí 👶", "Sâu Con 🍎", "Bé Na 🐍", "Giun Đất 🌱",
  "Sâu Bướm 🦋", "Bé Đậu 🥜", "Bé Tèo 👦", "Giun Sọc 🎨", "Sâu Róm 🐛",
  "Bé Xíu 🐣", "Bé Mập 🍔", "Giun Tốc Độ ⚡", "Sâu Siêu Quậy 😜", "Bé Bo 🍼",
  "Giun Cầu Vồng 🌈", "Bé Heo 🐷", "Sâu Lười 😴", "Bé Bí Đỏ 🎃", "Giun Tí Hon 🐜"
];

function spawnBotWorm(room) {
  const botId = "bot_" + (room.nextBotId++);
  const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
  const colorScheme = SNAKE_COLORS[Math.floor(Math.random() * SNAKE_COLORS.length)];

  const spawnAngle = Math.random() * Math.PI * 2;
  const spawnDist = Math.random() * (MAP_RADIUS * 0.75);
  const startX = Math.floor(MAP_CENTER + Math.cos(spawnAngle) * spawnDist);
  const startY = Math.floor(MAP_CENTER + Math.sin(spawnAngle) * spawnDist);
  const startAngle = Math.random() * Math.PI * 2;

  const initialScore = 8 + Math.floor(Math.random() * 15);
  const initialLength = Math.floor(12 + initialScore * 0.6);

  const bot = {
    id: botId,
    ws: null,
    isBot: true,
    uid: "",
    name,
    avatar: "",
    x: startX,
    y: startY,
    angle: startAngle,
    targetAngle: startAngle,
    speed: 3.5 + Math.random() * 0.5,
    baseSpeed: 3.5 + Math.random() * 0.5,
    boostSpeed: 6.8,
    isBoosting: false,
    radius: 9.5, // Kích thước ban đầu nhỏ vừa y đúc Slither.io
    score: initialScore,
    kills: 0,
    alive: true,
    color: colorScheme,
    body: [],
    nextDecisionTime: Date.now() + Math.random() * 1500,
    boostUntil: 0
  };

  for (let i = 0; i < initialLength; i++) {
    bot.body.push({
      x: startX - Math.cos(startAngle) * i * 6,
      y: startY - Math.sin(startAngle) * i * 6
    });
  }

  room.players.set(bot.id, bot);
  return bot;
}

function getOrCreateRoom(roomId, roomName = "Đại Chiến Giun") {
  if (!rooms.has(roomId)) {
    const room = {
      id: roomId,
      name: roomName,
      players: new Map(),
      foods: [],
      nextFoodId: 1,
      nextBotId: 1,
      lastTick: Date.now()
    };

    // Tạo mồi ban đầu
    spawnInitialFoods(room, 150);

    // Bắt đầu vòng lặp tick cho phòng
    room.interval = setInterval(() => tickRoom(room), TICK_INTERVAL);
    rooms.set(roomId, room);

    // Sinh đàn giun con ban đầu
    for (let i = 0; i < TARGET_BOT_COUNT; i++) {
      spawnBotWorm(room);
    }
  }
  return rooms.get(roomId);
}

function spawnInitialFoods(room, count) {
  for (let i = 0; i < count; i++) {
    spawnFood(room);
  }
}

function spawnFood(room, x, y, val = 1) {
  if (room.foods.length >= MAX_FOODS) {
    room.foods.shift();
  }
  let fx = x;
  let fy = y;
  if (fx === undefined || fy === undefined) {
    const r = Math.sqrt(Math.random()) * (MAP_RADIUS - 80);
    const a = Math.random() * Math.PI * 2;
    fx = Math.floor(MAP_CENTER + r * Math.cos(a));
    fy = Math.floor(MAP_CENTER + r * Math.sin(a));
  }
  const colorObj = SNAKE_COLORS[Math.floor(Math.random() * SNAKE_COLORS.length)];
  const food = {
    id: room.nextFoodId++,
    x: fx,
    y: fy,
    radius: val > 2 ? 5.2 + Math.min(val, 2.5) : 3.2, // Hạt mồi nhỏ vừa, thanh thoát
    val: val,
    color: colorObj.head
  };
  room.foods.push(food);
}

function spawnPlayer(room, ws, playerInfo) {
  const colorScheme = playerInfo.skin || SNAKE_COLORS[Math.floor(Math.random() * SNAKE_COLORS.length)];
  const spawnAngle = Math.random() * Math.PI * 2;
  const spawnDist = Math.random() * (MAP_RADIUS * 0.65);
  const startX = Math.floor(MAP_CENTER + Math.cos(spawnAngle) * spawnDist);
  const startY = Math.floor(MAP_CENTER + Math.sin(spawnAngle) * spawnDist);
  const startAngle = Math.random() * Math.PI * 2;

  const player = {
    id: ws.playerId,
    ws,
    uid: playerInfo.uid || "",
    name: playerInfo.name || "Chiến Thần",
    avatar: playerInfo.avatar || "",
    threadId: playerInfo.threadId || "",
    threadType: playerInfo.threadType !== undefined ? playerInfo.threadType : 1,
    botKey: playerInfo.botKey || "main",
    x: startX,
    y: startY,
    angle: startAngle,
    targetAngle: startAngle,
    speed: 3.8,
    baseSpeed: 3.8,
    boostSpeed: 7.2,
    isBoosting: false,
    radius: 9.5, // Kích thước ban đầu thon nhỏ vừa chuẩn Slither.io
    score: 10,
    kills: 0,
    alive: true,
    color: colorScheme,
    body: []
  };

  // Khởi tạo các đoạn thân ban đầu
  const initialLength = 18;
  for (let i = 0; i < initialLength; i++) {
    player.body.push({
      x: startX - Math.cos(startAngle) * i * 6,
      y: startY - Math.sin(startAngle) * i * 6
    });
  }

  room.players.set(player.id, player);
  return player;
}

function killPlayer(room, player) {
  if (!player.alive) return;
  player.alive = false;

  // Thân giun nổ thành chuỗi mồi to (giới hạn tối đa 16 hạt mồi giá trị cao, tránh spam mồi nghẽn server)
  const body = player.body || [];
  const dropCount = Math.min(16, Math.max(4, Math.floor(body.length / 4)));
  const step = Math.max(1, Math.floor(body.length / dropCount));
  for (let i = 0; i < body.length && i < dropCount * step; i += step) {
    const seg = body[i];
    spawnFood(
      room,
      seg.x + (Math.random() - 0.5) * 16,
      seg.y + (Math.random() - 0.5) * 16,
      4 + Math.floor(Math.random() * 4)
    );
  }

  // Nếu là giun con (bot), tự động hồi sinh con giun con mới sau 2.5s
  if (player.isBot) {
    setTimeout(() => {
      if (room.players.has(player.id)) {
        room.players.delete(player.id);
      }
      spawnBotWorm(room);
    }, 2500);
  }

  // Gửi thông báo chết cho chính người chơi
  if (player.ws && player.ws.readyState === WebSocket.OPEN) {
    player.ws.send(JSON.stringify({
      type: "dead",
      score: Math.floor(player.score),
      kills: player.kills
    }));
  }
}

function tickRoom(room) {
  // Cắt tỉa mồi thừa nếu bị phình to
  if (room.foods.length > MAX_FOODS) {
    room.foods = room.foods.slice(-MAX_FOODS);
  }
  // Duy trì lượng mồi tối ưu (120 hạt mồi, cực nhẹ)
  if (room.foods.length < 120) {
    spawnFood(room);
  }

  // Duy trì lượng đàn giun con (16 con giun con) luôn đông đúc náo nhiệt
  const allCurrentPlayers = Array.from(room.players.values());
  const activeBots = allCurrentPlayers.filter(p => p.isBot && p.alive).length;
  if (activeBots < TARGET_BOT_COUNT) {
    spawnBotWorm(room);
  }

  const playersList = allCurrentPlayers.filter(p => p.alive);

  // 1. Cập nhật vị trí và góc lượn của từng con giun chuẩn Slither physics
  for (const player of playersList) {
    // Trí thông minh nhân tạo (AI) cho đàn giun con
    if (player.isBot) {
      const now = Date.now();
      const distFromCenter = Math.hypot(player.x - MAP_CENTER, player.y - MAP_CENTER);

      // 1. Tránh xa rìa tường bản đồ
      if (distFromCenter > MAP_RADIUS - 240) {
        player.targetAngle = Math.atan2(MAP_CENTER - player.y, MAP_CENTER - player.x);
      } else if (now > player.nextDecisionTime) {
        player.nextDecisionTime = now + 1200 + Math.random() * 1800;

        // 2. Tìm hạt mồi gần nhất trong bán kính 350px để lượn lại đớp
        let closestFood = null;
        let minDistSq = 350 * 350;
        const searchCount = Math.min(room.foods.length, 35);
        for (let i = 0; i < searchCount; i++) {
          const f = room.foods[i];
          const dx = f.x - player.x;
          const dy = f.y - player.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < minDistSq) {
            minDistSq = distSq;
            closestFood = f;
          }
        }

        if (closestFood) {
          player.targetAngle = Math.atan2(closestFood.y - player.y, closestFood.x - player.x);
        } else {
          // Lượn ngẫu nhiên nhẹ nhàng
          player.targetAngle += (Math.random() - 0.5) * 1.5;
        }

        // Thi thoảng giun con bứt tốc nếu đủ điểm
        if (Math.random() < 0.2 && player.score > 18) {
          player.boostUntil = now + 700 + Math.random() * 1000;
        }
      }

      player.isBoosting = Boolean(player.boostUntil && now < player.boostUntil && player.score > 15);
    }

    let diff = player.targetAngle - player.angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    // Tốc độ cua mượt mà: giun nhỏ lượn nhanh, giun to lượn đầm
    const turnRate = Math.max(0.12, 0.22 - (player.radius - 16) * 0.003);
    player.angle += diff * turnRate;

    // Tăng tốc (Boost)
    if (player.isBoosting && player.score > 15) {
      player.speed = player.boostSpeed;
      // Trừ điểm rất nhẹ nhàng khi bứt tốc (0.05 điểm/tick ~ 1 điểm/s) để không làm tụt điểm thê thảm
      player.score -= 0.05;
      if (Math.random() < 0.22 && player.body.length > 5) {
        const tail = player.body[player.body.length - 1];
        spawnFood(room, tail.x, tail.y, 1);
      }
    } else {
      player.speed = player.baseSpeed;
    }

    // Lưu vị trí cũ trước khi di chuyển để tính toán Continuous Collision Detection (chống đâm xuyên)
    player.prevX = player.x;
    player.prevY = player.y;

    // Di chuyển đầu giun
    player.x += Math.cos(player.angle) * player.speed;
    player.y += Math.sin(player.angle) * player.speed;

    // Bán kính đầu giun nở to dần nhẹ nhàng theo điểm chuẩn Slither.io (nhỏ vừa thanh thoát)
    player.radius = 9.5 + Math.min(15, Math.sqrt(Math.max(0, player.score)) * 0.3);

    // Kiểm tra đâm vào rìa tường vòng tròn Slither.io
    const distFromCenter = Math.hypot(player.x - MAP_CENTER, player.y - MAP_CENTER);
    if (distFromCenter > MAP_RADIUS - player.radius) {
      killPlayer(room, player);
      continue;
    }

    // Cập nhật thân giun (Giới hạn tối đa MAX_BODY_SEGMENTS đốt để chống phình to lag)
    player.body.unshift({ x: player.x, y: player.y });
    const targetBodyLength = Math.min(MAX_BODY_SEGMENTS, Math.floor(16 + Math.sqrt(Math.max(0, player.score)) * 2.8));
    while (player.body.length > targetBodyLength) {
      player.body.pop();
    }

    // Ăn mồi (Food Collision)
    const eatRadius = player.radius + 12;
    for (let i = room.foods.length - 1; i >= 0; i--) {
      const food = room.foods[i];
      const dx = player.x - food.x;
      const dy = player.y - food.y;
      if (dx * dx + dy * dy < eatRadius * eatRadius) {
        player.score += food.val * 3;
        room.foods.splice(i, 1);
      }
    }
  }

  // 2. Kiểm tra va chạm giữa các con giun (Snake vs Snake) - Chuẩn xác 100%, chống xuyên thấu
  for (const p1 of playersList) {
    if (!p1.alive) continue;

    for (const p2 of playersList) {
      if (!p2.alive || p1.id === p2.id) continue;

      const dxHead = p1.x - p2.x;
      const dyHead = p1.y - p2.y;
      const headDistSq = dxHead * dxHead + dyHead * dyHead;

      // 2.1. Va chạm đối đầu (Head-to-head collision): con nào nhỏ hơn thì chết
      const headHitRadius = (p1.radius + p2.radius) * 0.85;
      if (headDistSq < headHitRadius * headHitRadius) {
        if (p1.score < p2.score) {
          killPlayer(room, p1);
          p2.kills += 1;
          p2.score += 40;
          break;
        } else if (p2.score < p1.score) {
          killPlayer(room, p2);
          p1.kills += 1;
          p1.score += 40;
          continue;
        } else {
          killPlayer(room, p1);
          killPlayer(room, p2);
          break;
        }
      }

      // 2.2. Kiểm tra khoảng cách nhanh với thân của p2
      const body = p2.body;
      const p2BodyLen = body.length;
      if (p2BodyLen === 0) continue;

      const maxReach = p2BodyLen * 7 + 120;
      if (headDistSq > maxReach * maxReach) continue;

      // Bán kính va chạm chuẩn xác (đầu p1 chạm vào bất kỳ đốt thân nào của p2)
      const hitRadius = (p1.radius + p2.radius) * 0.82;
      const hitRadiusSq = hitRadius * hitRadius;

      // Điểm giữa (midpoint) để chống đâm xuyên lọt kẽ khi boost tốc độ cao
      const midX = p1.prevX !== undefined ? (p1.prevX + p1.x) * 0.5 : p1.x;
      const midY = p1.prevY !== undefined ? (p1.prevY + p1.y) * 0.5 : p1.y;

      let collided = false;
      // Quét toàn bộ đốt thân từ đốt số 1 trở đi (tuyệt đối không bỏ qua đốt nào)
      for (let s = 1; s < p2BodyLen; s++) {
        const seg = body[s];
        // Điểm đầu hiện tại
        const dx = p1.x - seg.x;
        const dy = p1.y - seg.y;
        if (dx * dx + dy * dy < hitRadiusSq) {
          collided = true;
          break;
        }

        // Điểm giữa đường đi của tick này (Continuous Collision)
        const dmx = midX - seg.x;
        const dmy = midY - seg.y;
        if (dmx * dmx + dmy * dmy < hitRadiusSq) {
          collided = true;
          break;
        }
      }

      if (collided) {
        killPlayer(room, p1);
        p2.kills += 1;
        p2.score += 50; // Thưởng điểm hạ gục

        // Bắn sự kiện nếu p2 là người chơi thật có UID và nhóm
        if (!p2.isBot && p2.uid && p2.threadId) {
          const now = Date.now();
          if (!p2.lastKillNotif || (now - p2.lastKillNotif > 12000)) {
            p2.lastKillNotif = now;
            pushGameEvent({
              type: "kill",
              killerUid: p2.uid,
              killerName: p2.name,
              victimName: p1.name || "Một con sâu",
              kills: p2.kills,
              score: Math.floor(p2.score),
              threadId: p2.threadId,
              threadType: p2.threadType !== undefined ? p2.threadType : 1,
              botKey: p2.botKey || "main"
            });
          }
        }
        break; // p1 đã chết, dừng kiểm tra với các người chơi khác
      }
    }
  }

  // 3. Đóng gói gói tin tick gửi cho tất cả người chơi trong phòng (Tiết kiệm băng thông)
  room.tickCount = (room.tickCount || 0) + 1;

  // Leaderboard chỉ cần tính và gửi mỗi 10 tick (500ms)
  const sendLb = (room.tickCount % 10 === 0) || !room.cachedLb;
  if (sendLb) {
    room.cachedLb = playersList
      .map(p => ({
        id: p.id,
        name: p.name,
        score: Math.floor(p.score),
        kills: p.kills,
        avatar: p.avatar,
        uid: p.uid,
        threadId: p.threadId,
        threadType: p.threadType,
        isBot: p.isBot
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    // Bắn sự kiện khi có người chơi thật vươn lên TOP 1
    const topPlayer = room.cachedLb[0];
    if (topPlayer && !topPlayer.isBot && topPlayer.uid && topPlayer.threadId) {
      if (topPlayer.id !== room.lastTop1PlayerId) {
        room.lastTop1PlayerId = topPlayer.id;
        const now = Date.now();
        if (!room.lastTop1Notif || (now - room.lastTop1Notif > 30000)) {
          room.lastTop1Notif = now;
          pushGameEvent({
            type: "top1",
            playerUid: topPlayer.uid,
            playerName: topPlayer.name,
            score: topPlayer.score,
            kills: topPlayer.kills,
            threadId: topPlayer.threadId,
            threadType: topPlayer.threadType !== undefined ? topPlayer.threadType : 1,
            botKey: topPlayer.botKey || "main"
          });
        }
      }
    }
  }

  // Mồi chỉ cần gửi mỗi 10 tick (500ms) vì mồi đứng yên, giảm 90% dung lượng mạng
  const sendFoods = (room.tickCount % 10 === 0) || !room.cachedFoods;
  if (sendFoods) {
    room.cachedFoods = room.foods.map(f => [Math.round(f.x), Math.round(f.y), f.val, f.color]);
  }

  const playersSummary = playersList.map(p => {
    // Gửi trực tiếp toàn bộ đốt thân mịn màng, không subsample nhảy step gây giật/tụt đuôi
    const sampleBody = [];
    const blen = p.body.length;
    for (let idx = 0; idx < blen; idx++) {
      sampleBody.push([Math.round(p.body[idx].x), Math.round(p.body[idx].y)]);
    }
    return {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      x: Math.round(p.x * 10) / 10,
      y: Math.round(p.y * 10) / 10,
      angle: Math.round(p.angle * 100) / 100,
      radius: Math.round(p.radius),
      color: p.color,
      isBoosting: p.isBoosting,
      score: Math.floor(p.score),
      body: sampleBody
    };
  });

  const tickPacket = JSON.stringify({
    type: "tick",
    players: playersSummary,
    ...(sendFoods && { foods: room.cachedFoods }),
    ...(sendLb && { leaderboard: room.cachedLb })
  });

  for (const [, player] of room.players) {
    if (player.ws && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(tickPacket);
    }
  }
}

// ========================================================
// WEBSOCKET CONNECTION HANDLER
// ========================================================

let nextPlayerId = 1;

wss.on("connection", (ws) => {
  ws.playerId = "p_" + nextPlayerId++;
  ws.roomId = GLOBAL_ROOM_ID;

  ws.on("message", (rawMsg) => {
    try {
      const msg = JSON.parse(rawMsg);

      if (msg.type === "join") {
        let playerName = "Chiến Thần";
        let playerUid = "";
        let playerThreadId = "";
        let playerThreadType = 1;
        let playerBotKey = "main";

        // 1. Nhận diện từ Session Code ngắn & TỰ HỦY LINK
        if (msg.code) {
          const codeKey = String(msg.code).trim().toLowerCase();
          const s = activeSessions.get(codeKey);
          if (s && !s.used) {
            playerName = String(s.name).trim().slice(0, 25);
            playerUid = s.uid || "";
            playerThreadId = s.threadId || "";
            playerThreadType = s.threadType !== undefined ? Number(s.threadType) : 1;
            playerBotKey = s.botKey || "main";
            // Đánh dấu link này đã sử dụng để tự hủy ngay
            s.used = true;
            // Xóa vĩnh viễn sau 10 giây để người khác bấm vào link sẽ ra 404
            setTimeout(() => activeSessions.delete(codeKey), 10000);
          }
        }

        // 2. Nhận diện từ Token mã hóa nếu không có session code & TỰ HỦY TOKEN
        if (playerName === "Chiến Thần" && msg.token) {
          const verified = verifyGameToken(msg.token);
          if (verified && verified.name && !usedTokens.has(msg.token)) {
            playerName = String(verified.name).trim().slice(0, 25);
            playerUid = verified.uid || "";
            playerThreadId = verified.threadId || "";
            playerThreadType = verified.threadType !== undefined ? Number(verified.threadType) : 1;
            playerBotKey = verified.botKey || "main";
            usedTokens.add(msg.token);
          }
        }

        const playerInfo = {
          name: playerName,
          avatar: "",
          roomId: GLOBAL_ROOM_ID,
          uid: playerUid,
          threadId: playerThreadId,
          threadType: playerThreadType,
          botKey: playerBotKey,
          skin: msg.skin || null
        };

        ws.roomId = GLOBAL_ROOM_ID;
        ws.playerInfo = playerInfo;

        const room = getOrCreateRoom(GLOBAL_ROOM_ID, "Đại Chiến Con Giun");
        const player = spawnPlayer(room, ws, playerInfo);

        ws.send(JSON.stringify({
          type: "init",
          playerId: player.id,
          mapSize: MAP_SIZE,
          mapCenter: MAP_CENTER,
          mapRadius: MAP_RADIUS,
          player: {
            name: player.name,
            avatar: player.avatar,
            color: player.color
          },
          roomName: room.name
        }));
      }

      if (msg.type === "input") {
        const room = rooms.get(ws.roomId);
        if (room && room.players.has(ws.playerId)) {
          const player = room.players.get(ws.playerId);
          if (player && player.alive) {
            if (typeof msg.angle === "number") player.targetAngle = msg.angle;
            if (typeof msg.boost === "boolean") player.isBoosting = msg.boost;
          }
        }
      }

      if (msg.type === "respawn") {
        const room = rooms.get(ws.roomId);
        if (room && ws.playerInfo) {
          spawnPlayer(room, ws, ws.playerInfo);
        }
      }

    } catch (e) {
      console.error("[WS] Message error:", e);
    }
  });

  ws.on("close", () => {
    const room = rooms.get(ws.roomId);
    if (room && room.players.has(ws.playerId)) {
      const player = room.players.get(ws.playerId);
      killPlayer(room, player);
      room.players.delete(ws.playerId);
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n🎮 [GAME CON GIUN SERVER] Đang chạy tại cổng ${PORT}`);
  console.log(`⚡ WebSocket Server sẵn sàng phục vụ anh em chơi mượt mà!\n`);
});

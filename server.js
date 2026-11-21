const express = require("express");
const http = require("http");
const path = require("path");
const { WebSocketServer, WebSocket } = require("ws");
const { verifyGameToken } = require("./tokenHelper");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3150;
const MAP_SIZE = 4000;
const MAP_CENTER = 2000;
const MAP_RADIUS = 1850;
const TICK_RATE = 25; // 25 fps ticks for smooth physics
const TICK_INTERVAL = 1000 / TICK_RATE;
const GLOBAL_ROOM_ID = "ruaxbonz_arena";

// 1. Lọc link gốc: Bắt buộc phải có token hợp lệ từ bot Zalo mới được vào
// Nếu truy cập trực tiếp giun.ruaxbonz.com hoặc token không hợp lệ -> Đẩy ngay sang https://ruaxbonz.com/404
app.get(["/", "/index.html"], (req, res, next) => {
  const token = req.query.token;
  if (!token) {
    return res.redirect("https://ruaxbonz.com/404");
  }
  const decoded = verifyGameToken(token);
  if (!decoded) {
    return res.redirect("https://ruaxbonz.com/404");
  }
  next();
});

// Serve static frontend
app.use(express.static(path.join(__dirname, "public")));

// API verify token endpoint (for frontend inspection)
app.get("/api/verify-token", (req, res) => {
  const token = req.query.token;
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
  { head: "#00f5d4", body1: "#00bbf9", body2: "#00f5d4", glow: "rgba(0, 245, 212, 0.4)" }, // Cyan / Teal
  { head: "#f72585", body1: "#7209b7", body2: "#f72585", glow: "rgba(247, 37, 133, 0.4)" }, // Cyberpunk Pink
  { head: "#fee440", body1: "#ff006e", body2: "#fee440", glow: "rgba(254, 228, 64, 0.4)" }, // Neon Yellow
  { head: "#52b788", body1: "#2d6a4f", body2: "#74c69d", glow: "rgba(82, 183, 136, 0.4)" }, // Emerald Green
  { head: "#ff7b00", body1: "#d00000", body2: "#ffba08", glow: "rgba(255, 123, 0, 0.4)" }, // Flame Orange
  { head: "#9d4edd", body1: "#5a189a", body2: "#c77dff", glow: "rgba(157, 78, 221, 0.4)" }, // Neon Violet
  { head: "#4cc9f0", body1: "#4895ef", body2: "#4361ee", glow: "rgba(76, 201, 240, 0.4)" }, // Ice Blue
];

const rooms = new Map();

function getOrCreateRoom(roomId, roomName = "Đại Chiến Giun") {
  if (!rooms.has(roomId)) {
    const room = {
      id: roomId,
      name: roomName,
      players: new Map(),
      foods: [],
      nextFoodId: 1,
      lastTick: Date.now()
    };

    // Tạo mồi ban đầu
    spawnInitialFoods(room, 200);

    // Bắt đầu vòng lặp tick cho phòng
    room.interval = setInterval(() => tickRoom(room), TICK_INTERVAL);
    rooms.set(roomId, room);
  }
  return rooms.get(roomId);
}

function spawnInitialFoods(room, count) {
  for (let i = 0; i < count; i++) {
    spawnFood(room);
  }
}

function spawnFood(room, x, y, val = 1) {
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
    radius: val > 2 ? 6 + Math.min(val, 6) : 4.5,
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
    x: startX,
    y: startY,
    angle: startAngle,
    targetAngle: startAngle,
    speed: 3.8,
    baseSpeed: 3.8,
    boostSpeed: 7.2,
    isBoosting: false,
    radius: 16,
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

  // Thân giun nổ thành chuỗi mồi to sáng rực rỡ như Slither.io
  const body = player.body || [];
  for (let i = 0; i < body.length; i += 2) {
    const seg = body[i];
    spawnFood(
      room,
      seg.x + (Math.random() - 0.5) * 24,
      seg.y + (Math.random() - 0.5) * 24,
      3 + Math.floor(Math.random() * 4)
    );
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
  // Duy trì lượng mồi dồi dào trên bản đồ Slither.io
  if (room.foods.length < 350) {
    spawnFood(room);
  }

  const playersList = Array.from(room.players.values()).filter(p => p.alive);

  // 1. Cập nhật vị trí và góc lượn của từng con giun chuẩn Slither physics
  for (const player of playersList) {
    let diff = player.targetAngle - player.angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    // Tốc độ cua mượt mà: giun nhỏ lượn nhanh, giun to lượn đầm
    const turnRate = Math.max(0.12, 0.22 - (player.radius - 16) * 0.003);
    player.angle += diff * turnRate;

    // Tăng tốc (Boost)
    if (player.isBoosting && player.score > 15) {
      player.speed = player.boostSpeed;
      // Trừ điểm và thả mồi nhỏ phía sau đuôi
      player.score -= 0.16;
      if (Math.random() < 0.28 && player.body.length > 5) {
        const tail = player.body[player.body.length - 1];
        spawnFood(room, tail.x, tail.y, 1);
        if (player.body.length > 15) {
          player.body.pop();
        }
      }
    } else {
      player.speed = player.baseSpeed;
    }

    // Di chuyển đầu giun
    player.x += Math.cos(player.angle) * player.speed;
    player.y += Math.sin(player.angle) * player.speed;

    // Bán kính đầu giun nở to dần theo điểm
    player.radius = 16 + Math.min(22, Math.sqrt(player.score) * 0.55);

    // Kiểm tra đâm vào rìa tường vòng tròn Slither.io
    const distFromCenter = Math.hypot(player.x - MAP_CENTER, player.y - MAP_CENTER);
    if (distFromCenter > MAP_RADIUS - player.radius) {
      killPlayer(room, player);
      continue;
    }

    // Cập nhật thân giun
    player.body.unshift({ x: player.x, y: player.y });
    const targetBodyLength = Math.floor(18 + player.score * 0.65);
    while (player.body.length > targetBodyLength) {
      player.body.pop();
    }

    // Ăn mồi (Food Collision)
    const eatRadius = player.radius + 15;
    for (let i = room.foods.length - 1; i >= 0; i--) {
      const food = room.foods[i];
      const dx = player.x - food.x;
      const dy = player.y - food.y;
      if (dx * dx + dy * dy < eatRadius * eatRadius) {
        player.score += food.val * 2;
        room.foods.splice(i, 1);
      }
    }
  }

  // 2. Kiểm tra va chạm giữa các con giun (Snake vs Snake)
  for (const p1 of playersList) {
    if (!p1.alive) continue;

    for (const p2 of playersList) {
      if (!p2.alive) continue;
      if (p1.id === p2.id) continue; // Không tự đâm chính mình

      // Kiểm tra nếu đầu p1 đâm vào bất kỳ đốt thân nào của p2
      const body = p2.body;
      const hitRadius = p1.radius + (p2.radius * 0.7);
      const hitRadiusSq = hitRadius * hitRadius;

      // Chỉ check từ đốt thứ 3 trở đi để tránh va chạm mép đầu
      for (let s = 3; s < body.length; s += 2) {
        const seg = body[s];
        const dx = p1.x - seg.x;
        const dy = p1.y - seg.y;
        if (dx * dx + dy * dy < hitRadiusSq) {
          killPlayer(room, p1);
          p2.kills += 1;
          p2.score += 50; // Thưởng điểm hạ gục
          break;
        }
      }
    }
  }

  // 3. Đóng gói gói tin tick gửi cho tất cả người chơi trong phòng
  const leaderboard = playersList
    .map(p => ({ id: p.id, name: p.name, score: Math.floor(p.score), kills: p.kills, avatar: p.avatar }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const playersSummary = playersList.map(p => ({
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
    body: p.body.filter((_, idx) => idx % 2 === 0).map(b => [Math.round(b.x), Math.round(b.y)])
  }));

  const tickPacket = JSON.stringify({
    type: "tick",
    players: playersSummary,
    foods: room.foods.map(f => [Math.round(f.x), Math.round(f.y), f.val, f.color]),
    leaderboard
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
        let playerInfo = {
          name: msg.name || "Chiến thần",
          avatar: "",
          roomId: GLOBAL_ROOM_ID,
          uid: "",
          skin: msg.skin || null
        };

        if (msg.token) {
          const verified = verifyGameToken(msg.token);
          if (verified) {
            playerInfo.name = verified.name || playerInfo.name;
            playerInfo.avatar = "";
            playerInfo.roomId = GLOBAL_ROOM_ID;
            playerInfo.uid = verified.uid || "";
          }
        }

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

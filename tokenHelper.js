const crypto = require("crypto");

const FIXED_SECRET = "ruaxbonz-congiun-master-key-2026-very-secure-xyz";
const FIXED_HMAC = "ruaxbonz-congiun-hmac-signature-2026-ultra-safe-abc";

function getSecret() {
  return FIXED_SECRET;
}

function getHmacKey() {
  return FIXED_HMAC;
}

/**
 * Tạo token mã hóa cho người chơi khi bấm link game
 */
function createGameToken(playerInfo, ttlSeconds = 1800) {
  const now = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({
    uid: String(playerInfo.uid || ""),
    name: String(playerInfo.name || "Chiến thần Giun").slice(0, 30),
    avatar: String(playerInfo.avatar || ""),
    roomId: String(playerInfo.roomId || "general_arena"),
    roomName: String(playerInfo.roomName || "Đại Chiến Giun"),
    ts: now,
    exp: now + ttlSeconds
  });

  const iv = crypto.randomBytes(16);
  const key = crypto.createHash("sha256").update(getSecret()).digest();
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const ciphertext = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);

  const hmac = crypto.createHmac("sha256", getHmacKey()).update(Buffer.concat([iv, ciphertext])).digest();
  const binary = Buffer.concat([iv, hmac, ciphertext]);

  return binary.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Giải mã và xác thực token game
 */
function verifyGameToken(tokenStr) {
  if (!tokenStr || typeof tokenStr !== "string") return null;
  try {
    let base64 = tokenStr.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const binary = Buffer.from(base64, "base64");
    if (binary.length < 48) return null; // 16 iv + 32 hmac + at least some ciphertext

    const iv = binary.subarray(0, 16);
    const hmac = binary.subarray(16, 48);
    const ciphertext = binary.subarray(48);

    // Verify HMAC
    const expectedHmac = crypto.createHmac("sha256", getHmacKey()).update(Buffer.concat([iv, ciphertext])).digest();
    if (!crypto.timingSafeEqual(hmac, expectedHmac)) return null;

    // Decrypt
    const key = crypto.createHash("sha256").update(getSecret()).digest();
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");

    const data = JSON.parse(decrypted);
    const now = Math.floor(Date.now() / 1000);
    if (data.exp && data.exp < now) {
      data.isExpired = true;
    }
    return data;
  } catch (err) {
    return null;
  }
}

module.exports = {
  createGameToken,
  verifyGameToken
};

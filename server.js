// 政变 — 房间与静态资源服务器（零依赖）
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { Game, GameError, publicMeta } from './game.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = __dirname;
const PUBLIC_FILES = new Set(['index.html', 'style.css', 'app.js', 'voice.js', 'roles.js', 'favicon.svg']);
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const MAX_BODY = 64 * 1024;
const ROOM_TTL = 12 * 60 * 60 * 1000;
const ONLINE_WINDOW = 12000;

const rooms = new Map();
let chatSeq = 0;
let voiceSeq = 0;

// ---------------- 工具 ----------------

function id(size = 12) {
  return crypto.randomBytes(size).toString('hex');
}

function cleanName(raw) {
  const s = String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12);
  return s || '无名玩家';
}

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 100; attempt++) {
    let code = '';
    for (let i = 0; i < 4; i++) code += alphabet[crypto.randomInt(alphabet.length)];
    if (!rooms.has(code)) return code;
  }
  return id(4).toUpperCase();
}

function roomMeta(room) {
  const now = Date.now();
  const players = room.players.map((p, seat) => ({
    id: p.id,
    name: p.name,
    seat,
    isHost: p.id === room.hostId,
    online: p.id === room.players[0]?.id ? true : now - p.lastSeen < ONLINE_WINDOW
  }));
  // 第一位也按在线判断，上面只是为了结构统一；重新计算
  for (const p of players) {
    const rp = room.players.find((x) => x.id === p.id);
    p.online = now - rp.lastSeen < ONLINE_WINDOW;
  }
  return {
    code: room.code,
    hostId: room.hostId,
    status: room.game ? room.game.status : 'lobby',
    minPlayers: 2,
    maxPlayers: 6,
    canStart: !room.game && room.players.length >= 2,
    players,
    createdAt: room.createdAt
  };
}

function stateFor(room, player) {
  const now = Date.now();
  const meta = roomMeta(room);
  let game = null;
  if (room.game) {
    game = room.game.getState(player.id);
    for (const p of game.players) {
      const rp = room.players.find((x) => x.id === p.id);
      p.online = rp ? now - rp.lastSeen < ONLINE_WINDOW : false;
    }
  }
  return {
    serverNow: now,
    room: meta,
    me: {
      id: player.id,
      name: player.name,
      isHost: player.id === room.hostId
    },
    game,
    chat: room.chat.slice(-40),
    voice: voiceState(room, player),
    meta: publicMeta()
  };
}

function voiceMembers(room, now = Date.now()) {
  return room.players
    .filter((p) => room.voice[p.id])
    .map((p) => ({
      id: p.id,
      name: p.name,
      muted: Boolean(room.voice[p.id].muted),
      joinedAt: room.voice[p.id].joinedAt,
      online: now - p.lastSeen < ONLINE_WINDOW
    }));
}

function voiceState(room, player) {
  return {
    members: voiceMembers(room),
    joined: Boolean(room.voice[player.id]),
    meMuted: Boolean(room.voice[player.id]?.muted)
  };
}

function authPlayer(room, playerId, token) {
  if (!room) throw new HttpError(404, '房间不存在或已过期');
  const p = room.players.find((x) => x.id === playerId);
  if (!p || p.token !== token) throw new HttpError(401, '身份验证失败，请重新加入房间');
  p.lastSeen = Date.now();
  return p;
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body)
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, '请求内容过大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, '请求格式错误'));
      }
    });
    req.on('error', reject);
  });
}

function shareUrls() {
  const urls = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) {
        urls.push({ name, url: `http://${a.address}:${PORT}` });
      }
    }
  }
  const score = (u) => (u.name.startsWith('wlan') ? 0 : u.name.startsWith('rmnet') ? 2 : 1);
  return urls.sort((a, b) => score(a) - score(b));
}

function normalizeCode(raw) {
  return String(raw || '').trim().toUpperCase();
}

function getRoom(code) {
  return rooms.get(normalizeCode(code));
}

function createPlayer(room, name) {
  return {
    id: id(8),
    token: id(24),
    name: cleanName(name),
    lastSeen: Date.now(),
    chatAt: 0
  };
}

function addSystemChat(room, text) {
  room.chat.push({ id: ++chatSeq, from: null, name: '系统', text, ts: Date.now(), system: true });
  if (room.chat.length > 120) room.chat.splice(0, room.chat.length - 120);
}

// ---------------- 路由 ----------------

async function handleApi(req, res, url) {
  const route = url.pathname;

  if (route === '/api/health') {
    return sendJson(res, 200, { ok: true, rooms: rooms.size, now: Date.now() });
  }

  if (route === '/api/meta') {
    return sendJson(res, 200, publicMeta());
  }

  if (route === '/api/network') {
    return sendJson(res, 200, { urls: shareUrls() });
  }

  if (route === '/api/create' && req.method === 'POST') {
    const body = await readJson(req);
    const room = {
      code: makeCode(),
      hostId: null,
      createdAt: Date.now(),
      lastActive: Date.now(),
      players: [],
      game: null,
      chat: [],
      voice: {},
      voiceSignals: []
    };
    const p = createPlayer(room, body.name);
    room.hostId = p.id;
    room.players.push(p);
    rooms.set(room.code, room);
    addSystemChat(room, `${p.name} 创建了房间。`);
    return sendJson(res, 200, {
      roomCode: room.code,
      playerId: p.id,
      token: p.token,
      state: stateFor(room, p)
    });
  }

  if (route === '/api/join' && req.method === 'POST') {
    const body = await readJson(req);
    const room = getRoom(body.code);
    if (!room) throw new HttpError(404, '房间不存在或已过期');
    if (room.game) throw new HttpError(409, '这局游戏已经开始，无法中途加入');
    if (room.players.length >= 6) throw new HttpError(409, '房间已满（最多 6 人）');
    const name = cleanName(body.name);
    if (room.players.some((p) => p.name === name)) {
      throw new HttpError(409, '房间里已经有同名玩家，请换一个名字');
    }
    const p = createPlayer(room, name);
    room.players.push(p);
    room.lastActive = Date.now();
    addSystemChat(room, `${p.name} 加入了房间。`);
    return sendJson(res, 200, {
      roomCode: room.code,
      playerId: p.id,
      token: p.token,
      state: stateFor(room, p)
    });
  }

  if (route === '/api/state' && req.method === 'GET') {
    const code = normalizeCode(url.searchParams.get('code'));
    const room = getRoom(code);
    const p = authPlayer(room, url.searchParams.get('pid'), url.searchParams.get('token'));
    room.lastActive = Date.now();
    return sendJson(res, 200, stateFor(room, p));
  }

  if (route === '/api/start' && req.method === 'POST') {
    const body = await readJson(req);
    const room = getRoom(body.code);
    const p = authPlayer(room, body.playerId, body.token);
    if (p.id !== room.hostId) throw new HttpError(403, '只有房主可以开始游戏');
    if (room.game) throw new HttpError(409, '游戏已经开始');
    if (room.players.length < 2) throw new HttpError(409, '至少需要 2 名玩家');
    if (room.players.length > 6) throw new HttpError(409, '最多 6 名玩家');
    const startPlayerId = body.startPlayerId && room.players.some((x) => x.id === body.startPlayerId)
      ? body.startPlayerId
      : room.players[0].id;
    room.game = new Game({
      players: room.players.map((x) => ({ id: x.id, name: x.name })),
      startPlayerId
    });
    room.lastActive = Date.now();
    addSystemChat(room, '游戏开始！');
    return sendJson(res, 200, stateFor(room, p));
  }

  if (route === '/api/rematch' && req.method === 'POST') {
    const body = await readJson(req);
    const room = getRoom(body.code);
    const p = authPlayer(room, body.playerId, body.token);
    if (p.id !== room.hostId) throw new HttpError(403, '只有房主可以再来一局');
    if (!room.game || room.game.status !== 'over') throw new HttpError(409, '当前不能重新开局');
    if (room.players.length < 2) throw new HttpError(409, '至少需要 2 名玩家');
    let startPlayerId = body.startPlayerId;
    if (!startPlayerId || !room.players.some((x) => x.id === startPlayerId)) {
      const prev = room.game.turnOrder;
      const prevStart = prev.indexOf(room.game.startPlayerId);
      startPlayerId = prev[(prevStart + 1) % prev.length];
    }
    room.game = new Game({
      players: room.players.map((x) => ({ id: x.id, name: x.name })),
      startPlayerId
    });
    room.lastActive = Date.now();
    addSystemChat(room, '房主发起了新的对局。');
    return sendJson(res, 200, stateFor(room, p));
  }

  if (route === '/api/action' && req.method === 'POST') {
    const body = await readJson(req);
    const room = getRoom(body.code);
    const p = authPlayer(room, body.playerId, body.token);
    if (!room.game) throw new HttpError(409, '游戏还没有开始');
    room.game.tick();
    room.game.act(p.id, body.action || {});
    room.lastActive = Date.now();
    return sendJson(res, 200, stateFor(room, p));
  }

  if (route === '/api/respond' && req.method === 'POST') {
    const body = await readJson(req);
    const room = getRoom(body.code);
    const p = authPlayer(room, body.playerId, body.token);
    if (!room.game) throw new HttpError(409, '游戏还没有开始');
    room.game.tick();
    room.game.respond(p.id, body.response || {});
    room.lastActive = Date.now();
    return sendJson(res, 200, stateFor(room, p));
  }

  if (route === '/api/voice/join' && req.method === 'POST') {
    const body = await readJson(req);
    const room = getRoom(body.code);
    const p = authPlayer(room, body.playerId, body.token);
    if (!room.voice[p.id]) {
      room.voice[p.id] = { joinedAt: Date.now(), muted: false };
    }
    room.lastActive = Date.now();
    return sendJson(res, 200, {
      ok: true,
      voice: voiceState(room, p),
      latestSignalId: room.voiceSignals.length ? room.voiceSignals[room.voiceSignals.length - 1].id : 0
    });
  }

  if (route === '/api/voice/leave' && req.method === 'POST') {
    const body = await readJson(req);
    const room = getRoom(body.code);
    const p = authPlayer(room, body.playerId, body.token);
    delete room.voice[p.id];
    room.voiceSignals = room.voiceSignals.filter((x) => x.from !== p.id && x.to !== p.id);
    room.lastActive = Date.now();
    return sendJson(res, 200, { ok: true, voice: voiceState(room, p) });
  }

  if (route === '/api/voice/mute' && req.method === 'POST') {
    const body = await readJson(req);
    const room = getRoom(body.code);
    const p = authPlayer(room, body.playerId, body.token);
    if (!room.voice[p.id]) throw new HttpError(409, '你还没有加入语音');
    room.voice[p.id].muted = Boolean(body.muted);
    room.lastActive = Date.now();
    return sendJson(res, 200, { ok: true, voice: voiceState(room, p) });
  }

  if (route === '/api/voice/signal' && req.method === 'POST') {
    const body = await readJson(req);
    const room = getRoom(body.code);
    const p = authPlayer(room, body.playerId, body.token);
    if (!room.voice[p.id]) throw new HttpError(409, '你还没有加入语音');
    const to = String(body.to || '');
    if (!room.voice[to] || !room.players.some((x) => x.id === to)) {
      throw new HttpError(409, '对方不在语音中');
    }
    const type = String(body.type || '');
    if (!['offer', 'answer', 'ice', 'bye'].includes(type)) throw new HttpError(400, '未知语音信令');
    const signal = {
      id: ++voiceSeq,
      from: p.id,
      to,
      type,
      data: body.data ?? null,
      ts: Date.now()
    };
    room.voiceSignals.push(signal);
    if (room.voiceSignals.length > 800) room.voiceSignals.splice(0, room.voiceSignals.length - 800);
    room.lastActive = Date.now();
    return sendJson(res, 200, { ok: true, id: signal.id });
  }

  if (route === '/api/voice/poll' && req.method === 'GET') {
    const code = normalizeCode(url.searchParams.get('code'));
    const room = getRoom(code);
    const p = authPlayer(room, url.searchParams.get('pid'), url.searchParams.get('token'));
    const since = Number(url.searchParams.get('since') || 0) || 0;
    const signals = room.voiceSignals
      .filter((s) => s.to === p.id && s.id > since)
      .slice(-200);
    return sendJson(res, 200, {
      serverNow: Date.now(),
      signals,
      voice: voiceState(room, p),
      latestSignalId: room.voiceSignals.length ? room.voiceSignals[room.voiceSignals.length - 1].id : since
    });
  }

  if (route === '/api/chat' && req.method === 'POST') {
    const body = await readJson(req);
    const room = getRoom(body.code);
    const p = authPlayer(room, body.playerId, body.token);
    const text = String(body.text ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 100);
    if (!text) throw new HttpError(400, '消息不能为空');
    const now = Date.now();
    if (now - p.chatAt < 500) throw new HttpError(429, '发言太快了，喝口水');
    p.chatAt = now;
    room.chat.push({ id: ++chatSeq, from: p.id, name: p.name, text, ts: now });
    if (room.chat.length > 120) room.chat.splice(0, room.chat.length - 120);
    room.lastActive = now;
    return sendJson(res, 200, stateFor(room, p));
  }

  if (route === '/api/leave' && req.method === 'POST') {
    const body = await readJson(req);
    const room = getRoom(body.code);
    const p = authPlayer(room, body.playerId, body.token);
    if (room.game && room.game.status === 'playing') {
      throw new HttpError(409, '游戏进行中不能退出，可以关闭页面稍后回来');
    }
    delete room.voice[p.id];
    const idx = room.players.findIndex((x) => x.id === p.id);
    if (idx >= 0) room.players.splice(idx, 1);
    addSystemChat(room, `${p.name} 离开了房间。`);
    if (!room.players.length) {
      rooms.delete(room.code);
    } else if (room.hostId === p.id) {
      room.hostId = room.players[0].id;
      addSystemChat(room, `${room.players[0].name} 成为新房主。`);
    }
    return sendJson(res, 200, { ok: true, roomCode: room.players.length ? room.code : null });
  }

  throw new HttpError(404, '接口不存在');
}

// ---------------- 静态文件 ----------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/' || pathname === '') pathname = '/index.html';
  const rel = pathname.replace(/^\/+/, '');
  const base = path.basename(rel);
  if (!PUBLIC_FILES.has(base)) {
    if (!path.extname(pathname)) return serveFile(path.join(PUBLIC_DIR, 'index.html'), res);
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }
  return serveFile(path.join(PUBLIC_DIR, base), res);
}

async function serveFile(filePath, res) {
  try {
    const data = await fsp.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control': ext === '.html' ? 'no-cache' : 'no-cache',
      'content-length': data.length
    });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not Found');
  }
}

// ---------------- 服务器 ----------------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
    } else if (req.method === 'GET' || req.method === 'HEAD') {
      await serveStatic(req, res, url);
    } else {
      res.writeHead(405); res.end('Method Not Allowed');
    }
  } catch (err) {
    if (res.headersSent) return;
    if (err instanceof HttpError) {
      sendJson(res, err.status, { error: err.message });
    } else if (err instanceof GameError) {
      sendJson(res, 400, { error: err.message });
    } else {
      console.error('请求处理失败:', err);
      sendJson(res, 500, { error: '服务器开小差了，请重试' });
    }
  }
});

server.listen(PORT, HOST, () => {
  const lines = [`政变服务器已启动：http://127.0.0.1:${PORT}`];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) lines.push(`局域网（${name}）：http://${a.address}:${PORT}`);
    }
  }
  console.log(lines.join('\n'));
});

// 超时推进 + 房间清理
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.game && room.game.status === 'playing') {
      try {
        if (room.game.tick(now)) room.lastActive = now;
      } catch (err) {
        console.error('tick 失败', room.code, err);
      }
    }
    // 掉线超过 25 秒自动移出语音，避免幽灵通话
    for (const p of room.players) {
      if (room.voice[p.id] && now - p.lastSeen > 25000) delete room.voice[p.id];
    }
    if (room.voiceSignals.length) {
      room.voiceSignals = room.voiceSignals.filter((s) => now - s.ts < 60000).slice(-800);
    }
    if (now - room.lastActive > ROOM_TTL) rooms.delete(room.code);
  }
}, 500).unref();

process.on('SIGINT', () => {
  console.log('\n正在关闭服务器…');
  server.close(() => process.exit(0));
});
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

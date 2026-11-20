/* Sugmona Huevo relay server.
   Serves public/index.html and relays room messages over WebSocket at /ws.
   The browser host runs the match; this server only forwards messages and presence. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const PUB = process.env.PUBLIC_DIR ? path.resolve(process.env.PUBLIC_DIR) : path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.glb': 'model/gltf-binary' };

const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') u = '/index.html';
  const file = path.join(PUB, path.normalize(u));
  if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
const rooms = new Map();       // room name -> Map(peerId -> { ws, presence })
const dirty = new Set();       // rooms whose presence changed since the last flush
let counter = 1;

const send = (ws, m) => { if (ws.readyState === 1) ws.send(typeof m === 'string' ? m : JSON.stringify(m)); };
function broadcastPeers(name, left) {
  const room = rooms.get(name);
  if (!room) return;
  const list = [...room.entries()].map(([peer, c]) => ({ peer, presence: c.presence }));
  const msg = JSON.stringify({ op: 'peers', room: name, list, left: left || [] });
  for (const c of room.values()) send(c.ws, msg);
}
setInterval(() => { for (const n of dirty) broadcastPeers(n); dirty.clear(); }, 40);
setInterval(() => { for (const ws of wss.clients) { if (ws.isAlive === false) { ws.terminate(); continue; } ws.isAlive = false; ws.ping(); } }, 30000);

wss.on('connection', (ws) => {
  const id = 'p' + (counter++).toString(36) + Math.random().toString(36).slice(2, 6);
  let name = null, tokens = 80, last = Date.now();
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (raw) => {
    const now = Date.now();
    tokens = Math.min(100, tokens + (now - last) / 1000 * 60); last = now;
    if (--tokens < 0) return;                       // about 60 messages a second per player
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    if (m.op === 'join') {
      if (name) return;
      const n = String(m.room || '');
      if (!/^[a-z0-9][a-z0-9_.-]{0,47}$/.test(n)) return ws.close();
      if (!rooms.has(n)) rooms.set(n, new Map());
      const room = rooms.get(n);
      if (room.size >= 32) return ws.close();
      name = n; room.set(id, { ws, presence: {} });
      send(ws, { op: 'joined', peer: id });
      broadcastPeers(n);
      return;
    }
    if (!name) return;
    const room = rooms.get(name);
    if (m.op === 'emit') {
      if (!/^[a-z][a-z0-9_.-]{0,47}$/.test(String(m.topic))) return;
      const s = JSON.stringify(m.data === undefined ? null : m.data);
      if (s.length > 4096) return;
      const out = JSON.stringify({ op: 'msg', topic: m.topic, data: m.data, peer: id });
      for (const c of room.values()) send(c.ws, out);
    } else if (m.op === 'pres') {
      const c = room.get(id);
      if (!c || !m.patch || typeof m.patch !== 'object') return;
      for (const k of Object.keys(m.patch)) {
        if (!/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(k) || k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
        if (m.patch[k] === null) delete c.presence[k]; else c.presence[k] = m.patch[k];
      }
      if (JSON.stringify(c.presence).length > 4096) { c.presence = {}; return; }
      dirty.add(name);
    }
  });
  ws.on('close', () => {
    if (!name) return;
    const room = rooms.get(name);
    if (!room) return;
    room.delete(id);
    if (!room.size) rooms.delete(name); else broadcastPeers(name, [{ peer: id }]);
  });
});

server.listen(PORT, () => console.log('Sugmona Huevo running on http://localhost:' + PORT));

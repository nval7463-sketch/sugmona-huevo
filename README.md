# Sugmona Huevo: website version

A 3D social deduction game. This folder is a complete website: one HTML page plus a small Node server that relays online rooms between players.

## Run it on your computer

```bash
npm install
npm start
```

Open http://localhost:3000. To play with friends on the same network, share `http://<your-computer-address>:3000`.

## Put it on the internet

Any host that runs Node and supports WebSockets works (Render, Railway, Fly.io, a small VPS).

1. Upload this folder to a Git repository.
2. Create a new "Web Service" on your host from that repository.
3. Build command: `npm install`. Start command: `npm start`.
4. Open the public URL the host gives you. Anyone with the link can play. HTTPS and secure WebSockets are automatic on most hosts.

The server reads the `PORT` environment variable, which hosts set for you.

## How online play works

- One player presses **Host online** and gets a 4-character code. Others press **Join** and type it.
- The host's browser runs the match (bots, rules, voting). The server only forwards messages, so it needs almost no CPU.
- Up to 10 players per game. Empty seats are filled by bots.
- The page uses Claude's room feature when it is opened inside Claude, and this server everywhere else. It is the same game code in both places.

## Files

- `server.js`: static file server plus the WebSocket relay at `/ws`.
- `public/index.html`: the whole game (models are embedded in the page).
- Three.js loads from a public CDN (cdnjs and jsDelivr), so players need an internet connection.

## Controls

| Key | Action |
| --- | --- |
| `WASD` / arrows | Move |
| `E` or `Space` | Use a task, vent or button |
| `R` | Report a body |
| `Q` | Eliminate (impostor) |
| `F` | Cut the lights (impostor) |
| `Space`, `Shift`, click or `Q` | Jump, sprint and attack during a 1v1 duel |

The gear button in the top-right corner (or `Esc`) opens settings (audio, camera, graphics, call sign) and lets you leave the match. The cursor hides during play and returns for tasks and menus.

## Deploy on Fly.io

Rooms live in the server's memory, so run exactly one machine.

```bash
fly auth signup        # or: fly auth login
fly launch --no-deploy --copy-config
fly scale count 1
fly deploy
fly open
```

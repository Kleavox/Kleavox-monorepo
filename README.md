# DeauWait v3 — YouTube Live Watcher
> Wait for a YouTube channel to go live. Auto-redirects when stream detected.

**Stack:** Nuxt 4 · Vue Router 5 · Nitro · Tailwind CSS

---

## Setup

```bash
cd /home/noble/deauwait
npm install
npm run dev        # http://localhost:3000
```

## Production

```bash
npm run build
npm run start      # or use systemd service
```

## Deploy (Xenon)

```bash
# 1. Install systemd service
sudo cp deauwait.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now deauwait

# 2. Nginx
server {
    listen 443 ssl;
    server_name wait.deau.site;
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

## Structure (Nuxt 4)

```
deauwait/
├── app/                        ← srcDir (Nuxt 4 default)
│   ├── app.vue
│   ├── pages/
│   │   ├── index.vue           ← main input page
│   │   └── wait/[watchId].vue  ← waiting room
│   ├── components/
│   │   └── WatcherCard.vue
│   └── assets/css/main.css
├── server/                     ← Nitro server (unchanged)
│   ├── api/
│   │   ├── watch.post.ts
│   │   ├── status/[watchId].get.ts
│   │   └── watch/[watchId].delete.ts
│   └── utils/
│       ├── checkLive.ts        ← /channel/{id}/live detection
│       └── watcherStore.ts
├── public/
│   └── favicon.svg
├── nuxt.config.ts
├── tailwind.config.js
└── package.json
```

## Live Detection Strategy

1. **Primary:** `youtube.com/channel/{id}/live` — YouTube's canonical live URL
2. **Fallback:** RSS feed polling every 2 minutes
3. **Exclusions:** Premiers and scheduled streams are filtered out

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/watch` | Start watching a channel |
| GET | `/api/status/:watchId` | Poll watcher status |
| DELETE | `/api/watch/:watchId` | Stop watching |

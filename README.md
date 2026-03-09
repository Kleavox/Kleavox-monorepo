# DeauWait v2 — YouTube Live Watcher
> Tunggu channel YouTube live, auto-redirect saat terdeteksi.

Stack: **Nuxt 3** + **Nitro** server + **Tailwind CSS**

---

## Setup

```bash
# Clone / copy ke server
cd /home/noble/deauwait

# Install dependencies
npm install

# Development
npm run dev

# Production build
npm run build

# Preview build
npm run preview
```

## Deploy ke Xenon

### 1. Build
```bash
npm run build
```

### 2. Install systemd service
```bash
sudo cp deauwait.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable deauwait
sudo systemctl start deauwait
```

### 3. Nginx config
```nginx
server {
    listen 80;
    server_name wait.deau.site;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name wait.deau.site;

    ssl_certificate /etc/letsencrypt/live/wait.deau.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wait.deau.site/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. SSL
```bash
sudo certbot --nginx -d wait.deau.site
```

---

## Struktur Project

```
deauwait/
├── pages/
│   └── index.vue          # Main UI
├── components/
│   └── WatcherCard.vue    # Watcher status card
├── server/
│   ├── api/
│   │   ├── watch.post.ts          # POST /api/watch
│   │   ├── status/[watchId].get.ts # GET /api/status/:id
│   │   └── watch/[watchId].delete.ts # DELETE /api/watch/:id
│   └── utils/
│       ├── checkLive.ts   # RSS + scraping logic
│       └── watcherStore.ts # In-memory watcher store
├── assets/css/main.css    # Global styles + grain effect
├── nuxt.config.ts
├── tailwind.config.js
└── deauwait.service       # Systemd service
```

## API Endpoints

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| POST | `/api/watch` | Mulai watch channel |
| GET | `/api/status/:watchId` | Poll status |
| DELETE | `/api/watch/:watchId` | Stop watching |

## Upgrade Plan

- [ ] YouTube Data API v3 untuk deteksi lebih reliable
- [ ] Rate limiting (misalnya `h3-rate-limiter`)
- [ ] Basic auth / token sederhana
- [ ] Notifikasi push / webhook saat live

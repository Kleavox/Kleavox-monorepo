const express = require('express');
const RSSParser = require('rss-parser');
const path = require('path');

const app = express();
const parser = new RSSParser();
const PORT = process.env.PORT || 3001;

// Store active watchers: { watchId -> { channelId, intervalId, status, videoUrl, createdAt } }
const watchers = new Map();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Helper: extract channel ID from various YouTube URL formats or raw ID
function parseChannelInput(input) {
  input = input.trim();
  // Handle @handle
  const handleMatch = input.match(/(?:youtube\.com\/@|^@)([a-zA-Z0-9_.-]+)/);
  if (handleMatch) return { type: 'handle', value: handleMatch[1] };
  // Handle channel ID URL
  const channelMatch = input.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/);
  if (channelMatch) return { type: 'id', value: channelMatch[1] };
  // Raw channel ID
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(input)) return { type: 'id', value: input };
  // Raw handle
  if (/^[a-zA-Z0-9_.-]+$/.test(input)) return { type: 'handle', value: input };
  return null;
}

// Check RSS feed for live stream
async function checkLive(channelId) {
  try {
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const feed = await parser.parseURL(feedUrl);
    for (const item of feed.items) {
      // YouTube live streams appear in RSS with specific markers
      if (item.title && item.link) {
        // Check if it's a live stream by fetching minimal page info
        const videoId = item.link.match(/v=([a-zA-Z0-9_-]+)/)?.[1];
        if (videoId) {
          const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          const html = await res.text();
          if (html.includes('"isLiveBroadcast":true') || html.includes('"isLive":true')) {
            return { live: true, videoUrl: item.link, title: item.title };
          }
        }
      }
    }
    return { live: false };
  } catch (err) {
    return { live: false, error: err.message };
  }
}

// POST /api/watch - start watching a channel
app.post('/api/watch', async (req, res) => {
  const { channel } = req.body;
  if (!channel) return res.status(400).json({ error: 'channel is required' });

  const parsed = parseChannelInput(channel);
  if (!parsed) return res.status(400).json({ error: 'Invalid channel format' });

  // For handles, we need to resolve to channel ID via RSS
  let channelId = parsed.value;
  if (parsed.type === 'handle') {
    try {
      const feedUrl = `https://www.youtube.com/@${parsed.value}/videos`;
      const pageRes = await fetch(feedUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const html = await pageRes.text();
      const match = html.match(/"channelId":"(UC[a-zA-Z0-9_-]+)"/);
      if (!match) return res.status(404).json({ error: 'Channel not found' });
      channelId = match[1];
    } catch (e) {
      return res.status(500).json({ error: 'Failed to resolve channel: ' + e.message });
    }
  }

  const watchId = Math.random().toString(36).slice(2, 10);

  // Start polling every 2 minutes
  const intervalId = setInterval(async () => {
    const result = await checkLive(channelId);
    const watcher = watchers.get(watchId);
    if (!watcher) return;
    if (result.live) {
      watcher.status = 'live';
      watcher.videoUrl = result.videoUrl;
      watcher.title = result.title;
      clearInterval(intervalId);
    }
  }, 2 * 60 * 1000);

  // Check immediately
  const immediate = await checkLive(channelId);

  watchers.set(watchId, {
    channelId,
    channelInput: channel,
    intervalId,
    status: immediate.live ? 'live' : 'waiting',
    videoUrl: immediate.live ? immediate.videoUrl : null,
    title: immediate.live ? immediate.title : null,
    createdAt: Date.now()
  });

  res.json({ watchId, status: immediate.live ? 'live' : 'waiting', videoUrl: immediate.videoUrl || null });
});

// GET /api/status/:watchId - poll status
app.get('/api/status/:watchId', (req, res) => {
  const watcher = watchers.get(req.params.watchId);
  if (!watcher) return res.status(404).json({ error: 'Watcher not found' });
  res.json({
    status: watcher.status,
    videoUrl: watcher.videoUrl,
    title: watcher.title,
    channelInput: watcher.channelInput,
    age: Math.floor((Date.now() - watcher.createdAt) / 1000)
  });
});

// DELETE /api/watch/:watchId - stop watching
app.delete('/api/watch/:watchId', (req, res) => {
  const watcher = watchers.get(req.params.watchId);
  if (!watcher) return res.status(404).json({ error: 'Not found' });
  clearInterval(watcher.intervalId);
  watchers.delete(req.params.watchId);
  res.json({ ok: true });
});

// Cleanup stale watchers older than 12 hours
setInterval(() => {
  const now = Date.now();
  for (const [id, w] of watchers.entries()) {
    if (now - w.createdAt > 12 * 60 * 60 * 1000) {
      clearInterval(w.intervalId);
      watchers.delete(id);
    }
  }
}, 60 * 60 * 1000);

app.listen(PORT, '127.0.0.1', () => {
  console.log(`YTWatcher running on port ${PORT}`);
});

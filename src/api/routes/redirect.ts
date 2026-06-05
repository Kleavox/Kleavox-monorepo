import { Hono } from "hono";
import type { Env } from "../lib/env";
import { UAParser } from "ua-parser-js";

function serveApp(env: Env): Promise<Response> {
  return env.ASSETS.fetch(new Request("https://app/index.html"));
}

type HonoEnv = { Bindings: Env };
const redirect = new Hono<HonoEnv>();

const APP_PATHS = new Set([
  "dash", "admin", "terms", "privacy", "report",
  "data-deleted", "_next", "favicon.ico", "favicon.svg", "api",
]);

type LinkRow = {
  id: number;
  slug: string;
  target_url: string;
  password: string | null;
  expires_at: string | null;
};

redirect.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const host = c.req.header("host") ?? "";
  const isShortDomain = host === c.env.SHORT_HOST;
  const isAppPath = APP_PATHS.has(slug) || slug.startsWith("_") || slug.includes(".");

  if (isShortDomain) {
    if (isAppPath) {
      return c.redirect(`https://${c.env.APP_HOST}/${slug}`, 301);
    }
  } else {
    if (isAppPath) {
      return serveApp(c.env);
    }
  }

  // Lookup slug in D1
  const link = await c.env.DB
    .prepare("SELECT id, slug, target_url, password, expires_at FROM short_links WHERE slug = ? LIMIT 1")
    .bind(slug)
    .first<LinkRow>();

  if (!link) {
    if (isShortDomain) {
      return c.html(errorPage("NOT_FOUND", "This link does not exist or has been removed."), 404);
    }
    return serveApp(c.env);
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return c.html(errorPage("LINK_EXPIRED", "This link has expired and is no longer valid."), 410);
  }

  if (link.password) {
    return c.html(passwordPage(slug, c.env.SHORT_HOST));
  }

  // Log analytics fire-and-forget
  logClick(c.req.raw, link.id, c.env.DB).catch(e => console.error("[analytics]", e));

  return c.html(redirectPage(link.target_url, c.env.SHORT_HOST));
});

// ─── Analytics ───────────────────────────────────────────────
async function logClick(req: Request, linkId: number, db: D1Database): Promise<void> {
  const ua = req.headers.get("user-agent") ?? "";
  const r = new UAParser(ua).getResult();
  const ip = req.headers.get("cf-connecting-ip")
    ?? req.headers.get("x-real-ip")
    ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? "unknown";
  const cf = (req as unknown as { cf?: { country?: string; city?: string } }).cf;
  const referrer = req.headers.get("referer") ?? "Direct";

  await db.prepare(
    "INSERT INTO clicks (short_link_id, browser, os, device, country, city, ip, referrer) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(linkId, r.browser.name ?? null, r.os.name ?? null, r.device.type ?? "desktop",
    cf?.country ?? null, cf?.city ?? null, ip, referrer).run();
}

// ─── Pages ───────────────────────────────────────────────────
const BASE_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:monospace;background:#000;color:#f0f0f0;min-height:100vh;
  display:flex;align-items:center;justify-content:center;padding:1rem;
  background-image:radial-gradient(circle,#1f1f1f 0.75px,transparent 0.75px);
  background-size:22px 22px}
.card{background:#0a0a0a;border:1px solid #262626;border-radius:20px;
  padding:1px;width:100%;max-width:520px;box-shadow:0 0 80px rgba(163,230,53,.05)}
.inner{padding:2rem 2rem 1.75rem;border-radius:19px}
.tag{font-size:9px;text-transform:uppercase;letter-spacing:.2em;color:#a3e635;
  margin-bottom:1.5rem;display:flex;align-items:center;gap:.5rem}
.live{width:7px;height:7px;border-radius:50%;background:#a3e635;
  box-shadow:0 0 6px rgba(163,230,53,.7);animation:blink 1.6s ease-in-out infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
h1{font-size:1.75rem;font-weight:900;text-transform:uppercase;
  letter-spacing:-.05em;line-height:.9;margin-bottom:.3rem}
.sub{font-size:9px;text-transform:uppercase;letter-spacing:.2em;
  color:#888;margin-bottom:1.5rem}
.dest{background:#111;border:1px solid #222;border-radius:12px;
  padding:.875rem 1.125rem;margin-bottom:1.25rem}
.dest-lbl{font-size:8px;text-transform:uppercase;letter-spacing:.15em;
  color:#a3e635;margin-bottom:.35rem}
.dest-url{font-size:.78rem;color:#f0f0f0;opacity:.45;word-break:break-all}
.bar-wrap{background:#111;border-radius:9999px;height:38px;
  border:1px solid #222;position:relative;overflow:hidden;margin-bottom:.875rem}
.bar-fill{position:absolute;left:0;top:0;height:100%;background:#a3e635;
  border-radius:9999px;width:0%}
.bar-txt{position:absolute;inset:0;display:flex;align-items:center;
  justify-content:center;font-size:.8rem;font-weight:900;letter-spacing:.2em;
  mix-blend-mode:hard-light}
.skip{display:block;text-align:center;font-size:9px;text-transform:uppercase;
  letter-spacing:.15em;color:#555;text-decoration:none;border:1px solid #222;
  border-radius:9999px;padding:.5rem 1.25rem;transition:.2s}
.skip:hover{background:#141414;color:#f0f0f0;border-color:#333}
label{font-size:9px;text-transform:uppercase;letter-spacing:.15em;
  color:#888;display:block;margin-bottom:.5rem}
input[type=password]{background:#111;border:1.5px solid #262626;
  border-radius:9999px;padding:.75rem 1.25rem;color:#f0f0f0;font-weight:600;
  width:100%;font-size:15px;outline:none;transition:.2s;margin-bottom:.75rem}
input[type=password]:focus{border-color:#a3e635}
.btn{background:#a3e635;color:#0a0a0a;border:none;border-radius:9999px;
  padding:.875rem 2rem;font-weight:800;font-size:.73rem;text-transform:uppercase;
  letter-spacing:.15em;width:100%;cursor:pointer;margin-bottom:.5rem}
.btn:disabled{opacity:.4}
.err{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);
  border-radius:10px;padding:.65rem 1rem;color:#ef4444;font-size:9px;
  text-transform:uppercase;letter-spacing:.1em;margin-top:.5rem;display:none}
`;

function redirectPage(target: string, host: string): string {
  const display = target.replace(/^https?:\/\//, "").slice(0, 60) + (target.length > 68 ? "…" : "");
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Redirecting — DeauBit</title><style>${BASE_CSS}</style>
</head><body><div class="card"><div class="inner">
  <div class="tag"><div class="live"></div>${host}</div>
  <h1>Redirecting</h1>
  <div class="sub">SYNCHRONIZING_NODE_VECTOR</div>
  <div class="dest">
    <div class="dest-lbl">Destination</div>
    <div class="dest-url">${display}</div>
  </div>
  <div class="bar-wrap">
    <div class="bar-fill" id="bar"></div>
    <div class="bar-txt" id="txt">2s</div>
  </div>
  <a href="${target}" class="skip">Skip &rarr;</a>
</div></div>
<script>
const T="${target}",D=2000;let s=null;
function tick(ts){if(!s)s=ts;const p=Math.min((ts-s)/D,1);
  document.getElementById('bar').style.width=(p*100)+'%';
  document.getElementById('txt').textContent=Math.ceil(D*(1-p)/1000)+'s';
  p<1?requestAnimationFrame(tick):window.location.href=T;}
requestAnimationFrame(tick);
</script></body></html>`;
}

function passwordPage(slug: string, host: string): string {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Protected Link — DeauBit</title><style>${BASE_CSS}</style>
</head><body><div class="card"><div class="inner">
  <div class="tag"><div class="live"></div>${host}</div>
  <div id="form-view">
    <h1>Protected<br>Link</h1>
    <div class="sub">ACCESS_KEY_REQUIRED</div>
    <label>Security Key</label>
    <input type="password" id="pw" placeholder="Enter access key" autofocus>
    <div class="err" id="err"></div>
    <button class="btn" onclick="unlock()">Unlock Node</button>
  </div>
  <div id="go-view" style="display:none">
    <h1>Access<br>Granted</h1>
    <div class="sub">CLEARANCE_CONFIRMED</div>
    <div class="dest">
      <div class="dest-lbl">Destination</div>
      <div class="dest-url" id="dest-url"></div>
    </div>
    <div class="bar-wrap">
      <div class="bar-fill" id="bar"></div>
      <div class="bar-txt" id="txt">2s</div>
    </div>
    <a id="skip" href="#" class="skip">Skip &rarr;</a>
  </div>
</div></div>
<script>
let target=null;
async function unlock(){
  const pw=document.getElementById('pw').value,
        err=document.getElementById('err'),
        btn=event.target;
  if(!pw)return;
  btn.disabled=true;btn.textContent='Verifying...';err.style.display='none';
  const r=await fetch('/api/links/${slug}/verify',{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})});
  const d=await r.json();
  if(r.ok&&d.targetUrl){
    target=d.targetUrl;
    document.getElementById('dest-url').textContent=target.replace(/^https?:\\/\\//,'').slice(0,60);
    document.getElementById('skip').href=target;
    document.getElementById('form-view').style.display='none';
    document.getElementById('go-view').style.display='block';
    const D=2000;let s=null;
    function tick(ts){if(!s)s=ts;const p=Math.min((ts-s)/D,1);
      document.getElementById('bar').style.width=(p*100)+'%';
      document.getElementById('txt').textContent=Math.ceil(D*(1-p)/1000)+'s';
      p<1?requestAnimationFrame(tick):window.location.href=target;}
    requestAnimationFrame(tick);
  } else {
    err.textContent=d.error||'Incorrect password';
    err.style.display='block';btn.disabled=false;btn.textContent='Unlock Node';
  }
}
document.getElementById('pw').addEventListener('keydown',e=>{if(e.key==='Enter')unlock()});
</script></body></html>`;
}

function errorPage(title: string, msg: string): string {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — DeauBit</title>
<style>*{box-sizing:border-box;margin:0;padding:0}
body{font-family:monospace;background:#000;color:#f0f0f0;min-height:100vh;
  display:flex;align-items:center;justify-content:center;padding:1rem;
  background-image:radial-gradient(circle,#1f1f1f 0.75px,transparent 0.75px);background-size:22px 22px}
.card{background:#0a0a0a;border:1px solid #262626;border-radius:20px;padding:2rem;
  width:100%;max-width:380px;text-align:center}
h1{font-size:1.5rem;font-weight:900;text-transform:uppercase;letter-spacing:-.05em;
  color:#ef4444;margin-bottom:.4rem}
p{font-size:9px;text-transform:uppercase;letter-spacing:.15em;color:#888;margin-bottom:1.5rem}
a{background:#a3e635;color:#0a0a0a;border-radius:9999px;padding:.75rem 2rem;
  font-weight:800;font-size:.73rem;text-transform:uppercase;text-decoration:none;display:inline-block}
</style>
</head><body><div class="card">
<h1>${title}</h1><p>${msg}</p>
<a href="/">Return to Home</a>
</div></body></html>`;
}

export default redirect;

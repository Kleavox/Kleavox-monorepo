export interface ErrorPageOptions {
  service: string;
  title: string;
  message: string;
  accent?: string;
  homeHref?: string;
  homeLabel?: string;
}

const DEFAULT_ACCENT = "#a3e635";

export function renderErrorPage(options: ErrorPageOptions): string {
  const accent = options.accent ?? DEFAULT_ACCENT;
  const homeHref = options.homeHref ?? "/";
  const homeLabel = options.homeLabel ?? "Return to Kleavox";
  const service = escapeHtml(options.service);
  const title = escapeHtml(options.title);
  const message = escapeHtml(options.message);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} | Kleavox</title>
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 16% 12%,${hexToGlow(accent)},transparent 26rem),#070908;color:#eff5f0;font-family:"Aptos","Segoe UI Variable","Segoe UI",system-ui,sans-serif}
main{width:min(100%,560px);border:1px solid #222b26;background:rgb(14 18 16 / 88%);padding:clamp(28px,6vw,48px)}
small{display:block;margin-bottom:18px;color:${accent};font-family:"Cascadia Code",Consolas,monospace;font-size:0.66rem;font-weight:700;letter-spacing:0.16em;text-transform:uppercase}
h1{margin:0;font-size:clamp(1.9rem,6vw,2.8rem);font-weight:850;letter-spacing:-0.04em;line-height:1.02;text-transform:uppercase}
p{margin:18px 0 0;color:#84938a;font-size:0.95rem;line-height:1.7;overflow-wrap:anywhere}
a{display:inline-block;margin-top:28px;border:1px solid #222b26;padding:12px 18px;color:#eff5f0;font-family:"Cascadia Code",Consolas,monospace;font-size:0.7rem;font-weight:700;letter-spacing:0.08em;text-decoration:none;text-transform:uppercase}
a:hover{border-color:${accent};color:${accent}}
</style>
</head>
<body>
<main>
<small>${service}</small>
<h1>${title}</h1>
<p>${message}</p>
<a href="${escapeHtml(homeHref)}">${escapeHtml(homeLabel)} →</a>
</main>
</body>
</html>`;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function hexToGlow(hex: string): string {
  const value = hex.replace("#", "");
  const size = value.length === 3 ? 1 : 2;
  const red = Number.parseInt(value.slice(0, size).repeat(3 - size), 16);
  const green = Number.parseInt(value.slice(size, size * 2).repeat(3 - size), 16);
  const blue = Number.parseInt(value.slice(size * 2, size * 3).repeat(3 - size), 16);
  if ([red, green, blue].some(Number.isNaN)) return "rgb(163 230 53 / 7%)";
  return `rgb(${red} ${green} ${blue} / 7%)`;
}

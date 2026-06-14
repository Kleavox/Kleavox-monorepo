import { escapeHtml, renderErrorPage } from "@kleavox/core";

const ACCENT = "#a3e635";

export function protectedLinkPage(slug: string): string {
  const safeSlug = escapeHtml(slug);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Protected link | Kleavox</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 16% 12%,rgb(72 202 240 / 7%),transparent 26rem),#070908;color:#eff5f0;font-family:"Aptos","Segoe UI Variable","Segoe UI",system-ui,sans-serif}
    main{width:min(100%,460px);border:1px solid #222b26;background:rgb(14 18 16 / 88%);padding:clamp(28px,6vw,44px)}
    small{display:block;margin-bottom:18px;color:${ACCENT};font-family:"Cascadia Code",Consolas,monospace;font-size:0.66rem;font-weight:700;letter-spacing:0.16em;text-transform:uppercase}
    h1{margin:0;font-size:clamp(1.7rem,6vw,2.4rem);font-weight:850;letter-spacing:-0.04em;line-height:1.05;text-transform:uppercase}
    p{margin:16px 0 0;color:#84938a;font-size:0.95rem;line-height:1.7;overflow-wrap:anywhere}
    label{display:block;margin:28px 0 8px;font-family:"Cascadia Code",Consolas,monospace;font-size:0.68rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase}
    input,button{width:100%;min-height:48px;font:inherit}
    input{border:1px solid #222b26;background:#070908;color:#eff5f0;padding:0 14px}
    input:focus{border-color:${ACCENT};outline:none}
    button{margin-top:12px;border:0;background:${ACCENT};color:#031620;font-weight:800;cursor:pointer}
    button:disabled{opacity:0.6;cursor:wait}
    .error{color:#fb7185;font-size:14px;min-height:22px}
  </style>
</head>
<body>
  <main>
    <small>Kleavox</small>
    <h1>Protected destination</h1>
    <p>Enter the password provided by the link owner to continue to <strong>/${safeSlug}</strong>.</p>
    <form id="unlock">
      <label for="password">Link password</label>
      <input id="password" type="password" minlength="8" autocomplete="current-password" required autofocus>
      <button type="submit">Continue</button>
      <p class="error" id="error" role="alert"></p>
    </form>
  </main>
  <script>
    document.getElementById("unlock").addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector("button");
      const error = document.getElementById("error");
      button.disabled = true;
      error.textContent = "";
      const response = await fetch(location.pathname, {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({password: document.getElementById("password").value}),
      });
      if (response.redirected) {
        location.assign(response.url);
        return;
      }
      const data = await response.json().catch(() => ({}));
      error.textContent = data.message || "The password is incorrect.";
      button.disabled = false;
    });
  </script>
</body>
</html>`;
}

export function linkUnavailablePage(
  code: string,
  title: string,
  message: string,
): string {
  return renderErrorPage({
    service: "Kleavox",
    code,
    title,
    message,
  });
}

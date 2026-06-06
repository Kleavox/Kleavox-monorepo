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
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#10131a;color:#f4f6fb;font-family:Arial,sans-serif}
    main{width:min(100%,440px);border:1px solid #303746;background:#171b24;padding:32px}
    p{color:#aeb6c8;line-height:1.6}label{display:block;margin:28px 0 8px;font-size:13px;font-weight:700}
    input,button{width:100%;min-height:48px;border-radius:4px;font:inherit}input{border:1px solid #465066;background:#10131a;color:#fff;padding:0 14px}
    button{margin-top:12px;border:0;background:#2f6df6;color:#fff;font-weight:700;cursor:pointer}.error{color:#ff9d9d;font-size:14px;min-height:22px}
  </style>
</head>
<body>
  <main>
    <small>KLEAVOX LINK</small>
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

export function linkUnavailablePage(title: string, message: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)} | Kleavox</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#10131a;color:#f4f6fb;font-family:Arial,sans-serif}main{max-width:520px}p{color:#aeb6c8;line-height:1.7}a{color:#79a4ff}</style></head><body><main><small>KLEAVOX LINK</small><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><a href="/">Return to Kleavox</a></main></body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

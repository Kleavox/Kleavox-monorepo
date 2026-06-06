interface Env {
  ASSETS: Fetcher;
}

export default {
  fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ service: "portfolio", status: "ok" });
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

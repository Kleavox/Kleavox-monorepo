import { buildApp } from "./app.js";
import { startUptimePinger } from "./lib/pinger.js";

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? "0.0.0.0";

const app = buildApp();
let stopPinger: (() => void) | null = null;

app.listen({ port: PORT, host: HOST })
  .then(() => {
    app.log.info(`deauport-services running at http://${HOST}:${PORT}`);
    stopPinger = startUptimePinger(app.log);
  })
  .catch((err) => {
    app.log.error(err, "Failed to start server");
    process.exit(1);
  });

const shutdown = async () => {
  app.log.info("Shutting down...");
  try { stopPinger?.(); } catch {}
  try { await app.close(); } catch {}
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
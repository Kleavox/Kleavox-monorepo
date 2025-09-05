import { FastifyInstance } from "fastify";
import { runMonthlyRecap, runManualBackup } from "../lib/recap.js";

export default async function recapRoutes(app: FastifyInstance) {
  app.post("/trigger", async (req, reply) => {
    try {
      await runMonthlyRecap(app.log);
      return reply.code(200).send({ message: "Monthly recap initiated successfully and data has been reset." });
    } catch (e: any) {
      app.log.error(e, "Error triggering monthly recap");
      return reply.code(500).send({ error: "Failed to initiate recap." });
    }
  });

  app.post("/manual-backup", async (req, reply) => {
    try {
      await runManualBackup(app.log);
      return reply.code(200).send({ message: "Manual backup email sent successfully." });
    } catch (e: any) {
      app.log.error(e, "Error triggering manual backup");
      return reply.code(500).send({ error: "Failed to initiate backup." });
    }
  });
}
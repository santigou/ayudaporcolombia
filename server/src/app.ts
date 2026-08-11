import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "node:path";
import { authRouter } from "./routes/auth.routes.js";
import { pointsRouter } from "./routes/points.routes.js";
import { moderatorRouter } from "./routes/moderator.routes.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  app.use("/api/auth", authRouter);
  app.use("/api/points", pointsRouter);
  app.use("/api/moderator", moderatorRouter);

  const clientDist = path.join(process.cwd(), "..", "client", "dist");
  app.use(express.static(clientDist));
  app.get(/^(?!\/api|\/uploads).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"), (err) => {
      if (err) res.status(404).send("Not built yet — run npm run build");
    });
  });

  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error(err);
      const message = err instanceof Error ? err.message : "Error interno del servidor";
      res.status(500).json({ error: message });
    },
  );

  return app;
}

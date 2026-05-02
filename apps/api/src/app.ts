import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { authContext } from "./middleware/auth";
import { healthRouter } from "./routes/health";
import { v1Router } from "./routes/v1/index";
import { authRouter } from "./routes/v1/auth";
import { paymentsRouter } from "./routes/v1/payments";

type LoggedRequest = Request & {
  log?: {
    error?: (err: unknown, msg?: string) => void;
  };
};

export function createApp() {
  const app = express();
  const requestLogger = pinoHttp();

  app.use(helmet());
  app.use(cors());
  app.use("/v1/payments/webhook", express.raw({ type: "application/json" }));
  app.use(express.json());
  app.use(requestLogger);

  app.get("/", (_req, res) => res.json({ status: "ok" }));

  // Public routes
  app.use("/v1/auth", authRouter);
  app.use("/v1/payments", paymentsRouter);
  app.use("/health", healthRouter);

  // Auth middleware gates everything below this line.
  app.use(authContext);
  app.use("/v1", v1Router);

  app.use((err: unknown, req: LoggedRequest, res: Response, _next: NextFunction) => {
    req.log?.error?.(err, "unhandled_error");
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}

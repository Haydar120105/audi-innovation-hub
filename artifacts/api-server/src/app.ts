import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());

const clerkPublishableKey = process.env["CLERK_PUBLISHABLE_KEY"];
const clerkSecretKey = process.env["CLERK_SECRET_KEY"];

if (!clerkPublishableKey || !clerkSecretKey || clerkPublishableKey.includes("REPLACE_ME") || clerkSecretKey.includes("REPLACE_ME")) {
  logger.warn("CLERK_PUBLISHABLE_KEY or CLERK_SECRET_KEY not configured — auth middleware disabled. Set real keys to enable authentication.");
  // Mount a no-op middleware so getAuth() returns an empty auth object
  app.use((_req, _res, next) => next());
} else {
  app.use(clerkMiddleware({ publishableKey: clerkPublishableKey, secretKey: clerkSecretKey }));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;

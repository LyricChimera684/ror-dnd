import express, { type Express } from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";

const app: Express = express();

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// In production, restrict CORS to the Vercel frontend URL.
// FRONTEND_URL must be set as an env var on Render (e.g. https://your-app.vercel.app).
// In development, allow all origins for convenience.
const corsOrigin =
  process.env.NODE_ENV === "production"
    ? (process.env.FRONTEND_URL ?? true)
    : true;

// Express 5 requires an explicit options route for preflight when using
// a path pattern — use the wildcard segment syntax.
app.options("/{*wildcard}", cors({ credentials: true, origin: corsOrigin }));
app.use(cors({ credentials: true, origin: corsOrigin }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(clerkMiddleware());

app.use("/api", router);

export default app;

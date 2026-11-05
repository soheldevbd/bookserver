import "dotenv/config";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import router from "./routes.js";

const app = express();

const origins = (process.env.CLIENT_URL || "http://localhost:3000").split(",").map((o) => o.trim());
app.use(cors({ origin: origins, credentials: true }));
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ name: "BookNook API", status: "running" });
});
app.use(router);

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ message: "Something went wrong on the server" });
});

const port = Number(process.env.PORT) || 5001;
if (!process.env.VERCEL) {
  app.listen(port, () => console.log(`BookNook API running on port ${port}`));
}

export default app;

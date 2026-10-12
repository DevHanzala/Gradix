import { validateEnv } from "./config/env.js";
import { connectDB } from "./DB/db.js";

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});

const startServer = async () => {
  try {
    validateEnv();
    // Import the app only after env validation so module-level config is safe.
    const { default: app } = await import("./app.js");
    await connectDB();

    const port = Number(process.env.PORT) || 5000;
    app.listen(port, "0.0.0.0", () => {
      console.log(`Gradix backend listening on port ${port}`);
    });
  } catch (error) {
    console.error(`Startup failed: ${error.message}`);
    process.exit(1);
  }
};

startServer();

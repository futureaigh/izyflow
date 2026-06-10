import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// Load .env.local for development only
if (fs.existsSync(".env.local")) {
  try {
    const envConfig = dotenv.parse(fs.readFileSync(".env.local"));
    for (const k in envConfig) {
      process.env[k] = envConfig[k];
    }
    console.log("◇ injected env from .env.local");
  } catch (e) {
    console.error("Failed to load .env.local:", e);
  }
}

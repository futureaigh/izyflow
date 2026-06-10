import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// Load .env.production for production builds
if (process.env.NODE_ENV === 'production' && fs.existsSync(".env.production")) {
  try {
    const envConfig = dotenv.parse(fs.readFileSync(".env.production"));
    for (const k in envConfig) {
      process.env[k] = envConfig[k];
    }
    console.log("◇ injected env from .env.production");
  } catch (e) {
    console.error("Failed to load .env.production:", e);
  }
}
// Load .env.local for development
else if (fs.existsSync(".env.local")) {
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

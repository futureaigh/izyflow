import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { GoogleGenAI } from "@google/genai";

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No GEMINI_API_KEY found in .env");
    process.exit(1);
  }

  console.log("Testing Gemini API connection...");
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Say 'Hello from Gemini!'",
      config: {
        temperature: 0,
      }
    });

    console.log("Response text:", response.text);
    console.log("✅ Gemini API is working correctly!");
  } catch (error) {
    console.error("❌ Gemini API test failed:", error);
  }
}

testGemini();

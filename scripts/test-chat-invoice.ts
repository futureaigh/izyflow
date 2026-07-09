import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { GoogleGenAI, Type } from "@google/genai";

async function testInvoiceChat() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No GEMINI_API_KEY found in .env.local");
    process.exit(1);
  }

  console.log("Simulating chat request to create an invoice...");
  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Tools as defined in IzyAssistant.tsx
    const proposeInvoiceTool = {
      name: "proposeInvoice",
      description: "Propose a new invoice based on a user's description.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          clientName: { type: Type.STRING, description: "The name of the client" },
          amount: { type: Type.NUMBER, description: "The total amount of the invoice" },
          currency: { type: Type.STRING, description: "The currency of the invoice (e.g. GHS, USD)" },
          dueDate: { type: Type.STRING, description: "The due date of the invoice in YYYY-MM-DD format" },
          introduction: { type: Type.STRING, description: "A brief professional introduction or note for the invoice" },
          status: { type: Type.STRING, enum: ["Draft", "Sent", "Paid", "Partial"], description: "The status of the invoice" },
        },
        required: ["clientName", "amount", "dueDate", "introduction"]
      }
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Can you create an invoice for John Doe for $500? The service is Website Design and it's due on 2026-08-01.",
      config: {
        temperature: 0,
        tools: [{ functionDeclarations: [proposeInvoiceTool] }]
      }
    });

    console.log("\n--- AI Response ---");
    if (response.functionCalls && response.functionCalls.length > 0) {
      console.log("✅ The AI correctly recognized the intent and made a Function Call:");
      console.log(JSON.stringify(response.functionCalls[0], null, 2));
    } else if (response.text) {
      console.log("❌ The AI responded with text instead of a function call:");
      console.log(response.text);
    }
    
  } catch (error) {
    console.error("❌ Chat test failed:", error);
  }
}

testInvoiceChat();

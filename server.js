import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

// Use the recommended model and API key handling for the Canvas environment
// The `apiKey` is left blank, as it will be injected at runtime.
// FOR LOCAL TESTING: We'll read from process.env, falling back to ""
const apiKey = process.env.GEMINI_API_KEY || "";
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent";

// ------------------------------
// 🧩 Helper: Call Gemini (single attempt)
// ------------------------------
// NOTE: The 429 "RESOURCE_EXHAUSTED" error is a hard limit
// from Google on the free tier. No code change can "fix" this.
// The only solution is to make fewer requests per minute
// (e.g., wait 60s) or upgrade to a paid plan.
async function callGemini(prompt) {
  try {
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${apiKey}`, // Pass the key as a query param
      { contents: [{ parts: [{ text: prompt }] }] },
      { headers: { "Content-Type": "application/json" } }
    );
    return response; // Success!
  } catch (err) {
    // Log the error for debugging
    console.error(
      `❌ Error calling Gemini:`,
      err.response?.data || err.message
    );
    throw err; // Re-throw the error to be caught by the route handler
  }
}

// ------------------------------
// 🌱 Route: Analyze Soil
// ------------------------------
app.post("/analyze-soil", async (req, res) => {
  try {
    const {
      temperature,
      humidity,
      moisture,
      nitrogen,
      phosphorus,
      potassium,
      ph,
      rainfall,
      cropName,
    } = req.body;

    if (
      temperature === undefined ||
      humidity === undefined ||
      moisture === undefined ||
      nitrogen === undefined ||
      phosphorus === undefined ||
      potassium === undefined ||
      ph === undefined ||
      rainfall === undefined ||
      !cropName
    ) {
      return res.status(400).json({
        error: "Missing required fields in the request body.",
      });
    }

    const prompt = `
You are an expert soil scientist and crop advisor. Analyze the following soil and environmental data to assess if the conditions are suitable for growing ${cropName}. Then, provide recommendations for improvement.

Your analysis MUST be concise and practical.

---
[DATA]
🌡️ Temperature: ${temperature} °C
💧 Humidity: ${humidity} %
🌱 Soil Moisture: ${moisture}
🧪 Nitrogen (N): ${nitrogen} ppm
🧪 Phosphorus (P): ${phosphorus} ppm
🧪 Potassium (K): ${potassium} ppm
⚗️ pH: ${ph}
🌧️ Rainfall: ${rainfall} mm

---
[REQUEST]
Provide a short report in Markdown format with these exact sections:
1.  **Soil Health Status:** (Brief overview of N, P, K, and pH)
2.  **${cropName} Suitability:** (Clear "Yes", "No", or "Marginal" with reason)
3.  **Recommendations:** (Bulleted list of 2-3 top actions for fertilizer or amendments)
4.  **Summary:** (A single-line conclusion)
`;

    // Updated to call the new single-attempt function
    const aiRes = await callGemini(prompt);

    const aiText =
      aiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No response from Gemini.";

    res.json({ success: true, crop: cropName, analysis: aiText });
  } catch (error) {
    // Check if the error is from the API call
    if (error.response?.status === 429) {
      return res.status(429).json({
        error:
          "Gemini API rate limit exceeded. (RESOURCE_EXHAUSTED)",
        message: error.response?.data?.error?.message || "Quota exceeded. Please wait 1 minute and try again.",
      }); 
    }
    // Handle other potential errors
    res.status(500).json({
      error:
        "Internal Server Error. Please check your request or server logs.",
      message: error.message,
    });
  }
});

// ------------------------------
// ✅ Start Server
// ------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌱 Ready to analyze soil at http://localhost:${PORT}/analyze-soil`);
});


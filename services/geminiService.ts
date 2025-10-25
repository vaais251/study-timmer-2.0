import { GoogleGenAI } from "@google/genai";

// For deployment testing, paste your API key here.
// IMPORTANT: For a production app, it's recommended to use environment variables.
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE";

if (GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
    console.warn("Gemini API key is not configured. Please add your key to services/geminiService.ts");
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export async function generateContent(prompt: string): Promise<string> {
    try {
        if (GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
            return "AI feature is disabled. Please configure your Gemini API key in `services/geminiService.ts` to enable it.";
        }
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [{ text: prompt }] }],
            // The user's code used google search, so we add it here.
            config: {
                tools: [{ googleSearch: {} }],
            },
        });
        
        const text = response.text;
        
        if (text) {
            return text;
        } else {
            throw new Error("Received an empty response from Gemini API.");
        }
    } catch (error) {
        if (error instanceof Error) {
            return `Failed to get response from AI: ${error.message}`;
        }
        return "An unknown error occurred while contacting the AI.";
    }
}
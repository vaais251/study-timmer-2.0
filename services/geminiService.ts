
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  // This is a client-side check. The build environment must provide the key.
  console.warn("API_KEY environment variable not set. Gemini API calls will fail.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

export async function generateContent(prompt: string): Promise<string> {
    try {
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
        console.error("Error calling Gemini API:", error);
        if (error instanceof Error) {
            return `Failed to get response from AI: ${error.message}`;
        }
        return "An unknown error occurred while contacting the AI.";
    }
}

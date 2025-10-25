
import { GoogleGenAI } from "@google/genai";

// The API key is expected to be set in the environment variables.
if (!process.env.API_KEY) {
    throw new Error("Gemini API key is not configured in environment variables.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
        if (error instanceof Error) {
            return `Failed to get response from AI: ${error.message}`;
        }
        return "An unknown error occurred while contacting the AI.";
    }
}

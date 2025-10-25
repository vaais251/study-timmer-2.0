

import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

const getAIClient = (): GoogleGenAI => {
    if (ai) {
        return ai;
    }
    
    // Set the Gemini API key directly as requested.
    const API_KEY = "AIzaSyBT9IN5PiyqaWBdM9NekDg5d-5fWDuhZnE";

    if (!API_KEY) {
      throw new Error("Gemini API key is not configured.");
    }
    
    ai = new GoogleGenAI({ apiKey: API_KEY });
    return ai;
};

export async function generateContent(prompt: string): Promise<string> {
    try {
        const client = getAIClient();
        const response = await client.models.generateContent({
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

import { GoogleGenAI } from "@google/genai";

export async function generateContent(prompt: string): Promise<string> {
    try {
        // The API key is securely managed and injected as an environment variable.
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            console.warn("Gemini API key is not configured. AI features will be disabled.");
            return "AI feature is disabled. Please ensure your Gemini API key is correctly set up in the environment.";
        }
        
        const ai = new GoogleGenAI({ apiKey });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                tools: [{ googleSearch: {} }],
            },
        });
        
        const text = response.text;
        
        if (text) {
            return text;
        } else {
            // This case might occur if the model returns a valid but empty response.
            console.warn("Received an empty text response from Gemini API.");
            return "The AI returned an empty response. You might want to rephrase your request.";
        }
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        if (error instanceof Error) {
            return `An error occurred while contacting the AI. Please check your API key and network connection. Details: ${error.message}`;
        }
        return "An unknown error occurred while contacting the AI.";
    }
}
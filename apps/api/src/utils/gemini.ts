import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { env } from "../config/env";

export interface GeminiOptions {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
}

export class GeminiService {
    private genAI: GoogleGenerativeAI;
    private model: GenerativeModel;

    constructor(modelName: string = "gemini-1.5-flash") {
        this.genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: modelName });
    }

    /**
     * Generate content with resilience (retries + backoff)
     */
    async generateContent(prompt: string, options: GeminiOptions = {}) {
        const {
            maxRetries = 3,
            initialDelayMs = 1000,
            maxDelayMs = 10000,
        } = options;

        let lastError: any;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await this.model.generateContent(prompt);
                const response = await result.response;
                return response.text();
            } catch (error: any) {
                lastError = error;

                // Check if we should retry
                const isRetryable = this.isRetryableError(error);
                if (!isRetryable || attempt === maxRetries) {
                    break;
                }

                // Exponential backoff with jitter
                const delay = Math.min(
                    maxDelayMs,
                    initialDelayMs * Math.pow(2, attempt) + Math.random() * 1000
                );

                console.warn(`⚠️ Gemini request failed (attempt ${attempt + 1}). Retrying in ${Math.round(delay)}ms...`, error.message);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }

        console.error("❌ Gemini request failed after all retries:", lastError.message);
        throw lastError;
    }

    private isRetryableError(error: any): boolean {
        // Retry on 429 (Rate Limit), 500, 503 (Overloaded/Capacity)
        const status = error?.status || error?.response?.status;
        const message = error?.message || "";

        if (status === 429 || status === 500 || status === 503) return true;
        if (message.includes("SAFETY")) return false; // Don't retry safety blocks
        if (message.includes("quota")) return true;
        if (message.includes("overloaded")) return true;
        if (message.includes("capacity")) return true;

        return false;
    }
}

export const gemini = new GeminiService();

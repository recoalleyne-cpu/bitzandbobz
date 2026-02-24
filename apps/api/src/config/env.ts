import { z } from "zod";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

/**
 * Load .env from workspace root or app directory
 */
const envCandidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "../../.env"),
    path.resolve(__dirname, "../../../.env")
];

const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));
if (envPath) {
    dotenv.config({ path: envPath });
} else {
    dotenv.config();
}

/**
 * Define environment schema with Zod
 */
const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.string().default("4000").transform(Number),
    DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL (e.g., file:./prisma/dev.db or postgresql://...)"),
    ADMIN_PASSWORD: z.string().min(8, "ADMIN_PASSWORD must be at least 8 characters long"),
    ADMIN_JWT_SECRET: z.string().min(16, "ADMIN_JWT_SECRET must be at least 16 characters long for security"),
    PAYMENT_WEBHOOK_SECRET: z.string().optional().default(""),
    ADMIN_DAILY_SUMMARY_EMAIL: z.string().email().optional(),
    CORS_ORIGIN_STORE: z.string().url().optional(),
    CORS_ORIGIN_ADMIN: z.string().url().optional(),
    CORS_ORIGINS: z.string().optional().default(""),
    CORS_ALLOW_VERCEL_PREVIEW: z.string().optional().default("false"),
    CORS_ALLOWED_VERCEL_PROJECTS: z.string().optional().default(""),
    ADMIN_API_KEY: z.string().optional(),
});

/**
 * Parse and validate environment variables
 */
const result = envSchema.safeParse(process.env);

if (!result.success) {
    const { issues } = result.error;
    console.error("\x1b[31m%s\x1b[0m", "❌ Invalid environment configuration:");
    issues.forEach((issue: any) => {
        console.error("\x1b[31m%s\x1b[0m", `   - ${issue.path.join(".")}: ${issue.message}`);
    });

    if (process.env.NODE_ENV !== "test") {
        console.error("\x1b[33m%s\x1b[0m", "\n💡 Tip: Check your apps/api/.env file or root .env file.\n");
        process.exit(1);
    }

    // In tests, we might want to throw or handle differently
    throw new Error("Invalid environment configuration");
}

export const env = result.data;
export type Env = z.infer<typeof envSchema>;

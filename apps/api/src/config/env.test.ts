import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// We'll mock process.env before importing the env module
describe("Environment Configuration", () => {
    beforeEach(() => {
        vi.resetModules();
        process.env.NODE_ENV = "test";
    });

    it("should validate a correct configuration", async () => {
        process.env.DATABASE_URL = "file:./dev.db";
        process.env.ADMIN_PASSWORD = "password123";
        process.env.ADMIN_JWT_SECRET = "secret-key-at-least-16-chars";

        const { env } = await import("./env");

        expect(env.PORT).toBe(4000); // Default value
        expect(env.DATABASE_URL).toBe("file:./dev.db");
    });

    it("should fail on invalid DATABASE_URL", async () => {
        process.env.DATABASE_URL = "invalid-url";
        process.env.ADMIN_PASSWORD = "password123";
        process.env.ADMIN_JWT_SECRET = "secret-key-at-least-16-chars";

        await expect(import("./env")).rejects.toThrow("Invalid environment configuration");
    });

    it("should fail on short ADMIN_PASSWORD", async () => {
        process.env.DATABASE_URL = "file:./dev.db";
        process.env.ADMIN_PASSWORD = "short";
        process.env.ADMIN_JWT_SECRET = "secret-key-at-least-16-chars";

        await expect(import("./env")).rejects.toThrow("Invalid environment configuration");
    });

    it("should transform PORT to a number", async () => {
        process.env.PORT = "5000";
        process.env.DATABASE_URL = "file:./dev.db";
        process.env.ADMIN_PASSWORD = "password123";
        process.env.ADMIN_JWT_SECRET = "secret-key-at-least-16-chars";

        const { env } = await import("./env");
        expect(env.PORT).toBe(5000);
        expect(typeof env.PORT).toBe("number");
    });
});

import { db } from "../drizzle";
import { platforms } from "../schema";

export async function seedPlatforms() {
    const platformData = [
        {
            id: "shopee",
            name: "shopee",
            displayName: "Shopee",
            type: "local",
            baseUrl: "https://partner.shopeemobile.com",
            authType: "api-key",
            configSchema: {
                type: "object",
                required: ["apiKey", "apiSecret"],
                properties: {
                    apiKey: { type: "string", description: "Shopee API Key" },
                    apiSecret: { type: "string", description: "Shopee API Secret" },
                    shopId: { type: "string", description: "Shopee Shop ID" }
                }
            },
            rateLimits: {
                requestsPerSecond: 10,
                requestsPerMinute: 600,
                burstLimit: 20
            },
            isActive: true,
            description: "Shopee is a leading e-commerce platform in Southeast Asia and Taiwan, offering a wide range of products from local sellers and international brands."
        },
        {
            id: "tiktok-shop",
            name: "tiktok-shop",
            displayName: "TikTok Shop",
            type: "local",
            baseUrl: "https://open-api.tiktokglobalshop.com",
            authType: "oauth",
            configSchema: {
                type: "object",
                required: ["appId", "appSecret"],
                properties: {
                    appId: { type: "string", description: "TikTok Shop App ID" },
                    appSecret: { type: "string", description: "TikTok Shop App Secret" },
                    accessToken: { type: "string", description: "OAuth Access Token" },
                    refreshToken: { type: "string", description: "OAuth Refresh Token" }
                }
            },
            rateLimits: {
                requestsPerSecond: 5,
                requestsPerMinute: 300,
                burstLimit: 10
            },
            isActive: true,
            description: "TikTok Shop integrates social commerce with e-commerce, allowing sellers to reach customers through short-form videos and live streaming."
        },
        {
            id: "tokopedia",
            name: "tokopedia",
            displayName: "Tokopedia",
            type: "local",
            baseUrl: "https://ta.tokopedia.com",
            authType: "api-key",
            configSchema: {
                type: "object",
                required: ["fsId", "clientId", "clientSecret"],
                properties: {
                    fsId: { type: "string", description: "Tokopedia FS ID" },
                    clientId: { type: "string", description: "Tokopedia Client ID" },
                    clientSecret: { type: "string", description: "Tokopedia Client Secret" }
                }
            },
            rateLimits: {
                requestsPerSecond: 8,
                requestsPerMinute: 480,
                burstLimit: 15
            },
            isActive: true,
            description: "Tokopedia is one of Indonesia's largest e-commerce platforms, connecting millions of buyers and sellers across the archipelago."
        },
        {
            id: "cults3d",
            name: "cults3d",
            displayName: "Cults3D",
            type: "digital",
            baseUrl: "https://cults3d.com/api",
            authType: "api-key",
            configSchema: {
                type: "object",
                required: ["apiKey"],
                properties: {
                    apiKey: { type: "string", description: "Cults3D API Key" },
                    shopId: { type: "string", description: "Cults3D Shop ID (optional)" }
                }
            },
            rateLimits: {
                requestsPerSecond: 3,
                requestsPerMinute: 180,
                burstLimit: 8
            },
            isActive: true,
            description: "Cults3D is a leading marketplace for 3D printable files, connecting designers with makers worldwide."
        },
        {
            id: "custom-motekarfpv",
            name: "custom-motekarfpv",
            displayName: "MotekarFPV",
            type: "local",
            baseUrl: "",
            authType: "basic",
            configSchema: {
                type: "object",
                required: ["url", "username", "password"],
                properties: {
                    url: { type: "string", description: "Website URL" },
                    username: { type: "string", description: "API Username" },
                    password: { type: "string", description: "API Password" }
                }
            },
            rateLimits: {
                requestsPerSecond: 20,
                requestsPerMinute: 1200,
                burstLimit: 50
            },
            isActive: false, // Disabled by default since it's a custom site
            description: "Custom website for local 3D printing and FPV drone products store."
        },
        {
            id: "custom-r3dfpv",
            name: "custom-r3dfpv",
            displayName: "R3DFPV",
            type: "digital",
            baseUrl: "",
            authType: "basic",
            configSchema: {
                type: "object",
                required: ["url", "username", "password"],
                properties: {
                    url: { type: "string", description: "Website URL" },
                    username: { type: "string", description: "API Username" },
                    password: { type: "string", description: "API Password" }
                }
            },
            rateLimits: {
                requestsPerSecond: 20,
                requestsPerMinute: 1200,
                burstLimit: 50
            },
            isActive: false, // Disabled by default since it's a custom site
            description: "Custom website for international STL file sales and 3D models marketplace."
        }
    ];

    try {
        console.log("Seeding platforms...");

        for (const platform of platformData) {
            await db.insert(platforms).values(platform).onConflictDoNothing();
        }

        console.log("✅ Platforms seeded successfully");
    } catch (error) {
        console.error("❌ Error seeding platforms:", error);
        throw error;
    }
}
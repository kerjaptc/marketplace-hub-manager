import { seedPlatforms } from "./platforms";

async function main() {
    try {
        await seedPlatforms();
        console.log("🎉 All seed data inserted successfully");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error during seeding:", error);
        process.exit(1);
    }
}

main();
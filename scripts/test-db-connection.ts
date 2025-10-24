import 'dotenv/config';
import { db } from '../db/drizzle';
import { sql } from 'drizzle-orm';

async function testConnection() {
    try {
        console.log("Testing database connection...");

        // Simple query to test connection
        const result = await db.execute(sql`SELECT 1 as test`);

        console.log("✅ Database connection successful:", result);
        return true;
    } catch (error) {
        console.error("❌ Database connection failed:", error);
        return false;
    }
}

testConnection().then(success => {
    process.exit(success ? 0 : 1);
});
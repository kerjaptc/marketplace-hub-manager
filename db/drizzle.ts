import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Create a connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10, // Maximum number of connections
    idleTimeoutMillis: 30000, // Close connections after 30 seconds of inactivity
    connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
});

// Create drizzle instance with schema
export const db = drizzle(pool, { schema });

// Export pool for direct access if needed
export { pool };

// Export all schema items
export * from './schema';
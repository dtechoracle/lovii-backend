import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
    try {
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 20`;
        console.log('✅ Migration done: users.points column added (default 20)');

        // Show current counts for verification
        const result = await sql`SELECT COUNT(*) as cnt, AVG(points) as avg_points FROM users`;
        console.log(`📊 Users: ${result[0].cnt} total, avg points: ${result[0].avg_points}`);
    } catch (e: any) {
        console.error('❌ Migration failed:', e.message);
    }
}

migrate();

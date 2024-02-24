import * as schema from './schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
const connectionString = process.env.DATABASE_URL as string;
const client = postgres(connectionString);
export const drizzle_client = drizzle(client, { schema });

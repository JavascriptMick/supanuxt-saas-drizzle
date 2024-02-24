import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();
const client = postgres(process.env.DATABASE_URL as string);
const drizzle_client = drizzle(client);

const main = async () => {
  try {
    await migrate(drizzle_client, {
      migrationsFolder: 'drizzle/migrations'
    });

    console.log('Migration successful');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

main();

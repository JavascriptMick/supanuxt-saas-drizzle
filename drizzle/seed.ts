import { plan } from './schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();
const client = postgres(process.env.DATABASE_URL as string);
const drizzle_client = drizzle(client);

const main = async () => {
  try {
    console.log('Seeding database');

    const freeTrialValues = {
      features: ['ADD_NOTES', 'EDIT_NOTES', 'VIEW_NOTES'],
      max_notes: 10,
      max_members: 1,
      ai_gen_max_pm: 7
    };
    const freeTrial = await drizzle_client
      .insert(plan)
      .values({
        name: 'Free Trial',
        ...freeTrialValues
      })
      .onConflictDoUpdate({
        target: plan.name,
        set: freeTrialValues
      })
      .returning({ id: plan.id });

    const individualPlanValues = {
      features: ['ADD_NOTES', 'EDIT_NOTES', 'VIEW_NOTES', 'SPECIAL_FEATURE'],
      max_notes: 100,
      max_members: 1,
      ai_gen_max_pm: 50,
      stripe_product_id: 'prod_NQR7vwUulvIeqW'
    };
    const individualPlan = await drizzle_client
      .insert(plan)
      .values({
        name: 'Individual Plan',
        ...individualPlanValues
      })
      .onConflictDoUpdate({
        target: plan.name,
        set: individualPlanValues
      })
      .returning({ id: plan.id });

    const teamPlanValues = {
      features: [
        'ADD_NOTES',
        'EDIT_NOTES',
        'VIEW_NOTES',
        'SPECIAL_FEATURE',
        'SPECIAL_TEAM_FEATURE'
      ],
      max_notes: 200,
      max_members: 10,
      ai_gen_max_pm: 500,
      stripe_product_id: 'prod_NQR8IkkdhqBwu2'
    };
    const teamPlan = await drizzle_client
      .insert(plan)
      .values({
        name: 'Team Plan',
        ...teamPlanValues
      })
      .onConflictDoUpdate({
        target: plan.name,
        set: teamPlanValues
      })
      .returning({ id: plan.id });

    console.log({ freeTrial, individualPlan, teamPlan });

    process.exit(0);
  } catch (error) {
    console.error(error);
    throw new Error('Failed to seed database');
  }
};

main();

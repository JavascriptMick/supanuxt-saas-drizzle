import { drizzle_client } from '~~/drizzle/drizzle.client';
import { eq } from 'drizzle-orm';

import type { FullDBUser } from './service.types';
import {
  membership,
  account,
  plan,
  user,
  ACCOUNT_ACCESS,
  type User
} from '~~/drizzle/schema';
import { UtilService } from './util.service';
import generator from 'generate-password-ts';

const config = useRuntimeConfig();

export namespace AuthService {
  export async function getFullUserBySupabaseId(
    supabase_uid: string
  ): Promise<FullDBUser | null> {
    return (await drizzle_client.query.user.findFirst({
      where: eq(user.supabase_uid, supabase_uid),
      with: {
        memberships: {
          with: {
            account: true
          }
        }
      }
    })) as FullDBUser;
  }

  export async function getUserById(
    user_id: number
  ): Promise<FullDBUser | null> {
    const this_user = await drizzle_client.query.user.findFirst({
      where: eq(user.id, user_id),
      with: {
        memberships: {
          with: {
            account: true
          }
        }
      }
    });

    if (!this_user) {
      throw new Error('User not found');
    }

    return this_user as FullDBUser;
  }

  export async function createUser(
    supabase_uid: string,
    display_name: string,
    email: string
  ): Promise<FullDBUser | null> {
    const trialPlan = await drizzle_client.query.plan.findFirst({
      where: eq(plan.name, config.initialPlanName)
    });

    if (!trialPlan) {
      throw new Error('Trial plan not found');
    }

    const join_password: string = generator.generate({
      length: 10,
      numbers: true
    });

    const newAccountId: { insertedId: number }[] = await drizzle_client
      .insert(account)
      .values({
        name: display_name,
        current_period_ends: UtilService.addMonths(
          new Date(),
          config.initialPlanActiveMonths
        ),
        plan_id: trialPlan.id,
        features: trialPlan.features,
        max_notes: trialPlan.max_notes,
        max_members: trialPlan.max_members,
        plan_name: trialPlan.name,
        join_password: join_password
      })
      .returning({ insertedId: account.id });

    const newUserId: { insertedId: number }[] = await drizzle_client
      .insert(user)
      .values({
        supabase_uid: supabase_uid,
        display_name: display_name,
        email: email
      })
      .returning({ insertedId: user.id });

    const newMembershipId: { insertedId: number }[] = await drizzle_client
      .insert(membership)
      .values({
        account_id: newAccountId[0].insertedId,
        user_id: newUserId[0].insertedId,
        access: ACCOUNT_ACCESS.OWNER
      })
      .returning({ insertedId: membership.id });

    // Retrieve the new user
    return (await drizzle_client.query.user.findFirst({
      where: user => eq(user.id, newUserId[0].insertedId),
      with: {
        memberships: {
          with: {
            account: true
          }
        }
      }
    })) as FullDBUser;
  }

  export async function deleteUser(user_id: number): Promise<User> {
    const deletedUser = await drizzle_client
      .delete(user)
      .where(eq(user.id, user_id))
      .returning();
    return deletedUser[0] as User;
  }
}

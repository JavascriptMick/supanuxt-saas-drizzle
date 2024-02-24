import { eq } from 'drizzle-orm';

import { drizzle_client } from '~~/drizzle/drizzle.client';
import {
  account,
  membership,
  plan,
  ACCOUNT_ACCESS,
  type Account,
  type Membership
} from '~~/drizzle/schema';

import {
  type AccountWithMembers,
  type MembershipWithAccount,
  type MembershipWithUser
} from './service.types';
import generator from 'generate-password-ts';
import { UtilService } from './util.service';
import { AccountLimitError } from './errors';

const config = useRuntimeConfig();

export namespace AccountService {
  export async function getAccountById(
    account_id: number
  ): Promise<AccountWithMembers> {
    const this_account = await drizzle_client.query.account.findFirst({
      where: eq(account.id, account_id),
      with: { members: { with: { user: true } } }
    });

    if (!this_account) {
      throw new Error('Account not found.');
    }

    return this_account as AccountWithMembers;
  }

  export async function getAccountByJoinPassword(
    join_password: string
  ): Promise<AccountWithMembers> {
    const this_account = await drizzle_client.query.account.findFirst({
      where: eq(account.join_password, join_password),
      with: { members: { with: { user: true } } }
    });

    if (!this_account) {
      throw new Error('Account not found.');
    }

    return this_account as AccountWithMembers;
  }

  export async function getAccountMembers(
    account_id: number
  ): Promise<MembershipWithUser[]> {
    return drizzle_client.query.membership.findMany({
      where: eq(account.id, account_id),
      with: { user: true }
    });
  }

  export async function updateAccountStipeCustomerId(
    account_id: number,
    stripe_customer_id: string
  ) {
    const updatedAccounts = await drizzle_client
      .update(account)
      .set({ stripe_customer_id })
      .where(eq(account.id, account_id))
      .returning();
    return updatedAccounts[0] as Account;
  }

  export async function updateStripeSubscriptionDetailsForAccount(
    stripe_customer_id: string,
    stripe_subscription_id: string,
    current_period_ends: Date,
    stripe_product_id: string
  ) {
    const this_account = await drizzle_client.query.account.findFirst({
      where: eq(account.stripe_customer_id, stripe_customer_id)
    });

    if (!this_account) {
      throw new Error(
        `Account not found for customer id ${stripe_customer_id}`
      );
    }

    const paid_plan = await drizzle_client.query.plan.findFirst({
      where: eq(plan.stripe_product_id, stripe_product_id)
    });

    if (!paid_plan) {
      throw new Error(`Plan not found for product id ${stripe_product_id}`);
    }

    let updatedAccounts: Account[];
    if (paid_plan.id == this_account.plan_id) {
      // only update sub and period info
      updatedAccounts = await drizzle_client
        .update(account)
        .set({
          stripe_subscription_id,
          current_period_ends,
          ai_gen_count: 0
        })
        .where(eq(account.id, this_account.id))
        .returning();
    } else {
      // plan upgrade/downgrade... update everything, copying over plan features and perks
      updatedAccounts = await drizzle_client
        .update(account)
        .set({
          stripe_subscription_id,
          current_period_ends,
          plan_id: paid_plan.id,
          features: paid_plan.features,
          max_notes: paid_plan.max_notes,
          max_members: paid_plan.max_members,
          plan_name: paid_plan.name,
          ai_gen_max_pm: paid_plan.ai_gen_max_pm,
          ai_gen_count: 0 // I did vacillate on this point ultimately easier to just reset, discussion here https://www.reddit.com/r/SaaS/comments/16e9bew/should_i_reset_usage_counts_on_plan_upgrade/
        })
        .where(eq(account.id, this_account.id))
        .returning();
    }

    return updatedAccounts[0] as Account;
  }

  export async function acceptPendingMembership(
    account_id: number,
    membership_id: number
  ): Promise<MembershipWithAccount> {
    const this_membership = await drizzle_client.query.membership.findFirst({
      where: membership => eq(membership.id, membership_id)
    });

    if (!this_membership) {
      throw new Error(`Membership does not exist`);
    }

    if (this_membership.account_id != account_id) {
      throw new Error(`Membership does not belong to current account`);
    }

    await drizzle_client
      .update(membership)
      .set({ pending: false })
      .where(eq(membership.id, membership_id));

    // Retrieve the updated user with related entities
    const updatedMembershipWithAccount =
      await drizzle_client.query.membership.findFirst({
        where: membership => eq(membership.id, membership_id),
        with: { account: true }
      });

    return updatedMembershipWithAccount as MembershipWithAccount;
  }

  export async function deleteMembership(
    account_id: number,
    membership_id: number
  ): Promise<Membership> {
    const this_membership = await drizzle_client.query.membership.findFirst({
      where: membership => eq(membership.id, membership_id)
    });

    if (!this_membership) {
      throw new Error(`Membership does not exist`);
    }

    if (this_membership.account_id != account_id) {
      throw new Error(`Membership does not belong to current account`);
    }

    const deletedMembership = await drizzle_client
      .delete(membership)
      .where(eq(membership.id, membership_id))
      .returning();

    return deletedMembership[0] as Membership;
  }

  export async function joinUserToAccount(
    user_id: number,
    account_id: number,
    pending: boolean
  ): Promise<MembershipWithAccount> {
    const this_account = await drizzle_client.query.account.findFirst({
      where: account => eq(account.id, account_id),
      with: {
        members: true
      }
    });

    if (
      this_account?.members &&
      this_account?.members?.length >= this_account?.max_members
    ) {
      throw new Error(
        `Too Many Members, Account only permits ${this_account?.max_members} members.`
      );
    }

    if (this_account?.members) {
      for (const member of this_account.members) {
        if (member.user_id === user_id) {
          throw new Error(`User is already a member`);
        }
      }
    }

    const newMembership = await drizzle_client
      .insert(membership)
      .values({
        user_id: user_id,
        account_id: account_id,
        access: 'READ_ONLY',
        pending
      })
      .returning();

    // Retrieve the updated membership
    return (await drizzle_client.query.membership.findFirst({
      where: membership => eq(membership.id, newMembership[0].id),
      with: {
        account: true
      }
    })) as MembershipWithAccount;
  }

  export async function changeAccountName(
    account_id: number,
    new_name: string
  ) {
    const updatedAccount = await drizzle_client
      .update(account)
      .set({
        name: new_name
      })
      .where(eq(account.id, account_id))
      .returning();

    return updatedAccount[0] as Account;
  }

  export async function changeAccountPlan(account_id: number, plan_id: number) {
    const this_plan = await drizzle_client.query.plan.findFirst({
      where: eq(plan.id, plan_id)
    });

    if (!this_plan) {
      throw new Error(`Plan not found for plan id ${plan_id}`);
    }

    const updatedPlans = await drizzle_client
      .update(account)
      .set({
        plan_id: this_plan.id,
        features: this_plan.features,
        max_notes: this_plan.max_notes
      })
      .where(eq(account.id, account_id))
      .returning();
    return updatedPlans[0] as Account;
  }

  export async function rotateJoinPassword(account_id: number) {
    const join_password: string = generator.generate({
      length: 10,
      numbers: true
    });
    const updatedAccount = await drizzle_client
      .update(account)
      .set({
        join_password
      })
      .where(eq(account.id, account_id))
      .returning();

    return updatedAccount[0] as Account;
  }

  // Claim ownership of an account.
  // User must already be an ADMIN for the Account
  // Existing OWNER memberships are downgraded to ADMIN
  // In future, some sort of Billing/Stripe tie in here e.g. changing email details on the Account, not sure.
  export async function claimOwnershipOfAccount(
    user_id: number,
    account_id: number
  ): Promise<MembershipWithUser[]> {
    const this_membership = await drizzle_client.query.membership.findFirst({
      where: membership =>
        eq(membership.user_id, user_id) && eq(membership.account_id, account_id)
    });

    if (!this_membership) {
      throw new Error(`Membership does not exist`);
    }

    if (this_membership.access === ACCOUNT_ACCESS.OWNER) {
      throw new Error('BADREQUEST: user is already owner');
    } else if (this_membership.access !== ACCOUNT_ACCESS.ADMIN) {
      throw new Error('UNAUTHORISED: only Admins can claim ownership');
    }

    const existing_owner_memberships =
      await drizzle_client.query.membership.findMany({
        where: membership =>
          eq(membership.account_id, account_id) &&
          eq(membership.access, ACCOUNT_ACCESS.OWNER)
      });

    for (const existing_owner_membership of existing_owner_memberships) {
      await drizzle_client
        .update(membership)
        .set({ access: ACCOUNT_ACCESS.ADMIN }) // Downgrade OWNER to ADMIN
        .where(
          eq(membership.user_id, existing_owner_membership.user_id) &&
            eq(membership.account_id, account_id)
        )
        .returning();
    }

    // finally update the ADMIN member to OWNER
    await drizzle_client
      .update(membership)
      .set({ access: ACCOUNT_ACCESS.OWNER })
      .where(
        eq(membership.user_id, user_id) && eq(membership.account_id, account_id)
      )
      .returning();

    return (await drizzle_client.query.membership.findMany({
      where: eq(membership.account_id, account_id),
      with: { user: true }
    })) as MembershipWithUser[];
  }

  // Upgrade access of a membership.  Cannot use this method to upgrade to or downgrade from OWNER access
  export async function changeUserAccessWithinAccount(
    user_id: number,
    account_id: number,
    access: ACCOUNT_ACCESS
  ) {
    if (access === ACCOUNT_ACCESS.OWNER) {
      throw new Error(
        'UNABLE TO UPDATE MEMBERSHIP: use claimOwnershipOfAccount method to change ownership'
      );
    }

    const this_membership = await drizzle_client.query.membership.findFirst({
      where: membership =>
        eq(membership.user_id, user_id) && eq(membership.account_id, account_id)
    });
    if (!this_membership) {
      throw new Error(
        `Membership does not exist for user ${user_id} and account ${account_id}`
      );
    }

    if (this_membership.access === ACCOUNT_ACCESS.OWNER) {
      throw new Error(
        'UNABLE TO UPDATE MEMBERSHIP: use claimOwnershipOfAccount method to change ownership'
      );
    }

    const updatedMembershipId: { updatedId: number }[] = await drizzle_client
      .update(membership)
      .set({ access })
      .where(
        eq(membership.user_id, user_id) && eq(membership.account_id, account_id)
      )
      .returning({ updatedId: membership.id });

    // Retrieve the updated membership
    return (await drizzle_client.query.membership.findFirst({
      where: membership => eq(membership.id, updatedMembershipId[0].updatedId),
      with: {
        account: true
      }
    })) as MembershipWithAccount;
  }

  /*
  **** Usage Limit Checking *****
  This is trickier than you might think at first.  Free plan users don't get a webhook from Stripe
  that we can use to tick over their period end date and associated usage counts.  I also didn't
  want to require an additional background thread to do the rollover processing.

  getAccountWithPeriodRollover: retrieves an account record and does the rollover checking returning up to date account info
  checkAIGenCount: retrieves the account using getAccountWithPeriodRollover, checks the count and returns the account
  incrementAIGenCount: increments the counter using the account.  Note that passing in the account avoids another db fetch for the account.

  Note.. for each usage limit, you will need another pair of check/increment methods and of course the count and max limit in the account schema

  How to use in a service method....
  export async function someServiceMethod(account_id: number, .....etc) {
    const account = await AccountService.checkAIGenCount(account_id);
    ... User is under the limit so do work
    await AccountService.incrementAIGenCount(account);
  }
  */

  export async function getAccountWithPeriodRollover(account_id: number) {
    const this_account = await drizzle_client.query.account.findFirst({
      where: account => eq(account.id, account_id)
    });
    if (!this_account) {
      throw new Error(`Account not found for id ${account_id}`);
    }

    if (
      this_account.plan_name === config.initialPlanName &&
      this_account.current_period_ends < new Date()
    ) {
      const updatedAccount = await drizzle_client
        .update(account)
        .set({
          current_period_ends: UtilService.addMonths(
            this_account.current_period_ends,
            1
          ),
          // reset anything that is affected by the rollover
          ai_gen_count: 0
        })
        .where(eq(account.id, account_id))
        .returning();

      return updatedAccount[0] as Account;
    }
    return this_account as Account;
  }

  export async function checkAIGenCount(account_id: number) {
    const this_account = await getAccountWithPeriodRollover(account_id);

    if (this_account.ai_gen_count >= this_account.ai_gen_max_pm) {
      throw new AccountLimitError(
        'Monthly AI gen limit reached, no new AI Generations can be made'
      );
    }

    return this_account;
  }

  export async function incrementAIGenCount(this_account: any) {
    const updatedAccounts = await drizzle_client
      .update(account)
      .set({
        ai_gen_count: this_account.ai_gen_count + 1
      })
      .where(eq(account.id, this_account.id));

    return updatedAccounts[0] as Account;
  }
}

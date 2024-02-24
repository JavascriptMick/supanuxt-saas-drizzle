import type { InferResultType } from '~/drizzle/relation.types';

export type MembershipWithAccount = InferResultType<
  'membership',
  { account: true }
>;

export type MembershipWithUser = InferResultType<'membership', { user: true }>;

export type FullDBUser = InferResultType<
  'user',
  { memberships: { with: { account: true } } }
>;

export type AccountWithMembers = InferResultType<
  'account',
  { members: { with: { user: true } } }
>;

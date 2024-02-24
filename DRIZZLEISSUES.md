# Drizzle Issues

I encountered several things that I didn't like very much.

### Cannot infer types from nested with relations + cannot DRY the where clauses

In the Prisma version, I can do this in service types...

```
    export const accountWithMembers = Prisma.validator<Prisma.AccountArgs>()({
    include: {
        members: {
        include: {
            user: true
        }
        }
    }
    });
    export type AccountWithMembers = Prisma.AccountGetPayload<
    typeof accountWithMembers
    >
```

This exports both a type (AccountWithMembers) and a handy dandy (accountWithMembers) constant I can use in my queries to define a where clause that faithfully and completely matches the type definition...

```
    await prisma_client.account.findFirstOrThrow({
        where: { id: account_id },
        ...accountWithMembers
    });
```

in Drizzle, I can use a crazy workaround dynamic type thingo (drizzle/relation.types.ts) to get my nested type...

```
    export type AccountWithMembers = InferResultType<
    'account',
    { members: { with: { user: true } } }
    >;
```

but I couldn't figure out how to DRY the where clause bit, so the service method specifies it again...

```
    await drizzle_client.query.account.findFirst({
        where: eq(account.id, account_id),
        with: { members: { with: { user: true } } }
    });
```

Issue is mentioned in github https://github.com/drizzle-team/drizzle-orm/issues/695

### FindFirstOrThrow, FindUniqueOrThrow etc... don't exist

This is just annoying, in Drizzle, I need to check and throw all over the place.

```
    const this_account = await drizzle_client.query.account.findFirst({
        where: eq(account.id, account_id),
        with: { members: { with: { user: true } } }
    });

    if (!this_account) {
        throw new Error('Account not found.');
    }
```

### Single updates and deletions return an array instead of a single object

In Prisma, an update of a single row returns a single object...

```
  export async function updateAccountStipeCustomerId(
    account_id: number,
    stripe_customer_id: string
  ) {
    return await prisma_client.account.update({
      where: { id: account_id },
      data: {
        stripe_customer_id
      }
    });
  }
```

in Drizzle, updates always return an array. I had a look at the Drizzle Discord and, hilariously, this question was asked many times with no answer.

```
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
```

It's just a quality of life thing but I have lots of these single row updates so it's annoying.

### No Deep relations on update or delete

In Prisma, I can update or delete and return a deeply nested type in one statement

```
    export async function deleteUser(user_id: number): Promise<FullDBUser> {
        return prisma_client.user.delete({
            where: { id: user_id },
            ...fullDBUser
        });
    }
```

In Drizzle, while I can workaround this for updates by doing an update and select...

...for deletes, it doesn't seem to be possible.. maybe a select and delete?

```
    export async function deleteUser(user_id: number): Promise<User> {
        const deletedUser = await drizzle_client
            .delete(user)
            .where(eq(user.id, user_id))
            .returning();

        // This feels silly
        return deletedUser[0] as User;
    }
```

### Nested Create doesn't exist

In Prisma, I can create a deeply nested object into multiple tables with one statement. For example, here is me creating a user, account and the membership
record (a join table) between the user and the account in one go... much nice.

```
prisma_client.user.create({
      data: {
        supabase_uid: supabase_uid,
        display_name: display_name,
        email: email,
        memberships: {
          create: {
            account: {
              create: {
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
              }
            },
            access: ACCOUNT_ACCESS.OWNER
          }
        }
      },
      ...fullDBUser
    });
```

In Drizzle, I gotta create rows and frig around with ids...

```
     const newAccountId: { insertedId: number }[] = await drizzle_client
      .insert(account)
      .values({
        name: display_name,
        current_period_ends: UtilService.addMonths(
          new Date(),
          config.initialPlanActiveMonths
        ).toDateString(),
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
        account_id: newAccountId[0].insertedId, // Use the ids from the other inserted records to create a join table entry
        user_id: newUserId[0].insertedId,
        access: ACCOUNT_ACCESS.OWNER
      })
      .returning({ insertedId: membership.id });
```

### Enums are a mess in both Orms but Prisma at least has a workaround

Postgres supports enum types...

```
CREATE TYPE "ACCOUNT_ACCESS" AS ENUM('READ_ONLY', 'READ_WRITE', 'ADMIN', 'OWNER');
...
CREATE TABLE IF NOT EXISTS "membership" (
	...
	"access" "ACCOUNT_ACCESS" DEFAULT 'READ_ONLY' NOT NULL,
```

In Prisma, I can do this in the schema..

```
enum ACCOUNT_ACCESS {
  READ_ONLY
  READ_WRITE
  ADMIN
  OWNER
}
```

and then this horrible but functional kludge to create a type that is based on the schema definition and works everywhere you need to use the enum ...

```
// Workaround for prisma issue (https://github.com/prisma/prisma/issues/12504#issuecomment-1147356141)

// Import original enum as type
import type { ACCOUNT_ACCESS as ACCOUNT_ACCESS_ORIGINAL } from '@prisma/client';

// Guarantee that the implementation corresponds to the original type
export const ACCOUNT_ACCESS: { [k in ACCOUNT_ACCESS_ORIGINAL]: k } = {
  READ_ONLY: 'READ_ONLY',
  READ_WRITE: 'READ_WRITE',
  ADMIN: 'ADMIN',
  OWNER: 'OWNER'
} as const;

// Re-exporting the original type with the original name
export type ACCOUNT_ACCESS = ACCOUNT_ACCESS_ORIGINAL;
```

in Drizzle, you need to use helper method pgEnum to create a thing which is NOT a type...

```
export const accountAccessEnum = pgEnum('ACCOUNT_ACCESS', [
  'OWNER',
  'ADMIN',
  'READ_WRITE',
  'READ_ONLY'
]);
```

and then stick it in the schema like this...

```
export const membership = pgTable(
  'membership',
  {
    ...
    access: accountAccessEnum('access')
      .default(ACCOUNT_ACCESS.READ_ONLY)
      .notNull(),
```

but AFAIK, there is no way to infer a type for this enum.
I tried a bunch of different things but ended creating a completely duplicate type...

```
export enum ACCOUNT_ACCESS {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  READ_WRITE = 'READ_WRITE',
  READ_ONLY = 'READ_ONLY'
}
```

which works in some cases...

```
await drizzle_client
    .insert(membership)
    .values({
        account_id: newAccountId[0].insertedId,
        user_id: newUserId[0].insertedId,
        access: ACCOUNT_ACCESS.OWNER
    })
    .returning({ insertedId: membership.id });
```

but not others [example](https://github.com/JavascriptMick/supanuxt-saas-drizzle/blob/7919f6a32c83ae114fb5041fdad3d109149d3b16/server/trpc/trpc.ts#L80).

```
    const accessList: ACCOUNT_ACCESS[] = [ACCOUNT_ACCESS.OWNER, ACCOUNT_ACCESS.ADMIN]

    //doesn't work, activeMembership.access is not an enum
    if (!access.includes(activeMembership.access)) ....

    //need to do this map thing
    if (!access.map(a => a.valueOf()).includes(activeMembership.access))....
```

so, in both cases, it's more difficult than it needs to be but at least Prisma has a workaround that works.

### MINOR: In schema definition not null is not the default

Note that in Prisma, types are not nullable by default and you add a ? to make them nullable, in Drizzle is opposite...

In Prisma

```

    model Account {
        ...
        features String[] //not nullable by default

```

In Drizzle

```
    export const account = pgTable(
        'account',
        {
        ...
        features: text('features').array().notNull(), // nullable by default

```

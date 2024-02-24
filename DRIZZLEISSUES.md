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

### In schema definition not null is not the default

Ok fine but even on types that are defined as a list? Thats counter intuitive...

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

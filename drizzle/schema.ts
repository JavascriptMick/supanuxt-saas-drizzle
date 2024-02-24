import {
  pgTable,
  pgEnum,
  serial,
  text,
  uniqueIndex,
  timestamp,
  integer,
  boolean
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const user = pgTable('users', {
  id: serial('id').primaryKey().notNull(),
  supabase_uid: text('supabase_uid').notNull(),
  email: text('email').notNull(),
  display_name: text('display_name')
});
export const userRelations = relations(user, ({ many }) => ({
  memberships: many(membership)
}));
export type User = typeof user.$inferSelect;

export enum ACCOUNT_ACCESS {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  READ_WRITE = 'READ_WRITE',
  READ_ONLY = 'READ_ONLY'
}

// I tried a few hacks to derive the pgEnum from the ts enum but in the end I gave up
export const accountAccessEnum = pgEnum('ACCOUNT_ACCESS', [
  'OWNER',
  'ADMIN',
  'READ_WRITE',
  'READ_ONLY'
]);

// Membership
export const membership = pgTable(
  'membership',
  {
    id: serial('id').primaryKey().notNull(),
    user_id: integer('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    account_id: integer('account_id')
      .notNull()
      .references(() => account.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade'
      }),
    access: accountAccessEnum('access')
      .default(ACCOUNT_ACCESS.READ_ONLY)
      .notNull(),
    pending: boolean('pending').default(false).notNull()
  },
  table => {
    return {
      user_idAccountIdKey: uniqueIndex('membership_user_id_account_id_key').on(
        table.user_id,
        table.account_id
      )
    };
  }
);
export const membershipRelations = relations(membership, ({ one }) => ({
  user: one(user, {
    fields: [membership.user_id],
    references: [user.id]
  }),
  account: one(account, {
    fields: [membership.account_id],
    references: [account.id]
  })
}));
export type Membership = typeof membership.$inferSelect;

// Account
export const account = pgTable(
  'account',
  {
    id: serial('id').primaryKey().notNull(),
    name: text('name').notNull(),
    current_period_ends: timestamp('current_period_ends', {
      precision: 3,
      mode: 'date'
    })
      .defaultNow()
      .notNull(),
    features: text('features').array().notNull(),
    plan_id: integer('plan_id')
      .notNull()
      .references(() => plan.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    plan_name: text('plan_name').notNull(),
    max_notes: integer('max_notes').default(100).notNull(),
    stripe_subscription_id: text('stripe_subscription_id'),
    stripe_customer_id: text('stripe_customer_id'),
    max_members: integer('max_members').default(1).notNull(),
    join_password: text('join_password').notNull(),
    ai_gen_max_pm: integer('ai_gen_max_pm').default(7).notNull(),
    ai_gen_count: integer('ai_gen_count').default(0).notNull()
  },
  table => {
    return {
      join_passwordKey: uniqueIndex('account_join_password_key').on(
        table.join_password
      )
    };
  }
);
export const accountRelations = relations(account, ({ many }) => ({
  notes: many(note),
  members: many(membership)
}));
export type Account = typeof account.$inferSelect;

// Plan
export const plan = pgTable(
  'plan',
  {
    id: serial('id').primaryKey().notNull(),
    name: text('name').notNull(),
    features: text('features').array().notNull(),
    max_notes: integer('max_notes').default(100).notNull(),
    stripe_product_id: text('stripe_product_id'),
    max_members: integer('max_members').default(1).notNull(),
    ai_gen_max_pm: integer('ai_gen_max_pm').default(7).notNull()
  },
  table => {
    return {
      nameKey: uniqueIndex('plan_name_key').on(table.name)
    };
  }
);
export type Plan = typeof plan.$inferSelect;

// Note
export const note = pgTable('note', {
  id: serial('id').primaryKey().notNull(),
  account_id: integer('account_id').references(() => account.id, {
    onDelete: 'set null',
    onUpdate: 'cascade'
  }),
  note_text: text('note_text').notNull()
});
export const noteRelations = relations(note, ({ one }) => ({
  account: one(account, {
    fields: [note.account_id],
    references: [account.id]
  })
}));
export type Note = typeof note.$inferSelect;

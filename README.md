![SupaNuxt SaaS](assets/images/supanuxt_logo_200.png)

# SupaNuxt SaaS Drizzle Edition

> [!WARNING]  
> This project is currently in development and not ready for production use.

This repo is a port of an [original Prisma version](https://github.com/JavascriptMick/supanuxt-saas) to Drizzle. I has several [Issues](DRIZZLEISSUES.md) with the port.

Both the Prisma and Drizzle editions will be maintained going forward.

## Demo Sites

(Prisma) Demo site [here](https://nuxt3-saas-boilerplate.netlify.app/)

(Prisma) Pottery Helper [here](https://potteryhelper.com/)

## Community

Discord [here](https://discord.gg/3hWPDTA4kD)

## Tech Stack

- Nuxt 3
- Supabase (auth including OAuth + Postgresql instance)
- Drizzle (schema management + Strongly typed client)
- TRPC (server/client communication with Strong types, SSR compatible)
- Pinia (state Store)
- Stripe (payments including webhook integration)
- Tailwind + daisyUI (styling and components)
- OpenAI (text completions with AI)

## Features

### User Management

- [x] Social Signon (e.g. google) via Supabase, Full list of available [providers](https://supabase.com/docs/guides/auth#providers)
- [x] Email/Password Signon via Supabase
- [x] Password recovery
- [x] User roles and permissions (admin, regular user, etc. roles defined in the [Drizzle Schema](/drizzle/schema.ts))
- [x] User Email captured on initial login
- [x] Initial plan and plan period controled via config to allow either a trial plan or a 'No Plan' for initial users
- [x] Edit Account Name from Account Page

### Schema and DB Management

- [x] Drizzle based Schema Management
- [x] Supabase integration for DB
- [x] DB Seed Script to setup plan information including Plan and Stripe Product information

### Config Management and Env integration

- [x] [Config](/nuxt.config.ts) for Stripe Keys
- [x] [Env](/.env_example) keys for Supabase and Stripe
- [x] Config Switches for free trial - If you want a 'free trial period' set initialPlanName to an appropriate plan name in the DB and initialPlanActiveMonths to a positive value. If you don't want a free trial, set initialPlanName to an appropriate 'No Plan' plan in the DB and set the initialPlanActiveMonths to -1.

### Multi-Modal State Management

- [x] SPA type pages (e.g. [Dashboard](/pages/dashboard.vue)) - postgresql(supabase) -> Drizzle -> Service Layer for Business Logic -> TRPC -> Pinia -> UI
- [x] SSR type pages (e.g. [Note](/pages/notes/[note_id].vue)) - postgresql(supabase) -> Drizzle -> Service Layer for Business Logic -> TRPC -> UI

### Multi User Accounts (Teams)

- [x] Allow users to upgrade their accounts fron individual accounts to multi-user accounts (Teams).
- [x] Allow users to switch between Teams and view/edit data from the selected Team.
- [x] All features, billing and limits is controlled at the Account (Team) level (not the user level)
- [x] Gen/Regen an invite link to allow users to join a team
- [x] Team administrators and owners can accept pending invites
- [x] Team administrators and owners can administer the permissions (roles) of other team members on the Accounts page
- [x] Team owners can remove users from team

### Plans and Pricing

- [x] Manage multiple Plans each with specific Feature flags and Plan limits
- [x] Plan features copied to Accounts upon successfull subscription
- [x] Loose coupling between Plan and Account Features to allow ad-hoc account tweaks without creating custom plans
- [x] Pricing page appropriately reacts to users with/without account and current plan.
- [x] User Access level available at the router layer as procedures allowing restriction of access based on user access
- [x] Account features available at the router layer as utility procedures allowing restriction of access based on account features

### Stripe (Payments) Integration

- [x] Each plan is configured with Stripe Product ID so that multiple Stripe Prices can be created for each plan but subscriptions (via Webhook) will still activate the correct plan.
- [x] Support basic (customer.subscription) flows for Subscription payments via Webhook
- [ ] Support additional Stripe flows for things like failed payments, imminent subscription expiry (send email?) etc.....

### Support

- [ ] Help desk support (ticketing system, live chat, etc.)
- [ ] Knowledge base with FAQs and tutorials

### Look and Feel, Design System and Customisation

- [x] Default UI isn't too crap
- [x] Integrated Design system including theming (Tailwind + daisyUI)
- [x] Toasts for things like reset email sent
- [x] Modals, just because people like modals

### GDPR

- [x] Cookie Consent

### Demo Software (Notes)

- [x] Simple Text based Notes functionality
- [x] Read only Notes Dashboard
- [x] SSR Rendered (SEO Optimised) [Note](/pages/notes/[note_id].vue) Display
- [x] Max Notes limit property on Plan
- [x] Max Notes enforced
- [x] Add, Delete notes on Dashboard
- [x] AI Note generation with OpenAI
- [x] Per Account, Per Month Useage Limits on AI Access

### Testing

- [x] Manual test scenario for auth and sub workflows passing
- [x] Unit test framework (vitest)
- [ ] Integration tests for auth and sub workflows

## Special Mention

This https://blog.checklyhq.com/building-a-multi-tenant-saas-data-model/ Article by https://twitter.com/tim_nolet was my inspiration for the user/account/subscription schema. Tim was also generous with his time and answered some of my stoopid questions on the https://www.reddit.com/r/SaaS/ Subreddit.

## Architecture

The focus is on separation of concerns and avoiding vendor lock in.

### Diagram

<img src="assets/images/technical_architecture.png">

### Walkthrough

[<img src="https://img.youtube.com/vi/AFfbGuJYRqI/hqdefault.jpg">](https://www.youtube.com/watch?v=AFfbGuJYRqI)

### Tricky Decisions

_Composition over options API_ - I have decided to use composition api and setup functions accross the board including components, pages and Pinia stores. I was resistant at first, especially with the stores as I was used to Vuex but have come to the conclusion that it is easier to go one approach all over. It's also the latest and greatest and folks don't like to use a starter that starts behind the cutting edge.

_Drizzle over Supabase API_ - I went with Drizzle for direct DB access rather than use the Supabase client. This is Primarily to avoid lock-in with Supabase too much. Supabase is great but I thought burdening my users with a future situation where it's difficult to move off it wouldn't be very cool.

_Trpc over REST_ - Primarily for full thickness types without duplication on the client. Also I think the remote procedure call paradigm works well. Note however that I still include a [REST endpoint example](/server/api/note.ts) for flexibility. My preference for mobile is Flutter and there is not a Trpc client for Flutter that i'm aware off so it was important for me to make sure REST works also.

## Externals Setup

Things you gotta do that aren't code (and are therefore not very interesting)

### Env

Copy the [.env_example](/.env_example) file to create [.env](/.env)
Note) This file is for development convenience, is .gitignored by default and should _not_ be added to source control

### Supabase

This solution uses Supabase for Auth and to provide a DB. In addition to Magic Link and email/password login via Supabase, it also supports Google OAuth via Supabase.

1. Go to [Supabase](https://supabase.com/) and 'Start your Project'
2. Setup your org and project (Free tier is fine to start)
3. Update the project's email template (Supabase -> Authentication -> Email Templates) Note that the default Supabase email templates are very generic and for some reason, this can lead to your emails being sent to spam folders. for e.g. to get my password reset emails to my inbox, I needed to change the subject to "Password Reset for ..." and the email body text.
4. Choose an OAuth provider. I have chosen Google using these [Instructions](https://supabase.com/docs/guides/auth/social-login/auth-google) for the purposes of demonstration but they all should work.
5. Go to Project Settings -> API and copy Project URL and Project API Key to SUPABASE_URL and SUPABASE_KEY settings respectively in your [.env](/.env) file
6. Go to Project Settings -> Database -> Connection String -> URI and copy the uri value into the DATABASE_URL setting in your [.env](/.env) file, remembering to replace `[YOUR-PASSWORD]` with the password you provided when you setup the project.

### Stripe

This solution uses Stripe for Subscription payments.

1. Go to [Stripe](https://stripe.com) and setup your business (Free Tier is fine to start)
2. Create 2 products ('Team Plan' and 'Individual Plan') each with a single price and note the Product ID's and Price ID's
3. Edit the [seed.ts](/drizzle/seed.ts) file and replace the stripe_product_id values with the Product ID's from 2)

```typescript
    create: {
      name: 'Team Plan',
      .....
      stripe_product_id: '[Your Product ID from Stripe]'
    },
```

4. Edit the Pricing [pricing](/pages/pricing.vue) page and put your Price ID's from 2) into the appropriate hidden `price_id` form fields...

```html
<input type="hidden" name="price_id" value="[Your Price ID from Stripe]" />
```

5. go to the [API Keys](https://dashboard.stripe.com/test/apikeys) page find 'Secret Key' -> reveal test key. click to copy and then replace the STRIPE_SECRET_KEY value in your .env

6. install the stripe cli used to forward webhooks (macos)

```
brew install stripe/stripe-cli/stripe
```

7. log the CLI into your stripe account.

```
stripe login -i
```

provide the api key found in step 5) above

### Setup Database (Drizzle)

This solution uses Drizzle to both manage changes and connect to the Postgresql database provided by Supabase. Your Supabase DB will be empty by default so you need to hydrate the schema.

```
npm run db:generate
npm run db:migrate
npm run db:seed
```

...you should now have a a Plan table with 3 rows and a bunch of empty tables in your Supabase DB

_Note_ Beyond these commands, schema management is up to you. You might want to remove the migrations folder from .gitignore and start checking in your migration metadata, not sure.

## Developement Setup

### Dependencies

```bash
# yarn
yarn install

# npm
npm install

# pnpm
pnpm install --shamefully-hoist
```

### Webhook Forwarding

This makes sure that you can debug subscription workflows locally

```bash
stripe listen --forward-to localhost:3000/webhook
```

If you haven't already done so look at the stripe cli output for this text

```
Your webhook signing secret is whsec_xxxxxxxxxxxxx (^C to quit)
```

take ths signing secret and update the STRIPE_ENDPOINT_SECRET value in .env

### Start the Server

Start the development server on http://localhost:3000

```bash
npm run dev
```

### Running the Tests

There are a few unit tests, just for the stores because I needed to refactor. Feel free to extend the tests for your use cases, or not, it's your SaaS, not mine.

```bash
npm run test
```

## Production

Build the application for production:

```bash
npm run build
```

Locally preview production build:

```bash
npm run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

### Going Live on Netlify

Where you host your SAAS is 100% your problem however :-

- A quick look at the vue.js discord indicates that netlify has the most mentions (2020) out of all the hosting providers beating out Firebase (1592), Vercel (973) and AWS (740)
- I was able to get my app up and running with ridiculously little effort

Steps (Assumes your repo is in github)

1. Go to [Netlify](https://www.netlify.com/)
2. Log in with your github account (it's easier) and create an account (Free Tier is fine for now)
3. Add a New Site -> Import from Existing Proect
4. Choose your repo (You might need to Configure the Netlify app on GitHub) - Netlify auto-detects a nuxt app pretty good and the defaults it chooses seem to be fine.
5. Setup environment variables per the .env_example file (SUPABASE_URL, SUPABASE_KEY....etc)
6. Optionally change site name (e.g. mycoolsaas) or apply a domain name

7. Go to [Supabase](https://app.supabase.com/)
8. Choose your project
9. Go to URL Authentication -> URL Configuration -> Site URL
10. enter your new netlify URL e.g. https://mycoolsaas.netlify.app/ and click 'save'
11. Add the following additional redirect URLs for local development and deployment previews:

- http://localhost:3000/\*\*
- https://**--mycoolsaas.netlify.app/** (or https://mycustomdomain.com/**)

12. If you haven't already done so, edit your Supabase Email templates as the generic ones tend to get blocked by GMail.

### Netlify deployments and environment variables

Netlify is a bit rubbish at updating environment variables so you may need to manually re-deploy your site in certain situations e.g.

- If on initial load of the site you get a message along the lines of 'SUPABASE_URL is required'.. but you have set that environment variable correctly... try a manual deployment.
- Changing the default domain e.g. setting to a custom domain - If you notice you are redirected to the wrong version of the site after signup to a stripe subscription, this means the URL env variable has not been reset by Netlify. a manual deployment may fix it.

To manually redeploy to to your Netlify dashboard and navigate to Deploys -> Trigger Deploy -> Deploy site

/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aiActions from "../aiActions.js";
import type * as applications from "../applications.js";
import type * as auth0 from "../auth0.js";
import type * as calendar from "../calendar.js";
import type * as chatCleanup from "../chatCleanup.js";
import type * as crons from "../crons.js";
import type * as enrichment_tomba from "../enrichment/tomba.js";
import type * as followUp from "../followUp.js";
import type * as http from "../http.js";
import type * as inboxChecker from "../inboxChecker.js";
import type * as interviewScheduler from "../interviewScheduler.js";
import type * as openclaw from "../openclaw.js";
import type * as outreach_generator from "../outreach/generator.js";
import type * as outreach_mutations from "../outreach/mutations.js";
import type * as outreach_orchestrator from "../outreach/orchestrator.js";
import type * as outreach_queries from "../outreach/queries.js";
import type * as outreach_testing from "../outreach/testing.js";
import type * as pendingActions from "../pendingActions.js";
import type * as preferences from "../preferences.js";
import type * as replyClassifier from "../replyClassifier.js";
import type * as resumeProfiles from "../resumeProfiles.js";
import type * as sourcing_aiMatching from "../sourcing/aiMatching.js";
import type * as sourcing_arbeitnow from "../sourcing/arbeitnow.js";
import type * as sourcing_cleanup from "../sourcing/cleanup.js";
import type * as sourcing_cron from "../sourcing/cron.js";
import type * as sourcing_hackernews from "../sourcing/hackernews.js";
import type * as sourcing_queries from "../sourcing/queries.js";
import type * as sourcing_remotive from "../sourcing/remotive.js";
import type * as sourcing_store from "../sourcing/store.js";
import type * as sourcing_telegramNotify from "../sourcing/telegramNotify.js";
import type * as sourcing_textUtils from "../sourcing/textUtils.js";
import type * as sourcing_userMatches from "../sourcing/userMatches.js";
import type * as telegram from "../telegram.js";
import type * as telegramCallbacks from "../telegramCallbacks.js";
import type * as telegramCommands from "../telegramCommands.js";
import type * as telegramHelpers from "../telegramHelpers.js";
import type * as telegramJobFlow from "../telegramJobFlow.js";
import type * as telegramLinks from "../telegramLinks.js";
import type * as tokenVault from "../tokenVault.js";
import type * as userSettings from "../userSettings.js";
import type * as userTokens from "../userTokens.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aiActions: typeof aiActions;
  applications: typeof applications;
  auth0: typeof auth0;
  calendar: typeof calendar;
  chatCleanup: typeof chatCleanup;
  crons: typeof crons;
  "enrichment/tomba": typeof enrichment_tomba;
  followUp: typeof followUp;
  http: typeof http;
  inboxChecker: typeof inboxChecker;
  interviewScheduler: typeof interviewScheduler;
  openclaw: typeof openclaw;
  "outreach/generator": typeof outreach_generator;
  "outreach/mutations": typeof outreach_mutations;
  "outreach/orchestrator": typeof outreach_orchestrator;
  "outreach/queries": typeof outreach_queries;
  "outreach/testing": typeof outreach_testing;
  pendingActions: typeof pendingActions;
  preferences: typeof preferences;
  replyClassifier: typeof replyClassifier;
  resumeProfiles: typeof resumeProfiles;
  "sourcing/aiMatching": typeof sourcing_aiMatching;
  "sourcing/arbeitnow": typeof sourcing_arbeitnow;
  "sourcing/cleanup": typeof sourcing_cleanup;
  "sourcing/cron": typeof sourcing_cron;
  "sourcing/hackernews": typeof sourcing_hackernews;
  "sourcing/queries": typeof sourcing_queries;
  "sourcing/remotive": typeof sourcing_remotive;
  "sourcing/store": typeof sourcing_store;
  "sourcing/telegramNotify": typeof sourcing_telegramNotify;
  "sourcing/textUtils": typeof sourcing_textUtils;
  "sourcing/userMatches": typeof sourcing_userMatches;
  telegram: typeof telegram;
  telegramCallbacks: typeof telegramCallbacks;
  telegramCommands: typeof telegramCommands;
  telegramHelpers: typeof telegramHelpers;
  telegramJobFlow: typeof telegramJobFlow;
  telegramLinks: typeof telegramLinks;
  tokenVault: typeof tokenVault;
  userSettings: typeof userSettings;
  userTokens: typeof userTokens;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

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
import type * as followUp from "../followUp.js";
import type * as http from "../http.js";
import type * as inboxChecker from "../inboxChecker.js";
import type * as interviewScheduler from "../interviewScheduler.js";
import type * as openclaw from "../openclaw.js";
import type * as pendingActions from "../pendingActions.js";
import type * as preferences from "../preferences.js";
import type * as replyClassifier from "../replyClassifier.js";
import type * as resumeProfiles from "../resumeProfiles.js";
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
  followUp: typeof followUp;
  http: typeof http;
  inboxChecker: typeof inboxChecker;
  interviewScheduler: typeof interviewScheduler;
  openclaw: typeof openclaw;
  pendingActions: typeof pendingActions;
  preferences: typeof preferences;
  replyClassifier: typeof replyClassifier;
  resumeProfiles: typeof resumeProfiles;
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

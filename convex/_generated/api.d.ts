/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ResendOTP from "../ResendOTP.js";
import type * as auth from "../auth.js";
import type * as authCleanup from "../authCleanup.js";
import type * as authz from "../authz.js";
import type * as clients from "../clients.js";
import type * as crons from "../crons.js";
import type * as email from "../email.js";
import type * as followUps from "../followUps.js";
import type * as history from "../history.js";
import type * as http from "../http.js";
import type * as interactions from "../interactions.js";
import type * as migrations from "../migrations.js";
import type * as opportunities from "../opportunities.js";
import type * as passwordReset from "../passwordReset.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ResendOTP: typeof ResendOTP;
  auth: typeof auth;
  authCleanup: typeof authCleanup;
  authz: typeof authz;
  clients: typeof clients;
  crons: typeof crons;
  email: typeof email;
  followUps: typeof followUps;
  history: typeof history;
  http: typeof http;
  interactions: typeof interactions;
  migrations: typeof migrations;
  opportunities: typeof opportunities;
  passwordReset: typeof passwordReset;
  users: typeof users;
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

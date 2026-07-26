import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// GER-51 · M1: barre authVerifiers huérfanos (ver convex/authCleanup.ts).
crons.interval(
  "limpiar verificadores OAuth huerfanos",
  { minutes: 5 },
  internal.authCleanup.pruneStaleVerifiers
);

export default crons;

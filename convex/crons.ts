import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Barre restos de autenticación: verificadores de OAuth huérfanos (GER-51 · M1)
// y filas caducadas del límite de recuperación (GER-53 · M2).
// Ver convex/authCleanup.ts. El identificador debe ser ASCII puro.
crons.interval(
  "limpiar restos de auth",
  { minutes: 5 },
  internal.authCleanup.pruneStaleAuthRecords
);

export default crons;

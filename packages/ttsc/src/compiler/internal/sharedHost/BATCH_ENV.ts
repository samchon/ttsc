/**
 * Environment marker set to `"1"` on native plugin and compiler host spawns
 * that run one batch command and exit, and cleared on every resident spawn.
 * Mirrors `driver.BatchEnv` on the Go side.
 */
export const BATCH_ENV = "TTSC_BATCH";

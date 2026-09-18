/**
 * Environment variable that names a pooled host session's shared compile store
 * (samchon/ttsc#1390).
 *
 * The process that configures a pooled host, such as Next.js evaluating
 * `withTtsc` before Turbopack starts its loader workers, or Metro evaluating
 * `withTtsc` before it forks its transform workers, sets it to the store's
 * absolute path. Every worker it spawns inherits it, so all of them find the
 * same store, and no process outside that session does.
 */
export const TTSC_TRANSFORM_SESSION_ENV = "TTSC_UNPLUGIN_TRANSFORM_SESSION";

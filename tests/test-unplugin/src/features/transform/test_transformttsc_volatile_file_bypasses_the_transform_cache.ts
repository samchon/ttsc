import { assertVolatileFileBypassesTransformCache } from "../../internal/transform-volatile";

/**
 * Verifies a plugin-declared volatile file bypasses the project transform cache
 * and signals the markVolatile hook.
 *
 * Implements the hermeticity half of samchon/ttsc#716: a transform whose output
 * depends on non-file inputs (environment, time, network) cannot be proven
 * fresh by any file snapshot, so the envelope's `volatile` list must exclude
 * the file from caching instead of widening the watch set. A cache replay here
 * would freeze the non-hermetic output for the worker lifetime.
 *
 * 1. Run the fixture plugin's `emit-volatile` operation, which declares
 *    src/main.ts volatile and embeds a per-run nanosecond timestamp.
 * 2. Transform the unchanged project twice through one shared cache.
 * 3. Assert the two outputs differ (the compiler ran twice) and the markVolatile
 *    hook fired on both requests.
 */
export const test_transformttsc_volatile_file_bypasses_the_transform_cache =
  async () => {
    await assertVolatileFileBypassesTransformCache();
  };

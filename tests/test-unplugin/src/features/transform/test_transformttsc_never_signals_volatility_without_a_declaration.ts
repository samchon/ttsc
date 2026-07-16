import { assertNonVolatileFileNeverSignalsVolatility } from "../../internal/transform-volatile";

/**
 * Verifies the negative twin of the volatile contract: without a `volatile`
 * declaration the transform keeps its caching behavior and never signals the
 * markVolatile hook.
 *
 * An adapter that marked hermetic modules uncacheable would silently disable
 * the bundler's persistent cache for every ttsc project, so the volatility
 * signal must fire only on an explicit plugin declaration.
 *
 * 1. Transform the unchanged project twice through one shared cache with an
 *    ordinary (hermetic) fixture operation.
 * 2. Assert the second transform replays the cached output byte-for-byte.
 * 3. Assert the markVolatile hook never fired.
 */
export const test_transformttsc_never_signals_volatility_without_a_declaration =
  async () => {
    await assertNonVolatileFileNeverSignalsVolatility();
  };

import { assertBunRegisterSameRuntimeExplicitOptionsWin } from "../../internal/adapter-bun-register";

/**
 * Verifies bun-register does not shadow explicit options in same-runtime order
 * (#676).
 *
 * `@ttsc/unplugin/bun-register` auto-registers on import under Bun and also
 * exports `register(options)`. Bun uses the first matching `onLoad` hook and
 * does not fall through to a later overlapping plugin (oven-sh/bun#20583), so a
 * default plugin registered at import time used to shadow the explicit one,
 * silently ignoring the caller's `project`, `plugins`, and compiler options. The
 * entry must register exactly one loader whose effective options resolve on
 * first load, so an explicit call after import wins.
 *
 * 1. Freshly evaluate the entry with a Bun-like global present (import-time
 *    auto-registration runs, as in a real preload).
 * 2. Call `register(options)` with an explicit prefix plugin afterwards.
 * 3. Assert exactly one plugin is ever registered and that driving it applies
 *    the explicit options, not the fixture's tsconfig defaults.
 */
export const test_bun_register_explicit_options_are_not_shadowed_in_same_runtime_order =
  async () => {
    await assertBunRegisterSameRuntimeExplicitOptionsWin();
  };

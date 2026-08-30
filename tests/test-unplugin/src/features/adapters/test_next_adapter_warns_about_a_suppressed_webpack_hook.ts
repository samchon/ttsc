import { assertNextAdapterWarnsAboutASuppressedWebpackHook } from "../../internal/adapter-next";

/**
 * Verifies the Next wrapper warns when it suppresses Next's own webpack guard.
 *
 * See {@link assertNextAdapterWarnsAboutASuppressedWebpackHook}: Next refuses to
 * build on Turbopack when a config has a `webpack` hook and no `turbopack`
 * block. This wrapper always defines both, so it owes the caller that warning
 * itself (samchon/ttsc#1310).
 */
export const test_next_adapter_warns_about_a_suppressed_webpack_hook =
  async () => {
    await assertNextAdapterWarnsAboutASuppressedWebpackHook();
  };

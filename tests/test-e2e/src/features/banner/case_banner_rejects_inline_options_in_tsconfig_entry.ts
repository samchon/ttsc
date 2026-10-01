import { FixtureFiles } from "../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { TestBanner } from "../../internal/banner/internal/TestBanner";

/**
 * Verifies the @ttsc/banner plugin: inline options in the tsconfig plugin entry
 * are rejected with a specific error.
 *
 * All banner options must live in a dedicated `banner.config.*` file. The only
 * accepted key in the tsconfig plugin entry is `configFile` (plus framework
 * keys like `transform`). Providing any other key — such as the
 * formerly-accepted `text` or `config` — must fail immediately with an error
 * that names the offending key and points users at the config file. This
 * prevents silent no-ops where a user writes `{ "transform": "@ttsc/banner",
 * "text": "…" }` and receives no banner instead of the expected output.
 *
 * 1. Create a project with the formerly accepted inline `text` key.
 * 2. Run `ttsc --emit`; direct factory units exercise `config` and `options`.
 * 3. Assert non-zero exit and a stderr message that names the offending key and
 *    mentions `configFile`.
 *
 * @evidence contracts/testing.md#behavioral-verification Launcher rejection of text must fail, name the offending key and mention configFile.
 * @evidence contracts/testing.md#independent-expectations The config-file-only plugin contract rejects the literal obsolete text key.
 * @evidence contracts/testing.md#distinguishing-cases This obsolete text input proves launcher rejection; test_banner_factory_rejects_inline_options preserves exact text, config and object options inputs, per-key errors and configFile guidance in the unit runner.
 * @evidence contracts/testing.md#execution-ownership This case_banner_rejects_inline_options_in_tsconfig_entry scene is called by test_banner_native_boundary_batch through TestExecutor and the real built launcher or native host; portable decisions are separate Go units.
 * @evidence contracts/e2e.md#necessary-boundary Real descriptor loading must expose an invalid tsconfig key through launcher status and rendered diagnostic.
 * @evidence contracts/e2e.md#shared-execution One invalid text descriptor aborts loading, requiring one launcher invocation; the three-key portable validation table runs through direct factory units without a Go producer. Other unchanged native preparations reuse TestProject.sharedPluginCache, whose identity covers compiler, SDK, sources and overlays.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns fresh fixture directories until process exit, including failure; synchronous child processes finish before assertions. Sources/config remain fixed for their compilation, and only unchanged artifact inputs share the cache, never consumer results.
 * @evidence contracts/e2e.md#preserved-coverage Launcher rejection of text must fail, name the offending key and mention configFile. The original text transport assertions remain in this entry; test_banner_factory_rejects_inline_options owns all original key-specific errors and configFile guidance for config and options. Direct preamble/config/map unit cases do not claim this launcher and serialization connection.
 */
export function case_banner_rejects_inline_options_in_tsconfig_entry() {
  const key = "text";
  const value = "my banner";
  const root = TestProject.commonJsProject(
    FixtureFiles.read("banner/banner_rejects_inline_options_in_tsconfig_entry/inputs-1"),
    {
      compilerOptions: {
        plugins: [
          {
            transform: "@ttsc/banner",
            [key]: value,
          },
        ],
      },
    },
  );
  TestBanner.seedPackage(root);
  const result = TestProject.spawn(
    TestProject.TTSC_BIN,
    ["--cwd", root, "--emit"],
    { cwd: root },
  );
  assert.notEqual(result.status, 0, `expected failure for key "${key}"`);
  assert.match(
    result.stderr,
    new RegExp(`unsupported key.*"${key}"|"${key}".*unsupported key`),
    `stderr should name unsupported key "${key}"`,
  );
  assert.match(
    result.stderr,
    /configFile/,
    `stderr should mention configFile for key "${key}"`,
  );
}

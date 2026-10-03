import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx --no-plugins skips ttsc plugin discovery and loading.
 *
 * Ttsc's own config loaders evaluate a user `*.config.ts` by running it through
 * ttsx in an ephemeral, deliberately lenient project. That build must NOT load
 * the host project's transform/check plugins: their factories run and their
 * project checks fire, so a plugin that imposes a requirement the loader
 * tsconfig does not meet (e.g. `@nestia/core` demanding `strict` mode) would
 * abort config evaluation. `--no-plugins` routes `false` into
 * `loadProjectPlugins`, which skips both `compilerOptions.plugins` entries and
 * package auto-discovery, making the build hermetic.
 *
 * 1. Materialize a project whose tsconfig declares a plugin entry whose
 *    `transform` specifier cannot be resolved.
 * 2. Run plain `ttsx` and assert it fails because plugin loading throws.
 * 3. Run `ttsx --no-plugins` and assert it succeeds and runs the entry.
 * @evidence contracts/testing.md#behavioral-verification Plain ttsx with an unresolvable configured transform must fail, while --no-plugins must succeed and print ran from the same project.
 * @evidence contracts/testing.md#independent-expectations The deliberately absent @ttsc/this-plugin-does-not-exist specifier is the negative input; the literal program output is an independent skipped-loading success witness.
 * @evidence contracts/testing.md#distinguishing-cases The only option difference is --no-plugins. The failing run asserts nonzero status but not its exact plugin-resolution diagnostic; package auto-discovery is not separately seeded.
 * @evidence contracts/testing.md#execution-ownership The named test_ttsx_no_plugins_skips_plugin_loading E2E entry owns the actual bootstrap and observations specified here. TestProject/internal helpers supply fixtures and completed process results; this acknowledgment does not infer portable unit coverage from similarly named tests.
 * @evidence contracts/e2e.md#necessary-boundary Launcher option propagation must bypass actual plugin resolution before native build and still execute the project. A direct loadProjectPlugins false branch cannot prove the public flag wiring.
 * @evidence contracts/e2e.md#shared-execution Two host lifetimes share the same config/source fixture. No Go plugin is successfully built; plain failure and bypassed success have different bootstrap paths and cannot share one flag state.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The project is manually written under a tracked TestProject.tmpdir. Sources are immutable and both children synchronously finish; normal process-exit cleanup owns the fixture.
 * @evidence contracts/e2e.md#preserved-coverage Original plain nonzero and bypass status/output assertions remain. Failure-cause specificity and independent package-discovery bypass are not certified by these assertions.
 */
export function test_ttsx_no_plugins_skips_plugin_loading() {
  const root = TestProject.tmpdir("ttsc-ttsx-no-plugins-");
  for (const [name, contents] of Object.entries(FixtureFiles.read("ttsc/ttsx_no_plugins_skips_plugin_loading/inputs-1"))) {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents, "utf8");
  }

  // Plain run: loadProjectPlugins resolves the tsconfig plugin entry and
  // throws because the `transform` specifier does not resolve.
  const withPlugins = TestProject.spawn(TestProject.TTSX_BIN, ["src/main.ts"], {
    cwd: root,
  });
  assert.notEqual(
    withPlugins.status,
    0,
    "ttsx without --no-plugins should fail while loading the bogus plugin",
  );

  // Hermetic run: --no-plugins disables discovery, so the unresolvable
  // entry is never touched and the entry executes.
  const noPlugins = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--no-plugins", "src/main.ts"],
    { cwd: root },
  );
  assert.equal(noPlugins.status, 0, noPlugins.stderr);
  assert.equal(noPlugins.stdout.trim(), "ran");
}

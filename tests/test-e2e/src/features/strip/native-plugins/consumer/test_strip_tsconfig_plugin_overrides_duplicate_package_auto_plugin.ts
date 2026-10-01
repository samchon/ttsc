import { FixtureFiles } from "../../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestStrip } from "../../../../internal/strip/internal/TestStrip";
import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/strip/internal/plugin-cache";

/**
 * Verifies the @ttsc/strip plugin: tsconfig plugin wins over duplicate package
 * auto plugin.
 *
 * When `@ttsc/strip` is present in both a tsconfig plugin entry and in
 * `package.json` dependencies, the loader must deduplicate and use only the
 * tsconfig entry's config. Without deduplication the plugin would run twice —
 * once with the explicit config and once with the default config — which could
 * strip calls the user explicitly chose to keep.
 *
 * 1. Create a project whose tsconfig references a `strip.config.json` that strips
 *    only `console.warn`, while `package.json` also lists `@ttsc/strip`
 *    (default config would additionally strip `console.log`).
 * 2. Run `ttsc --emit`.
 * 3. Assert `console.log("keep-log")` is present in the output and `console.warn`
 *    is absent — confirming only the tsconfig-entry config ran.
 *
 * @evidence contracts/testing.md#behavioral-verification Duplicate explicit and dependency registrations must remove console.warn while retaining console.log(keep-log).
 * @evidence contracts/testing.md#independent-expectations The authored custom calls list selects warn only and takes precedence over implicit defaults.
 * @evidence contracts/testing.md#distinguishing-cases Both registrations exist; retained default target log detects an unwanted second default pass.
 * @evidence contracts/testing.md#execution-ownership This named test_strip_tsconfig_plugin_overrides_duplicate_package_auto_plugin entry runs through TestExecutor and the real built launcher or native host; portable decisions are separate Go units.
 * @evidence contracts/e2e.md#necessary-boundary Host registration deduplication must apply the explicit native configuration exactly once.
 * @evidence contracts/e2e.md#shared-execution The competing registration context requires its own load; a single registration cannot establish deduplication. Other unchanged native preparations reuse TestProject.sharedPluginCache, whose identity covers compiler, SDK, sources and overlays.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns fresh fixture directories until process exit, including failure; synchronous child processes finish before assertions. Sources/config remain fixed for their compilation, and only unchanged artifact inputs share the cache, never consumer results.
 * @evidence contracts/e2e.md#preserved-coverage Duplicate explicit and dependency registrations must remove console.warn while retaining console.log(keep-log). All original assertions remain in this named entry. TestLinkedProgramStripsDefaultStatementsAndPreservesDeclarations and TestLinkedProgramStripsCustomCallsOnlyInStatementPositions own AST list/body/callee/value-position distinctions; this case retains its original configuration or published-output boundary.
 */
export function test_strip_tsconfig_plugin_overrides_duplicate_package_auto_plugin() {
    const root = TestProject.commonJsProject(
      FixtureFiles.read("strip/strip_tsconfig_plugin_overrides_duplicate_package_auto_plugin/inputs-1"),
      {
        compilerOptions: {
          plugins: [{ transform: "@ttsc/strip" }],
        },
      },
    );
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ devDependencies: { "@ttsc/strip": "*" } }),
    );
    TestStrip.seedPackage(root);

    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", root, "--emit"],
      {
        cwd: root,
        env: {
          PATH: TestStrip.goPath(),
          TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.match(js, /console\.log\("keep-log"\)/);
    assert.doesNotMatch(js, /console\.warn/);
}

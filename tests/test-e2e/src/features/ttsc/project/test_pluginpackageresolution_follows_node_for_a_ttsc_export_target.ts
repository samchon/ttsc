import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import child_process from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { PluginPackageResolution } from "../../../../../../packages/ttsc/lib/plugin/internal/load/PluginPackageResolution.js";

/**
 * Verifies a package's `ttsc` export target resolves, or is refused, exactly as
 * Node resolves it under the `ttsc` condition.
 *
 * The plugin resolver reads the `ttsc` condition itself, so a package can point
 * plugin bootstrap at a runtime-free descriptor without redirecting its
 * ordinary imports. It fell back to the runtime entry for an explicitly blocked
 * (`null`) target and for a selected file that is missing, and it accepted a
 * target that climbs out of the package, where Node refuses all three. Node
 * itself, run with `--conditions=ttsc`, is the oracle for every row.
 *
 * 1. Install one package per exports shape: a valid descriptor, a blocked target,
 *    a missing target, an escaping target, a blocked target nested in another
 *    condition, an array whose first entry is invalid, and an array of only
 *    blocked entries.
 * 2. Resolve each through the plugin resolver and through Node.
 * 3. Assert both select the same file or both refuse with the same code.
 *
 * @evidence contracts/testing.md#behavioral-verification PluginPackageResolution.resolvePluginRequest returns the same canonical file or rejection code as Node for every authored export shape.
 * @evidence contracts/testing.md#independent-expectations A separate unmodified Node process with --conditions=ttsc is the independent exports-resolution oracle; expectations are not computed by the plugin resolver.
 * @evidence contracts/testing.md#distinguishing-cases Valid, blocked, missing, escaping, nested blocked, invalid-first fallback and all-blocked array targets retain their seven distinct fixtures; the escaping target exists so only the export rule can reject it.
 * @evidence contracts/testing.md#execution-ownership The named E2E function under src/features/project executes the shipped resolver and the actual conditioned Node reference process; each specifier remains a separate result-map key.
 * @evidence contracts/e2e.md#necessary-boundary Node conditional exports resolution supplies the real independent contract for the host's custom ttsc-condition resolver; ordinary default-condition calls cannot supply that oracle.
 * @evidence contracts/e2e.md#shared-execution One fixture workspace and one conditioned Node process resolve all seven packages; neither a package nor an export shape needs a separate native build or host lifetime.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity All fixtures are written before resolution and immutable afterward; distinct package names prevent one resolution cache entry from determining another. Synchronous process completion is checked before JSON consumption, and TestProject registers the workspace for exit cleanup.
 * @evidence contracts/e2e.md#preserved-coverage The complete seven plugin outcomes and seven independent Node outcomes are compared together after all have executed; status and exact response membership assertions additionally reject broken or incomplete oracle transport.
 */
export function test_pluginpackageresolution_follows_node_for_a_ttsc_export_target() {
    const root = fs.realpathSync.native(
      TestProject.tmpdir("ttsc-ttsc-exports-"),
    );
    fs.writeFileSync(path.join(root, "package.json"), "{}");
    const cases: Record<string, unknown> = {
      valid: { ttsc: "./descriptor.cjs", default: "./runtime.cjs" },
      blocked: { ttsc: null, default: "./runtime.cjs" },
      missing: { ttsc: "./missing.cjs", default: "./runtime.cjs" },
      escaping: { ttsc: "./../outside.cjs", default: "./runtime.cjs" },
      nested: { node: { ttsc: null, default: "./runtime.cjs" } },
      fallback: { ttsc: ["./../outside.cjs", "./descriptor.cjs"] },
      emptied: { ttsc: [null, null], default: "./runtime.cjs" },
    };
    // The file an escaping target names exists, so only the target rule can
    // refuse it.
    fs.mkdirSync(path.join(root, "node_modules"), { recursive: true });
    fs.writeFileSync(path.join(root, "node_modules", "outside.cjs"), "");
    for (const [name, target] of Object.entries(cases)) {
      const directory = path.join(root, "node_modules", `pkg-${name}`);
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(
        path.join(directory, "package.json"),
        JSON.stringify({ name: `pkg-${name}`, exports: { ".": target } }),
      );
      fs.writeFileSync(path.join(directory, "descriptor.cjs"), "");
      fs.writeFileSync(path.join(directory, "runtime.cjs"), "");
    }

    const specifiers = Object.keys(cases).map((name) => `pkg-${name}`);
    const node = nodeOutcomes(root, specifiers);
    const ours = Object.fromEntries(specifiers.map((specifier) => [
      specifier,
      outcome(() => PluginPackageResolution.resolvePluginRequest(specifier, root)),
    ]));
    assert.deepEqual(ours, node);
  }

function outcome(resolve: () => string): string {
  try {
    return `file:${fs.realpathSync.native(resolve())}`;
  } catch (error) {
    return `error:${String((error as { code?: unknown }).code)}`;
  }
}

function nodeOutcomes(root: string, specifiers: string[]): Record<string, string> {
  const script = [
    "const outcomes = {};",
    `for (const specifier of ${JSON.stringify(specifiers)}) {`,
    "  try {",
    `    const file = require.resolve(specifier, { paths: [${JSON.stringify(root)}] });`,
    "    outcomes[specifier] = 'file:' + require('node:fs').realpathSync.native(file);",
    "  } catch (error) {",
    "    outcomes[specifier] = 'error:' + error.code;",
    "  }",
    "}",
    "process.stdout.write(JSON.stringify(outcomes));",
  ].join("\n");
  const result = child_process.spawnSync(
    process.execPath,
    ["--conditions=ttsc", "-e", script],
    { cwd: root, encoding: "utf8", windowsHide: true },
  );
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const results = JSON.parse(result.stdout) as Record<string, string>;
  assert.deepEqual(Object.keys(results), specifiers);
  return results;
}

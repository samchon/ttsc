import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import child_process from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { PluginPackageResolution } from "../../../../../packages/ttsc/lib/plugin/internal/load/PluginPackageResolution.js";

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
 */
export const test_pluginpackageresolution_follows_node_for_a_ttsc_export_target =
  () => {
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

    for (const name of Object.keys(cases)) {
      const specifier = `pkg-${name}`;
      const ours = outcome(() =>
        PluginPackageResolution.resolvePluginRequest(specifier, root),
      );
      const node = nodeOutcome(root, specifier);
      assert.deepEqual(ours, node, specifier);
    }
  };

function outcome(resolve: () => string): string {
  try {
    return `file:${fs.realpathSync.native(resolve())}`;
  } catch (error) {
    return `error:${String((error as { code?: unknown }).code)}`;
  }
}

function nodeOutcome(root: string, specifier: string): string {
  const script = [
    "try {",
    `  const file = require.resolve(${JSON.stringify(specifier)}, { paths: [${JSON.stringify(root)}] });`,
    "  process.stdout.write('file:' + require('node:fs').realpathSync.native(file));",
    "} catch (error) {",
    "  process.stdout.write('error:' + error.code);",
    "}",
  ].join("\n");
  const result = child_process.spawnSync(
    process.execPath,
    ["--conditions=ttsc", "-e", script],
    { cwd: root, encoding: "utf8" },
  );
  return result.stdout;
}

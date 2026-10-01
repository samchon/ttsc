import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { TTSX_REGISTER, linkTtscPackage } from "../../../internal/ttsc/internal/ttsx-register";

/**
 * Verifies a ttsx run leaves every compiler output the project declares
 * byte-identical: declarations, build information, and JavaScript.
 *
 * Pins samchon/ttsc#1404. ttsx compiles into a private per-run directory, but
 * only `outDir` was redirected there. `declarationDir` and `tsBuildInfoFile`
 * name their own locations, so a run wrote `.d.ts` files into the published
 * types directory, including one for a script the project keeps out of its file
 * set, and replaced the incremental build information with its private build's
 * state. Every build ttsx starts now isolates all of its outputs.
 *
 * 1. Create a project with `declaration`, `declarationDir`, `incremental`, and
 *    `tsBuildInfoFile`, plus `scripts/tool.ts` outside `include`, and build it
 *    with ttsc.
 * 2. Run the in-include entry and the out-of-include script through ttsx, and the
 *    entry through the `ttsc/register` preload.
 * 3. Assert each run succeeds and the project tree outside `node_modules` is
 *    byte-identical to the state after the ttsc build.
 * @evidence contracts/testing.md#behavioral-verification A real ttsc build seeds declarations/build info, then included ttsx entry, excluded script and public register runs must print their authored values and preserve every non-node_modules file SHA-256 snapshot.
 * @evidence contracts/testing.md#independent-expectations The initial build must produce types/index.d.ts and build/app.tsbuildinfo; comparing their and every other file content hash before/after runtime independently detects unintended publication.
 * @evidence contracts/testing.md#distinguishing-cases Included entry, excluded-root fallback and register bootstrap share the declared declaration/incremental output profile. Snapshot excludes node_modules where runtime caches and linked package state live.
 * @evidence contracts/testing.md#execution-ownership The named test_ttsx_leaves_declaration_and_build_info_outputs_untouched E2E entry owns the actual bootstrap and observations specified here. TestProject/internal helpers supply fixtures and completed process results; this acknowledgment does not infer portable unit coverage from similarly named tests.
 * @evidence contracts/e2e.md#necessary-boundary Native compiler emission and both public runtime bootstraps must leave real published JS/declaration/build-info outputs unchanged. Direct option-planning units cannot prove side-effect isolation.
 * @evidence contracts/e2e.md#shared-execution One project and linked ttsc package serve one seed build plus three distinct command/entry lifetimes. Snapshot baseline is reused; separate bootstrap/root shapes require their own actual consumers, while further batching is not claimed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity All runtime comparisons use the post-seed immutable baseline. TestProject tracks root/package links; synchronous commands finish before the next starts, and private runtime state is excluded from the content oracle.
 * @evidence contracts/e2e.md#preserved-coverage Original declaration/build-info existence, three values/statuses and complete non-node_modules hash equality remain. File timestamps and transient create/remove events are outside this oracle.
 */
export function test_ttsx_leaves_declaration_and_build_info_outputs_untouched() {
    const root = TestProject.createProject(FixtureFiles.read("ttsc/ttsx_leaves_declaration_and_build_info_outputs_untouched/inputs-1"));
    linkTtscPackage(root);

    const built = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", root, "-p", "tsconfig.json"],
      { cwd: root },
    );
    assert.equal(built.status, 0, built.stderr);
    const before = snapshot(root);
    assert.ok(before.has("types/index.d.ts"), [...before.keys()].join("\n"));
    assert.ok(before.has("build/app.tsbuildinfo"));

    for (const [label, command, args, expected] of [
      ["entry", TestProject.TTSX_BIN, ["--cwd", root, "src/index.ts"], "entry"],
      [
        "script",
        TestProject.TTSX_BIN,
        ["--cwd", root, "scripts/tool.ts"],
        "tool",
      ],
      [
        "register",
        process.execPath,
        ["--require", TTSX_REGISTER, "src/index.ts"],
        "entry",
      ],
    ] as const) {
      const result = TestProject.spawn(command, [...args], { cwd: root });
      assert.equal(result.status, 0, `${label}: ${result.stderr}`);
      assert.equal(result.stdout.trim(), expected, label);
      assert.deepEqual(snapshot(root), before, `${label} changed the project`);
    }
  }

/** Every file outside `node_modules`, keyed by `/` path, to its SHA-256. */
function snapshot(root: string): Map<string, string> {
  const files = new Map<string, string>();
  const walk = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const location = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(location);
      else
        files.set(
          path.relative(root, location).split(path.sep).join("/"),
          crypto
            .createHash("sha256")
            .update(fs.readFileSync(location))
            .digest("hex"),
        );
    }
  };
  walk(root);
  return files;
}

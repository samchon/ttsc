import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { TTSX_REGISTER, linkTtscPackage } from "./ttsx-register";

type Files = Readonly<Record<string, string>>;
type Spawn = typeof TestProject.spawn;
type Profile = {
  name: string;
  files: Files;
  run(root: string, persistent: string, spawn: Spawn): void;
};

/**
 * Supplies remaining excluded-link and declaration-byte populations.
 * Their five requests remain untransferred. Installed package, stale neighbor
 * and missing-owned output now use the selected shared Runtime.
 *
 * @evidence contracts/common.md#principled-implementation Actual outputs, source-tree effects and owned missing-emit errors determine assertions; stale adjacent JavaScript must not supply execution.
 * @evidence contracts/common.md#clear-and-simple-design Two callbacks retain excluded alias and declaration/build-info behavior; transferred package and negative delivery no longer run here.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No predicted output path or synthetic process result replaces real files and native commands. Only the assembler invocation holding namespace is outside the active-profile snapshot.
 * @evidence contracts/common.md#meaningful-documentation Documents original request counts, seed authority and borrowed alias capability without claiming unexecuted symlink coverage.
 * @evidence contracts/portability.md#os-neutral-implementation Native paths and realpath compare a supplied actual alias with the consumer root; actual capability absence cannot certify divergence coverage.
 * @evidence contracts/performance.md#efficient-algorithms Filesystem snapshots hash B active-profile bytes and visit E entries, with O(B+E) work plus native command costs; holding unrelated completed canonical inputs is not active-profile data.
 * @evidence contracts/performance.md#reuse-equivalent-work The declared output seed is reused by three runtime consumers; excluded entry and compiler seed retain five requests.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The parent launcher handles completion and retention before profile moves. Exact input and output snapshots remain available across declared consumers.
 * @evidence contracts/testing.md#behavioral-verification Real status/output, source emits and declared bytes verify remaining effects. Package entries/mtime, stale rejection and missing-emit failure now belong to the selected Runtime.
 * @evidence contracts/testing.md#independent-expectations Literal output markers and originally authored file/path expectations define the oracle independently from produced artifacts.
 * @evidence contracts/testing.md#distinguishing-cases Excluded source through a physical or supported alias and declaration/build-info preservation through entry, script and register remain distinct.
 * @evidence contracts/testing.md#execution-ownership The canonical parent owns the installed tool, optional alias and profile staging. Callbacks invoke actual TTSC/TTSX/Node register routes, not private runtime predictions.
 * @evidence contracts/e2e.md#necessary-boundary Public runtime loading must respect actual checked publication and missing-output failures; direct output inference cannot prove those connections.
 * @evidence contracts/e2e.md#shared-execution Two remaining input populations borrow one root but retain five untransferred requests; this is not final consolidation certification.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Only the invocation-owned holding namespace is excluded; every active profile input and output stays in its original snapshot scope. The actual alias is borrowed, not synthesized by a fake backend.
 * @evidence contracts/e2e.md#preserved-coverage All installed/no-source-emit/declaration-byte/stale-output/missing-emit assertions remain. Physical fallback reports no alias capability proof.
 */
export function canonicalCheckedOutputProfiles(
  inputs: {
    excluded: Files;
    declared: Files;
  },
  rootAlias?: string,
): Profile[] {
  const collect = (failures: unknown[], assertion: () => void): void => {
    try {
      assertion();
    } catch (error) {
      failures.push(error);
    }
  };

  const complete = (name: string, failures: unknown[]): void => {
    if (failures.length) throw new AggregateError(failures, name);
  };
  const sourceEmits = (root: string): string[] => {
    const found: string[] = [];
    const walk = (directory: string): void => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        // This reserved assembler namespace holds completed canonical inputs,
        // not any original active profile input or checked output.
        if (directory === root && entry.name === "runtime-profile-holding")
          continue;
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "node_modules" && entry.name !== "lib") walk(file);
        } else if (/\.(?:js|mjs|cjs|d\.ts|js\.map)$/.test(entry.name)) {
          found.push(path.relative(root, file).replace(/\\/g, "/"));
        }
      }
    };
    walk(root);
    return found.sort();
  };
  const bytes = (root: string): Map<string, string> => {
    const files = new Map<string, string>();
    const walk = (directory: string): void => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        // This reserved assembler namespace holds completed canonical inputs,
        // not any original active profile input or checked output.
        if (directory === root && entry.name === "runtime-profile-holding")
          continue;
        if (entry.name === "node_modules") continue;
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(file);
        else
          files.set(
            path.relative(root, file).split(path.sep).join("/"),
            crypto
              .createHash("sha256")
              .update(fs.readFileSync(file))
              .digest("hex"),
          );
      }
    };
    walk(root);
    return files;
  };
  return [
    {
      name: "output-excluded-link",
      files: inputs.excluded,
      run(root, _persistent, spawn): void {
        const failures: unknown[] = [];
        let entryRoot = root;
        if (rootAlias !== undefined) {
          // The parent owns creation/withdrawal of this existing alias. Missing
          // capability retains the physical run with divergence coverage zero.
          assert.equal(
            fs.realpathSync.native(rootAlias),
            fs.realpathSync.native(root),
          );
          entryRoot = rootAlias;
        }
        const before = sourceEmits(root);
        const result = spawn(
          TestProject.TTSX_BIN,
          ["--cwd", entryRoot, path.join(entryRoot, "clear.ts")],
          { cwd: entryRoot },
        );
        if (result) {
          collect(failures, () =>
            assert.equal(result.status, 0, result.stderr),
          );
          collect(failures, () => assert.match(result.stdout, /cleared world/));
        }
        collect(failures, () =>
          assert.deepEqual(
            sourceEmits(root),
            before,
            "the entry project emitted into the source tree",
          ),
        );
        collect(failures, () =>
          assert.deepEqual(
            fs.existsSync(path.join(root, "lib"))
              ? fs.readdirSync(path.join(root, "lib")).sort()
              : [],
            [],
            "ttsx must not populate the project's outDir",
          ),
        );
        complete("excluded linked entry output", failures);
      },
    },
    {
      name: "output-declared-bytes",
      files: inputs.declared,
      run(root, _persistent, spawn): void {
        const failures: unknown[] = [];
        linkTtscPackage(root);
        const built = spawn(
          TestProject.TTSC_BIN,
          ["--cwd", root, "-p", "tsconfig.json"],
          {
            cwd: root,
          },
        );
        if (built)
          collect(failures, () => assert.equal(built.status, 0, built.stderr));
        const before = bytes(root);
        collect(failures, () =>
          assert.ok(
            before.has("types/index.d.ts"),
            [...before.keys()].join("\n"),
          ),
        );
        collect(failures, () => assert.ok(before.has("build/app.tsbuildinfo")));
        for (const [label, command, args, expected] of [
          [
            "entry",
            TestProject.TTSX_BIN,
            ["--cwd", root, "src/index.ts"],
            "entry",
          ],
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
          const result = spawn(command, [...args], { cwd: root });
          if (result) {
            collect(failures, () =>
              assert.equal(result.status, 0, `${label}: ${result.stderr}`),
            );
            collect(failures, () =>
              assert.equal(result.stdout.trim(), expected, label),
            );
          }
          collect(failures, () =>
            assert.deepEqual(
              bytes(root),
              before,
              `${label} changed the project`,
            ),
          );
        }
        complete("declared output bytes", failures);
      },
    },
  ];
}

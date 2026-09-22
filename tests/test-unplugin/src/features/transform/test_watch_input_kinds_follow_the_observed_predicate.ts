import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { TtscWatchInputKind } from "../../../../../packages/unplugin/lib/core/transform/watch/TtscWatchInputKind.mjs";
import { classifyWatchInput } from "../../../../../packages/unplugin/lib/core/transform/watch/classifyWatchInput.mjs";

/**
 * Verifies each watch input is classified by the predicate the compiler
 * observed on it, which decides how the adapter's own observer watches it
 * (samchon/ttsc#1388).
 *
 * A file is watched for its edit, a missing path for its creation, a listing
 * for an entry appearing, and a directory only checked to exist for nothing,
 * since each probed descendant is an input of its own. The rows are the
 * observation shapes TypeScript-Go reports for a real project. The project's
 * root files, which no compiler predicate reports, name their own kind
 * (samchon/ttsc#1419).
 *
 * 1. Classify each recorded observation, and the legacy evidence without one.
 * 2. Classify evidence-free recovery inputs from the filesystem.
 * 3. Assert every kind.
 */
export async function test_watch_input_kinds_follow_the_observed_predicate(): Promise<void> {
  const observed = (observation: object, missing = false) => ({
    evidence: {
      identity: "x",
      missing,
      state: { codec: "predicates" as const, observation },
    },
    file: "x",
  });
  const rows: [string, object, TtscWatchInputKind][] = [
    [
      "a read declaration",
      observed({ fileExists: true, readFile: { hash: "h", ok: true } }),
      "file",
    ],
    [
      "a file probe that failed",
      observed({ fileExists: false }, true),
      "missing",
    ],
    [
      "a read that failed",
      observed({ readFile: { ok: false } }, true),
      "missing",
    ],
    [
      "a missing ancestor `node_modules/@types`",
      observed({ directoryExists: false }),
      "missing",
    ],
    [
      "a path probed absent as both kinds",
      observed({ directoryExists: false, fileExists: false }, true),
      "missing",
    ],
    ["a stat that found nothing", observed({ stat: "missing" }), "missing"],
    [
      "a realpath that failed",
      observed({ realpath: { ok: false } }),
      "missing",
    ],
    [
      "a listed type root",
      observed({
        accessibleEntries: { directories: ["node"], files: [] },
        directoryExists: true,
      }),
      "listing",
    ],
    [
      "a listed directory that was absent",
      observed({
        accessibleEntries: { directories: [], files: [] },
        directoryExists: false,
      }),
      "missing",
    ],
    [
      "a package directory checked to exist",
      observed({ directoryExists: true }),
      "presence",
    ],
    [
      "a directory also probed as a file",
      observed({ directoryExists: true, fileExists: false }),
      "presence",
    ],
    [
      "a hashed project input",
      { evidence: { identity: "x", missing: false }, file: "x" },
      "file",
    ],
    [
      "a missing graph input",
      { evidence: { identity: "x", missing: true }, file: "x" },
      "missing",
    ],
    [
      "the project's root-file membership",
      {
        evidence: {
          identity: "x",
          missing: false,
          state: {
            codec: "membership",
            digest: "d",
            directories: ["x"],
            policy: { excludedDirectories: [], inputExtensions: [".ts"] },
          },
        },
        file: "x",
      },
      "membership",
    ],
  ];
  for (const [label, input, expected] of rows) {
    const watched = input as Parameters<typeof classifyWatchInput>[0];
    assert.equal(classifyWatchInput(watched), expected, label);
  }

  // A failed compile's recovery inputs carry no evidence; the filesystem
  // decides, and a directory is a listing since nothing narrows it.
  const root = TestProject.tmpdir("ttsc-watch-input-kinds-");
  const file = path.join(root, "input.d.ts");
  fs.writeFileSync(file, "export {};\n");
  assert.equal(classifyWatchInput({ file }), "file");
  assert.equal(classifyWatchInput({ file: root }), "listing");
  const absent = { file: path.join(root, "absent.d.ts") };
  assert.equal(classifyWatchInput(absent), "missing");
}

import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { TtscWatchInputKind } from "../../../../../packages/unplugin/lib/core/transform/watch/TtscWatchInputKind.mjs";
import { classifyWatchInput } from "../../../../../packages/unplugin/lib/core/transform/watch/classifyWatchInput.mjs";

/**
 * Verifies each watch input is classified by the predicate the compiler
 * observed on it, which decides the host channel it takes (samchon/ttsc#1388).
 *
 * Every adapter used to hand every input to one file-dependency channel. That
 * channel misses a created path on Rolldown and Farm, and a new directory entry
 * on webpack, Rspack, and Turbopack. It also watches a directory recursively on
 * Rollup, where the compiler's `DirectoryExists(node_modules)` probe put every
 * package under watch. The rows are the observation shapes TypeScript-Go
 * reports for a real project.
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
      "a missing ancestor `node_modules/@types`",
      observed({ directoryExists: false }),
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
  ];
  for (const [label, input, expected] of rows) {
    assert.equal(
      classifyWatchInput(input as Parameters<typeof classifyWatchInput>[0]),
      expected,
      label,
    );
  }

  // A failed compile's recovery inputs carry no evidence; the filesystem
  // decides, and a directory is a listing since nothing narrows it.
  const root = TestProject.tmpdir("ttsc-watch-input-kinds-");
  const file = path.join(root, "input.d.ts");
  fs.writeFileSync(file, "export {};\n");
  assert.equal(classifyWatchInput({ file }), "file");
  assert.equal(classifyWatchInput({ file: root }), "listing");
  assert.equal(
    classifyWatchInput({ file: path.join(root, "absent.d.ts") }),
    "missing",
  );
}

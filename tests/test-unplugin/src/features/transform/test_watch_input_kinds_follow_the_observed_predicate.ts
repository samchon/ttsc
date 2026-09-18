import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { TtscWatchInputKind } from "../../../../../packages/unplugin/lib/core/transform/watch/TtscWatchInputKind.mjs";
import { classifyWatchInput } from "../../../../../packages/unplugin/lib/core/transform/watch/classifyWatchInput.mjs";
import { missingWatchInputShape } from "../../../../../packages/unplugin/lib/core/transform/watch/missingWatchInputShape.mjs";

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
 * A missing input also carries what must appear there. esbuild keeps one watch
 * state per path and observes a file's creation and a directory's through
 * different channels, so the shape decides its channel.
 *
 * 1. Classify each recorded observation, and the legacy evidence without one.
 * 2. Classify evidence-free recovery inputs from the filesystem.
 * 3. Assert every kind, and the shape of every missing input.
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
  type Shape = ReturnType<typeof missingWatchInputShape>;
  const rows: [string, object, TtscWatchInputKind, Shape?][] = [
    [
      "a read declaration",
      observed({ fileExists: true, readFile: { hash: "h", ok: true } }),
      "file",
    ],
    [
      "a file probe that failed",
      observed({ fileExists: false }, true),
      "missing",
      "file",
    ],
    [
      "a read that failed",
      observed({ readFile: { ok: false } }, true),
      "missing",
      "file",
    ],
    [
      "a missing ancestor `node_modules/@types`",
      observed({ directoryExists: false }),
      "missing",
      "directory",
    ],
    [
      "a path probed absent as both kinds",
      observed({ directoryExists: false, fileExists: false }, true),
      "missing",
      "either",
    ],
    [
      "a stat that found nothing",
      observed({ stat: "missing" }),
      "missing",
      "either",
    ],
    [
      "a realpath that failed",
      observed({ realpath: { ok: false } }),
      "missing",
      "either",
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
      "directory",
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
      "file",
    ],
  ];
  for (const [label, input, expected, shape] of rows) {
    const watched = input as Parameters<typeof classifyWatchInput>[0];
    assert.equal(classifyWatchInput(watched), expected, label);
    assert.equal(
      expected === "missing" ? missingWatchInputShape(watched) : undefined,
      shape,
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
  const absent = { file: path.join(root, "absent.d.ts") };
  assert.equal(classifyWatchInput(absent), "missing");
  assert.equal(missingWatchInputShape(absent), "either");
}

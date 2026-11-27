import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { CompilerTarget } from "../../../../../packages/ttsc/src/plugin/internal/source/CompilerTarget";
import { SourcePluginAdmission } from "../../../../../packages/ttsc/src/plugin/internal/source/SourcePluginAdmission";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies `CompilerTarget.buildEnv` adds the `ttsc_compiler_batch` Go build
 * tag exactly when the compiler source declared in `TTSC_TSGO_SOURCE` contains
 * an `internal/batch` directory, while keeping caller `-tags`, the 7.1 target
 * tag, `ofEnv`, and `withoutTag` consistent.
 *
 * A declared compiler source may provide `internal/batch` to pace Go's
 * collector during one-shot batch compilations. When that directory is absent
 * or `TTSC_TSGO_SOURCE` is unset, `GOFLAGS` and cache keys must stay
 * untouched.
 *
 * 1. Check `buildEnv` without `TTSC_TSGO_SOURCE`, with a declared source lacking
 *    `internal/batch`, and with a regular file named `internal/batch`.
 * 2. Check `buildEnv` with a declared source holding an `internal/batch` directory
 *    across 7.0 and 7.1, caller `-tags`, stored `GOFLAGS`, and deduplication,
 *    and verify `ofEnv` reads back the compiler line.
 * 3. Verify `withoutTag` removes `ttsc_compiler_batch` alone and alongside
 *    `ttsc_typescript_7_1`, preserves lookalikes, and inverts `buildEnv`.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls production CompilerTarget.buildEnv, ofEnv and withoutTag over temporary compiler source directories and a temporary GOENV file, asserting exact GOFLAGS values, input immutability and target line recovery.
 * @evidence contracts/testing.md#independent-expectations Expected GOFLAGS values, tag names (ttsc_compiler_batch and ttsc_typescript_7_1) and line results come directly from the compiler batch contract and Go's -tags=a,b flag syntax rather than the implementation under test.
 * @evidence contracts/testing.md#distinguishing-cases Undeclared source, declared source without internal/batch, declared source with a file instead of a directory at internal/batch, and declared source with an internal/batch directory across 7.0, 7.1, caller tags, stored GOFLAGS, already-present tags and lookalike tags in withoutTag.
 * @evidence contracts/testing.md#execution-ownership A TypeScript unit test using temporary directories and a temporary GOENV file; Go runs only go env for stored GOFLAGS when needed, with no compilation or native host started.
 */
export function test_compilertarget_adds_compiler_batch_tag_for_batch_source(): void {
  const variable = SourcePluginAdmission.COMPILER_SOURCE_ENV;
  assert.equal(CompilerTarget.COMPILER_BATCH_TAG, "ttsc_compiler_batch");

  const root = TestProject.tmpdir("ttsc-compiler-batch-tag-");
  const withBatch = path.join(root, "with-batch");
  const withoutBatch = path.join(root, "without-batch");
  const withFile = path.join(root, "with-file");
  fs.mkdirSync(path.join(withBatch, "internal", "batch"), { recursive: true });
  fs.mkdirSync(withoutBatch, { recursive: true });
  fs.mkdirSync(path.join(withFile, "internal"), { recursive: true });
  fs.writeFileSync(path.join(withFile, "internal", "batch"), "not a dir\n");

  const stored = path.join(root, "go-env");
  const base: NodeJS.ProcessEnv = { ...process.env, GOENV: stored };
  delete base.GOFLAGS;
  delete base[variable];

  // No declared source, declared source without internal/batch, and a non-directory file leave GOFLAGS as before.
  for (const env of [
    base,
    { ...base, [variable]: withoutBatch },
    { ...base, [variable]: withFile },
  ]) {
    assert.equal(CompilerTarget.buildEnv(env, "7.0", root), env);
    const built71 = CompilerTarget.buildEnv(env, "7.1", root);
    assert.equal(built71.GOFLAGS, "-tags=ttsc_typescript_7_1");
    assert.equal(CompilerTarget.ofEnv(built71), "7.1");
  }

  // Declared source with internal/batch adds ttsc_compiler_batch on both 7.0 and 7.1.
  const declaredBase: NodeJS.ProcessEnv = { ...base, [variable]: withBatch };
  for (const [line, storedFlags, flags, expected] of [
    ["7.0", undefined, undefined, "-tags=ttsc_compiler_batch"],
    [
      "7.0",
      undefined,
      "-mod=mod  -trimpath",
      "-mod=mod -trimpath -tags=ttsc_compiler_batch",
    ],
    [
      "7.0",
      undefined,
      "-tags=netgo,osusergo -v",
      "-tags=netgo,osusergo,ttsc_compiler_batch -v",
    ],
    [
      "7.0",
      undefined,
      "--tags=ttsc_compiler_batch",
      "--tags=ttsc_compiler_batch",
    ],
    [
      "7.0",
      "-mod=mod -tags=netgo",
      undefined,
      "-mod=mod -tags=netgo,ttsc_compiler_batch",
    ],
    [
      "7.1",
      undefined,
      undefined,
      "-tags=ttsc_typescript_7_1,ttsc_compiler_batch",
    ],
    [
      "7.1",
      undefined,
      "-tags=netgo -v",
      "-tags=netgo,ttsc_typescript_7_1,ttsc_compiler_batch -v",
    ],
    [
      "7.1",
      undefined,
      "--tags=ttsc_typescript_7_1",
      "--tags=ttsc_typescript_7_1,ttsc_compiler_batch",
    ],
    [
      "7.1",
      "-mod=mod -tags=netgo",
      undefined,
      "-mod=mod -tags=netgo,ttsc_typescript_7_1,ttsc_compiler_batch",
    ],
  ] as const) {
    if (storedFlags === undefined) fs.rmSync(stored, { force: true });
    else fs.writeFileSync(stored, `GOFLAGS=${storedFlags}\n`);
    const input: NodeJS.ProcessEnv =
      flags === undefined
        ? { ...declaredBase }
        : { ...declaredBase, GOFLAGS: flags };
    const built = CompilerTarget.buildEnv(input, line, root);
    assert.equal(
      built.GOFLAGS,
      expected,
      `buildEnv(${line}, stored=${String(storedFlags)}, flags=${String(flags)})`,
    );
    assert.equal(input.GOFLAGS, flags, "buildEnv leaves its input unchanged");
    assert.equal(CompilerTarget.ofEnv(built), line);
  }
  fs.rmSync(stored, { force: true });

  // withoutTag removes ttsc_compiler_batch alone and with ttsc_typescript_7_1, keeping lookalikes and caller flags.
  for (const [flags, expected] of [
    ["-tags=ttsc_compiler_batch", ""],
    ["-tags=ttsc_typescript_7_1,ttsc_compiler_batch", ""],
    [
      "-mod=mod -tags=netgo,ttsc_typescript_7_1,ttsc_compiler_batch -v",
      "-mod=mod -tags=netgo -v",
    ],
    [
      "--tags=ttsc_compiler_batchx -trimpath",
      "--tags=ttsc_compiler_batchx -trimpath",
    ],
  ] as const)
    assert.equal(
      CompilerTarget.withoutTag(flags),
      expected,
      `withoutTag(${flags})`,
    );

  for (const line of ["7.0", "7.1"] as const)
    assert.equal(
      CompilerTarget.withoutTag(
        CompilerTarget.buildEnv(
          { ...declaredBase, GOFLAGS: "-mod=mod -tags=netgo" },
          line,
          root,
        ).GOFLAGS!,
      ),
      "-mod=mod -tags=netgo",
      `withoutTag inverts buildEnv for ${line}`,
    );
}

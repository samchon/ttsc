import assert from "node:assert/strict";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import { resolveOptions } from "../../../../../packages/unplugin/src/core/options/resolveOptions";
import { rollupDeliveryOptions } from "../../../../../packages/unplugin/src/core/rollup/rollupDeliveryOptions";
import { createTransformCacheKey } from "../../../../../packages/unplugin/src/core/transform/cache/createTransformCacheKey";
import { sharedCompileIdentity } from "../../../../../packages/unplugin/src/core/transform/session/sharedCompileIdentity";
import { resolveCompilerEnvironment } from "../../../../../packages/unplugin/src/core/transform/tsconfig/resolveCompilerEnvironment";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies compiler permission and argument transport distinguish reusable
 * output.
 *
 * A matching project cannot authorize output compiled under another permission
 * or argument base directory.
 *
 * 1. Normalize enabled, disabled and omitted permission options.
 * 2. Compare resident, shared and Rollup identities for authored transports.
 * 3. Require equal snapshots to share and differing argv/cwd to separate.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual option normalization and all three cache identity owners; permission values survive and different effective argument snapshots cannot share an identity.
 * @evidence contracts/testing.md#independent-expectations Literal true, false and undefined specify permission states; distinct ordered arguments and working directories describe different compiler invocations independently of the hash implementation.
 * @evidence contracts/testing.md#distinguishing-cases Omission contrasts explicit enable and disable; absent, empty, reordered and populated argv plus differing cwd separate transport dimensions while cloned equivalent snapshots retain equality.
 * @evidence contracts/testing.md#execution-ownership This discoverable source unit uses in-memory environment records and a tracked temporary project; it launches no compiler or bundler and never mutates the process environment.
 */
export function test_compiler_permission_and_argument_identity_are_invocation_scoped(): void {
  assert.equal(resolveOptions({ runExternalCode: true }).runExternalCode, true);
  assert.equal(
    resolveOptions({ runExternalCode: false }).runExternalCode,
    false,
  );
  assert.equal(resolveOptions().runExternalCode, undefined);
  const root = TestProject.createProject({ "tsconfig.json": '{"files":[]}' });
  const options = resolveOptions({ project: path.join(root, "tsconfig.json") });
  const compile = {
    aliasPaths: {},
    compilerOptions: {},
    projectRoot: root,
    tsconfig: options.project!,
  };
  const identities = (compilerEnvironment: NodeJS.ProcessEnv) => [
    createTransformCacheKey({ ...compile, compilerEnvironment }),
    sharedCompileIdentity({ ...compile, compilerEnvironment }),
    rollupDeliveryOptions(options, {}, compilerEnvironment),
  ];
  const rows = [
    {},
    { TTSC_TSGO_ARGS: "[]" },
    { TTSC_TSGO_ARGS: '["--runExternalCode"]' },
    { TTSC_TSGO_ARGS: '["--runExternalCode","false"]' },
    { TTSC_TSGO_ARGS: '["--strict","--runExternalCode"]' },
    { TTSC_TSGO_ARGS: '["--runExternalCode","--strict"]' },
    { TTSC_TSGO_ARGS: '["@args.rsp"]', TTSC_TSGO_ARGS_CWD: root },
    { TTSC_TSGO_ARGS: '["@args.rsp"]', TTSC_TSGO_ARGS_CWD: path.dirname(root) },
  ];
  const keys = rows.map(identities);
  for (let index = 0; index < rows.length; index++) {
    assert.deepEqual(identities({ ...rows[index] }), keys[index]);
  }
  for (let owner = 0; owner < 3; owner++)
    assert.equal(new Set(keys.map((key) => key[owner])).size, rows.length);
  assert.notEqual(
    rollupDeliveryOptions(
      resolveOptions({ ...options, runExternalCode: true }),
      {},
    ),
    rollupDeliveryOptions(
      resolveOptions({ ...options, runExternalCode: false }),
      {},
    ),
  );
}

/**
 * Verifies permission overrides preserve argument order and environment
 * ownership.
 *
 * A disabled invocation must override inherited permission without changing a
 * concurrent invocation or the parent environment.
 *
 * 1. Derive enabled, disabled and omitted snapshots from one inherited record.
 * 2. Mutate the caller after capture and compare the detached snapshots.
 * 3. Reject malformed argv and invalid permission, then check native name rules.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual resolveCompilerEnvironment appends ordered true/false assignments, owns absent channels, detaches caller state and rejects malformed transports without changing the supplied or process environment.
 * @evidence contracts/testing.md#independent-expectations Literal JSON argument arrays and exact cwd/path values define the upstream transport; own undefined properties prevent late inheritance independently of the native spawn implementation.
 * @evidence contracts/testing.md#distinguishing-cases Omitted, true and false permissions cover default and overrides; malformed JSON, nonarrays, mixed members, empty payloads, invalid permission and native environment-name case distinguish boundary handling.
 * @evidence contracts/testing.md#execution-ownership This source unit calls the environment owner directly on detached records without replacing process.env, spawning processes or loading a compiler.
 */
export function test_compiler_permission_snapshots_preserve_environment_ownership(): void {
  const parent = { ...process.env };
  const inherited = {
    TTSC_TSGO_ARGS: '["--strict","--runExternalCode"]',
    TTSC_TSGO_ARGS_CWD: "original/base",
    OTHER: "kept",
  };
  const before = { ...inherited };
  const enabled = resolveCompilerEnvironment(true, inherited);
  const disabled = resolveCompilerEnvironment(false, inherited);
  const omitted = resolveCompilerEnvironment(undefined, inherited);
  assert.equal(
    enabled.TTSC_TSGO_ARGS,
    '["--strict","--runExternalCode","--runExternalCode","true"]',
  );
  assert.equal(
    disabled.TTSC_TSGO_ARGS,
    '["--strict","--runExternalCode","--runExternalCode","false"]',
  );
  assert.deepEqual(omitted, inherited);
  assert.deepEqual(inherited, before);
  inherited.TTSC_TSGO_ARGS = "[]";
  inherited.TTSC_TSGO_ARGS_CWD = "changed";
  assert.equal(disabled.TTSC_TSGO_ARGS_CWD, "original/base");
  assert.equal(disabled.OTHER, "kept");
  const absent = resolveCompilerEnvironment(undefined, {});
  assert.equal(Object.hasOwn(absent, "TTSC_TSGO_ARGS"), true);
  assert.equal(Object.hasOwn(absent, "TTSC_TSGO_ARGS_CWD"), true);
  assert.equal(absent.TTSC_TSGO_ARGS, undefined);
  assert.equal(
    resolveCompilerEnvironment(true, { TTSC_TSGO_ARGS: "" }).TTSC_TSGO_ARGS,
    '["--runExternalCode","true"]',
  );
  assert.equal(
    resolveCompilerEnvironment(true, { TTSC_TSGO_ARGS: "\u0085 [] \n" })
      .TTSC_TSGO_ARGS,
    '["--runExternalCode","true"]',
  );
  assert.equal(
    resolveCompilerEnvironment(false, { TTSC_TSGO_ARGS: "\u0085" })
      .TTSC_TSGO_ARGS,
    '["--runExternalCode","false"]',
  );
  for (const raw of [
    "{",
    "null",
    "true",
    "{}",
    "[1]",
    '["--strict",null]',
    "\uFEFF[]",
  ])
    assert.throws(() =>
      resolveCompilerEnvironment(false, { TTSC_TSGO_ARGS: raw }),
    );
  assert.throws(
    () => resolveCompilerEnvironment("false" as unknown as boolean, {}),
    /must be a boolean/,
  );
  const names = resolveCompilerEnvironment(false, {
    ttsc_tsgo_args: '["--strict"]',
    ttsc_tsgo_args_cwd: "native/base",
  });
  assert.equal(
    names.TTSC_TSGO_ARGS,
    process.platform === "win32"
      ? '["--strict","--runExternalCode","false"]'
      : '["--runExternalCode","false"]',
  );
  assert.equal(
    names.TTSC_TSGO_ARGS_CWD,
    process.platform === "win32" ? "native/base" : undefined,
  );
  const conflicting = resolveCompilerEnvironment(undefined, {
    TTSC_TSGO_ARGS: '["--strict"]',
    ttsc_tsgo_args: '["--noCheck"]',
  });
  assert.equal(conflicting.TTSC_TSGO_ARGS, '["--strict"]');
  assert.equal(
    isDeepStrictEqual({ ...process.env }, parent),
    true,
    "parent environment stays unchanged",
  );
}

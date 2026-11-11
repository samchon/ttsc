import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { BuildExecution } from "../../../../../packages/ttsc/src/compiler/internal/build/BuildExecution";
import { RuntimeBuildInputs } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeBuildInputs";
import type { ITtscLoadedNativePlugin } from "../../../../../packages/ttsc/src/structures/internal/ITtscLoadedNativePlugin";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a project is keyed by the variables its processes read only when
 * every native plugin declares that it reads variables through the recorded
 * read; one undeclared host keeps the complete environment in the key.
 *
 * A native host may call `os.Getenv`, which nothing records. Dropping the whole
 * environment from such a project's key would reuse an emit compiled under
 * another value of a variable the host reads (samchon/ttsc#1852).
 *
 * 1. Take the build identity of one project under a baseline environment.
 * 2. Add a variable no build process reads, for a declared and an undeclared
 *    plugin host.
 * 3. Change a variable the compiler reads, for the declared host.
 *
 * @evidence contracts/testing.md#behavioral-verification The production proof factory computes real build identities from an actual execution context; equality or inequality of two identities is the observable keying decision.
 * @evidence contracts/testing.md#independent-expectations The authored capability decides the expectation: a declared host must ignore a variable nobody reads and follow one the compiler reads, while an undeclared host must follow any variable.
 * @evidence contracts/testing.md#distinguishing-cases A declared host with an unread variable, the same host with a compiler-read variable, and an undeclared host with the unread variable separate a read-based key from a complete one; a mixed pair of hosts follows its undeclared member.
 * @evidence contracts/testing.md#execution-ownership The unit runner discovers this named export. The resolvers and the proof factory run directly over an owned temporary project linked to the existing dependency installation; identities are computed without starting a compiler or building a native artifact.
 */
export function test_runtimebuildinputs_keys_undeclared_plugin_hosts_by_the_complete_environment(): void {
  const root = TestProject.physicalPath(
    TestProject.createProject({
      "package.json": '{"private":true}',
      "tsconfig.json": '{"compilerOptions":{},"include":["src"]}',
      "src/main.ts": "export const value = 1;\n",
    }),
  );
  fs.symlinkSync(
    TestProject.physicalPath(
      path.join(TestProject.WORKSPACE_ROOT, "node_modules"),
    ),
    path.join(root, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const selected = BuildExecution.resolveExecutionContext({
    cwd: root,
    plugins: false,
    env: { TTSC_TSGO_BINARY: undefined },
  });
  // An existing executable stands for a native host; only its descriptor's
  // declaration differs between the cases.
  const host = (declared: boolean): ITtscLoadedNativePlugin =>
    ({
      binary: process.execPath,
      capabilities: {
        emitObservations: true,
        ...(declared ? { environmentInputs: true as const } : {}),
      },
      config: {},
      kind: "executable",
      name: declared ? "declared" : "undeclared",
      source: root,
      stage: "transform",
    }) as unknown as ITtscLoadedNativePlugin;
  const identity = (
    plugins: ITtscLoadedNativePlugin[],
    env: NodeJS.ProcessEnv,
  ): string => {
    const proof = RuntimeBuildInputs.create(
      {
        emit: true,
        env: {
          NO_COLOR: undefined,
          FORCE_COLOR: undefined,
          E2E_UNREAD_VARIABLE: undefined,
          ...env,
        },
        forceEmitProvenance: true,
        isolateOutputsTo: path.join(root, "private-emit"),
        runtimeCacheDir: path.join(root, "cache/runtime-builds"),
      },
      { ...selected, nativePlugins: plugins },
    );
    const text = proof?.identity?.();
    assert.equal(typeof text, "string", "the build has a replayable identity");
    return text!;
  };
  const unread = { E2E_UNREAD_VARIABLE: "another invocation" };

  assert.equal(
    identity([host(true)], unread),
    identity([host(true)], {}),
    "a declared host ignores a variable nobody reads",
  );
  assert.notEqual(
    identity([host(true)], { FORCE_COLOR: "1" }),
    identity([host(true)], {}),
    "and follows one the compiler reads",
  );
  assert.notEqual(
    identity([host(false)], unread),
    identity([host(false)], {}),
    "an undeclared host follows every variable",
  );
  assert.notEqual(
    identity([host(true), host(false)], unread),
    identity([host(true), host(false)], {}),
    "one undeclared host decides for the project",
  );
}

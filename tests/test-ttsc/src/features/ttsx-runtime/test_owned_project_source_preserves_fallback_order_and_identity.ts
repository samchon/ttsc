import assert from "node:assert/strict";

import { OwnedProjectSource } from "../../../../../packages/ttsc/src/launcher/internal/runtime/OwnedProjectSource";

/**
 * Verifies owned-source selection preserves fallback order and error identity.
 *
 * Only a classified empty project and an unowned requested source request a
 * root build. Supported dependency callbacks distinguish this coordination
 * policy without supplying fake native compiler records or emitted files.
 *
 * 1. Contrast no owner, project success, empty project and missing ownership.
 * 2. Check exact config/source forwarding and returned object identity.
 * 3. Preserve other failures and the literal missing-root-output error.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual production-used OwnedProjectSource.serve through its supported dependency interface and observes ordered callbacks, exact coordinates, returned identities and thrown error identities.
 * @evidence contracts/testing.md#independent-expectations Literal callback sequences specify no-owner and project/root admission; independently authored identity objects and the exact missing-output error fix expectations without reading native producer records.
 * @evidence contracts/testing.md#distinguishing-cases No owner performs no build, project success avoids root, classified empty skips project serving, a nonempty ownership miss falls back, missing root output rejects, and config/project/classifier/project-read/root-build/root-read failures propagate unchanged.
 * @evidence contracts/testing.md#execution-ownership One in-process unit calls the actual coordinator with ordinary supported callback inputs; no compiler, filesystem, child, native emission or host is executed, and owning-config discovery, empty native emit and source provenance remain unverified delegated boundaries.
 */
export function test_owned_project_source_preserves_fallback_order_and_identity(): void {
  const real = "/physical inputs/b/index.ts";
  const config = "/owning project/tsconfig.json";
  const project = { identity: "project" };
  const root = { identity: "root" };
  const projectValue = { identity: "project served" };
  const rootValue = { identity: "root served" };
  const empty = new Error("authored empty-project classification input");
  type Stage = "config" | "project" | "classify" | "project-read" | "root" | "root-read";
  const failures: Error[] = [];
  const check = (name: string, operation: () => void): void => {
    try { operation(); } catch (cause) { failures.push(new Error(name, { cause })); }
  };
  const scenario = (options: {
    noOwner?: boolean; emptyProject?: boolean; projectMiss?: boolean;
    rootMiss?: boolean; fail?: Stage; error?: Error;
  }) => {
    const calls: Stage[] = [];
    const enter = (stage: Stage): void => {
      calls.push(stage);
      if (options.fail === stage) throw options.error;
    };
    const dependencies: OwnedProjectSource.Dependencies<typeof project, typeof projectValue> = {
      owningTsconfig(source) {
        enter("config"); assert.equal(source, real);
        return options.noOwner ? null : config;
      },
      ensureProjectBuilt(owner) {
        enter("project"); assert.equal(owner, config);
        if (options.emptyProject) throw empty;
        return project;
      },
      isEmptyProjectEmitError(error) {
        enter("classify"); return error === empty;
      },
      serve(build, source) {
        assert.equal(source, real);
        if (build === project) {
          enter("project-read"); return options.projectMiss ? null : projectValue;
        }
        assert.equal(build, root);
        enter("root-read"); return options.rootMiss ? null : rootValue;
      },
      ensureRootBuilt(owner, source) {
        enter("root"); assert.equal(owner, config); assert.equal(source, real);
        return root;
      },
    };
    return { calls, run: () => OwnedProjectSource.serve(real, dependencies) };
  };
  for (const row of [
    { name: "no owner", options: { noOwner: true }, value: null, calls: ["config"] },
    { name: "project success", options: {}, value: projectValue, calls: ["config", "project", "project-read"] },
    { name: "empty project", options: { emptyProject: true }, value: rootValue, calls: ["config", "project", "classify", "root", "root-read"] },
    { name: "unowned requested source", options: { projectMiss: true }, value: rootValue, calls: ["config", "project", "project-read", "root", "root-read"] },
  ]) check(row.name, () => {
    const actual = scenario(row.options);
    assert.equal(actual.run(), row.value);
    assert.deepEqual(actual.calls, row.calls);
  });
  check("missing root output", () => {
    const actual = scenario({ projectMiss: true, rootMiss: true });
    assert.throws(actual.run, { message: "ttsx: the build of /physical inputs/b/index.ts through /owning project/tsconfig.json emitted no JavaScript for it" });
    assert.deepEqual(actual.calls, ["config", "project", "project-read", "root", "root-read"]);
  });
  for (const [stage, calls] of [
    ["config", ["config"]],
    ["project", ["config", "project", "classify"]],
    ["classify", ["config", "project", "classify"]],
    ["project-read", ["config", "project", "project-read"]],
    ["root", ["config", "project", "project-read", "root"]],
    ["root-read", ["config", "project", "project-read", "root", "root-read"]],
  ] as const) check(`${stage} failure`, () => {
    const error = new Error(`authored ${stage} failure`);
    const actual = scenario({ fail: stage, error, emptyProject: stage === "classify", projectMiss: stage === "root" || stage === "root-read" });
    assert.throws(actual.run, (caught) => caught === error);
    assert.deepEqual(actual.calls, [...calls]);
  });
  if (failures.length) throw new AggregateError(failures, "owned project source coordination failed");
}

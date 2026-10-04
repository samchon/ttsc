import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { readProjectConfig } from "../../../../../packages/ttsc/src/compiler/internal/project/readProjectConfig";
import { CapabilityPluginResult } from "../../../../../packages/ttsc/src/plugin/internal/CapabilityPluginResult";

/**
 * Verify declared capability selection and the caught resolver result policy.
 * Supplied manifest/context/sidecar records are authored policy inputs. A real
 * missing config supplies a reader failure inside the supported task boundary.
 * Authority acquisition, cache lookup and tool resolution precede that catch
 * in the resolver and are not covered by these no-throw observations.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual production-used select/unavailable/fromTask and actual readProjectConfig for a missing explicit config. Literal results distinguish true-only selection, configured order, empty binaries, complete manifest/context forwarding, fresh unavailable results and successful task reference preservation.
 * @evidence contracts/testing.md#independent-expectations Independently authored capability flags, distinct binary strings, full manifest, context string and exact missing-config error determine expected results; expected selection is a literal list rather than a product-generated filter.
 * @evidence contracts/testing.md#distinguishing-cases False/absent/true declarations and an empty binary contrast eligibility. Context true/false/absent and null contrast own-field presence. Unknown capability and missing-project failures return empty without being reusable resolved absence. Success, Error and primitive throws distinguish the caught task; original inputs remain unchanged.
 * @evidence contracts/testing.md#execution-ownership The unit directly calls source operations with in-memory records and an owned temporary directory. It probes no runtime, evaluates no descriptor, builds no Go/plugin/compiler and starts no process. Native acquired proof, actual resolver bootstrap/evaluator counts and selected binary provenance are not certified. Owned directory cleanup failure is retained with all body failures.
 */
export function test_capability_plugin_result_preserves_selection_and_unavailable_policy(): void {
  type Selection = Parameters<typeof CapabilityPluginResult.select>[0];
  const failures: Error[] = [];
  const check = (name: string, body: () => void): void => {
    try { body(); }
    catch (cause) { failures.push(new Error(name, { cause })); }
  };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-capability-result-"));
  try {
    const manifest = '[{"name":"absent","stage":"check"},{"name":"false","stage":"check"},{"name":"empty-binary","stage":"check"},{"name":"first","stage":"check","config":"first.json"},{"name":"second","stage":"transform"},{"name":"third","stage":"transform"}]';
    const context = '{"physicalProjectRoot":"/authored/project","tsconfig":"/authored/project/tsconfig.json"}';
    const selection: Selection = {
      manifest,
      projectContext: context,
      plugins: [
        { binary: "absent", capabilities: {} },
        { binary: "false", capabilities: { graphNodes: false } },
        { binary: "", capabilities: { graphNodes: true, projectContextArgs: true } },
        { binary: "first", capabilities: { graphNodes: true, projectContextArgs: true } },
        { binary: "second", capabilities: { graphNodes: true, projectContextArgs: false } },
        { binary: "third", capabilities: { graphNodes: true } },
      ],
    };
    check("ordered declaring selection and complete manifest", () => {
      const before = JSON.stringify(selection);
      const actual = CapabilityPluginResult.select(selection, "graphNodes");
      assert.deepEqual(actual, [
        { binary: "first", manifest, projectContext: context },
        { binary: "second", manifest },
        { binary: "third", manifest },
      ]);
      assert.equal(Object.hasOwn(actual[0]!, "projectContext"), true);
      assert.equal(Object.hasOwn(actual[1]!, "projectContext"), false);
      assert.equal(Object.hasOwn(actual[2]!, "projectContext"), false);
      assert.deepEqual(CapabilityPluginResult.select(selection, "aCapabilityNoPluginDeclares"), []);
      const fresh = CapabilityPluginResult.select(selection, "graphNodes");
      assert.notEqual(fresh, actual);
      assert.notEqual(fresh[0], actual[0]);
      assert.notEqual(actual[0], selection.plugins[3]);
      actual[0]!.binary = "mutated result";
      assert.equal(fresh[0]!.binary, "first");
      assert.equal(JSON.stringify(selection), before);
    });
    check("null context and empty selection", () => {
      const actual = CapabilityPluginResult.select({ ...selection, projectContext: null }, "graphNodes");
      assert.deepEqual(actual, [
        { binary: "first", manifest }, { binary: "second", manifest }, { binary: "third", manifest },
      ]);
      for (const plugin of actual) assert.equal(Object.hasOwn(plugin, "projectContext"), false);
      assert.deepEqual(CapabilityPluginResult.select({ manifest, projectContext: context, plugins: [] }, "graphNodes"), []);
    });
    check("fresh unavailable result never has freshness", () => {
      const actual = CapabilityPluginResult.unavailable();
      const fresh = CapabilityPluginResult.unavailable();
      assert.equal(actual.status, "unavailable");
      assert.deepEqual(actual.plugins, []);
      assert.equal(actual.isCurrent(), false);
      assert.equal(actual.isCurrent(), false);
      assert.notEqual(actual, fresh);
      assert.notEqual(actual.plugins, fresh.plugins);
      assert.equal(fresh.isCurrent(), false);
    });
    check("successful task preserves resolution and callback identity", () => {
      let calls = 0;
      let currentCalls = 0;
      const resolution: ReturnType<typeof CapabilityPluginResult.fromTask> = {
        status: "resolved",
        plugins: CapabilityPluginResult.select(selection, "graphNodes"),
        isCurrent: () => { currentCalls += 1; return true; },
      };
      const actual = CapabilityPluginResult.fromTask(() => { calls += 1; return resolution; });
      assert.equal(calls, 1);
      assert.equal(actual, resolution);
      assert.equal(actual.plugins, resolution.plugins);
      assert.equal(currentCalls, 0);
      assert.equal(actual.isCurrent(), true);
      assert.equal(currentCalls, 1);
    });
    for (const error of [new Error("load failed"), "publication failed"]) check("caught task failure", () => {
      let calls = 0;
      const actual = CapabilityPluginResult.fromTask(() => { calls += 1; throw error; });
      assert.equal(calls, 1);
      assert.equal(actual.status, "unavailable");
      assert.deepEqual(actual.plugins, []);
      assert.equal(actual.isCurrent(), false);
    });
    const missing = path.join(root, "tsconfig.json");
    check("actual missing explicit config cause", () => {
      assert.equal(fs.existsSync(missing), false);
      assert.throws(
        () => readProjectConfig({ cwd: root, tsconfig: missing }),
        (error: unknown) => error instanceof Error && error.message === `ttsc: tsconfig not found: ${missing}`,
      );
    });
    for (const capability of ["graphNodes", "aCapabilityNoPluginDeclares"]) check(`missing project caught policy/${capability}`, () => {
      let calls = 0;
      const actual = CapabilityPluginResult.fromTask(() => {
        calls += 1;
        readProjectConfig({ cwd: root, tsconfig: missing });
        return { status: "resolved", isCurrent: () => false, plugins: CapabilityPluginResult.select(selection, capability) };
      });
      assert.equal(calls, 1);
      assert.equal(actual.status, "unavailable");
      assert.deepEqual(actual.plugins, []);
      assert.equal(actual.isCurrent(), false);
      assert.equal(fs.existsSync(missing), false);
    });
  } finally {
    check("owned root cleanup", () => fs.rmSync(root, { recursive: true, force: true }));
  }
  if (failures.length !== 0) throw new AggregateError(failures, "capability result policy failures");
}

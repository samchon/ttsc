import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { CommonJsRuntimeSource } from "../../../../../packages/ttsc/src/launcher/internal/runtime/CommonJsRuntimeSource";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies prepared CommonJS keeps star-helper execution and inert text intact.
 *
 * Export metadata cannot change a helper's conditional execution or discard
 * properties the actual helper exports, including computed runtime names.
 *
 * 1. Evaluate all executable scope shapes against one immutable JavaScript fixture.
 * 2. Evaluate false conditions whose dependency throws, plus helper-shaped string data.
 * 3. Compare prepared execution with unmodified native execution and literal results.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls authored CommonJsRuntimeSource.prepare and executes its returned body through vm.compileFunction; assertions observe star exports, computed values, conditional execution and exact inert text.
 * @evidence contracts/testing.md#independent-expectations Unmodified native vm execution is the reference; literal actual 17 and computed 42 fixture values additionally rule out two equally empty results, while false-branch dependencies deliberately throw if executed.
 * @evidence contracts/testing.md#distinguishing-cases Top/block/IIFE/static scopes, regex backtick and division retain actual exports; false unbraced conditions do not execute their throwing dependency and inline/member helper templates retain exact text without loading ghost modules.
 * @evidence contracts/testing.md#execution-ownership This named source unit calls the actual adapter in the test process using native JavaScript fixture modules; no product host, consumer installation or native compiler build executes, and the three fixture modules loaded through the native require are deleted from its cache in a finally block. The fixtures are written to a TestProject.createProject directory.
 */
export function test_commonjs_preparation_preserves_star_helper_execution_and_inert_text(): void {
  const root = TestProject.createProject({
    "package.json": '{"type":"commonjs"}',
    "nested.cjs": 'exports.actual = 17; exports["dyn" + "amic"] = 42;',
    "hidden.cjs": 'throw new Error("must-not-execute");',
    "ghost.cjs": 'throw new Error("inert text executed");',
  });
  const filename = path.join(root, "consumer.cjs");
  const native = createRequire(filename);
  const helper = 'function __exportStar(value, target) { for (const key of Object.keys(value)) if (key !== "default" && !(key in target)) Object.defineProperty(target, key, { enumerable: true, get: () => value[key] }); } const tslib_1 = { __exportStar };';
  const execute = (source: string): Record<string, unknown> => {
    const module = { exports: {} as Record<string, unknown> };
    vm.compileFunction(source, ["exports", "require", "module", "__filename", "__dirname"], { filename })(module.exports, native, module, filename, root);
    return module.exports;
  };
  const failures: Error[] = [];
  const check = (label: string, source: string, expected: Record<string, unknown>) => {
    try {
      const reference = execute(source);
      assert.deepEqual(reference, expected, label + " native reference");
      assert.deepEqual(execute(CommonJsRuntimeSource.prepare(source, filename)), reference, label + " prepared");
    } catch (error) {
      failures.push(new Error(label, { cause: error }));
    }
  };
  try {
    for (const name of ["__exportStar", "tslib_1.__exportStar"]) {
      const call = name + '(require("./nested.cjs"), exports);';
      for (const [scope, body] of [
        ["top", call],
        ["block", "if(true){" + call + "}"],
        ["iife", "(function(){" + call + "})();"],
        ["class", "class ExportScope { static {" + call + "} }"],
      ]) {
        for (const prefix of ["", "const marker = /`/;", "const ratio = 8 / 2 / 2;"])
          check(name + "/" + scope + "/" + prefix, helper + prefix + body, { actual: 17, dynamic: 42 });
      }
      const text = "\n" + name + '(require("./ghost.cjs"), exports);\n';
      check(name + "/template", helper + "exports.text = `" + text + "`;", { text });
      check(name + "/false", helper + "exports.actual=17;if(false) " + name + '(require("./hidden.cjs"), exports);', { actual: 17 });
    }
  } finally {
    for (const file of ["nested.cjs", "hidden.cjs", "ghost.cjs"])
      delete native.cache[path.join(root, file)];
  }
  if (failures.length)
    throw new AggregateError(failures, "CommonJS preparation changed helper execution");
}

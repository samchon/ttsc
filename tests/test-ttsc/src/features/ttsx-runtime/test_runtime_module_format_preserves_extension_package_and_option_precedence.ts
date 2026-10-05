import assert from "node:assert/strict";
import path from "node:path";

import { RuntimeModuleFormat } from "../../../../../packages/ttsc/src/launcher/internal/runtime/RuntimeModuleFormat";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies module format follows extension, dependency scope and emit options.
 *
 * This test checks the classification precedence on manifests written to a
 * temporary directory, without compiling a project for every manifest or option
 * spelling.
 *
 * 1. Create module, CommonJS, silent and malformed nearest package scopes.
 * 2. Classify extensions and owning module/target decisions directly.
 * 3. Assert exact formats, including dependency overrides and their negative twin.
 *
 * @evidence contracts/testing.md#behavioral-verification The authored moduleFormat function reads actual fixture package scopes and returns formats for extension, compiler-option and package-precedence branches.
 * @evidence contracts/testing.md#independent-expectations Explicit .mts/.cts extensions and Node package type determine their contracted formats; upstream compiler emit precedence establishes preserve, node-family, target-derived and dependency override expectations independently of classifier output.
 * @evidence contracts/testing.md#distinguishing-cases Module/commonjs/missing/malformed package types, both authoritative extensions, preserve versus commonjs, all node-family kinds, implicit targets, literal node_modules versus miscased directory, explicit versus silent dependency types and null ownership cover adjacent policy branches.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/ttsx-runtime; it calls RuntimeModuleFormat.moduleFormat over package.json manifests written by TestProject.createProject, which the classifier reads as resolver input. No compiler, emit or Node module hook runs.
 */
export function test_runtime_module_format_preserves_extension_package_and_option_precedence() {
  const root = TestProject.createProject({
    "module/package.json": '{"type":"module"}',
    "commonjs/package.json": '{"type":"commonjs"}',
    "silent/package.json": "{}",
    "malformed/package.json": "{",
    "node_modules/cjs/package.json": '{"type":"commonjs"}',
    "node_modules/esm/package.json": '{"type":"module"}',
    "node_modules/silent/package.json": "{}",
    "Node_Modules/cjs/package.json": '{"type":"commonjs"}',
  });
  const format = (
    scope: string,
    filename: string,
    options: { module?: string; target?: string } | null,
  ) =>
    RuntimeModuleFormat.moduleFormat(path.join(root, scope, filename), options);
  for (const scope of ["module", "commonjs", "silent", "malformed"]) {
    assert.equal(
      format(scope, "main.mts", { module: "commonjs" }),
      "module",
      scope,
    );
    assert.equal(
      format(scope, "main.cts", { module: "esnext" }),
      "commonjs",
      scope,
    );
    assert.equal(format(scope, "main.mjs", null), "module", scope);
    assert.equal(format(scope, "main.cjs", null), "commonjs", scope);
    assert.equal(
      format(scope, "main.ts", { module: "preserve" }),
      "module",
      scope,
    );
    assert.equal(
      format(scope, "main.ts", { module: "commonjs" }),
      "commonjs",
      scope,
    );
    for (const target of [undefined, "es6", "ES2019", "es2022", "ESNext"]) {
      assert.equal(
        format(scope, "main.ts", { target }),
        "module",
        scope + String(target),
      );
      assert.equal(
        format(scope, "main.ts", { module: "none", target }),
        "module",
        scope + String(target),
      );
    }
    for (const module of ["node16", "node18", "node20", "nodenext"]) {
      assert.equal(
        format(scope, "main.ts", { module }),
        scope === "module" ? "module" : "commonjs",
        scope + module,
      );
    }
    assert.equal(
      format(scope, "main.ts", null),
      scope === "module" ? "module" : "commonjs",
      scope,
    );
  }
  assert.equal(
    format("node_modules/cjs", "main.ts", { module: "esnext" }),
    "commonjs",
  );
  assert.equal(
    format("node_modules/esm", "main.ts", { module: "commonjs" }),
    "module",
  );
  assert.equal(
    format("node_modules/silent", "main.ts", { module: "esnext" }),
    "module",
  );
  assert.equal(
    format("Node_Modules/cjs", "main.ts", { module: "esnext" }),
    "module",
  );
  assert.equal(
    format("node_modules/cjs", "main.mts", { module: "commonjs" }),
    "module",
  );
  assert.equal(
    format("node_modules/esm", "main.cts", { module: "esnext" }),
    "commonjs",
  );
}

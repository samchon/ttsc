import { TestProject } from "@ttsc/testing";

import {
  TtscCompiler,
  assert,
  expectArrayValue,
  expectRecordValue,
  fs,
  os,
  path,
  tsgo,
  writeBasicProject,
  writePackageCompilerPlugin,
} from "../../internal/compiler";

/**
 * Verifies TtscCompiler.compile discovers package plugins from an ancestor
 * package.json.
 *
 * Plugin auto-discovery walks up from `cwd` to find the nearest `package.json`
 * carrying `ttsc.plugins`. When the project lives under a monorepo workspace
 * root that has no `package.json` of its own, the workspace-root plugins must
 * still apply. Pins the ancestor-walk so workspace-level plugin declarations
 * reach nested packages through `compile()`.
 *
 * 1. Create a workspace root with `ttsc.plugins` and a nested `packages/app`
 *    project.
 * 2. Construct a TtscCompiler with `cwd` pointing at the nested project.
 * 3. Call `compile()` and assert the workspace-level plugin was applied.
 *
 * @evidence contracts/testing.md#behavioral-verification Compiles a nested packages/app project and requires PLUGIN JavaScript from its ancestor manifest with no project dist.
 * @evidence contracts/testing.md#independent-expectations The workspace manifest declares the uppercasing fixture; the child has no package manifest, so upward discovery must reach the workspace-owned declaration.
 * @evidence contracts/testing.md#distinguishing-cases This ancestor positive complements the same-directory discovery case and the nearest-empty-manifest negative; source retains a declared goUpper symbol for valid typing.
 * @evidence contracts/testing.md#execution-ownership The exported feature executes real contributor assembly and TtscCompiler.compile under TestExecutor.
 * @evidence contracts/e2e.md#necessary-boundary Actual upward package resolution must deliver a Go contributor to native compilation from a nested cwd; a resolver-only unit does not prove transformed output crosses the API.
 * @evidence contracts/e2e.md#shared-execution The shared immutable compiler contributor and keyed plugin cache avoid another source producer; this nested project uses one compile process for output and no-publication checks.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fresh TestProject workspace contains both manifest owner and nested child, preventing ambient repository manifests from determining discovery; registered workspace cleanup happens at suite exit.
 * @evidence contracts/e2e.md#preserved-coverage The original success, PLUGIN output and absent nested dist remain. The nearest-manifest case retains the complementary stop condition.
 */
export const test_ttsccompiler_compile_discovers_package_plugins_from_ancestor_package_json =
  () => {
    const workspace = TestProject.tmpdir("ttsc-workspace-");
    const project = path.join(workspace, "packages", "app");
    writeBasicProject(
      project,
      'declare function goUpper(value: string): string;\nexport const value = goUpper("plugin");\nconsole.log(value);\n',
    );
    writePackageCompilerPlugin(workspace, "compile-fixture");
    const compiler = new TtscCompiler({ binary: tsgo, cwd: project });

    const result = compiler.compile();

    assert.equal(result.type, "success");
    assert.match(expectRecordValue(result.output, "dist/main.js"), /PLUGIN/);
    assert.equal(fs.existsSync(path.join(project, "dist")), false);
  };

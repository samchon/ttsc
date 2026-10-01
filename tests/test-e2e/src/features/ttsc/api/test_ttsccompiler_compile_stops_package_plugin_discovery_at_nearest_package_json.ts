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
} from "../../../internal/ttsc/internal/compiler";

/**
 * Verifies TtscCompiler.compile stops package plugin discovery at the nearest
 * package.json.
 *
 * Plugin auto-discovery must not cross an intervening `package.json` boundary.
 * When the project's own `package.json` carries no `ttsc.plugins`, the search
 * must stop there even if an ancestor has plugins — otherwise a nested package
 * would silently inherit transformations it never declared. Pins the discovery
 * boundary so packages that opt out by having their own `package.json` are
 * isolated from ancestor-level plugins.
 *
 * 1. Create a workspace root with `ttsc.plugins` and a nested project with its own
 *    (empty) `package.json`.
 * 2. Construct a TtscCompiler with `cwd` pointing at the nested project.
 * 3. Call `compile()` and assert the workspace plugin was NOT applied.
 *
 * @evidence contracts/testing.md#behavioral-verification Compiles packages/app beneath a plugin-enabled workspace but with its own empty package manifest; checks unchanged goUpper("plugin"), absence of PLUGIN and no dist.
 * @evidence contracts/testing.md#independent-expectations The nearest-package ownership contract stops upward discovery at the child manifest even when its plugin list is absent; literal call text is authored fixture input.
 * @evidence contracts/testing.md#distinguishing-cases The nearby empty manifest is the negative twin of ancestor discovery, distinguishing no plugin application from an accidentally inherited contributor.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this named native compile API feature with its own nested project.
 * @evidence contracts/e2e.md#necessary-boundary The loaded native project must honor the JavaScript manifest boundary before plugin assembly; returned unchanged JavaScript proves the boundary reaches actual compilation.
 * @evidence contracts/e2e.md#shared-execution One compile checks both unchanged call and forbidden uppercase literal. The helper may materialize the ancestor contributor, but the child must not build or execute it.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A fresh registered workspace owns ancestor and child manifests, keeping discovery state private; synchronous compile completes before observations and suite exit removes the workspace.
 * @evidence contracts/e2e.md#preserved-coverage All original success, unchanged-call, absent-PLUGIN and no-dist assertions remain, with the ancestor-positive entry owning the complementary transformation.
 */
export const test_ttsccompiler_compile_stops_package_plugin_discovery_at_nearest_package_json =
  () => {
    const workspace = TestProject.tmpdir("ttsc-workspace-");
    const project = path.join(workspace, "packages", "app");
    writeBasicProject(
      project,
      'declare function goUpper(value: string): string;\nexport const value = goUpper("plugin");\nconsole.log(value);\n',
    );
    writePackageCompilerPlugin(workspace, "compile-fixture");
    fs.writeFileSync(
      path.join(project, "package.json"),
      JSON.stringify({ private: true }),
      "utf8",
    );
    const compiler = new TtscCompiler({ binary: tsgo, cwd: project });

    const result = compiler.compile();

    assert.equal(result.type, "success");
    assert.match(
      expectRecordValue(result.output, "dist/main.js"),
      /goUpper\("plugin"\)/,
    );
    assert.doesNotMatch(
      expectRecordValue(result.output, "dist/main.js"),
      /PLUGIN/,
    );
    assert.equal(fs.existsSync(path.join(project, "dist")), false);
  };

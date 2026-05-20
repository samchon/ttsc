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

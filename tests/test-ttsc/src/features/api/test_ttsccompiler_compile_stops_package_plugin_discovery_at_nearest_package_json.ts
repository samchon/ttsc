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

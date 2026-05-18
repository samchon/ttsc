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
 * Verifies TtscCompiler.compile stops package plugin discovery at nearest
 * package.json.
 *
 * This ttsc API scenario is owned by a tests package instead of the production
 * package manifest, so package.json stays focused on build and publish
 * contracts while the feature file documents the behavior under test.
 *
 * 1. Prepare the isolated project, resolver input, or plugin source fixture.
 * 2. Invoke the package API or internal resolver path being pinned.
 * 3. Assert the returned files, diagnostics, cache key, or descriptor contract.
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

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
  writePackageSourcePlugin,
} from "../../internal/compiler";

/**
 * Verifies TtscCompiler.prepare honors projectRoot when tsconfig is outside the
 * project.
 *
 * This ttsc API scenario is owned by a tests package instead of the production
 * package manifest, so package.json stays focused on build and publish
 * contracts while the feature file documents the behavior under test.
 *
 * 1. Prepare the isolated project, resolver input, or plugin source fixture.
 * 2. Invoke the package API or internal resolver path being pinned.
 * 3. Assert the returned files, diagnostics, cache key, or descriptor contract.
 */
export const test_ttsccompiler_prepare_honors_projectroot_when_tsconfig_is_outside_the_project =
  () => {
    const root = TestProject.tmpdir("ttsc-compiler-api-");
    const project = path.join(root, "project");
    const config = path.join(root, "config");
    fs.mkdirSync(project, { recursive: true });
    fs.mkdirSync(config, { recursive: true });
    fs.writeFileSync(
      path.join(project, "package.json"),
      JSON.stringify({
        private: true,
        devDependencies: {
          "prepare-fixture": "0.0.0",
        },
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(config, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
        },
      }),
      "utf8",
    );
    writePackageSourcePlugin(project, "prepare-fixture");
    const cacheDir = path.join(project, ".cache", "ttsc");
    const compiler = new TtscCompiler({
      binary: tsgo,
      cacheDir,
      cwd: root,
      projectRoot: "project",
      tsconfig: "config/tsconfig.json",
    });

    const prepared = compiler.prepare();

    assert.equal(prepared.length, 1);
    assert.equal(fs.existsSync(expectArrayValue(prepared, 0)), true);
    assert.equal(
      expectArrayValue(prepared, 0).startsWith(path.join(cacheDir, "plugins")),
      true,
    );
  };

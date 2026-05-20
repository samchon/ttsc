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
 * Verifies TtscCompiler.prepare honors `projectRoot` when the tsconfig lives
 * outside the project directory.
 *
 * Monorepo setups sometimes keep a shared tsconfig in a sibling `config/`
 * directory while the actual source and `package.json` live in `project/`.
 * Plugin discovery anchors on `projectRoot`, not on `cwd` or the tsconfig
 * directory. Pins the `projectRoot` override so the plugin binary is cached
 * under the project's own `cacheDir` even when the tsconfig resolves
 * elsewhere.
 *
 * 1. Create a `project/` dir with `package.json` and plugin, and a
 *    `config/tsconfig.json`.
 * 2. Construct a TtscCompiler with `projectRoot: "project"` and `tsconfig:
 *    "config/tsconfig.json"`.
 * 3. Call `prepare()` and assert the binary exists under
 *    `project/.cache/ttsc/plugins`.
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

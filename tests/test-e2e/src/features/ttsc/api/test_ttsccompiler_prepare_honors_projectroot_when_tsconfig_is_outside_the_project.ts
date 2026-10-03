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
} from "../../../internal/ttsc/internal/compiler";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Prepares a package-discovered Go plugin with cwd=root, projectRoot=project and tsconfig=config/tsconfig.json; checks its binary exists beneath the project-owned cache.
 * @evidence contracts/testing.md#independent-expectations The explicit projectRoot owns package discovery even when the selected configuration lives in a sibling directory; literal project/cache paths establish the expected location.
 * @evidence contracts/testing.md#distinguishing-cases This split root/config layout differs from ordinary co-located config discovery; its positive assertion catches anchoring package lookup at the external config directory.
 * @evidence contracts/testing.md#execution-ownership The named feature calls the checkout built API via the existing shared subclass and selected native compiler, with explicit projectRoot and cacheDir. Actual package discovery feeds preparation; this is not packed installation or executable image certification.
 * @evidence contracts/e2e.md#necessary-boundary Real package discovery from the overridden root must feed native preparation despite an external tsconfig, which direct path resolution alone cannot establish.
 * @evidence contracts/e2e.md#shared-execution One original prepare supplies count/presence/location assertions. Consolidated execution borrows the API allocation only after prior project/cache inputs are held aside, then creates the same nested project and external config layout. The distinct package-source descriptor and explicit cache remain necessary inputs; actual native builds/processes/Programs are separately observed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Standalone registered ownership remains. Borrowed execution requires an empty root before exact project/package/plugin and sibling config staging, preventing previous project metadata from supplying discovery. Earlier cache artifacts stay in a separate retained sibling; the outer owner retains this fixture too. Direct returns and normal cleanup do not certify interruption or arbitrary descendants.
 * @evidence contracts/e2e.md#preserved-coverage Prepared count, actual binary existence and cache-prefix checks remain. This case does not compile a source file, execute its selected binary, independently validate loaded image/new-build provenance or assert output semantics.
 */
export const test_ttsccompiler_prepare_honors_projectroot_when_tsconfig_is_outside_the_project =
  (preparedRoot?: string) => {
    const root = preparedRoot ?? TestProject.tmpdir("ttsc-compiler-api-");
    if (preparedRoot !== undefined)
      assert.deepEqual(fs.readdirSync(root), [], "borrowed external-config fixture must be empty");
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

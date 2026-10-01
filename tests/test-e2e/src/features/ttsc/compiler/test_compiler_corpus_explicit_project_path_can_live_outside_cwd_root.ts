import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../../internal/ttsc/internal/compiler-corpus";

const project = {
  name: "explicit project path can live outside cwd root",
  root: () =>
    createProject(FixtureFiles.read("ttsc/compiler_corpus_explicit_project_path_can_live_outside_cwd_root/inputs-1")),
  run(root: string) {
    const result = spawn(
      ttscBin,
      ["--cwd", root, "--project", "configs/tsconfig.app.json", "--emit"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      fs
        .readFileSync(path.join(root, "dist", "app", "main.js"), "utf8")
        .includes("explicit-project"),
      true,
    );
  },
};

/**
 * Verifies compiler corpus: `--project` resolves source and output paths
 * relative to a nested config directory.
 *
 * When `--project` is a relative path like `configs/tsconfig.app.json` and the
 * tsconfig's `include` and `rootDir` reference `../src`, the Go compiler must
 * resolve those paths relative to the tsconfig file, not the working directory.
 * Pins the cross-root resolution so monorepo setups that co-locate config files
 * separately from source compile correctly.
 *
 * 1. Create a project with `configs/tsconfig.app.json` that points `rootDir` at
 *    `../src`.
 * 2. Run `ttsc --project configs/tsconfig.app.json --emit`.
 * 3. Assert `dist/app/main.js` is written and contains the expected identifier.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs ttsc with project configs/tsconfig.app.json and emit against a fixture whose config refers to ../src and ../dist/app; asserts success and emitted main.js containing the authored explicit-project literal.
 * @evidence contracts/testing.md#independent-expectations Config-relative rootDir/include/outDir resolve from the config location. The literal source value at dist/app/main.js detects incorrect cwd-relative resolution; this fixture nests the config inside cwd, so its filename does not prove a config physically outside cwd.
 * @evidence contracts/testing.md#distinguishing-cases Owns nested config with parent-relative source/output paths and explicit project selection. It has no physically external config or negative project-selection input.
 * @evidence contracts/testing.md#execution-ownership E2E export test_compiler_corpus_explicit_project_path_can_live_outside_cwd_root is discovered under src/features/compiler by TestExecutor; it owns every local project.run/cases/helper assertion and invokes the built ttsc launcher rather than treating authored configuration as an output.
 * @evidence contracts/e2e.md#necessary-boundary The launcher-selected config must be read by the native compiler with config-relative paths and then written to the expected output tree; a direct path-normalization unit cannot verify this assembly.
 * @evidence contracts/e2e.md#shared-execution One CLI compiler invocation combines config selection, native resolution and output inspection. Built compiler/package preparation is shared, and no plugin compilation is required.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A fresh authored project contains a distinct configs/src/dist layout and unique literal. The synchronous child finishes before output reading and TestProject removes all fixture paths at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Exit success and exact output-location/source-literal checks remain in project.run; the historical entry name is broader than the nested-config fixture, so physical outside-cwd resolution is not claimed.
 */
export const test_compiler_corpus_explicit_project_path_can_live_outside_cwd_root =
  (): void => {
    const root = project.root();
    project.run(root);
  };

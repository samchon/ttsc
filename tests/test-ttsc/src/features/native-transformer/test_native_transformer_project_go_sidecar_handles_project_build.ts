import {
  assert,
  copyProject,
  fs,
  goPath,
  goTransformerSource,
  path,
  runNode,
  spawn,
  ttscBin,
} from "../../internal/native-transformer";

/**
 * Verifies native transformer project: Go sidecar handles project build.
 *
 * This ttsc native transformer scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_native_transformer_project_go_sidecar_handles_project_build =
  () => {
    const root = copyProject("go-native-transformer");
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_GO_TRANSFORMER_SOURCE: goTransformerSource(),
      },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const out = path.join(root, "dist", "main.js");
    const js = fs.readFileSync(out, "utf8");
    assert.match(js, /GO NATIVE TRANSFORMER/);
    const run = runNode(out, { cwd: root });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout.trim(), "GO NATIVE TRANSFORMER");
  };

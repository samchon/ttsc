import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../../internal/ttsc/internal/toolchain";
import { WatchSession } from "../../../internal/ttsc/internal/watch";

/**
 * Verifies positional TSX emit discovers and materializes tsgo's real output
 * extension.
 *
 * Preserve mode emits `.jsx`, while every transform mode emits `.js`. The
 * launcher builds into a private temporary directory before copying exactly one
 * file into the user tree, so both the temporary-file lookup and the final
 * target must agree with the effective `jsx` option.
 *
 * 1. Emit with configured `jsx: preserve` and assert only `view.jsx` appears.
 * 2. Override that config with CLI `--jsx react-native` and assert `view.js`.
 * 3. Override a non-preserve config with CLI `--jsx preserve` and assert
 *    `view.jsx` again.
 * 4. Repeat both override directions under a real watch and assert each compiler
 *    output stays quiet instead of feeding back as an input change.
 *
 * @evidence contracts/testing.md#behavioral-verification Configured preserve emits only jsx; CLI overrides each direction select js/ jsx; two real watch sessions emit adjacent correct extension and stay quiet.
 * @evidence contracts/testing.md#independent-expectations TypeScript JSX output contract fixes preserve=.jsx and react-native=.js; explicit absent alternative and watcher quiet interval expose mismatched lookup or feedback.
 * @evidence contracts/testing.md#distinguishing-cases Configured preserve, both CLI override directions, both watch modes without outDir.
 * @evidence contracts/testing.md#execution-ownership Named E2E test_ttsc_single_file_matches_jsx_output_extensions is discovered under src/features/ttsc/compiler by @ttsc/test-e2e src/index.ts and TestExecutor. It runs the built CLI through actual child processes; private helpers keep the cases and assertions above in this entry.
 * @evidence contracts/e2e.md#necessary-boundary Native extension production, launcher copying and real watcher input filtering must agree across one-shot and watch lifetimes.
 * @evidence contracts/e2e.md#shared-execution One source/project and workspace native binaries serve three one-shot invocations and two sequential watch sessions. Changed JSX config/CLI overrides require their distinct native executions; watchers cannot share opposite effective JSX configurations. Output files are removed between modes.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private root and explicit output removals prevent prior extension results satisfying later assertions. Each WatchSession closes in finally with SIGTERM and bounded SIGKILL fallback; waitForQuiet checks 900ms without new build start/completion. Tracked root ends at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Configured preserve emits only jsx; CLI overrides each direction select js/ jsx; two real watch sessions emit adjacent correct extension and stay quiet. No case is removed or transferred by these acknowledgments; the oracle limitations above remain explicit.
 */
export const test_ttsc_single_file_matches_jsx_output_extensions =
  async (): Promise<void> => {
    const root = createProject({
      "tsconfig.json": config("preserve"),
      "src/view.tsx": [
        "declare global {",
        "  namespace JSX {",
        "    interface IntrinsicElements { div: {}; }",
        "  }",
        "}",
        "export const view = <div />;",
        "",
      ].join("\n"),
    });
    const jsx = path.join(root, "dist", "view.jsx");
    const js = path.join(root, "dist", "view.js");
    const adjacentJsx = path.join(root, "src", "view.jsx");
    const adjacentJs = path.join(root, "src", "view.js");

    const configuredPreserve = spawn(ttscBin, ["--cwd", root, "src/view.tsx"], {
      cwd: root,
    });
    assert.equal(
      configuredPreserve.status,
      0,
      `${configuredPreserve.stdout}${configuredPreserve.stderr}`,
    );
    assert.equal(fs.existsSync(jsx), true, configuredPreserve.stdout);
    assert.equal(fs.existsSync(js), false, configuredPreserve.stdout);

    fs.rmSync(jsx);
    const cliTransform = spawn(
      ttscBin,
      ["--cwd", root, "--jsx", "react-native", "src/view.tsx"],
      { cwd: root },
    );
    assert.equal(
      cliTransform.status,
      0,
      `${cliTransform.stdout}${cliTransform.stderr}`,
    );
    assert.equal(fs.existsSync(js), true, cliTransform.stdout);
    assert.equal(fs.existsSync(jsx), false, cliTransform.stdout);

    fs.rmSync(js);
    fs.writeFileSync(path.join(root, "tsconfig.json"), config("react-native"));
    const cliPreserve = spawn(
      ttscBin,
      ["--cwd", root, "--jsx", "preserve", "src/view.tsx"],
      { cwd: root },
    );
    assert.equal(
      cliPreserve.status,
      0,
      `${cliPreserve.stdout}${cliPreserve.stderr}`,
    );
    assert.equal(fs.existsSync(jsx), true, cliPreserve.stdout);
    assert.equal(fs.existsSync(js), false, cliPreserve.stdout);

    fs.rmSync(jsx);
    fs.writeFileSync(path.join(root, "tsconfig.json"), watchConfig("preserve"));
    const transformWatch = new WatchSession(root, {
      args: ["--jsx", "react-native", "src/view.tsx"],
    });
    try {
      await transformWatch.waitForBuilds(1);
      assert.equal(
        fs.existsSync(adjacentJs),
        true,
        transformWatch.transcript(),
      );
      assert.equal(
        fs.existsSync(adjacentJsx),
        false,
        transformWatch.transcript(),
      );
      await transformWatch.waitForQuiet();
    } finally {
      await transformWatch.close();
    }

    fs.rmSync(adjacentJs);
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      watchConfig("react-native"),
    );
    const preserveWatch = new WatchSession(root, {
      args: ["--jsx", "preserve", "src/view.tsx"],
    });
    try {
      await preserveWatch.waitForBuilds(1);
      assert.equal(
        fs.existsSync(adjacentJsx),
        true,
        preserveWatch.transcript(),
      );
      assert.equal(
        fs.existsSync(adjacentJs),
        false,
        preserveWatch.transcript(),
      );
      await preserveWatch.waitForQuiet();
    } finally {
      await preserveWatch.close();
    }
  };

function config(jsx: "preserve" | "react-native"): string {
  return JSON.stringify({
    compilerOptions: {
      jsx,
      module: "commonjs",
      outDir: "dist",
      rootDir: "src",
      strict: true,
      target: "ES2022",
    },
    include: ["src"],
  });
}

function watchConfig(jsx: "preserve" | "react-native"): string {
  return JSON.stringify({
    compilerOptions: {
      jsx,
      module: "commonjs",
      rootDir: "src",
      strict: true,
      target: "ES2022",
    },
    include: ["src"],
  });
}

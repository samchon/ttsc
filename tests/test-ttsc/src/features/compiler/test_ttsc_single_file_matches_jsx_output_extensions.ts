import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/toolchain";
import { WatchSession } from "../../internal/watch";

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

import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies the `--build` refusal claims only `--build` / `-b`.
 *
 * The launcher resolves a flag by identity — dashes stripped, lower-cased — so
 * a refusal keyed on that identity is one normalization away from swallowing
 * every neighbouring spelling: the dash-less `build` subcommand, an unknown
 * flag that merely starts with the same letters, and the schema's own
 * build-named passthrough flag with its value token. Each of those must keep
 * the behaviour it had before ttsc learned to refuse solution mode.
 *
 * 1. Materialize a single-project fixture that emits into `dist`.
 * 2. Run the bare `build` subcommand, an unknown `--buildish` flag, and
 *    `--incremental --tsBuildInfoFile <path>`.
 * 3. Assert the subcommand and the forwarded pair still build, `--buildish`
 *    still reaches tsgo's unknown-option diagnostic, and none of the three
 *    prints ttsc's solution-mode refusal.
 */
export const test_ttsc_build_refusal_does_not_over_match_neighboring_arguments =
  () => {
    const root = createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "src/main.ts": `export const value = 1;\n`,
    });

    const subcommand = spawn(ttscBin, ["build", "--cwd", root], { cwd: root });
    assert.equal(
      subcommand.status,
      0,
      `${subcommand.stdout}${subcommand.stderr}`,
    );
    assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), true);
    assert.doesNotMatch(subcommand.stderr, /solution mode/);

    const forwarded = spawn(
      ttscBin,
      [
        "--cwd",
        root,
        "--incremental",
        "--tsBuildInfoFile",
        "dist/app.tsbuildinfo",
      ],
      { cwd: root },
    );
    assert.equal(forwarded.status, 0, `${forwarded.stdout}${forwarded.stderr}`);
    assert.doesNotMatch(forwarded.stderr, /solution mode/);

    const unknown = spawn(ttscBin, ["--cwd", root, "--buildish"], {
      cwd: root,
    });
    const unknownOutput = `${unknown.stdout}${unknown.stderr}`;
    assert.notEqual(unknown.status, 0);
    assert.match(unknownOutput, /buildish/i);
    assert.doesNotMatch(unknownOutput, /solution mode/);
  };

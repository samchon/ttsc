import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies `ttsc --pretty <file>.ts` stays in single-file mode.
 *
 * `--pretty` is a boolean upstream, but the schema declared it value-taking, so
 * the forwarding path removed the following token from `positional` on its
 * behalf. The visible failure is a _lane switch_ before it is an error: with no
 * input file left, the launcher fell into project mode, added `-p`, and tsgo
 * rejected the mix with TS5042. A parser-level assertion cannot see that, so
 * this case drives the real launcher.
 *
 * 1. Create a project and a source file.
 * 2. Run `ttsc --pretty src/main.ts`.
 * 3. Assert a zero exit, no TS5042, and the single-file emit on disk.
 */
export const test_ttsc_single_file_mode_survives_a_forwarded_pretty_flag =
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
      "src/main.ts": `export const value: string = "pretty";\n`,
    });

    const result = spawn(ttscBin, ["--cwd", root, "--pretty", "src/main.ts"], {
      cwd: root,
    });
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    assert.equal(
      /TS5042/.test(`${result.stdout}${result.stderr}`),
      false,
      `the run must stay in single-file mode:\n${result.stdout}${result.stderr}`,
    );
    assert.equal(
      fs.existsSync(path.join(root, "dist", "main.js")),
      true,
      `${result.stdout}${result.stderr}`,
    );
  };

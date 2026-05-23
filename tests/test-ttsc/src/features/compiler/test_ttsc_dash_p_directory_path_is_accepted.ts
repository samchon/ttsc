import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies `ttsc -p &lt;directory&gt;` accepts a bare directory path (RC-3).
 *
 * tsgo's own `-p` accepts either a tsconfig file path or the directory that
 * contains one; the directory form is the documented shorthand for a project
 * subfolder. Before the flag-schema cutover, ttsc's launcher classified a
 * `-p` value through `isBuildAlias` and only accepted `.json/.ts/.tsx/...`
 * extensions, so `ttsc -p packages/foo` exited 2 with "unknown command" even
 * though `tsgo -p packages/foo` would have worked. The schema's `--tsconfig`
 * entry no longer constrains the value to an extension list, so the
 * launcher hands the directory to tsgo which finds the tsconfig.
 *
 * 1. Create a project where the tsconfig lives in a subdirectory.
 * 2. Run `ttsc -p &lt;subdir&gt; --noEmit` from outside that subdirectory.
 * 3. Assert zero exit and no "unknown" error in stderr.
 */
export const test_ttsc_dash_p_directory_path_is_accepted = () => {
  const root = createProject({
    "sub/tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        noEmit: true,
        rootDir: ".",
      },
      include: ["main.ts"],
    }),
    "sub/main.ts": `export const x: number = 1;\n`,
  });

  const result = spawn(ttscBin, ["--cwd", root, "-p", "sub", "--noEmit"], {
    cwd: root,
  });

  assert.equal(
    result.status,
    0,
    `stderr=${result.stderr}\nstdout=${result.stdout}`,
  );
  assert.doesNotMatch(
    `${result.stdout}${result.stderr}`,
    /unknown (command|option)/i,
  );
};

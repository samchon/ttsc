import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies ttsc rejects the `transform` command as unsupported.
 *
 * `transform` was a sub-command in earlier CLI drafts but was removed before
 * the public release. Pins that a user who types `ttsc transform` receives a
 * clear "unknown command" error rather than being silently treated as a project
 * path or falling through to the default build action.
 *
 * 1. Create a project with a valid TypeScript source file.
 * 2. Run `ttsc transform --cwd <root>`.
 * 3. Assert non-zero exit and an `unknown command "transform"` message on stderr.
 */
export const test_ttsc_rejects_unsupported_transform_command = () => {
  const root = createProject({
    "jsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "src/main.ts": `export const answer: number = 42;\n`,
  });

  const result = spawn(ttscBin, ["transform", "--cwd", root], { cwd: root });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown command "transform"/);
};

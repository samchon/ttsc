import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies ttsc rejects `format` combined with --watch.
 *
 * Watch mode rebuilds on file changes, so combining it with a one-shot
 * source-rewriting pass would loop the watcher against its own edits. The
 * launcher refuses the combination before any plugin spawns; this test pins
 * the user-facing error message and exit path. Mirrors the `fix --watch`
 * rejection so any future relaxation of one constraint visibly diverges from
 * the other.
 *
 * 1. Materialize a minimal tsconfig project.
 * 2. Run `ttsc format --watch` through the real launcher.
 * 3. Assert non-zero exit and the documented refusal message on stderr.
 */
export const test_ttsc_rejects_format_with_watch_mode = () => {
  const root = createProject({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
        noEmit: true,
      },
      include: ["src"],
    }),
    "src/main.ts": `export const value = 1;\n`,
  });

  const result = spawn(ttscBin, ["format", "--watch", "--cwd", root], {
    cwd: root,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /format does not support watch mode/);
};

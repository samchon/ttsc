import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies a forwarded `--listEmittedFiles` flag surfaces tsgo's file listing.
 *
 * Ttsc adds `--listEmittedFiles` to its own internal tsgo calls to learn the
 * emitted paths, then strips the resulting `TSFILE:` lines back out as noise.
 * That strip must not also eat the listing when the _user_ forwarded the flag —
 * otherwise `ttsc --listEmittedFiles` would print nothing at all.
 *
 * 1. Create a minimal project.
 * 2. Run `ttsc --emit --listEmittedFiles`.
 * 3. Assert a zero exit and a `TSFILE:` listing line in stdout.
 */
export const test_ttsc_listemittedfiles_flag_surfaces_emitted_paths = () => {
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
    "src/main.ts": `export const value: string = "listed";\n`,
  });

  const result = spawn(
    ttscBin,
    ["--cwd", root, "--emit", "--listEmittedFiles"],
    { cwd: root },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /TSFILE:.*main\.js/);
};

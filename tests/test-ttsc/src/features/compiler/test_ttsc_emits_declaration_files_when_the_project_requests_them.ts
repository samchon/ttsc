import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies ttsc emits declaration files when the project requests them.
 *
 * Pins the `declaration: true` contract through the real launcher binary. Both
 * `dist/main.js` and `dist/main.d.ts` must be written when the tsconfig enables
 * declarations. Validates that the default (no `--emit` flag) command surface
 * still respects the tsconfig-level declaration option without requiring an
 * extra CLI flag.
 *
 * 1. Create a project with `declaration: true` in tsconfig.
 * 2. Run `ttsc --cwd <root>` (no extra flags).
 * 3. Assert both `dist/main.js` and `dist/main.d.ts` exist on disk.
 */
export const test_ttsc_emits_declaration_files_when_the_project_requests_them =
  () => {
    const root = createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          declaration: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "src/main.ts": `export interface Box<T> { value: T }\nexport const box = <T>(value: T): Box<T> => ({ value });\n`,
    });

    const result = spawn(ttscBin, ["--cwd", root], { cwd: root });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), true);
    assert.equal(fs.existsSync(path.join(root, "dist", "main.d.ts")), true);
  };

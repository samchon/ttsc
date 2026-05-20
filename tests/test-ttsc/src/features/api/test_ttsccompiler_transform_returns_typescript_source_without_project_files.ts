import {
  TtscCompiler,
  assert,
  createProject,
  expectArrayValue,
  expectRecordValue,
  fs,
  path,
  tsgo,
} from "../../internal/compiler";

/**
 * Verifies TtscCompiler.transform returns TypeScript source without project
 * files.
 *
 * `transform()` is the source-only twin of `compile()`. It must return the
 * original (or plugin-modified) `.ts` content and must never write `.js`,
 * `.d.ts`, or any other output to disk. Pins the basic no-plugin path so the
 * minimum viable use-case — read a project's TypeScript into memory — works
 * before any plugin is involved.
 *
 * 1. Create a minimal project with no plugins.
 * 2. Call `transform()` via the programmatic API.
 * 3. Assert the typescript map contains the source and no JS/declaration keys
 *    exist.
 */
export const test_ttsccompiler_transform_returns_typescript_source_without_project_files =
  () => {
    const root = createProject();
    const compiler = new TtscCompiler({
      binary: tsgo,
      cwd: root,
      plugins: false,
    });

    const result = compiler.transform();

    assert.equal(result.type, "success");
    assert.match(
      expectRecordValue(result.typescript, "src/main.ts"),
      /const message: string = "api-ok"/,
    );
    assert.match(
      expectRecordValue(result.typescript, "src/main.ts"),
      /console\.log\(\s*message\s*\)/,
    );
    assert.equal(result.typescript["dist/main.js"], undefined);
    assert.equal(result.typescript["dist/main.d.ts"], undefined);
    assert.equal(fs.existsSync(path.join(root, "dist")), false);
  };

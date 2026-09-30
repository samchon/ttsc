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
 * @evidence contracts/testing.md#behavioral-verification Calls transform and asserts the authored typed declaration and console call in src/main.ts, no JavaScript or declaration output keys and no dist directory.
 * @evidence contracts/testing.md#independent-expectations createProject authors the api-ok TypeScript fixture independently; source-only transform preserves that spelling rather than producing emitted JavaScript or declaration artifacts.
 * @evidence contracts/testing.md#distinguishing-cases The no-plugin singleton source pins the minimum source-only path and both forbidden emit-key forms. Multi-file membership and plugin-changed sources are owned by adjacent transform entries.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers the exported API feature and invokes the real native transform through TtscCompiler; this is not an in-memory decoder unit.
 * @evidence contracts/e2e.md#necessary-boundary The real native source envelope must arrive through the JavaScript API without entering disk emit. Direct parser calls cannot verify mode selection, producer output or publication behavior.
 * @evidence contracts/e2e.md#shared-execution One transform process supplies all source and absence checks; plugins are disabled, while package build and tsgo resolution are shared by the API suite.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A fresh registered createProject directory supplies a known source and initially absent dist. Synchronous transform finishes its child before assertions; TestProject removes its registered fixture at suite exit.
 * @evidence contracts/e2e.md#preserved-coverage Both source snippets, success, absent main.js/main.d.ts keys and absent dist stay executable in this entry. It does not claim exact full source equality or source-map correctness.
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

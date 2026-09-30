import {
  assert,
  commonJsProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/compiler-corpus";

const project = {
  name: "emitDeclarationOnly writes declarations without JavaScript",
  root: () =>
    commonJsProject(
      {
        "src/main.ts": `export type Pair = [string, number];\nexport interface Bag { pair: Pair }\n`,
      },
      {
        compilerOptions: {
          declaration: true,
          emitDeclarationOnly: true,
        },
      },
    ),
  run(root: string) {
    const result = spawn(ttscBin, ["--cwd", root], { cwd: root });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(path.join(root, "dist", "main.d.ts")), true);
    assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
  },
};

/**
 * Verifies compiler corpus: `emitDeclarationOnly` writes `.d.ts` files and
 * suppresses JavaScript output.
 *
 * Library packages often enable `emitDeclarationOnly` to produce type
 * declarations from a separate bundler pass. Pins the contract that the Go
 * compiler respects this flag end-to-end through the ttsc CLI: the `.d.ts` must
 * appear on disk while no `.js` file is written, even when the project
 * otherwise has a configured `outDir`.
 *
 * 1. Create a project with `emitDeclarationOnly: true` and a type-heavy source
 *    file.
 * 2. Run `ttsc --cwd <root>`.
 * 3. Assert `dist/main.d.ts` exists and `dist/main.js` does not.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs project-mode ttsc on a Pair/Bag type fixture with declaration and emitDeclarationOnly enabled; asserts successful exit, dist/main.d.ts presence and dist/main.js absence.
 * @evidence contracts/testing.md#independent-expectations emitDeclarationOnly emits declarations while suppressing JavaScript by TypeScript compiler contract. Independently named output paths supply the existence oracle; declaration contents and type fidelity are not inspected.
 * @evidence contracts/testing.md#distinguishing-cases Owns the positive declaration-only mode and the paired negative JavaScript output at a configured outDir. Ordinary emit/noEmit and diagnostic gating have complementary entries.
 * @evidence contracts/testing.md#execution-ownership E2E export test_compiler_corpus_emitdeclarationonly_writes_declarations_without_javascript is discovered under src/features/compiler by TestExecutor; it owns every local project.run/cases/helper assertion and invokes the built ttsc launcher rather than treating authored configuration as an output.
 * @evidence contracts/e2e.md#necessary-boundary The launcher must forward declaration-only options to the real Go compiler and write its selected output artifacts; direct option units cannot establish producer/write integration.
 * @evidence contracts/e2e.md#shared-execution One project compiler process jointly verifies declaration production and JavaScript suppression. Existing native compiler and built packages are shared; no Go plugin binary is built for this type-only fixture.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fresh project/output tree prevents a stale declaration from satisfying the positive assertion. The synchronous CLI is joined before inspection and TestProject removes sources/outputs at exit.
 * @evidence contracts/e2e.md#preserved-coverage Both artifact existence/absence assertions remain in project.run under this exported owner. No declaration semantic-content assertion is implied by a green presence check.
 */
export const test_compiler_corpus_emitdeclarationonly_writes_declarations_without_javascript =
  (): void => {
    const root = project.root();
    project.run(root);
  };

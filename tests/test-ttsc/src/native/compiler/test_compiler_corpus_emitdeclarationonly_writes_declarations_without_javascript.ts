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
 */
export const test_compiler_corpus_emitdeclarationonly_writes_declarations_without_javascript =
  (): void => {
    const root = project.root();
    project.run(root);
  };

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
 * Verifies compiler corpus: emitDeclarationOnly writes declarations without
 * JavaScript.
 *
 * This ttsc compiler corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_compiler_corpus_emitdeclarationonly_writes_declarations_without_javascript =
  (): void => {
    const root = project.root();
    project.run(root);
  };

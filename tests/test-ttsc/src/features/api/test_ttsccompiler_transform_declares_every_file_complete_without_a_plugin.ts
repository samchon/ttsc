import {
  TtscCompiler,
  assert,
  createProject,
  tsgo,
} from "../../internal/compiler";

/**
 * Verifies the host declares every file's inputs complete when no plugin can
 * contribute to them.
 *
 * The rule behind samchon/ttsc#1259: ttsc's own source-to-source transform is
 * syntactic — this lane answers with each file's parsed text and never runs the
 * emit transformer chain — so an output the host alone produced is a function
 * of that file's own text and the compiler options. Without the declaration a
 * consumer must keep revalidating each file's whole reference closure to learn
 * what cannot have changed.
 *
 * 1. Create a plugin-free project whose entry imports a second module.
 * 2. Call `transform()` via the programmatic API.
 * 3. Assert both files are declared complete and that nothing was reported as a
 *    dependency of either.
 */
export const test_ttsccompiler_transform_declares_every_file_complete_without_a_plugin =
  () => {
    const root = createProject({
      files: {
        "src/types.ts": "export interface Model {\n  id: string;\n}\n",
      },
      source:
        'import type { Model } from "./types";\n\nexport const value: string = ({ id: "x" } satisfies Model).id;\n',
    });
    const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

    const result = compiler.transform();

    assert.equal(result.type, "success");
    assert.deepEqual(result.dependenciesComplete, [
      "src/main.ts",
      "src/types.ts",
    ]);
    assert.equal(result.dependencies, undefined);
  };

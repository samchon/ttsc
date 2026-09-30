import { TestProject } from "../../../../utils/src/TestProject";

import { assert, fs, path, readProjectConfig } from "../../internal/project-unit";

/**
 * Verifies a child tsconfig's `outDir: null` resets an inherited output
 * directory.
 *
 * TypeScript-Go reads `null` as a reset, so a child that extends a base with
 * `outDir` and declares `outDir: null` has no output directory. ttsc tracked
 * `outDir` beside the merged options and kept the base value unless the child
 * declared a string, so it resurrected a directory the compiler's effective
 * config does not contain. An omitted child `outDir` must still inherit, and a
 * later `extends` array entry's reset must win over an earlier one's value.
 *
 * 1. Create a base with `outDir`, a child resetting it, and a sibling child that
 *    omits it.
 * 2. Create an array-extends child whose later entry resets the value.
 * 3. Assert the resets read as unset and the omission inherits the base value.
 *
 * @evidence contracts/testing.md#behavioral-verification Reads child null, child omission and a later array null reset, distinguishing explicit unset from accidental inheritance.
 * @evidence contracts/testing.md#independent-expectations Null reset and omission have different tsconfig meanings: the authored base-output directory is inherited only when the child omits outDir.
 * @evidence contracts/testing.md#distinguishing-cases Direct null and later-array null yield undefined; an otherwise equivalent omitted child retains the physical base-output path.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers the exported test_readprojectconfig_lets_a_child_null_reset_an_inherited_outdir once under src/unit/project. It calls the authored readProjectConfig on an isolated fixture directory; there is no installation, native build or CLI process.
 */
export const test_readprojectconfig_lets_a_child_null_reset_an_inherited_outdir =
  () => {
    const root = TestProject.tmpdir("ttsc-project-");
    const write = (name: string, value: unknown) =>
      fs.writeFileSync(path.join(root, name), JSON.stringify(value), "utf8");
    write("base.json", { compilerOptions: { outDir: "base-output" } });
    write("reset.json", { compilerOptions: { outDir: null } });
    write("child-null.json", {
      extends: "./base.json",
      compilerOptions: { outDir: null },
    });
    write("child-omit.json", { extends: "./base.json", compilerOptions: {} });
    write("child-array.json", { extends: ["./base.json", "./reset.json"] });

    const read = (name: string) =>
      readProjectConfig({ tsconfig: path.join(root, name) }).compilerOptions
        .outDir;
    assert.equal(read("child-null.json"), undefined);
    assert.equal(read("child-array.json"), undefined);
    assert.equal(
      read("child-omit.json"),
      path.join(fs.realpathSync(root), "base-output"),
    );
  };

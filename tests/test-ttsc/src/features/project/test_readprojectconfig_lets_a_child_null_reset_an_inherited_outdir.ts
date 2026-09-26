import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  path,
  readProjectConfig,
} from "../../internal/project";

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

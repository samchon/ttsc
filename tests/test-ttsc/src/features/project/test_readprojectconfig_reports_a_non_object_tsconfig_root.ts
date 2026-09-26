import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  path,
  readProjectConfig,
} from "../../internal/project";

/**
 * Verifies a tsconfig whose root is not an object fails with the compiler's
 * configuration error.
 *
 * `null`, an array, or a primitive is valid JSONC but not a configuration;
 * TypeScript-Go reports TS5092 for each. ttsc dereferenced the root as an
 * object, so `null` surfaced as a raw `TypeError` and the others were read as
 * an empty config. A root reached through `extends` takes the same path.
 *
 * 1. Write configs whose roots are `null`, an array, a string, and a number,
 *    plus a child that extends the `null` one.
 * 2. Read each through `readProjectConfig`.
 * 3. Assert each fails naming the file and the root-must-be-an-object rule.
 */
export const test_readprojectconfig_reports_a_non_object_tsconfig_root =
  () => {
    const root = TestProject.tmpdir("ttsc-project-");
    const roots = { "null.json": "null", "array.json": "[]", "string.json": '"x"', "number.json": "1" };
    for (const [name, text] of Object.entries(roots)) {
      fs.writeFileSync(path.join(root, name), text, "utf8");
    }
    fs.writeFileSync(
      path.join(root, "child.json"),
      JSON.stringify({ extends: "./null.json" }),
      "utf8",
    );
    for (const name of [...Object.keys(roots), "child.json"]) {
      assert.throws(
        () => readProjectConfig({ tsconfig: path.join(root, name) }),
        (error: unknown) =>
          error instanceof Error &&
          error.constructor === Error &&
          /must be an object/.test(error.message) &&
          error.message.includes(name === "child.json" ? "null.json" : name),
        name,
      );
    }
  };

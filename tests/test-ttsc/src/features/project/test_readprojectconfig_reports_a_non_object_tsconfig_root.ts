import { FileSystemIterator } from "../../../../utils/src/FileSystemIterator";
import { TestProject } from "../../../../utils/src/TestProject";
import { assert, path, readProjectConfig } from "../../internal/project-unit";

/**
 * Verifies a tsconfig whose root is not an object fails with the compiler's
 * configuration error.
 *
 * `null`, an array, or a primitive is valid JSONC but not a configuration;
 * TypeScript-Go reports TS5092 for each. ttsc dereferenced the root as an
 * object, so `null` surfaced as a raw `TypeError` and the others were read as
 * an empty config. A root reached through `extends` takes the same path.
 *
 * 1. Write configs whose roots are `null`, an array, a string, and a number, plus
 *    a child that extends the `null` one.
 * 2. Read each through `readProjectConfig`.
 * 3. Assert each fails naming the file and the root-must-be-an-object rule.
 *
 * @evidence contracts/testing.md#behavioral-verification Checks null, array, string and number roots plus a child extending null, requiring ordinary attributed configuration errors instead of TypeError or empty options.
 * @evidence contracts/testing.md#independent-expectations These independently authored JSON values are valid JSON but violate the object-root config contract; the child must attribute its invalid ancestor.
 * @evidence contracts/testing.md#distinguishing-cases Four non-object root kinds (null, array, string, number) and a child extending the null one are each rejected with a plain Error naming the offending file; the matching acceptance of object roots and of empty text is exercised only by other tests.
 * @evidence contracts/testing.md#execution-ownership A unit test calling readProjectConfig directly on tsconfig files whose root values are null, an array, a string or a number in a private temp directory; no install, native build, compiler process or CLI is involved.
 */
export const test_readprojectconfig_reports_a_non_object_tsconfig_root =
  async () => {
    const root = TestProject.tmpdir("ttsc-project-");
    const roots = {
      "null.json": "null",
      "array.json": "[]",
      "string.json": '"x"',
      "number.json": "1",
    };
    await FileSystemIterator.write(root, {
      ...roots,
      "child.json": JSON.stringify({ extends: "./null.json" }),
    });
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

import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  STANDARD_DECORATOR_OUTPUT,
  STANDARD_DECORATOR_SOURCE,
} from "../../internal/ttsx-decorators";

/**
 * Verifies decorator runtime targets follow compiler response-file precedence.
 *
 * A scan of visible CLI flags misses targets inside response files, leaving
 * decorators intact or replacing an explicitly requested lower target.
 *
 * 1. Select ESNext or ES2019 using nested response files and direct CLI flags.
 * 2. Run decorated code which exposes whether optional chaining was lowered.
 * 3. Assert the compiler's last effective target controls both behaviors.
 */
export const test_ttsx_standard_decorators_honor_response_file_options = () => {
  for (const [target, response, args, nativeOptionalChain] of [
    ["ES2022", "--target esnext\n", ["@args.txt"], true],
    ["ESNext", "--target es2019\n", ["@args.txt"], false],
    ["ESNext", "@inner.txt\n", ["--target", "es2019", "@args.txt"], true],
    ["ESNext", "@inner.txt\n", ["@args.txt", "--target", "es2019"], false],
    ["ESNext", "--target invalid\n", ["@args.txt"], null],
  ] as const) {
    const root = TestProject.commonJsProject(
      {
        "args.txt": response,
        "inner.txt": "--target esnext\n",
        "src/main.ts":
          STANDARD_DECORATOR_SOURCE +
          '\nfunction optional(value?: { answer: number }) { return value?.answer; }\nconsole.log(optional.toString().includes("?."));',
      },
      { compilerOptions: { target } },
    );
    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      [...args, "src/main.ts"],
      { cwd: root },
    );
    if (nativeOptionalChain === null) {
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /TS6046/);
      assert.equal(result.stdout, "");
    } else {
      assert.equal(result.status, 0, result.stderr);
      assert.equal(
        result.stdout.trim(),
        STANDARD_DECORATOR_OUTPUT + "\n" + nativeOptionalChain,
      );
    }
  }
};

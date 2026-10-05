import { TestProject } from "../../../../utils/src/TestProject";
import {
  assert,
  fs,
  path,
  readProjectConfig,
} from "../../internal/project-unit";

/**
 * Verifies a malformed config is reported by name, in ttsc's own voice.
 *
 * The reader called `JSON.parse` with no context wrap, so a broken config
 * surfaced as the raw V8 message — a byte offset in an unnamed file — while
 * every neighbouring failure in the same reader (`ttsc: extended tsconfig not
 * found: …`, `ttsc: circular tsconfig extends detected: …`) named its file.
 * `jsconfig.json` travels the same reader and must behave identically.
 *
 * 1. Write a `tsconfig.json` whose object is left unterminated.
 * 2. Invoke `readProjectConfig` on it, and on an equally broken `jsconfig.json`.
 * 3. Assert each throw carries the `ttsc:` prefix and names that exact file.
 *
 * @evidence contracts/testing.md#behavioral-verification Reads malformed tsconfig and jsconfig roots and asserts each error has the ttsc attribution prefix and exact offending path.
 * @evidence contracts/testing.md#independent-expectations Both authored objects are unterminated, independently requiring a parse failure attributed to the respective file.
 * @evidence contracts/testing.md#distinguishing-cases The same malformed shape is exercised under two supported config names; accepts_jsonc_comments_and_trailing_commas owns the valid JSONC twin and names_the_extended_config_that_failed_to_parse owns ancestor attribution.
 * @evidence contracts/testing.md#execution-ownership A unit test calling readProjectConfig directly on an unterminated tsconfig.json and an unterminated jsconfig.json in a private temp directory; no install, native build, compiler process or CLI is involved.
 */
export const test_readprojectconfig_names_the_config_that_failed_to_parse =
  () => {
    const root = TestProject.tmpdir("ttsc-project-");
    for (const name of ["tsconfig.json", "jsconfig.json"]) {
      const file = path.join(root, name);
      fs.writeFileSync(
        file,
        `{ "compilerOptions": { "strict": true \n`,
        "utf8",
      );
      assert.throws(
        () => readProjectConfig({ tsconfig: file }),
        (error: unknown) => {
          const message =
            error instanceof Error ? error.message : String(error);
          assert.match(message, /^ttsc: failed to parse /);
          assert.equal(
            message.includes(file),
            true,
            `the message must name ${file}: ${message}`,
          );
          return true;
        },
      );
      fs.rmSync(file);
    }
  };

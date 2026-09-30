import { TestProject } from "../../../../utils/src/TestProject";

import { assert, fs, path, readProjectConfig } from "../../internal/project-unit";

/**
 * Verifies a malformed `extends` ancestor is named, not the root that pulled it
 * in.
 *
 * The reader is re-entered once per ancestor while walking an `extends` chain,
 * so one unattributed `JSON.parse` message could have come from any file in the
 * chain and the user had to bisect it by hand. Placing the broken JSON in an
 * ancestor rather than the root is what makes this case distinct from the
 * single-file one; a root-level fixture would prove only what the root case
 * already covers.
 *
 * 1. Write a valid root config that extends a valid middle config.
 * 2. Give the middle config an unterminated grandparent.
 * 3. Assert the throw names the grandparent and neither of the other two.
 *
 * @evidence contracts/testing.md#behavioral-verification Reads a valid root and middle extending a malformed grandparent, requiring attribution to the grandparent and rejecting attribution to either valid descendant.
 * @evidence contracts/testing.md#independent-expectations Only the explicitly authored grandparent is syntactically incomplete; its fixture path is the independent expected owner.
 * @evidence contracts/testing.md#distinguishing-cases A three-level chain distinguishes ancestor attribution from entry attribution; names_the_config_that_failed_to_parse owns the malformed-entry variant.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers the exported test_readprojectconfig_names_the_extended_config_that_failed_to_parse once under src/unit/project. It calls the authored readProjectConfig on an isolated fixture directory; there is no installation, native build or CLI process.
 */
export const test_readprojectconfig_names_the_extended_config_that_failed_to_parse =
  () => {
    const root = TestProject.tmpdir("ttsc-project-");
    const rootConfig = path.join(root, "tsconfig.json");
    const middle = path.join(root, "middle.json");
    const broken = path.join(root, "base.json");
    fs.writeFileSync(
      rootConfig,
      JSON.stringify({ extends: "./middle.json" }),
      "utf8",
    );
    fs.writeFileSync(
      middle,
      JSON.stringify({ extends: "./base.json" }),
      "utf8",
    );
    fs.writeFileSync(broken, `{ "compilerOptions": \n`, "utf8");

    assert.throws(
      () => readProjectConfig({ tsconfig: rootConfig }),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        assert.match(message, /^ttsc: failed to parse /);
        assert.equal(
          message.includes(broken),
          true,
          `the message must name the broken ancestor: ${message}`,
        );
        assert.equal(message.includes(rootConfig), false, message);
        assert.equal(message.includes(middle), false, message);
        return true;
      },
    );
  };

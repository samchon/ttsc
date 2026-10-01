import { TestProject } from "../../../../utils/src/TestProject";

import {
  assert,
  fs,
  os,
  path,
  readProjectConfig,
} from "../../internal/project-unit";

/**
 * Verifies readProjectConfig rejects circular tsconfig extends.
 *
 * The extends-chain resolver must track visited files and break the cycle
 * rather than looping indefinitely. Without this guard a two-file cycle
 * (`a.json → b.json → a.json`) would exhaust the stack and crash the process
 * with an unhandled `RangeError`.
 *
 * 1. Write two tsconfig files where `a.json` extends `b.json` and `b.json` extends
 *    `a.json`.
 * 2. Invoke `readProjectConfig` on `a.json`.
 * 3. Assert it throws `circular tsconfig extends detected`.
 *
 * @evidence contracts/testing.md#behavioral-verification Reads a two-file reciprocal extends chain and requires the circular-config error, detecting unchecked recursion or acceptance of cyclic configuration.
 * @evidence contracts/testing.md#independent-expectations The authored edges a to b and b to a form a cycle independent of reader traversal; the supported contract rejects circular inheritance.
 * @evidence contracts/testing.md#distinguishing-cases A two-node cycle contrasts with the valid acyclic chain in inherits_plugins_and_outdir_through_tsconfig_extends and ordered independent bases in applies_array_extends_in_order.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers the exported test_readprojectconfig_rejects_circular_tsconfig_extends once under src/features/project. It calls the authored readProjectConfig on an isolated fixture directory; there is no installation, native build or CLI process.
 */
export const test_readprojectconfig_rejects_circular_tsconfig_extends = () => {
  const root = TestProject.tmpdir("ttsc-project-");
  fs.writeFileSync(
    path.join(root, "a.json"),
    JSON.stringify({ extends: "./b.json" }),
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "b.json"),
    JSON.stringify({ extends: "./a.json" }),
    "utf8",
  );

  assert.throws(
    () => readProjectConfig({ tsconfig: path.join(root, "a.json") }),
    /circular tsconfig extends detected/,
  );
};

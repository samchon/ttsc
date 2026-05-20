import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  os,
  path,
  readProjectConfig,
} from "../../internal/project";

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

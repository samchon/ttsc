import ttsc from "@ttsc/unplugin/bun";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { expectOutput } from "./common.mjs";

const root = process.argv[2];
const plugin = ttsc({ project: path.join(root, "tsconfig.json") });
const build = () =>
  Bun.build({
    entrypoints: [path.join(root, "src/main.ts")],
    plugins: [plugin],
    target: "bun",
  });
for (const [index, value] of ["FIRST", "SECOND", "SECOND"].entries()) {
  fs.writeFileSync(
    path.join(root, "src/contract-input.server.ts"),
    `export type ContractInput = "${value}";\n`,
  );
  const result = await build();
  assert.equal(result.success, true, result.logs.join("\n"));
  expectOutput(await result.outputs[0].text(), value, 4);
  assert.equal(
    fs.statSync(path.join(root, ".ttsc/contract-runs")).size,
    index + 1,
    "each Bun build compiles once for all four modules and releases its generation at completion",
  );
}

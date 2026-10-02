import { TestProject } from "@ttsc/testing";
import nodeChildProcessForTrace from "node:child_process";
import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";
const childProcess = { ...nodeChildProcessForTrace, ...E2eProcessTrace };

import {
  COMMONJS_PLUGIN_DESCRIPTOR_SHIM_SOURCE,
  assert,
  fs,
  path,
} from "../../../internal/ttsc/internal/project";

/**
 * Verifies a descriptor dependency changed A-B-A while loading must lose cache proof.
 *
 * The shim evaluates the temporary dependency state but omits its hash after A-B-A replacement, while the final bytes equal the original.
 *
 * 1. Prepare the authored descriptor mutation.
 * 2. Execute its isolated evaluator and assert the value, observed inputs and missing proof.
 *
 * @evidence contracts/testing.md#behavioral-verification The shim evaluates the temporary dependency state but omits its hash after A-B-A replacement, while the final bytes equal the original.
 * @evidence contracts/testing.md#independent-expectations The authored before/during module values and restored bytes independently distinguish the evaluation result from the final filesystem state.
 * @evidence contracts/testing.md#distinguishing-cases The shim evaluates the temporary dependency state but omits its hash after A-B-A replacement, while the final bytes equal the original.
 * @evidence contracts/testing.md#execution-ownership This matching src/features/project entry executes the real boundary described above through the existing TestExecutor population; authored subcases retain their assertion identities.
 * @evidence contracts/e2e.md#necessary-boundary The real CommonJS descriptor shim runs in a Node child with supported module hooks and writes its descriptor/input-proof envelope; direct hashing cannot establish the module value observed during the authored filesystem mutation.
 * @evidence contracts/e2e.md#shared-execution One Node shim evaluation carries the mutation, returned descriptor and all proof assertions; no compiler, Go build, descriptor-cache warmup or consumer installation occurs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A tracked private root owns descriptor, dependencies and output; hook registration and module cache live only in the synchronous child, so mutation and loaded values cannot contaminate another case.
 * @evidence contracts/e2e.md#preserved-coverage The shim evaluates the temporary dependency state but omits its hash after A-B-A replacement, while the final bytes equal the original. Existing inputs and assertions remain in this named entry; no meaningful distinction is removed or transferred by these acknowledgments.
 */
export const test_commonjs_plugin_descriptor_aba_omits_stale_hash_proof =
  (): void => {
    const root = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-descriptor-aba-"),
    );
    const dependency = path.join(root, "selection.cjs");
    const descriptor = path.join(root, "plugin.cjs");
    const output = path.join(root, "descriptor.json");
    const before = 'module.exports = { name: "before", source: "before" };\n';
    const during = 'module.exports = { name: "during", source: "during" };\n';
    fs.writeFileSync(dependency, before, "utf8");
    fs.writeFileSync(
      descriptor,
      [
        'const fs = require("node:fs");',
        'const { registerHooks } = require("node:module");',
        'const { pathToFileURL } = require("node:url");',
        `const dependency = ${JSON.stringify(dependency)};`,
        `const during = ${JSON.stringify(during)};`,
        `const before = ${JSON.stringify(before)};`,
        "registerHooks({",
        "  load(url, context, nextLoad) {",
        "    if (url !== pathToFileURL(dependency).href) return nextLoad(url, context);",
        "    fs.writeFileSync(dependency, during, 'utf8');",
        "    try { return nextLoad(url, context); }",
        "    finally { fs.writeFileSync(dependency, before, 'utf8'); }",
        "  },",
        "});",
        "module.exports = () => require(dependency);",
        "",
      ].join("\n"),
      "utf8",
    );

    const result = childProcess.spawnSync(
      process.execPath,
      ["-e", COMMONJS_PLUGIN_DESCRIPTOR_SHIM_SOURCE],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          TTSC_PLUGIN_CONTEXT: JSON.stringify({}),
          TTSC_PLUGIN_DESCRIPTOR_OUT: output,
          TTSC_PLUGIN_ENTRY: descriptor,
        },
        windowsHide: true,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(fs.readFileSync(output, "utf8")) as {
      descriptor: { name: string };
      inputHashes: Record<string, string | null>;
      inputs: string[];
    };
    assert.equal(payload.descriptor.name, "during");
    assert.equal(fs.readFileSync(dependency, "utf8"), before);
    assert.ok(payload.inputs.includes(dependency));
    assert.equal(
      Object.prototype.hasOwnProperty.call(payload.inputHashes, dependency),
      false,
      "an A-B-A input must stay watched without certifying the B result as A",
    );
  };

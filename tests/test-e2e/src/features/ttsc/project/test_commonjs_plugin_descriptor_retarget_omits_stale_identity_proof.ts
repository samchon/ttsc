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
 * Verifies a same-content link retarget during evaluation must drop cache proof.
 *
 * The shim returns the old linked descriptor and records the lexical selection, but omits proof for a same-content retarget during evaluation.
 *
 * 1. Prepare the authored descriptor mutation.
 * 2. Execute its isolated evaluator and assert the value, observed inputs and missing proof.
 *
 * @evidence contracts/testing.md#behavioral-verification The shim returns the old linked descriptor and records the lexical selection, but omits proof for a same-content retarget during evaluation.
 * @evidence contracts/testing.md#independent-expectations Equal authored selection bytes are checked in distinct old/new targets, and native realpath observes the link pointing to old before evaluation and new afterward. Returned literal old value plus missing proof distinguishes evaluated selection from final physical identity; no expected proof is computed from the SUT.
 * @evidence contracts/testing.md#distinguishing-cases The shim returns the old linked descriptor and records the lexical selection, but omits proof for a same-content retarget during evaluation.
 * @evidence contracts/testing.md#execution-ownership The generic project entry launches the actual built CommonJS shim/recorder against a real linked descriptor. Child factory performs actual junction/directory-link retarget after require; no compiler, packed consumer or full ttsx bootstrap is certified.
 * @evidence contracts/e2e.md#necessary-boundary The real CommonJS descriptor shim runs in a Node child with supported module hooks and writes its descriptor/input-proof envelope; direct hashing cannot establish the module value observed during the authored filesystem mutation.
 * @evidence contracts/e2e.md#shared-execution One Node shim evaluation carries the mutation, returned descriptor and all proof assertions; no compiler, Go build, descriptor-cache warmup or consumer installation occurs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Tracked root is retained before setup. Distinct old/new targets, child-only entry/context/output and native before/after link observations isolate retarget; actual launch error/signal/status does not establish arbitrary descendant join. Fresh child module state does not certify future shared-profile reset.
 * @evidence contracts/e2e.md#preserved-coverage The shim returns the old linked descriptor and records the lexical selection, but omits proof for a same-content retarget during evaluation. Existing inputs and assertions remain in this named entry; no meaningful distinction is removed or transferred by these acknowledgments.
 */
export const test_commonjs_plugin_descriptor_retarget_omits_stale_identity_proof =
  (): void => {
    const root = TestProject.tmpdir("ttsc-descriptor-link-retarget-");
    TestProject.retainTemporaryDirectory(root, "descriptor retarget child has no descendant join acknowledgement");
    const oldTarget = path.join(root, "old");
    const newTarget = path.join(root, "new");
    const link = path.join(root, "selection-link");
    const descriptor = path.join(root, "plugin.cjs");
    const output = path.join(root, "descriptor.json");
    fs.mkdirSync(oldTarget);
    fs.mkdirSync(newTarget);
    const selectionSource = 'module.exports = require("./value.cjs");\n';
    fs.writeFileSync(
      path.join(oldTarget, "selection.cjs"),
      selectionSource,
      "utf8",
    );
    fs.writeFileSync(
      path.join(newTarget, "selection.cjs"),
      selectionSource,
      "utf8",
    );
    fs.writeFileSync(
      path.join(oldTarget, "value.cjs"),
      'module.exports = { name: "old", source: "old" };\n',
      "utf8",
    );
    fs.writeFileSync(
      path.join(newTarget, "value.cjs"),
      'module.exports = { name: "new", source: "new" };\n',
      "utf8",
    );
    fs.symlinkSync(
      oldTarget,
      link,
      process.platform === "win32" ? "junction" : "dir",
    );
    const linkedSelection = path.join(link, "selection.cjs");
    assert.equal(fs.readFileSync(path.join(oldTarget, "selection.cjs"), "utf8"), selectionSource);
    assert.equal(fs.readFileSync(path.join(newTarget, "selection.cjs"), "utf8"), selectionSource);
    assert.equal(fs.realpathSync.native(linkedSelection), fs.realpathSync.native(path.join(oldTarget, "selection.cjs")));
    fs.writeFileSync(
      descriptor,
      [
        'const fs = require("node:fs");',
        `const selected = require(${JSON.stringify(linkedSelection)});`,
        "module.exports = () => {",
        `  fs.rmSync(${JSON.stringify(link)}, { force: true, recursive: true });`,
        `  fs.symlinkSync(${JSON.stringify(newTarget)}, ${JSON.stringify(link)}, ${JSON.stringify(process.platform === "win32" ? "junction" : "dir")});`,
        "  return selected;",
        "};",
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
    assert.equal(result.error, undefined, "descriptor retarget launch error");
    assert.equal(result.signal, null, "descriptor retarget child terminated by signal");
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.realpathSync.native(linkedSelection), fs.realpathSync.native(path.join(newTarget, "selection.cjs")));
    const payload = JSON.parse(fs.readFileSync(output, "utf8")) as {
      descriptor: { name: string };
      inputHashes: Record<string, string | null>;
      inputRealpaths: Record<string, string | null>;
      inputs: string[];
    };
    assert.equal(payload.descriptor.name, "old");
    assert.ok(payload.inputs.includes(linkedSelection));
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        payload.inputHashes,
        linkedSelection,
      ),
      false,
      "the retargeted alias must remain watched without certifying old output",
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        payload.inputRealpaths,
        linkedSelection,
      ),
      false,
    );
  };

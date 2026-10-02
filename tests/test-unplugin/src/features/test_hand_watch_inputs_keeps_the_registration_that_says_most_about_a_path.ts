import assert from "node:assert/strict";
import path from "node:path";

import type { TtscWatchInput } from "../../../../packages/unplugin/src/core/transform/watch/TtscWatchInput";
import { handWatchInputs } from "../../../../packages/unplugin/src/core/transform/watch/handWatchInputs";

/**
 * Verifies that when one spelling reaches the host more than once, the
 * registration handed over is the one that says most about it: the project's
 * membership for the root, an evidenced input over a plain one, and otherwise
 * the first (samchon/ttsc#1467).
 *
 * A graph lists the project root itself as a resolution input, and a failed
 * generation's recovery list named it plainly before its membership. Keeping
 * the first occurrence dropped the membership, so nothing observed a root file
 * appearing, and the host matrix's Next.js sessions never heard an input
 * deleted and recreated. The order the inputs were derived in must decide
 * nothing but ties.
 *
 * 1. Hand a plain root, a plain file, ordinary root evidence, membership, the same file with
 *    evidence, and a second evidence for that file, through a batching hook.
 * 2. Assert the root kept its membership, the file kept its first evidence, and
 *    the derived order survived.
 * 3. Repeat through a per-file hook and assert the same registrations; when
 *    both hooks exist, require only the batch and its failed-generation flag.
 *
 * @evidence contracts/testing.md#behavioral-verification handWatchInputs hands membership over a plain root and the first evidence over a plain file, preserving first-seen path order through both host hooks.
 * @evidence contracts/testing.md#independent-expectations The independently authored root/membership and file/first pairs pin the precedence and tie contract exactly; second evidence must not replace the first.
 * @evidence contracts/testing.md#distinguishing-cases Plain/evidenced duplicates, ordinary root evidence versus membership, lower-ranked entries after membership and two tied file proofs exercise upgrade, no downgrade and tie decisions. Batch and single channels must agree, while a host offering both receives only the batch with its failure flag; an empty batch remains empty.
 * @evidence contracts/testing.md#execution-ownership Calls handWatchInputs with captured addWatchFiles and addWatchFile callbacks; this entry owns the full registration list and literal callback trace without a host.
 */
export async function test_hand_watch_inputs_keeps_the_registration_that_says_most_about_a_path(): Promise<void> {
  const root = path.resolve("project");
  const file = path.join(root, "src", "main.ts");
  const membership: NonNullable<TtscWatchInput["evidence"]> = {
    identity: "root",
    missing: false,
    state: {
      codec: "membership",
      digest: "d",
      directories: [root],
      policy: { excludedDirectories: [], inputExtensions: [".ts"], sources: [] },
    },
  };
  const first: NonNullable<TtscWatchInput["evidence"]> = { identity: "file", missing: false, state: { codec: "host", hash: "first" } };
  const second: NonNullable<TtscWatchInput["evidence"]> = {
    identity: "file",
    missing: false,
    state: { codec: "host", hash: "second" },
  };
  const inputs: TtscWatchInput[] = [
    { file: root },
    { file },
    { file: root, evidence: first },
    { file: root, evidence: membership },
    { file: root, evidence: second },
    { file, evidence: first },
    { file, evidence: second },
  ];

  let batched: readonly TtscWatchInput[] | undefined;
  handWatchInputs({ addWatchFiles: (handed) => (batched = handed) }, inputs);
  assert.deepEqual(
    batched?.map((input) => [input.file, input.evidence]),
    [
      [root, membership],
      [file, first],
    ],
    "the membership and the first evidence win, in the derived order",
  );

  const single: [string, unknown][] = [];
  handWatchInputs(
    { addWatchFile: (handed, evidence) => single.push([handed, evidence]) },
    inputs,
  );
  assert.deepEqual(single, [
    [root, membership],
    [file, first],
  ]);
  let failed: boolean | undefined;
  let singleCalls = 0;
  handWatchInputs({
    addWatchFile: () => { ++singleCalls; },
    addWatchFiles: (handed, failure) => { batched = handed; failed = failure; },
  }, inputs, true);
  assert.equal(singleCalls, 0);
  assert.equal(failed, true);
  assert.deepEqual(batched?.map((input) => [input.file, input.evidence]), single);
  handWatchInputs({ addWatchFiles: (handed) => { batched = handed; } }, []);
  assert.deepEqual(batched, []);
}

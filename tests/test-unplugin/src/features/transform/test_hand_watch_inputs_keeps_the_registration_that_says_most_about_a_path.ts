import assert from "node:assert/strict";
import path from "node:path";

import type { TtscWatchInput } from "../../../../../packages/unplugin/lib/core/transform/watch/TtscWatchInput.mjs";
import { handWatchInputs } from "../../../../../packages/unplugin/lib/core/transform/watch/handWatchInputs.mjs";

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
 * 1. Hand a plain root, a plain file, the root's membership, the same file with
 *    evidence, and a second evidence for that file, through a batching hook.
 * 2. Assert the root kept its membership, the file kept its first evidence, and
 *    the derived order survived.
 * 3. Repeat through a per-file hook and assert the same registrations.
 */
export async function test_hand_watch_inputs_keeps_the_registration_that_says_most_about_a_path(): Promise<void> {
  const root = path.resolve("project");
  const file = path.join(root, "src", "main.ts");
  const membership = {
    identity: "root",
    missing: false,
    state: {
      codec: "membership",
      digest: "d",
      directories: [root],
      policy: undefined,
    },
  } as unknown as NonNullable<TtscWatchInput["evidence"]>;
  const first = { identity: "file", missing: false, state: { codec: "hash" } };
  const second = {
    identity: "file",
    missing: false,
    state: { codec: "other" },
  };
  const inputs: TtscWatchInput[] = [
    { file: root },
    { file },
    { file: root, evidence: membership },
    { file, evidence: first as unknown as TtscWatchInput["evidence"] },
    { file, evidence: second as unknown as TtscWatchInput["evidence"] },
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
}

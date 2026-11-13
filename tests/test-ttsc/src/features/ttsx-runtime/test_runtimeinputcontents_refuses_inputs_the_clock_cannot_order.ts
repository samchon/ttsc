import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { RuntimeInputContents } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeInputContents";

/**
 * Verifies a stamped content session hashes only inputs whose stamps end before
 * the clock reference minted ahead of a compile.
 *
 * The runtime hashes the files a compile read after that compile, from its own
 * resolution trace (samchon/ttsc#1859). A file saved during the compile would
 * pair its new hash with the old output, so the session refuses any input it
 * cannot order before the reference, and says whether the reason is a moved
 * stamp or a device without a reference, which sends later builds of the same
 * request to trace before compiling.
 *
 * 1. Write a source and observe its device and stamps.
 * 2. Witness it against a later reference, an earlier one, and none for its
 *    device.
 *
 * @evidence contracts/testing.md#behavioral-verification The production session stats and reads a real file; the returned hash and the thrown refusal and its reason are observed directly.
 * @evidence contracts/testing.md#independent-expectations The references are derived from the file's own device and modification stamp, so each expectation follows from ordering alone.
 * @evidence contracts/testing.md#distinguishing-cases A reference after the stamps, one before them, a map without the file's device, an unstamped session and an absent input separate admission from each refusal.
 * @evidence contracts/testing.md#execution-ownership The unit runner discovers this named export; the test owns its temporary file and removes it in finally.
 */
export function test_runtimeinputcontents_refuses_inputs_the_clock_cannot_order(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-stamped-"));
  try {
    const source = path.join(root, "main.ts");
    fs.writeFileSync(source, "export const value = 1;\n");
    const stats = fs.statSync(source, { bigint: true });
    const newest =
      stats.mtimeNs > stats.ctimeNs ? stats.mtimeNs : stats.ctimeNs;
    const witness = (stamped: boolean | ReadonlyMap<bigint, bigint>) => {
      const session = RuntimeInputContents.open(
        path.join(root, "tsconfig.json"),
        undefined,
        undefined,
        stamped,
      );
      try {
        return session.observe([source, path.join(root, "absent.ts")]);
      } finally {
        session.close();
      }
    };
    const refusal = (
      stamped: ReadonlyMap<bigint, bigint>,
    ): RuntimeInputContents.UnsettledInput => {
      try {
        witness(stamped);
      } catch (error) {
        assert.ok(error instanceof RuntimeInputContents.UnsettledInput);
        return error;
      }
      throw new Error("the session admitted an unordered input");
    };

    const later = witness(new Map([[stats.dev, newest + 1n]]));
    assert.equal(later[0]![1] !== null && later[0]![2] !== null, true);
    assert.deepEqual(later[1], [path.join(root, "absent.ts"), null, null]);
    assert.deepEqual(witness(false)[0], later[0], "unstamped reads the same");

    assert.equal(
      refusal(new Map([[stats.dev, stats.mtimeNs]])).unreferenced,
      false,
      "an input changed at or after the reference moved",
    );
    assert.equal(
      refusal(new Map()).unreferenced,
      true,
      "a device without a reference can never be ordered",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

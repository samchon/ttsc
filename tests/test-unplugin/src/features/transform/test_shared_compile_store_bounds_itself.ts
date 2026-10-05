import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { TtscSharedCompilePublication } from "../../../../../packages/unplugin/src/core/transform/session/TtscSharedCompilePublication";
import { claimSharedCompile } from "../../../../../packages/unplugin/src/core/transform/session/claimSharedCompile";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies direct store publication/adoption retains four states per identity
 * and 32 store-wide, and reclaims departed writers while preserving live ones.
 *
 * Authored past timestamps distinguish recency from filename order. Adoption
 * supplies the actual refreshed use time. Real live/dead PID observations are
 * owning cleanup inputs, not a compiler or host-protocol connection.
 *
 * 1. Publish four states, adopt the oldest, then publish the fifth and require the
 *    literal four survivors including the adopted state.
 * 2. Publish 32 other identities and require that adopted state plus the newest
 *    31, giving the literal global 32-publication boundary.
 * 3. Independently establish an exited child PID and live current PID, then
 *    require dead lock/write removal and preservation of live lock/old write.
 * 4. Publish two distinguishable states of one identity; refuse adoption of one
 *    while adopting the other state's exact serialized consumer data.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual claimSharedCompile publish/adopt against one native temporary store. Exact JSON-name sets distinguish per-identity/global LRU retention; native PID inputs distinguish departed lock/partial writes from a live lock and one-hour-old live partial write. Two distinct publications of one identity additionally prove adopt false returns compile despite an existing publication, while adopt true returns the other state's exact consumer payload without confusing state keys.
 * @evidence contracts/testing.md#independent-expectations Literal four/32 limits are the supported store policy. Authored monotonic old timestamps and actual adoption fix independent recency; expected survivor names use authored identities/states, not a product sorting result. Child spawn success/status zero plus independent ESRCH and current-PID success establish the liveness contrast before cleanup.
 * @evidence contracts/testing.md#distinguishing-cases Fifth-state and thirty-third-publication boundaries retain the oldest freshly adopted state over unused older states. Dead and live writers differ by observed PID liveness; old age alone cannot erase the live partial write. Every compile claim releases in finally even after publication/assertion failure; the synchronous child is already exited before its PID is used.
 * @evidence contracts/testing.md#execution-ownership This discoverable direct unit owns the LRU and reclamation rows over literal empty publication data. It uses one exited Node child solely as native PID input, without executing a compiler/plugin build, installed consumer or product host/protocol. TestProject owns the temporary store; no E2E native transport is replaced or certified.
 */
export async function test_shared_compile_store_bounds_itself(): Promise<void> {
  const store = TestProject.tmpdir("ttsc-unplugin-shared-bounds-");
  const publication: TtscSharedCompilePublication = {
    externalInputHashes: {},
    externalInputRealpaths: {},
    result: {
      type: "success",
      typescript: {},
    } as unknown as TtscSharedCompilePublication["result"],
    scratchDirectory: path.resolve("/scratch"),
  };
  const published = () =>
    fs
      .readdirSync(store)
      .filter((entry) => entry.endsWith(".json"))
      .sort();
  let clock = Date.now() - 1_000_000;
  /** Publish literal data, stamped after every earlier publication. */
  const publish = async (
    identity: string,
    state: string,
    value = publication,
  ) => {
    const claim = await claimSharedCompile(store, identity, state, {
      adopt: false,
    });
    try {
      assert.ok(claim?.kind === "compile", "publication owns a compile claim");
      await claim.publish(value);
    } finally {
      if (claim?.kind === "compile") claim.release();
    }
    const file = path.join(store, `${identity}-${state}.json`);
    assert.equal(
      fs.existsSync(file),
      true,
      "publication was actually persisted",
    );
    clock += 1_000;
    fs.utimesSync(file, new Date(clock), new Date(clock));
  };

  // 1. Four per identity, most recently used first.
  const identity = "a".repeat(32);
  const states = ["1", "2", "3", "4", "5"].map((digit) => digit.repeat(32));
  for (const state of states.slice(0, 4)) await publish(identity, state);
  const adopted = await claimSharedCompile(store, identity, states[0]!, {
    adopt: true,
  });
  try {
    assert.equal(adopted?.kind, "adopt", "the oldest state is adopted");
  } finally {
    if (adopted?.kind === "compile") adopted.release();
  }
  await publish(identity, states[4]!);
  assert.deepEqual(
    published(),
    [states[0], states[2], states[3], states[4]].map(
      (state) => `${identity}-${state}.json`,
    ),
    "the least recently used state of the identity is gone",
  );

  // 2. Thirty-two in the whole store.
  const others = Array.from({ length: 32 }, (_, index) =>
    index.toString(16).padStart(32, "0"),
  );
  for (const other of others) await publish(other, "f".repeat(32));
  assert.deepEqual(
    published(),
    [
      `${identity}-${states[0]}.json`,
      ...others.slice(1).map((other) => `${other}-${"f".repeat(32)}.json`),
    ].sort(),
    "the least recently used publications of the store are gone",
  );

  // 3. What gone workers left behind.
  const exited = spawnSync(process.execPath, ["-e", ""], { encoding: "utf8" });
  assert.equal(exited.error, undefined, "native PID input process starts");
  assert.equal(exited.status, 0, "native PID input process exits successfully");
  assert.equal(exited.signal, null);
  const dead = exited.pid;
  assert.ok(Number.isInteger(dead) && dead > 0);
  assert.throws(
    () => process.kill(dead, 0),
    (error: unknown) => (error as NodeJS.ErrnoException).code === "ESRCH",
    "dead PID is independently confirmed absent",
  );
  assert.doesNotThrow(
    () => process.kill(process.pid, 0),
    "current PID is independently live",
  );
  const abandoned = path.join(
    store,
    `${"b".repeat(32)}-${"c".repeat(32)}.lock`,
  );
  fs.mkdirSync(abandoned);
  fs.writeFileSync(path.join(abandoned, "owner"), `${dead}:gone`);
  const live = path.join(store, `${"d".repeat(32)}-${"e".repeat(32)}.lock`);
  fs.mkdirSync(live);
  fs.writeFileSync(path.join(live, "owner"), `${process.pid}:here`);
  // A partial write names its writer: `<publication>.<pid>.<uuid>.tmp`.
  const partial = (pid: number) =>
    path.join(
      store,
      `${"9".repeat(32)}-${"8".repeat(32)}.json.${pid}.${crypto.randomUUID()}.tmp`,
    );
  const deadWrite = partial(dead);
  fs.writeFileSync(deadWrite, "{");
  // However long ago it began, a live writer's write is its own to finish.
  const liveWrite = partial(process.pid);
  fs.writeFileSync(liveWrite, "{");
  const long = new Date(Date.now() - 3_600_000);
  fs.utimesSync(liveWrite, long, long);
  await publish(others[0]!, "0".repeat(32));
  assert.equal(fs.existsSync(abandoned), false, "a dead worker's lock");
  assert.equal(
    fs.existsSync(deadWrite),
    false,
    "a dead writer's partial write",
  );
  assert.equal(fs.existsSync(live), true, "a live worker keeps its lock");
  assert.equal(fs.existsSync(liveWrite), true, "and its partial write");

  const firstPublication: TtscSharedCompilePublication = {
    ...publication,
    result: {
      ...publication.result,
      type: "success",
      typescript: { "src/main.ts": "export const publicationState = 1;\n" },
    },
  };
  const secondPublication: TtscSharedCompilePublication = {
    ...publication,
    result: {
      ...publication.result,
      type: "success",
      typescript: { "src/main.ts": "export const publicationState = 2;\n" },
    },
  };
  await publish(identity, states[0]!, firstPublication);
  await publish(identity, states[1]!, secondPublication);
  const firstFile = path.join(store, `${identity}-${states[0]}.json`);
  const firstBytes = fs.readFileSync(firstFile);
  const refused = await claimSharedCompile(store, identity, states[0]!, {
    adopt: false,
  });
  try {
    assert.equal(
      refused?.kind,
      "compile",
      "refutation retains compile ownership despite an existing publication",
    );
    assert.deepEqual(
      fs.readFileSync(firstFile),
      firstBytes,
      "a claim alone does not replace the publication",
    );
  } finally {
    if (refused?.kind === "compile") refused.release();
  }
  const otherState = await claimSharedCompile(store, identity, states[1]!, {
    adopt: true,
  });
  if (otherState?.kind === "compile") otherState.release();
  assert.ok(otherState?.kind === "adopt");
  assert.deepEqual(otherState.publication, secondPublication);
  assert.notEqual(
    otherState.publication,
    secondPublication,
    "adoption reads persisted data, not the publisher's object reference",
  );
  assert.equal(otherState.publication.result.type, "success");
  if (otherState.publication.result.type === "success")
    assert.equal(
      otherState.publication.result.typescript["src/main.ts"],
      "export const publicationState = 2;\n",
    );
}

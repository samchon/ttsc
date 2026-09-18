import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import type { TtscSharedCompilePublication } from "../../../../../packages/unplugin/lib/core/transform/session/TtscSharedCompilePublication.mjs";
import { adoptedExternalInputMismatch } from "../../../../../packages/unplugin/lib/core/transform/session/adoptedExternalInputMismatch.mjs";
import { claimSharedCompile } from "../../../../../packages/unplugin/lib/core/transform/session/claimSharedCompile.mjs";
import { sharedCompileIdentity } from "../../../../../packages/unplugin/lib/core/transform/session/sharedCompileIdentity.mjs";

/**
 * Verifies how the workers of one pooled session decide between adopting a
 * compile, compiling it under the lock, and taking over an abandoned lock
 * (samchon/ttsc#1390).
 *
 * The store is only an optimization, so every decision must fail toward the
 * worker compiling for itself: an unusable publication is absent, a store that
 * cannot be used answers nothing, and a holder whose process died loses its
 * lock rather than blocking the pool. In the other direction, an adopter may
 * take a compile only for the same identity and only while every external input
 * still has the state its publisher recorded, and a holder must never release a
 * lock another worker has since taken over.
 *
 * 1. Claim an empty store, publish, and assert a waiting claim adopts the
 *    publication, that a claim refusing adoption compiles under the lock, and
 *    that a malformed publication is not adopted.
 * 2. Leave a lock owned by a dead process and assert the next claim takes it over,
 *    and that the displaced holder's release leaves the new owner's lock
 *    alone.
 * 3. Point a claim at a store that cannot be used and assert it answers nothing.
 * 4. Decide identities and external-input mismatches for each changed field.
 */
export async function test_shared_compile_claims_adopt_lock_and_take_over(): Promise<void> {
  const store = TestProject.tmpdir("ttsc-unplugin-shared-claims-");
  const identity = "a".repeat(32);
  const state = "b".repeat(64);
  const lock = path.join(store, `${identity}-${state}.lock`);
  const publication: TtscSharedCompilePublication = {
    externalInputHashes: { [path.resolve("/outside/helper.ts")]: "hash" },
    externalInputRealpaths: {
      [path.resolve("/outside/helper.ts")]: path.resolve("/real/helper.ts"),
    },
    result: {
      type: "success",
      typescript: {},
    } as unknown as TtscSharedCompilePublication["result"],
    scratchDirectory: path.resolve("/scratch"),
  };

  const holder = await claimSharedCompile(store, identity, state, {
    adopt: true,
  });
  assert.equal(holder?.kind, "compile", "the first worker compiles");
  assert.equal(fs.existsSync(lock), true);
  const waiter = claimSharedCompile(store, identity, state, { adopt: true });
  if (holder?.kind !== "compile") return;
  await holder.publish(publication);
  holder.release();
  assert.deepEqual(
    await waiter,
    { kind: "adopt", publication },
    "a waiter adopts the holder's publication",
  );
  assert.equal(fs.existsSync(lock), false, "the holder released its lock");

  const replacing = await claimSharedCompile(store, identity, state, {
    adopt: false,
  });
  assert.equal(
    replacing?.kind,
    "compile",
    "a worker that found the publication wanting compiles under the lock",
  );
  if (replacing?.kind === "compile") replacing.release();

  const malformed = "c".repeat(64);
  fs.writeFileSync(
    path.join(store, `${identity}-${malformed}.json`),
    JSON.stringify({ ...publication, result: { type: "exception" } }),
  );
  const unusable = await claimSharedCompile(store, identity, malformed, {
    adopt: true,
  });
  assert.equal(unusable?.kind, "compile", "a failed envelope is never adopted");
  if (unusable?.kind === "compile") unusable.release();

  const dead = spawnSync(process.execPath, ["-e", ""]).pid;
  fs.mkdirSync(lock);
  fs.writeFileSync(path.join(lock, "owner"), `${dead}:gone`);
  const successor = await claimSharedCompile(store, identity, state, {
    adopt: false,
  });
  assert.equal(
    successor?.kind,
    "compile",
    "a lock whose holder died is taken over",
  );
  const successorToken = fs.readFileSync(path.join(lock, "owner"), "utf8");
  assert.match(successorToken, new RegExp(`^${process.pid}:`));
  const displaced = await claimSharedCompile(store, identity, "d".repeat(64), {
    adopt: false,
  });
  assert.equal(displaced?.kind, "compile");
  const displacedLock = path.join(store, `${identity}-${"d".repeat(64)}.lock`);
  fs.writeFileSync(path.join(displacedLock, "owner"), successorToken);
  if (displaced?.kind === "compile") displaced.release();
  assert.equal(
    fs.existsSync(displacedLock),
    true,
    "a holder never releases a lock another worker took over",
  );
  if (successor?.kind === "compile") {
    successor.release();
    successor.release();
  }
  assert.equal(fs.existsSync(lock), false);

  const file = path.join(store, "not-a-directory");
  fs.writeFileSync(file, "");
  assert.equal(
    await claimSharedCompile(file, identity, state, { adopt: true }),
    undefined,
    "a store that cannot be used leaves the worker to compile for itself",
  );

  const compile = {
    aliasPaths: { "@/*": ["/project/src/*"] },
    compilerOptions: { removeComments: true },
    plugins: [{ transform: "typia/lib/transform" }],
    tsconfig: path.resolve("/project/tsconfig.json"),
  };
  const id = sharedCompileIdentity(compile);
  assert.match(id, /^[0-9a-f]{32}$/);
  assert.equal(sharedCompileIdentity({ ...compile }), id);
  for (const changed of [
    { aliasPaths: {} },
    { compilerOptions: {} },
    { plugins: undefined },
    { tsconfig: path.resolve("/project/tsconfig.app.json") },
  ]) {
    assert.notEqual(
      sharedCompileIdentity({ ...compile, ...changed }),
      id,
      JSON.stringify(changed),
    );
  }

  const helper = path.resolve("/outside/helper.ts");
  const other = path.resolve("/outside/other.ts");
  const current = {
    hashes: { ...publication.externalInputHashes },
    realpaths: { ...publication.externalInputRealpaths },
  };
  assert.equal(adoptedExternalInputMismatch(publication, current), undefined);
  for (const [label, changed] of [
    ["content", { ...current, hashes: { [helper]: "edited" } }],
    [
      "physical identity",
      { ...current, realpaths: { [helper]: path.resolve("/moved/helper.ts") } },
    ],
    ["a missing input", { ...current, hashes: {} }],
    [
      "an input the publisher never recorded",
      { ...current, hashes: { ...current.hashes, [other]: "hash" } },
    ],
  ] as const) {
    assert.equal(
      adoptedExternalInputMismatch(publication, changed),
      label === "an input the publisher never recorded" ? other : helper,
      label,
    );
  }
}

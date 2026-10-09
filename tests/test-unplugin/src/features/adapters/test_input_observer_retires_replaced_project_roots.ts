import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createInputObserver } from "../../../../../packages/unplugin/src/core/observer/createInputObserver";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies project notification authority follows the current physical root.
 *
 * A native handle can follow a moved directory while its configured spelling
 * names another one. Polling and registration must retire that authority, and
 * attaching at the same spelling must reopen it without losing other owners.
 *
 * 1. Register two owners against a silent watch with a known case policy.
 * 2. Replace the root or its ancestor, or fail its opening, and prove recovery.
 * 3. Reattach at the same spelling and reject retired callbacks and late polls.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual createInputObserver over real directory identities with captured watch and poll collaborators. Literal owner notifications, handle closes, fresh native admission and quiet unchanged conditions distinguish retirement from arbitrary invalidation or a disabled observer.
 * @evidence contracts/testing.md#independent-expectations A handle opened on a different directory cannot authorize the current spelling. Two independently named owners must receive only changes to their recorded files, and an unchanged copied file must remain quiet. Captured callbacks and handle counts establish ownership independently of observer internals.
 * @evidence contracts/testing.md#distinguishing-cases Root and ancestor replacement, detection before registration or same-root attachment, missing and recreated roots, synchronous opening replacement, native failure, declared polling, close refusal and late callbacks each execute with independent failure collection. Same-root attachment retains overlapping owner conditions and earns a new subscription; final disposal suppresses captured callbacks and polls.
 * @evidence contracts/testing.md#execution-ownership This source unit executes the owning observer and native filesystem proofs with supported watch/poll/case seams. It starts no native watcher, compiler, installed consumer or Vite server. Each scenario owns its observer and checks every close attempt; TestProject owns temporary directories.
 */
export async function test_input_observer_retires_replaced_project_roots(): Promise<void> {
  const failures: Error[] = [];
  for (const scenario of [
    "poll",
    "ancestor",
    "register",
    "reattach",
    "reattach-changed",
    "missing",
    "opening",
    "error",
    "close-refusal",
    "polling",
  ] as const) {
    const base = fs.realpathSync.native(
      TestProject.tmpdir("ttsc-root-authority-"),
    );
    const parent = path.join(base, "parent");
    const root = path.join(parent, "project");
    const file = path.join(root, "input.d.ts");
    const other = path.join(root, "unchanged.d.ts");
    const owner = path.join(root, "main.ts");
    const retained = path.join(root, "retained.ts");
    const writeRoot = (): void => {
      fs.mkdirSync(root, { recursive: true });
      fs.writeFileSync(file, "before");
      fs.writeFileSync(other, "unchanged");
    };
    if (scenario !== "missing") writeRoot();
    const handles: Array<{
      event(type: string, file: string | null): void;
      fail(): void;
      closed: number;
    }> = [];
    const changes: string[] = [];
    const polls: Array<() => void> = [];
    let poll: (() => void) | undefined;
    let pollCloses = 0;
    const observer = createInputObserver(
      ({ reload }) => changes.push(...reload),
      {
        caseSensitive: () => true,
        watch(_root, event, fail) {
          const handle = { event, fail, closed: 0 };
          handles.push(handle);
          if (scenario === "opening" && handles.length === 1) {
            fs.renameSync(root, `${root}-old`);
            writeRoot();
          }
          return {
            close() {
              handle.closed += 1;
              if (scenario === "close-refusal")
                throw new Error("close refused");
            },
          };
        },
        poll(listener) {
          polls.push(listener);
          poll = listener;
          return {
            close() {
              pollCloses += 1;
              if (poll === listener) poll = undefined;
            },
          };
        },
      },
    );
    const settle = () => new Promise((resolve) => setTimeout(resolve, 30));
    try {
      observer.open(root, scenario === "polling");
      observer.replace(owner, [{ file }], false, observer.begin());
      if (scenario === "missing") {
        writeRoot();
        assert.ok(poll, "an absent root cannot provide native authority");
        poll();
        assert.deepEqual(changes, [owner], "creation repairs the absent input");
        changes.length = 0;
        observer.replace(owner, [{ file }]);
      }
      observer.replace(retained, [{ file: other }]);
      assert.ok(poll, "every native root identity needs the shared poll");
      poll();
      assert.deepEqual(changes, [], "current conditions stay quiet");
      const first = handles[0];
      if (scenario === "polling") {
        assert.equal(
          handles.length,
          0,
          "declared polling opens no native scope",
        );
      } else if (scenario === "error") {
        first!.fail();
      } else if (scenario !== "missing" && scenario !== "opening") {
        const moved = scenario === "ancestor" ? parent : root;
        fs.renameSync(moved, `${moved}-old`);
        writeRoot();
      }
      if (scenario === "reattach-changed") {
        fs.writeFileSync(file, "changed before attachment");
        observer.open(root, false);
        assert.deepEqual(
          changes,
          [owner],
          "reattachment proves retained conditions immediately",
        );
        changes.length = 0;
        observer.replace(owner, [{ file }]);
      }
      if (scenario === "reattach") observer.open(root, false);
      if (scenario === "register")
        observer.replace(
          path.join(root, "new.ts"),
          [{ file: other }],
          false,
          observer.begin(),
        );
      if (scenario !== "polling") {
        poll?.();
        assert.equal(first!.closed, 1, "lost root authority closes once");
      }
      await settle();
      assert.deepEqual(changes, [], "same-byte replacements do not invalidate");
      fs.writeFileSync(file, "replacement edit");
      if (scenario === "reattach" || scenario === "reattach-changed")
        handles[1]!.event("change", file);
      poll?.();
      await settle();
      assert.deepEqual(
        changes,
        [owner],
        "only the changed input's owner hears recovery",
      );
      changes.length = 0;
      observer.replace(owner, [{ file }]);
      if (scenario !== "polling") {
        observer.open(root, false);
        assert.equal(
          handles.length,
          2,
          "same-root attachment earns a fresh subscription",
        );
        fs.writeFileSync(other, "fresh native edit");
        const sequence = observer.begin();
        first!.event("change", other);
        first!.event("rename", null);
        first!.fail();
        assert.equal(
          observer.begin(),
          sequence,
          "retired callbacks cannot advance the current epoch",
        );
        await settle();
        assert.deepEqual(
          changes,
          [],
          "old callbacks cannot route current changes",
        );
        handles[1]!.event("change", other);
        await settle();
        assert.ok(
          new Set<string>(changes).has(retained),
          "overlapping owner survives fresh attachment",
        );
        assert.ok(
          !new Set<string>(changes).has(owner),
          "unchanged owner remains quiet",
        );
      }
    } catch (cause) {
      failures.push(new Error(scenario, { cause }));
    } finally {
      await observer.dispose();
      const sequence = observer.begin();
      for (const handle of handles) {
        handle.event("rename", null);
        handle.fail();
        if (handle.closed !== 1)
          failures.push(
            new Error(`${scenario}: close attempts ${handle.closed}`),
          );
      }
      for (const listener of polls) listener();
      if (observer.begin() !== sequence)
        failures.push(
          new Error(`${scenario}: retired callbacks changed the epoch`),
        );
      if (pollCloses !== polls.length)
        failures.push(new Error(`${scenario}: poll ownership was not released`));
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "project root notification authority");
}

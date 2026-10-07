import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createInputObserver } from "../../../../../packages/unplugin/src/core/observer/createInputObserver";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies external descendants share current recursive watch authority.
 *
 * Nested resolution candidates need directory admission, not another recursive
 * handle. Coverage cannot cross a sibling boundary, a failed or replaced root,
 * or a junction that leaves the physical tree.
 *
 * 1. Register a parent and twenty nested candidates, then fill the external cap.
 * 2. Check shared admission, events, contributor withdrawal and final release.
 * 3. Reject failed, replaced and escaping coverage, and replay new admission.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls createInputObserver with actual temporary directories and supported watch/poll seams. It asserts two initial handles for a project plus an external tree, descendant reuse even after the external cap is full, admission and tracking, event invalidation, contributor release, and rejection of failed, replaced or escaping authority.
 * @evidence contracts/testing.md#independent-expectations A recursive observer covers lexical descendants only while its native root identity remains current and the physical path remains beneath that root. Literal handle populations follow from the authored tree and the documented sixteen-external-scope limit. Event assertions require replay of the real missing-file predicate after file creation.
 * @evidence contracts/testing.md#distinguishing-cases Covers twenty nested directories, prefix-sharing siblings, the full scope cap, independent owner withdrawal, directory admission pruning, native failure, replacement before the next poll, a junction outside the scope, and final disposal. A file created without an event between the compile token and new descendant admission requires immediate condition replay. Each rejection or race scenario uses a fresh observer and collects failures independently.
 * @evidence contracts/testing.md#execution-ownership This named test-unplugin source unit exercises the observer's real registration and filesystem proofs through captured backend handles and callbacks. No native observer, compiler, installed consumer or Vite host runs. Temporary inputs and each observer are released by their existing owners; anonymous backend callbacks remain review-owned.
 */
export async function test_input_observer_reuses_only_current_covering_external_scopes(): Promise<void> {
  const failures: Error[] = [];
  for (const scenario of ["shared", "failed", "replaced", "escaping", "race"] as const) {
    const base = fs.realpathSync.native(TestProject.tmpdir("ttsc-scope-sharing-"));
    const root = path.join(base, "project");
    const external = path.join(base, "external");
    fs.mkdirSync(root);
    fs.mkdirSync(external);
    const handles: Array<{
      root: string;
      closed: number;
      tracked: string[];
      admit?: (directory: string) => boolean;
      event: (type: string, file: string | null) => void;
      fail: () => void;
    }> = [];
    const changed = new Set<string>();
    let poll: (() => void) | undefined;
    const observer = createInputObserver((change) => {
      for (const owner of change.reload) changed.add(owner);
    }, {
      watch(scope, event, fail, admit) {
        const handle = { root: scope, closed: 0, tracked: [] as string[], admit, event, fail };
        handles.push(handle);
        return {
          close: () => { handle.closed += 1; },
          track: (file) => { handle.tracked.push(file); },
          prune: () => {},
        };
      },
      poll(listener) { poll = listener; return { close: () => { poll = undefined; } }; },
    });
    const missing = (file: string) => ({
      file,
      evidence: { identity: file, missing: true, state: {
        codec: "predicates" as const, observation: { fileExists: false },
      } },
    });
    try {
      observer.open(root, false);
      const parentInput = path.join(external, "parent.d.ts");
      observer.replace(path.join(root, "parent.ts"), [missing(parentInput)]);
      const parent = handles[1]!;
      assert.equal(parent.root, external);
      if (scenario === "shared") {
        const children = Array.from({ length: 20 }, (_, index) => {
          const directory = path.join(external, `child${index}`);
          fs.mkdirSync(directory);
          return missing(path.join(directory, "input.d.ts"));
        });
        const childOwner = path.join(root, "children.ts");
        observer.replace(childOwner, children);
        assert.equal(handles.length, 2, "nested candidates share one external scope");
        assert.equal(parent.tracked.length, 21);
        assert.equal(parent.admit?.(path.dirname(children[0]!.file)), true);
        for (let index = 0; index < 15; index++) {
          const sibling = path.join(base, `external-sibling${index}`);
          fs.mkdirSync(sibling);
          observer.replace(path.join(root, `sibling${index}.ts`), [missing(path.join(sibling, "input.d.ts"))]);
        }
        assert.equal(handles.length, 17, "prefix siblings need independent scopes");
        const afterCap = path.join(external, "after-cap");
        fs.mkdirSync(afterCap);
        observer.replace(path.join(root, "after-cap.ts"), [missing(path.join(afterCap, "input.d.ts"))]);
        assert.equal(handles.length, 17);
        assert.ok(parent.tracked.includes(path.join(afterCap, "input.d.ts")), "reuse precedes the cap");
        observer.forget(path.join(root, "parent.ts"));
        assert.equal(parent.closed, 0, "descendant owners retain the shared scope");
        fs.writeFileSync(children[0]!.file, "export {};\n");
        parent.event("rename", children[0]!.file);
        await new Promise((resolve) => setTimeout(resolve, 30));
        assert.ok(changed.has(childOwner), "a shared scope event reaches its descendant owner");
        observer.forget(childOwner);
        assert.equal(parent.admit?.(path.dirname(children[1]!.file)), false, "withdrawal removes directory contributions");
        observer.forget(path.join(root, "after-cap.ts"));
        assert.equal(parent.closed, 1, "last owner releases the shared scope");
      } else {
        const child = path.join(external, "child");
        if (scenario === "failed") parent.fail();
        if (scenario === "replaced") {
          await TestProject.rename(external, `${external}-old`);
          fs.mkdirSync(external);
        }
        if (scenario === "escaping") {
          const target = path.join(base, "outside");
          fs.mkdirSync(target);
          fs.symlinkSync(target, child, process.platform === "win32" ? "junction" : "dir");
        } else fs.mkdirSync(child);
        const startedAt = observer.begin();
        if (scenario === "race") fs.writeFileSync(path.join(child, "input.d.ts"), "export {};\n");
        const childOwner = path.join(root, "child.ts");
        observer.replace(childOwner, [missing(path.join(child, "input.d.ts"))], false, startedAt);
        if (scenario === "race") {
          assert.equal(handles.length, 2);
          assert.ok(changed.has(childOwner), "new shared admission replays the compile-to-subscribe window");
        } else {
          assert.ok(handles.length > 2, "invalid covering authority needs its own scope");
          assert.equal(parent.tracked.length, 1, "invalid ancestor cannot admit the new descendant");
          if (scenario !== "escaping") assert.equal(parent.closed, 1);
        }
        assert.ok(poll, "external identities remain subject to polling");
      }
    } catch (cause) {
      failures.push(new Error(scenario, { cause }));
    } finally {
      await observer.dispose();
      for (const handle of handles) {
        if (handle.closed !== 1) failures.push(new Error(`${scenario}: ${handle.root} closed ${handle.closed} times`));
      }
    }
  }
  if (failures.length !== 0) throw new AggregateError(failures, "external scope sharing");
}

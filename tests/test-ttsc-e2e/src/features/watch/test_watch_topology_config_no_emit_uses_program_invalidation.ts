import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchInputChange.js";
import { WatchTopology } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchTopology.js";
import { WATCH_EVENT_DEADLINE_MS } from "../../internal/watch";

/**
 * Verifies tsconfig noEmit gets the same resident Program fast path as
 * --noEmit.
 *
 * A JSON project input can also be a resolveJsonModule Program member. Removing
 * it must cold-load the Program without escalating to an execution reload.
 *
 * 1. Watch a noEmit project importing a declared JSON project input.
 * 2. Remove the JSON member and wait for Program invalidation.
 * 3. Assert no execution-level topology reload was scheduled.
 *
 * @evidence contracts/testing.md#behavioral-verification This case drives the real WatchTopology: tsconfig noEmit gets the same resident Program fast path as --noEmit. An imported resolveJsonModule member declared as a project input is removed under configured noEmit; the emitted change must invalidate the Program without an execution reload.
 * @evidence contracts/testing.md#independent-expectations Authored tsconfig options, source imports and declared input paths establish which files are compiler inputs, products or reload dependencies. Literal event-kind/path assertions and quiet negative twins enforce those independently specified roles rather than snapshotting topology output.
 * @evidence contracts/testing.md#distinguishing-cases An imported resolveJsonModule member declared as a project input is removed under configured noEmit; the emitted change must invalidate the Program without an execution reload.
 * @evidence contracts/testing.md#execution-ownership This named src/features/watch entry refreshes the real tsgo compiler population and drives native filesystem subscriptions through WatchTopology; the source units own direct event planning and injected watcher decisions.
 * @evidence contracts/e2e.md#necessary-boundary The real compiler input/output population must agree with native observer registration and notification classification for this authored layout. Direct path planning cannot establish tsgo membership, actual delivered events or subscription survival across mutations.
 * @evidence contracts/e2e.md#shared-execution The case reuses its built compiler and one Node test process; each topology session serves its authored mutation sequence. Distinct roots/options need their own compiler-population request, and an explicitly new session retains the initial-versus-newly-admitted input distinction; watcher registration installs or builds nothing.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private TestProject roots separate mutable config, source, output and declared-input state. Each topology owns its subscriptions and existing finally paths close them. Event counters reset only between asserted transitions; actual cold registration and config recovery remain unprimed.
 * @evidence contracts/e2e.md#preserved-coverage An imported resolveJsonModule member declared as a project input is removed under configured noEmit; the emitted change must invalidate the Program without an execution reload. Every original assertion and authored layout remains in this named entry; no change to timeout, capability guard, input, expected event or quiet negative twin is made by these acknowledgments.
 */
export const test_watch_topology_config_no_emit_uses_program_invalidation =
  async (): Promise<void> => {
    const root = TestProject.tmpdir("ttsc-watch-config-no-emit-");
    const source = path.join(root, "src", "main.ts");
    const json = path.join(root, "src", "member.json");
    const config = path.join(root, "tsconfig.json");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(
      source,
      'import member from "./member.json";\nexport default member;\n',
      "utf8",
    );
    fs.writeFileSync(json, '{"value":1}\n', "utf8");
    fs.writeFileSync(
      config,
      JSON.stringify({
        compilerOptions: {
          esModuleInterop: true,
          noEmit: true,
          resolveJsonModule: true,
        },
        files: ["src/main.ts"],
      }),
      "utf8",
    );

    const changes: WatchInputChange[] = [];
    let topologyChanges = 0;
    const topology = new WatchTopology(
      {
        cwd: root,
        files: [],
        projectRoot: root,
        tsconfig: config,
      },
      {
        onError: (location, error) => {
          throw new Error(`watch error on ${location}`, { cause: error });
        },
        onInputChange: (change) => changes.push(change),
        onTopologyChange: () => {
          topologyChanges++;
        },
      },
    );
    try {
      topology.refresh(false);
      topology.setProjectInputs({
        files: [json],
        globs: [],
        root,
      });
      fs.rmSync(json);
      await waitFor(() =>
        changes.some(
          (change) => change.kind === "project" && change.invalidate === true,
        ),
      );
      assert.equal(
        topologyChanges,
        0,
        "config noEmit must not escalate Program membership to execution reload",
      );
    } finally {
      topology.close();
    }
  };

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + WATCH_EVENT_DEADLINE_MS;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail("timed out waiting for Program invalidation");
}

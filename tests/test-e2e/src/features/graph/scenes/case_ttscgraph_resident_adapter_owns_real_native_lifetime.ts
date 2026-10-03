import { TtscGraphSession } from "@ttsc/graph";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { FixtureFiles } from "../../../internal/FixtureFiles";
import { installedTargetBoundary } from "../../../internal/graph/internal/installedTargetBoundary";
import { resolveTtscgraphBinary } from "../../../internal/graph/internal/ttsgraph";

interface Peer {
  alive(): boolean;
}
interface Internals {
  state: { child?: Peer; pending: Map<number, unknown> };
  artifacts?: { file: string | null };
}

/** Poll actual child exit while retaining only the handle this case owns. */
async function exited(peer: Peer): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (peer.alive()) {
    assert.ok(Date.now() < deadline, "owned native graph child did not exit");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** Wait only queue microtasks, before Node can deliver a native response. */
async function active(owner: Internals): Promise<Peer> {
  for (let turn = 0; turn < 20; turn++) {
    if (owner.state.pending.size === 1 && owner.state.child !== undefined)
      return owner.state.child;
    await Promise.resolve();
  }
  assert.fail("native request did not acquire pending ownership");
}

/**
 * Verifies the default resident adapter owns real native I/O and retirement.
 *
 * Source state inputs do not establish that Node's pipes reach the compiler or
 * that retirement reaches the kernel. This control drives the actual default
 * adapter with the real native producer, then observes actual child exits.
 *
 * 1. Read a real declaration twice through the public resident facade and require
 *    unchanged model identity.
 * 2. Abort a confirmed active write and require that producer to exit, then
 *    recover on a replacement.
 * 3. Close active and queued calls twice, require one settlement each and actual
 *    exit, and forbid respawn.
 *
 * @evidence contracts/testing.md#behavioral-verification The workspace-built public session uses its default Node adapter and explicitly selected actual native binary; real nodes, unchanged identity, AbortError, replacement identity, exactly-once close settlements and actual process exit are checked.
 * @evidence contracts/testing.md#independent-expectations A literal exported function defines the expected compiler fact; read-only pending/child observations establish active ownership and actual exitCode/signal-based liveness, with literal terminal errors and settlement counters.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged reuse contrasts active abort and replacement, then terminal close contrasts retryable retirement; a resolved no-publisher artifact answer is checked separately from unavailable discovery.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_graph, this exported scene imports the workspace package lib entry and exercises its default adapter, actual Node pipes and the selected real native producer. This is not a packed SDK installation or a proof of loaded executable image identity. Authored State units in tests/test-graph/src/features own scripted port policy separately and do not replace this actual connection.
 * @evidence contracts/e2e.md#necessary-boundary Only this real process boundary can connect state retirement to Node stream termination and kernel child exit while confirming producer frames pass the built runtime validator.
 * @evidence contracts/e2e.md#shared-execution The authored target package layout also supplies this original resident declaration, empty-artifact discovery and HTTP viewer inputs. The facade here is workspace-built and the explicit native selection is independent of that target resolution profile. This public session shares initial/unchanged work; active abort requires one replacement, and both terminal requests share it. Sharing directories does not remove either required native lifetime; unchanged returned model identity is not compiler Program identity or construction-count evidence.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Original resident config temporarily applies while this distinct public session owns its cold generation. Discovery may already be warm, so cold capability discovery is not claimed. Finally awaits close and attempts every peer join before restoring config. Unconfirmed closure retains the project and blocks dependent reuse without changing inputs an unresolved process may read; restoration failure also blocks reuse.
 * @evidence contracts/e2e.md#preserved-coverage Direct policy owners include tests/test-graph/src/features/test_ttscgraph_native_request_abort_restarts_session.ts, test_ttscgraph_queued_native_request_can_abort_before_start.ts, test_ttscgraph_native_session_close_terminates_child_once.ts and test_ttscgraph_session_states_its_artifacts_on_every_request.ts, selected by the existing features runner/claim. Those authored port matrices are not actual process-survival evidence; real retirement, no-publisher discovery, stdio decoding and native recovery remain here rather than being asserted from recorded unit-port calls.
 */
export async function case_ttscgraph_resident_adapter_owns_real_native_lifetime(): Promise<void> {
  const target = installedTargetBoundary();
  const root = target.root;
  const configFile = path.join(root, "tsconfig.json");
  const original = fs.readFileSync(configFile);
  const session = new TtscGraphSession({
    cwd: root,
    tsconfig: "tsconfig.json",
    binary: resolveTtscgraphBinary(),
  });
  const owner = session as unknown as Internals;
  const peers = new Set<Peer>();
  const primaryFailures: unknown[] = [];
  try {
    fs.writeFileSync(
      configFile,
      FixtureFiles.read(
        "graph/ttscgraph_resident_adapter_owns_real_native_lifetime/inputs-1",
      )["tsconfig.json"]!,
    );
    const first = await session.graph();
    peers.add(owner.state.child!);
    assert.ok(
      first.nodes.some((node) => node.name === "NativeResidentControl"),
    );
    assert.equal(await session.graph(), first);
    assert.equal(
      owner.artifacts?.file,
      null,
      "no-publisher discovery did not resolve an empty artifact answer",
    );

    const controller = new AbortController();
    const aborted = session.graph({ signal: controller.signal });
    const old = await active(owner);
    peers.add(old);
    controller.abort({
      toString(): string {
        throw new Error("unprintable cancellation reason");
      },
    });
    await assert.rejects(aborted, /native snapshot request cancelled/);
    await exited(old);
    const recovered = await session.graph();
    assert.ok(
      recovered.nodes.some((node) => node.name === "NativeResidentControl"),
    );
    assert.notEqual(owner.state.child, old);
    peers.add(owner.state.child!);

    let activeSettlements = 0;
    let queuedSettlements = 0;
    const head = session.graph().finally(() => {
      activeSettlements++;
    });
    const queued = session.graph().finally(() => {
      queuedSettlements++;
    });
    const current = await active(owner);
    const closure = Promise.allSettled([session.close(), session.close()]);
    await assert.rejects(head, /native session closed/);
    await assert.rejects(queued, /native session is closed/);
    assert.equal(activeSettlements, 1);
    assert.equal(queuedSettlements, 1);
    assert.equal(owner.state.pending.size, 0);
    for (const result of await closure)
      if (result.status === "rejected") throw result.reason;
    await exited(current);
    await assert.rejects(session.graph(), /native session is closed/);
    assert.equal(peers.size, 2);
  } catch (error) {
    primaryFailures.push(error);
    throw error;
  } finally {
    const cleanupErrors: unknown[] = [];
    if (owner.state.child !== undefined) peers.add(owner.state.child);
    try {
      await session.close();
    } catch (error) {
      cleanupErrors.push(error);
    }
    for (const peer of peers) {
      try {
        await exited(peer);
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (cleanupErrors.length)
      try {
        target.retainUnjoined(
          "Resident graph peer or sidecar closure was not established",
        );
      } catch (error) {
        cleanupErrors.push(error);
      }
    else {
      try {
        fs.writeFileSync(configFile, original);
      } catch (error) {
        cleanupErrors.push(error);
        target.preventReuse("Resident profile config restoration failed");
      }
    }
    if (cleanupErrors.length)
      throw new AggregateError(
        [...primaryFailures, ...cleanupErrors],
        "Resident assertions and peer cleanup failed",
      );
  }
}

import { TtscGraphSession } from "@ttsc/graph";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { resolveTtscgraphBinary } from "../internal/ttsgraph";

interface Peer { alive(): boolean; }
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
    if (owner.state.pending.size === 1 && owner.state.child !== undefined) return owner.state.child;
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
 * 1. Read a real declaration twice through the public resident facade and require unchanged model identity.
 * 2. Abort a confirmed active write and require that producer to exit, then recover on a replacement.
 * 3. Close active and queued calls twice, require one settlement each and actual exit, and forbid respawn.
 *
 * @evidence contracts/testing.md#behavioral-verification The public installed session uses its default Node adapter and actual native binary; real nodes, unchanged identity, AbortError, replacement identity, exactly-once close settlements and actual process exit are checked.
 * @evidence contracts/testing.md#independent-expectations A literal exported function defines the expected compiler fact; read-only pending/child observations establish active ownership and actual exitCode/signal-based liveness, with literal terminal errors and settlement counters.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged reuse contrasts active abort and replacement, then terminal close contrasts retryable retirement; a resolved no-publisher artifact answer is checked separately from unavailable discovery.
 * @evidence contracts/testing.md#execution-ownership This features entry exercises installed generated graph JavaScript, actual Node pipes and the real canonical native producer. Pure state matrices execute in src/unit and never manufacture native replies.
 * @evidence contracts/e2e.md#necessary-boundary Only this real process boundary can connect state retirement to Node stream termination and kernel child exit while confirming producer frames pass the installed generated validator.
 * @evidence contracts/e2e.md#shared-execution One project and public session share the initial and unchanged compiler work; active abort requires one replacement, and both terminal requests share that replacement. No per-error fake executable is built.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Case-owned source/config and session preserve cold publication and generation state; finally closes the session and joins every observed real peer, including assertion failures.
 * @evidence contracts/e2e.md#preserved-coverage Original fake-peer semantic assertions reside in direct state units; real retirement, no-publisher discovery, stdio decoding and native recovery remain here rather than being asserted from recorded unit-port calls.
 */
export async function test_ttscgraph_resident_adapter_owns_real_native_lifetime(): Promise<void> {
  const root = TestProject.createProject({
    "package.json": '{"name":"resident-native-boundary"}',
    "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true, target: "ES2022", module: "commonjs" }, include: ["src"] }),
    "src/app.ts": "export function NativeResidentControl(): void {}\n",
  });
  const session = new TtscGraphSession({ cwd: root, tsconfig: "tsconfig.json", binary: resolveTtscgraphBinary() });
  const owner = session as unknown as Internals;
  const peers = new Set<Peer>();
  try {
    const first = await session.graph();
    peers.add(owner.state.child!);
    assert.ok(first.nodes.some((node) => node.name === "NativeResidentControl"));
    assert.equal(await session.graph(), first);
    assert.equal(owner.artifacts?.file, null, "no-publisher discovery did not resolve an empty artifact answer");

    const controller = new AbortController();
    const aborted = session.graph({ signal: controller.signal });
    const old = await active(owner);
    peers.add(old);
    controller.abort({ toString(): string { throw new Error("unprintable cancellation reason"); } });
    await assert.rejects(aborted, /native snapshot request cancelled/);
    await exited(old);
    const recovered = await session.graph();
    assert.ok(recovered.nodes.some((node) => node.name === "NativeResidentControl"));
    assert.notEqual(owner.state.child, old);
    peers.add(owner.state.child!);

    let activeSettlements = 0;
    let queuedSettlements = 0;
    const head = session.graph().finally(() => { activeSettlements++; });
    const queued = session.graph().finally(() => { queuedSettlements++; });
    const current = await active(owner);
    session.close(); session.close();
    await assert.rejects(head, /native session closed/);
    await assert.rejects(queued, /native session is closed/);
    assert.equal(activeSettlements, 1);
    assert.equal(queuedSettlements, 1);
    assert.equal(owner.state.pending.size, 0);
    await exited(current);
    await assert.rejects(session.graph(), /native session is closed/);
    assert.equal(peers.size, 2);
  } finally {
    if (owner.state.child !== undefined) peers.add(owner.state.child);
    session.close();
    for (const peer of peers) await exited(peer);
  }
}

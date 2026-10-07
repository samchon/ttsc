import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { BatchWorkspace } from "../../../batch/BatchWorkspace";
import {
  ColdArtifactObservation,
  artifactExchanges,
  bounded,
} from "../../../internal/graph/internal/ColdArtifactObservation";
import {
  TtsgraphClient,
  resolveGraphLauncher,
  resolveTtscgraphBinary,
} from "../../../internal/graph/internal/ttsgraph";

/**
 * Connect actual cold publisher preparation to transport EOF and caller abort.
 *
 * The ordinary graph batch owns successful cold publication, warm reuse and
 * document freshness. These two additional lifetimes must start without a
 * published source profile; both retain the batch's real publisher and SDK.
 *
 * 1. Observe an actual cold Go build, require tools/list while it runs, then EOF.
 * 2. Abort another actual cold public session, observe its original producer
 *    retire, then require queued recovery, unchanged reuse and terminal close.
 * 3. Join owners and independently observe original process generations gone;
 *    canceled preparation must publish no exchange or native graph late start.
 *
 * @evidence contracts/testing.md#behavioral-verification Real built MCP and public Session actors discover the configured lint/Evidence publisher from the shared graph root. Cold readiness combines actual live Go process identity with matching source-key/scratch/argv trace and nonempty Go-generated compiler work. EOF, explicit signal cancellation, subsequent recovery and terminal admission are checked through public owners.
 * @evidence contracts/testing.md#independent-expectations The authored Markdown address defines the recovered artifact; literal AbortError and original reason text define caller cancellation. Native OS process generations, Go-owned work files and exact producer spawn/close receipts independently distinguish execution and retirement. A nonce sampled before an OS query requires an active-Go scan started after the transport response. A begin trace or guard alone cannot establish execution.
 * @evidence contracts/testing.md#distinguishing-cases MCP EOF during active cold preparation differs from public caller abort followed by queued recovery and terminal close. Empty unique plugin caches retain cold source-profile misses while the ordinary shared Go object cache remains unchanged. Warm/freshness and unavailable/absent-publisher semantics remain with the graph batch and source units.
 * @evidence contracts/testing.md#execution-ownership The existing graph batch invokes this scene with its shared workspace. Two actual built product lifetimes use the same configured publisher, SDK and native platform; an isolated Node actor supplies only public AbortSignal control. OS observation actors produce no compiler or graph answers.
 * @evidence contracts/e2e.md#necessary-boundary Event-loop responsiveness, stdin EOF, SDK worker/native process containment and source preparation cannot be certified by the portable injected discovery unit or command-only RPC test.
 * @evidence contracts/e2e.md#shared-execution The batch's actual graphRoot and immutable lint/Evidence dependency population serve both rows without another installation or source fixture copy. Conflicting cold caches and terminal lifetimes require two actors; Go objects are shared normally. Recovery reuses the canceled actor's original cache, source selection and public session.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each tracked row allocation starts with empty plugin cache, trace and Go work directories. Configured fixture sources remain unchanged; row reclamation requires qualified original product close, original actor and OS observer closure plus independent process-generation absence. Windows input observations follow the original outer Job owner as well as its inner target waiter and Go process. Exact admitted guards and task scratch must retire after native joining, and cancellation must publish no binary. Existing interrupted Go work is recorded separately from new or modified work after closure. Unconfirmed closure retains the row and batch; cleanup failures remain selected failures.
 * @evidence contracts/e2e.md#preserved-coverage Adds configured-publisher cold EOF and public cold cancellation/recovery that command-only native/RPC tests do not cover. Existing graph first publication, artifact content refresh and graph-free escape remain in the enclosing batch. MCP cancellation notifications are not asserted to bind an AbortSignal.
 */
export async function case_ttscgraph_cold_artifact_preparation_owns_cancel_and_eof(
  workspace: BatchWorkspace.Workspace,
): Promise<void> {
  const failures: unknown[] = [];
  for (const [name, run] of [
    ["cold MCP EOF", mcp],
    ["cold public Session cancellation", session],
  ] as const) {
    try {
      await BatchWorkspace.open();
      await run(workspace);
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "Cold graph preparation lifecycle failures",
    );
}

function allocation(name: string) {
  const root = TestProject.tmpdir(name);
  const cache = path.join(root, "plugins");
  const trace = path.join(root, "trace");
  const goTmp = path.join(root, "go-tmp");
  for (const directory of [cache, trace, goTmp]) {
    fs.mkdirSync(directory);
    assert.deepEqual(fs.readdirSync(directory), []);
  }
  return {
    root,
    cache,
    trace,
    goTmp,
    env: {
      ...process.env,
      TTSC_CACHE_DIR: cache,
      TTSC_GO_CACHE_DIR: TestProject.sharedGoBuildCache(),
      TTSC_E2E_TRACE: trace,
      GOTMPDIR: goTmp,
      TTSC_GRAPH_BINARY: resolveTtscgraphBinary(),
    },
  };
}

function closeReceipt(
  child: ChildProcess,
): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  const result = new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve, reject) => {
    child.on("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  void result.catch(() => undefined);
  return result;
}

async function mcp(workspace: BatchWorkspace.Workspace): Promise<void> {
  const row = allocation("graph-cold-eof-");
  const nativeReceipt = path.join(row.root, "native-starts.jsonl");
  fs.writeFileSync(nativeReceipt, "", { flag: "wx" });
  const child = spawn(
    process.execPath,
    [
      "--import",
      new URL(
        "../../../internal/graph/internal/nativeSpawnObserver.mjs",
        import.meta.url,
      ).href,
      resolveGraphLauncher(),
      "--cwd",
      workspace.graphRoot,
    ],
    {
      env: { ...row.env, TTSC_E2E_GRAPH_SPAWN_RECEIPT: nativeReceipt },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  const completion = closeReceipt(child);
  const client = TtsgraphClient.connect(child, nativeReceipt);
  const observed = new ColdArtifactObservation(child.pid!, row.root);
  const failures: unknown[] = [];
  let joined = false;
  let observerJoined = false;
  let retiredWork: string[] | undefined;
  try {
    await observed.ready();
    await client.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "cold-lifecycle", version: "1" },
    });
    client.notify("notifications/initialized", {});
    const pending = client.request("tools/call", {
      name: "inspect_typescript_graph",
      arguments: {
        question: "Read the configured Markdown artifact.",
        draft: { type: "details", reason: "Observe the actual publisher." },
        review: "Use the configured publisher.",
        request: {
          type: "details",
          handles: ["docs/contract.md#accepted-value"],
        },
      },
    });
    void pending.catch(() => undefined);
    const first = await observed.build(row.trace, row.cache, row.goTmp);
    const tools = await client.request("tools/list", {});
    assert.ok(tools && typeof tools === "object");
    await observed.active(first);
    assert.equal(
      client.nativeSpawnCount(),
      0,
      "cold publication admitted native graph before completion",
    );
    assert.deepEqual(artifactExchanges(child.pid!), []);
    client.endStdin();
    assert.equal(await client.waitForExit(), 0, client.stderrText());
    assert.deepEqual(await completion, { code: 0, signal: null });
    await observed.absent(first);
    await observed.joined();
    await observed.retired(first);
    retiredWork = workSnapshot(row.goTmp);
    client.assertNativeChildrenJoined();
    assert.equal(
      client.nativeSpawnCount(),
      0,
      "EOF allowed a late native graph admission",
    );
    assert.deepEqual(
      artifactExchanges(child.pid!),
      [],
      "EOF allowed late artifact publication",
    );
    await assert.rejects(pending);
    joined = true;
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      client.endStdin();
      assert.deepEqual(
        await bounded(
          completion,
          30_000,
          "Cold MCP original close remained unresolved",
        ),
        { code: 0, signal: null },
        "MCP EOF did not acknowledge successful session closure",
      );
      await observed.joined();
      joined = true;
    } catch (error) {
      failures.push(error);
    }
    try {
      await observed.close();
    } catch (error) {
      failures.push(error);
    } finally {
      observerJoined = observed.isJoined;
    }
    if (retiredWork !== undefined) {
      try {
        assert.deepEqual(
          workSnapshot(row.goTmp),
          retiredWork,
          "Go work changed after original EOF owner joined",
        );
      } catch (error) {
        failures.push(error);
      }
    }
    if (!joined || !observerJoined)
      retain(row.root, "Cold MCP preparation or observer readers did not join");
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "Cold MCP assertions and cleanup failed",
    );
}

async function session(workspace: BatchWorkspace.Workspace): Promise<void> {
  const row = allocation("graph-cold-cancel-");
  const report = path.join(row.root, "actor.jsonl");
  const nativeReceipt = path.join(row.root, "native-starts.jsonl");
  fs.writeFileSync(nativeReceipt, "", { flag: "wx" });
  const child = spawn(
    process.execPath,
    [
      "--import",
      new URL(
        "../../../internal/graph/internal/nativeSpawnObserver.mjs",
        import.meta.url,
      ).href,
      path.resolve(
        import.meta.dirname,
        "../../../../fixtures/graph/cold-artifact-session-actor.cjs",
      ),
      path.join(path.dirname(resolveGraphLauncher()), "index.js"),
      workspace.graphRoot,
      resolveTtscgraphBinary(),
      report,
    ],
    {
      env: { ...row.env, TTSC_E2E_GRAPH_SPAWN_RECEIPT: nativeReceipt },
      stdio: ["pipe", "pipe", "pipe", "ipc"],
      windowsHide: true,
    },
  );
  const completion = closeReceipt(child);
  const events = new Set<string>();
  let stderr = "";
  child.stdout!.on("data", (chunk) =>
    fs.appendFileSync(path.join(row.root, "stdout.log"), chunk),
  );
  child.stderr!.on("data", (chunk) => {
    stderr += String(chunk);
    fs.appendFileSync(path.join(row.root, "stderr.log"), chunk);
  });
  child.on("message", (message: { event?: string }) => {
    if (message.event) events.add(message.event);
  });
  let exited = false;
  child.once("close", () => {
    exited = true;
  });
  const wait = async (event: string, milliseconds = 120_000) => {
    const deadline = Date.now() + milliseconds;
    while (!events.has(event)) {
      if (events.has("failed"))
        throw new Error(
          `Public session actor failed: ${fs.readFileSync(report, "utf8")} ${stderr}`,
        );
      if (exited)
        throw new Error(
          `Public session actor exited before ${event}: ${stderr}`,
        );
      if (Date.now() >= deadline)
        throw new Error(`Public session ${event} exceeded ${milliseconds}ms`);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  };
  const observed = new ColdArtifactObservation(child.pid!, row.root);
  const failures: unknown[] = [];
  let joined = false;
  let observerJoined = false;
  let retiredWork: string[] | undefined;
  try {
    await observed.ready();
    await wait("ready");
    child.send("start");
    const first = await observed.build(row.trace, row.cache, row.goTmp);
    child.send("abort");
    await observed.absent(first);
    await observed.retired(first);
    assert.deepEqual(
      artifactExchanges(child.pid!),
      [],
      "cancelled cold preparation published artifacts",
    );
    assert.deepEqual(
      nativeReceipts(nativeReceipt),
      [],
      "cancelled preparation admitted native graph",
    );
    const oldWork = new Set(fs.readdirSync(row.goTmp));
    child.send("recover");
    await observed.build(row.trace, row.cache, row.goTmp, first, oldWork);
    await wait("cancelled");
    await wait("recovered");
    const published = artifactExchanges(child.pid!);
    assert.equal(
      nativeReceipts(nativeReceipt).filter((entry) => entry.event === "spawned")
        .length,
      1,
    );
    child.send("close");
    await wait("closed", 30_000);
    assert.deepEqual(
      await bounded(completion, 30_000, "Public session actor did not close"),
      { code: 0, signal: null },
    );
    await observed.joined();
    retiredWork = workSnapshot(row.goTmp);
    const receipts = nativeReceipts(nativeReceipt);
    assert.deepEqual(
      receipts
        .filter((entry) => entry.event === "spawned")
        .map((entry) => entry.id),
      receipts
        .filter((entry) => entry.event === "closed")
        .map((entry) => entry.id),
    );
    assert.ok(
      artifactExchanges(child.pid!).every((entry) => published.includes(entry)),
      "terminal close published a late artifact exchange",
    );
    joined = true;
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      if (child.connected) {
        child.send("abort");
        child.send("close");
      }
      await bounded(
        completion,
        30_000,
        "Public session original close remained unresolved",
      );
      assert.ok(
        events.has("closed") || events.has("closed-after-failure"),
        "Public session did not acknowledge fulfilled original close",
      );
      await observed.joined();
      joined = true;
    } catch (error) {
      failures.push(error);
    }
    try {
      await observed.close();
    } catch (error) {
      failures.push(error);
    } finally {
      observerJoined = observed.isJoined;
    }
    if (retiredWork !== undefined) {
      try {
        assert.deepEqual(
          workSnapshot(row.goTmp),
          retiredWork,
          "Go work changed after original Session close joined",
        );
      } catch (error) {
        failures.push(error);
      }
    }
    if (!joined || !observerJoined)
      retain(row.root, "Cold public session or observer readers did not join");
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "Cold public session assertions and cleanup failed",
    );
}

function nativeReceipts(file: string): { event: string; id: number }[] {
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

/** Retained old Go work differs from new or modified work after owner closure. */
function workSnapshot(root: string): string[] {
  const result: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      const stat = fs.lstatSync(file);
      result.push(
        `${path.relative(root, file)}:${stat.birthtimeMs}:${stat.size}:${stat.mtimeMs}`,
      );
      if (entry.isDirectory()) visit(file);
    }
  };
  visit(root);
  return result.sort();
}

function retain(root: string, reason: string): void {
  TestProject.retainTemporaryDirectory(root, reason);
  BatchWorkspace.retain(reason);
}

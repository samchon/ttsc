import assert from "node:assert/strict";
import type { CapabilityPluginResolver } from "ttsc";

import {
  artifactsAreStaleResident,
  publishArtifactsResident,
} from "../../../../packages/graph/src/model/publishedArtifacts";
import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies resident publication awaits its owning discovery and joins cancelled
 * verbs.
 *
 * Explicit resolver and daemon contracts expose admission and release without
 * starting a compiler, worker or native product process.
 *
 * 1. Suspend cold discovery, cancel it and return a late proof; require release
 *    without publication.
 * 2. Publish through direct fallback and require both ordered phases and original
 *    proof freshness.
 * 3. Cancel two fallback commands and require every command to settle before proof
 *    release.
 * 4. Cancel a daemon request and join its close before releasing publication
 *    authority.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual publishArtifactsResident and artifactsAreStaleResident with explicit SDK/daemon contract implementations. Late cancelled discovery must release once without running verbs; direct fallback preserves argv and phase order, freshness calls the original proof, and cancelled publisher phases join every owner before release.
 * @evidence contracts/testing.md#independent-expectations Authored gates, cancellation signals, command arguments and event order define the oracle independently of publication code. Empty graph output is legitimate resolved absence; this unit does not certify SDK worker execution or kernel process containment.
 * @evidence contracts/testing.md#distinguishing-cases Cold unresolved discovery, already-aborted admission, fresh/withdrawn proof, resolved/unavailable empty lookups, cancellation during a false freshness reply, release failure preserving cancellation, two publisher commands with asymmetric cancellation completion, and successful/failed daemon close retain separate failure identities. Real native cold builds belong to the installed E2E population.
 * @evidence contracts/testing.md#execution-ownership Runs the portable publication owner directly in the source-unit process with explicit dependency contracts and temporary project coordinates. No foreign method is replaced and no native artifact, worker, compiler Program or product host is launched.
 */
export async function test_resident_artifact_publication_owns_async_discovery_and_cancellation(): Promise<void> {
  const cwd = TestProject.tmpdir("graph-resident-publication-");
  const options = { cwd, tsconfig: "tsconfig.json" };
  const plugin = {
    binary: "publisher",
    manifest: "manifest",
    projectContext: "context",
  };
  let releaseCount = 0;
  let resolveCount = 0;
  let commands = 0;
  let current = true;
  let freshnessCalls = 0;
  const proof: CapabilityPluginResolver.Resolution = {
    status: "resolved",
    plugins: [plugin],
    isCurrent: async () => {
      freshnessCalls++;
      return current;
    },
    release: async () => {
      releaseCount++;
    },
  };
  let finishDiscovery!: (proof: CapabilityPluginResolver.Resolution) => void;
  const discovery = new Promise<CapabilityPluginResolver.Resolution>(
    (resolve) => {
      finishDiscovery = resolve;
    },
  );
  const cancelled = new AbortController();
  const cold = publishArtifactsResident(
    { ...options, signal: cancelled.signal },
    () => undefined,
    {
      resolve: async (_options, request) => {
        resolveCount++;
        assert.equal(request?.signal, cancelled.signal);
        return discovery;
      },
      runCommand: async () => {
        commands++;
        throw new Error("unexpected command");
      },
    },
  );
  void cold.catch(() => undefined);
  assert.equal(resolveCount, 1);
  assert.equal(commands, 0);
  cancelled.abort(new DOMException("cancelled cold discovery", "AbortError"));
  finishDiscovery(proof);
  await assert.rejects(cold, { name: "AbortError" });
  assert.equal(releaseCount, 1);
  assert.equal(commands, 0);
  await assert.rejects(
    publishArtifactsResident(
      { ...options, signal: cancelled.signal },
      () => undefined,
      {
        resolve: async () => {
          resolveCount++;
          return proof;
        },
        runCommand: async () => {
          throw new Error("unexpected command");
        },
      },
    ),
    { name: "AbortError" },
  );
  assert.equal(resolveCount, 1);

  const verbs: string[] = [];
  const published = await publishArtifactsResident(options, () => undefined, {
    resolve: async () => proof,
    runCommand: async (command, args, spawnOptions, request) => {
      assert.equal(command, plugin.binary);
      assert.deepEqual(args.slice(1, 6), [
        "--cwd",
        cwd,
        "--tsconfig",
        options.tsconfig,
        "--plugins-json=manifest",
      ]);
      assert.ok(args.includes("--project-context-json=context"));
      assert.equal(spawnOptions.windowsHide, true);
      assert.equal(request?.signal, undefined);
      verbs.push(args[0]!);
      return {
        pid: 1,
        output: [],
        stdout: args[0] === "project-inputs" ? "{}" : "[]",
        stderr: "",
        status: 0,
        signal: null,
      };
    },
  });
  assert.deepEqual(verbs, ["project-inputs", "graph-nodes"]);
  assert.equal(published.file, null);
  assert.equal(published.discovery, proof);
  assert.equal(await artifactsAreStaleResident(published), false);
  current = false;
  assert.equal(await artifactsAreStaleResident(published), true);
  assert.equal(freshnessCalls, 2);
  await published.discovery.release();
  assert.equal(releaseCount, 2);
  for (const status of ["resolved", "unavailable"] as const) {
    const absent = await publishArtifactsResident(
      options,
      () => {
        assert.fail("an empty lookup must not open a publisher");
      },
      {
        resolve: async () => ({
          ...proof,
          status,
          plugins: [],
          release: async () => undefined,
        }),
        runCommand: async () => {
          throw new Error("empty lookup must not run a command");
        },
      },
    );
    assert.equal(absent.file, null);
    current = true;
    assert.equal(
      await artifactsAreStaleResident(absent),
      status === "unavailable",
    );
    await absent.discovery.release();
  }

  const group = new AbortController();
  let bothStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    bothStarted = resolve;
  });
  let finishSecond!: () => void;
  const second = new Promise<void>((resolve) => {
    finishSecond = resolve;
  });
  let active = 0;
  let finished = 0;
  const groupedProof: CapabilityPluginResolver.Resolution = {
    ...proof,
    plugins: [plugin, { ...plugin, binary: "second" }],
    release: async () => {
      assert.equal(
        finished,
        2,
        "proof released before every cancelled command joined",
      );
      releaseCount++;
    },
  };
  const grouped = publishArtifactsResident(
    { ...options, signal: group.signal },
    () => undefined,
    {
      resolve: async () => groupedProof,
      runCommand: async (command, _args, _spawnOptions, request) => {
        assert.equal(request?.signal, group.signal);
        active++;
        if (active === 2) bothStarted();
        await new Promise<void>((resolve) => {
          group.signal.addEventListener("abort", () => resolve(), {
            once: true,
          });
        });
        if (command === "second") await second;
        finished++;
        throw group.signal.reason;
      },
    },
  );
  let groupSettled = false;
  void grouped.then(
    () => {
      groupSettled = true;
    },
    () => {
      groupSettled = true;
    },
  );
  await started;
  group.abort(new DOMException("cancelled publisher group", "AbortError"));
  await Promise.resolve();
  assert.equal(groupSettled, false);
  assert.equal(releaseCount, 2);
  finishSecond();
  await assert.rejects(grouped, AggregateError);
  assert.equal(finished, 2);
  assert.equal(releaseCount, 3);

  const daemonAbort = new AbortController();
  let daemonStarted!: () => void;
  const asking = new Promise<void>((resolve) => {
    daemonStarted = resolve;
  });
  let finishAsk!: (value: null) => void;
  const answer = new Promise<null>((resolve) => {
    finishAsk = resolve;
  });
  let daemonClosed = false;
  const daemonPublication = publishArtifactsResident(
    { ...options, signal: daemonAbort.signal },
    () => ({
      ask: async () => {
        daemonStarted();
        return answer;
      },
      close: async () => {
        daemonClosed = true;
        finishAsk(null);
      },
    }),
    {
      resolve: async () => ({
        ...proof,
        release: async () => {
          assert.equal(daemonClosed, true);
          releaseCount++;
        },
      }),
      runCommand: async () => {
        throw new Error("cancelled daemon must not enter fallback");
      },
    },
  );
  void daemonPublication.catch(() => undefined);
  await asking;
  daemonAbort.abort(new DOMException("cancelled daemon", "AbortError"));
  await assert.rejects(daemonPublication, AggregateError);
  assert.equal(daemonClosed, true);
  assert.equal(releaseCount, 4);

  const closeAbort = new AbortController();
  const closeFailure = new Error("daemon retirement failed");
  let finishFailedAsk!: (value: null) => void;
  const failedAnswer = new Promise<null>((resolve) => {
    finishFailedAsk = resolve;
  });
  let closeStarted!: () => void;
  const closingStarted = new Promise<void>((resolve) => {
    closeStarted = resolve;
  });
  const failedDaemon = publishArtifactsResident(
    { ...options, signal: closeAbort.signal },
    () => ({
      ask: async () => {
        closeStarted();
        return failedAnswer;
      },
      close: async () => {
        finishFailedAsk(null);
        throw closeFailure;
      },
    }),
    {
      resolve: async () => proof,
      runCommand: async () => {
        throw new Error("cancelled daemon must not enter fallback");
      },
    },
  );
  void failedDaemon.catch(() => undefined);
  await closingStarted;
  closeAbort.abort(new DOMException("cancelled failed daemon", "AbortError"));
  await assert.rejects(failedDaemon, (error: unknown) => {
    assert.ok(error instanceof AggregateError);
    assert.ok(error.errors[0] instanceof AggregateError);
    assert.deepEqual(error.errors[0].errors, [
      closeAbort.signal.reason,
      closeFailure,
    ]);
    return true;
  });

  const staleAbort = new AbortController();
  await assert.rejects(
    artifactsAreStaleResident(
      {
        ...published,
        discovery: {
          ...proof,
          isCurrent: async () => {
            staleAbort.abort(
              new DOMException("cancelled freshness", "AbortError"),
            );
            return false;
          },
        },
      },
      { signal: staleAbort.signal },
    ),
    { name: "AbortError" },
  );

  const releaseAbort = new AbortController();
  const cleanupFailure = new Error("proof release failed");
  await assert.rejects(
    publishArtifactsResident(
      { ...options, signal: releaseAbort.signal },
      () => undefined,
      {
        resolve: async () => {
          releaseAbort.abort(
            new DOMException("cancelled late proof", "AbortError"),
          );
          return {
            ...proof,
            release: async () => {
              throw cleanupFailure;
            },
          };
        },
        runCommand: async () => {
          throw new Error("unexpected command");
        },
      },
    ),
    (error: unknown) => {
      assert.ok(error instanceof AggregateError);
      assert.deepEqual(error.errors, [
        releaseAbort.signal.reason,
        cleanupFailure,
      ]);
      return true;
    },
  );
}

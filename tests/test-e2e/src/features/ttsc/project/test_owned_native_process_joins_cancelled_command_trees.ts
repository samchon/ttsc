import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import type { SpawnSyncOptions } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { OwnedNativeProcess } from "../../../../../../packages/ttsc/src/internal/OwnedNativeProcess";
import type { serializeCompilerError as SerializeCompilerError } from "../../../../../../packages/ttsc/src/internal/serializeCompilerError";
import { NativeProcessObserver } from "../../../../../utils/src/NativeProcessObserver";
import { FixtureFiles } from "../../../internal/FixtureFiles";

/**
 * Verifies the SDK's native command supervisor joins actual descendants.
 *
 * 1. Reuse the installed SDK, platform helper and one test-only observer with
 *    static Node inputs; collect transport, input and failure outcomes.
 * 2. Enroll live targets, then require their original lifetimes retired and late
 *    effects absent.
 * 3. Require recovery and reject an incompatible supervisor without fallback
 *    admission.
 * 4. Cancel an actual resolver runtime probe and reject active/queued work after
 *    unknown proof.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual run calls exercise the Go helper and Node commands. Literal argv, environment, cwd, stdin hex, diagnostic text and status23 assert transport; ENOENT and ENOBUFS assert failure identity. A ready test observer enrolls each live command before effects or fast exit; product join must immediately yield retired on its original kernel lifetime. Parent and grandchild enrollment precedes cancellation, which must preserve original abort identity and prevent the unchanged 500ms late marker. Every command observes its joined, not-started or unknown classification. Recovery succeeds; incompatible and missing supervisors cannot admit the marker target. Null, unproved object and malformed nested receipt fields remain unknown and retained; literal diagnostic expectations require approved native fields or structure markers and exclude authored output/extra decoys. Original execution, verification and cleanup failures remain together rather than replacing one another.
 * @evidence contracts/testing.md#independent-expectations Authored Node inputs independently report argv/cwd/env/stdin and prescribe status23. Literal bytes distinguish DataView slices and latin1 encoding. Native retained Windows handles, Linux pidfds or Darwin knotes supply original lifetime authority, independent from SDK receipts and numeric PID reuse; wait uses zero timeout after product join. The grandchild's original publication clock and 500ms marker supply a separate effect oracle. An incompatible preload writes null, never a valid cleanup certificate. Actual retained directory/null receipt observations require preservation; unknown is lack of retirement authority, not an asserted OS refusal or reproduced PID reuse.
 * @evidence contracts/testing.md#distinguishing-cases Nonzero successful execution, binary DataView offset/length, latin1 string input, relative cwd, nonexistent target, bounded output overflow, active two-generation cancellation, recovery and legacy/invalid-receipt/missing supervisor refusal retain separate failure names. Resolver rows distinguish arbitrary cancellation during the real configured-JavaScript-plugin runtime probe from unknown helper retirement that must reject both later commands in the active request and the queued request. Portable pre-abort and unsupported-option refusal belong to the direct source unit.
 * @evidence contracts/testing.md#execution-ownership The runtime experiment admits this scenario, loads its installed SDK and executes its platform helper plus a separately prepared test-only native observer. The standalone observer fixture remains under the owning package's test tree. Explicit SDK/platform/observer paths allow separately reported workspace/private probes, which do not certify installed packaging. No TypeScript compiler or installation is added.
 * @evidence contracts/e2e.md#necessary-boundary Native containment and the SDK's control pipe/result receipt must retire a real Node descendant tree; pure parsing or synthetic promise settlement cannot establish that connection.
 * @evidence contracts/e2e.md#shared-execution One existing runtime consumer supplies the SDK installation and already built product helper. A process-shared preparation builds the standalone test observer once with isolated source/module/object/temp inputs, or records an explicit prebuilt observer; one cold ready session serves all rows. Separate command lifetimes distinguish nonzero, missing target, overflow and cancellation. Three resolver actors require conflicting helper/preload environments or queued-admission scheduling and separate workers, while sharing the SDK and observer without another installation or TypeScript Program. Actual configured-plugin runtime probing precedes descriptor preparation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity One copied fixture owns unique role/session publications and markers. Live target gates precede effects; grandchild enrollment leaves its timer and interval unchanged. Nonce, role, PID and opaque target acknowledgements must match. Inner actors request original-lifetime retirement proof before success; outer cancellation/finally awaits every operation and closes the observer through actual process exit. Only actor options.env changes isolated authority, never the test environment. Unknown observer or product retirement retains exact allocations and blocks unsafe later target work; observed incompatible-helper exit cannot certify its unknown SDK tree. Fixed actor error receipts are atomic diagnostic snapshots checked against the current session and role, and the enrolled PID when enrollment was observed; missing, partial or foreign snapshots cannot certify closure or erase the original failure, and late publication remains unknown. Actual SDK serialization preserves causes and aggregates without a second serializer. Normal roots remain exit-tracked.
 * @evidence contracts/e2e.md#preserved-coverage The original thirteen transport, input, missing-target, overflow, tree, recovery, RPC and supervisor-refusal rows retain their failure identities and collect outcomes. An additional queued-command row blocks only the main dispatcher until the real worker command publication, then explicit close must cancel without retained ownership failures and its actor must retire on the original lifetime. Original lifetime checks replace ambiguous numeric PID absence, while actual admitted PID equality, no late effect and recovery remain explicit. RPC cancellation retains the original Error through worker close; unknown proof retains first/queued rejection, one actual helper admission and exact retained-result directory. The existing invalid row independently collects null, unproved object and malformed field cases with distinct helper lifetimes; an earlier failed assertion cannot skip the later cases. Its direct SDK diagnostic assertions do not claim to test the worker's serialization boundary. Missing target/supervisor rows assert no target admission without inventing a lifetime. Native platform units, cold publication and MCP EOF coverage remain separate.
 */
export async function test_owned_native_process_joins_cancelled_command_trees(
  consumerRoot: string,
  options: {
    sdkModule?: string;
    binary?: string;
    observerBinary?: string;
  } = {},
): Promise<void> {
  const installed = createRequire(path.join(consumerRoot, "package.json"));
  const sdkModule =
    options.sdkModule ??
    path.join(
      path.dirname(installed.resolve("ttsc/package.json")),
      "lib/internal/OwnedNativeProcess.js",
    );
  const owner: { OwnedNativeProcess: typeof OwnedNativeProcess } = await import(
    pathToFileURL(sdkModule).href
  );
  const diagnostics: { serializeCompilerError: typeof SerializeCompilerError } =
    await import(pathToFileURL(path.join(path.dirname(sdkModule), "serializeCompilerError.js")).href);
  const sdkIndex = path.resolve(path.dirname(sdkModule), "../index.js");
  const pluginSource = options.sdkModule
    ? path.resolve(
        import.meta.dirname,
        "../../../../../../packages/ttsc/cmd/utility-host",
      )
    : path.join(
        path.dirname(installed.resolve("ttsc/package.json")),
        "cmd/utility-host",
      );
  const allocatedRoot = TestProject.createProject(
    FixtureFiles.read("ttsc/owned-native-process"),
  );
  const root = TestProject.physicalPath(allocatedRoot);
  const command = path.join(root, "command.cjs");
  const observer = await NativeProcessObserver.prepare({
    binary: options.observerBinary,
  }).open();
  const observerReady = { at: Date.now(), atNs: process.hrtime.bigint().toString() };
  const env = {
    ...process.env,
    TTSC_BINARY: options.binary ?? TestProject.NATIVE_BINARY,
    TTSC_OWNED_VALUE: "authored environment",
    TTSC_LIFETIME_ROOT: root,
    TTSC_LIFETIME_SESSION: observer.sessionNonce,
    TTSC_LIFETIME_HELPER_ROLE: undefined,
    TTSC_OWNED_HELPER_ADMISSIONS: undefined,
    TTSC_OWNED_PROBE_PID: undefined,
    TTSC_OWNED_RPC_BINARY: undefined,
  };
  const failures: Error[] = [];
  const retainedProtocols: string[] = [];
  let retirementUnknown = false;
  let sequence = 0;
  type Target = Awaited<ReturnType<typeof observer.acquire>>;
  const targets = new Map<string, Target>();
  let events: Record<string, unknown>[] = [];
  const record = (event: string, details: Record<string, unknown> = {}): void => {
    events.push({ ...details, event, at: Date.now(), atNs: process.hrtime.bigint().toString() });
  };
  const location = (role: string, event: string): string =>
    path.join(root, `lifetime-${role}-${event}.json`);
  const captureActorDiagnostics = (roles: readonly string[]): void => {
    for (const role of roles) {
      if (role !== "rpc-cancel-actor" && role !== "rpc-unknown-actor") continue;
      try {
        const file = location(role, "error");
        if (!fs.existsSync(file)) {
          record("actor-error-diagnostic", { role, status: "unavailable", reason: "No receipt at snapshot; later publication remains unknown" });
          continue;
        }
        const receipt: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
        assert.ok(receipt && typeof receipt === "object");
        assert.ok("version" in receipt && receipt.version === 1);
        assert.ok("sessionNonce" in receipt && receipt.sessionNonce === observer.sessionNonce);
        assert.ok("role" in receipt && receipt.role === role);
        assert.ok("pid" in receipt && typeof receipt.pid === "number" && Number.isSafeInteger(receipt.pid) && receipt.pid > 0);
        const target = targets.get(role);
        if (target) assert.equal(receipt.pid, target.pid);
        assert.ok("error" in receipt);
        record("actor-error-diagnostic", { role, status: "available", receipt });
      } catch (cause) {
        record("actor-error-diagnostic", {
          role,
          status: "unavailable",
          reason: diagnostics.serializeCompilerError(cause),
        });
      }
    }
  };
  const publish = (role: string, event: string, target: Target): void => {
    const destination = location(role, event);
    fs.writeFileSync(
      destination + ".pending",
      JSON.stringify({ ...target, role, retired: event === "retired" }),
    );
    fs.renameSync(destination + ".pending", destination);
    record("ack-published", { role, acknowledgement: event, targetId: target.targetId });
  };
  const observe = async <T>(
    operation: (signal: AbortSignal) => Promise<T>,
    roles: readonly string[],
    signal?: AbortSignal,
  ): Promise<T> => {
    const controller = new AbortController();
    const abort = (): void => controller.abort(signal?.reason);
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
    let settled = false;
    let wakePublicationPoll: (() => void) | undefined;
    const outcome = operation(controller.signal)
      .then(
        (value) => {
          record("product-settled", { outcome: "returned" });
          return { kind: "returned" as const, value };
        },
        (error: unknown) => {
          record("product-settled", { outcome: "rejected" });
          return { kind: "rejected" as const, error };
        },
      )
      .finally(() => {
        settled = true;
        wakePublicationPoll?.();
      });
    const until = Date.now() + 5000;
    const certified = new Set<string>();
    try {
      while (!settled) {
        for (const role of roles) {
          const ready =
            role === "tree-grandchild"
              ? path.join(root, "grandchild.json")
              : location(role, "ready");
          if (!targets.has(role) && fs.existsSync(ready)) {
            const publication: unknown = JSON.parse(
              fs.readFileSync(ready, "utf8"),
            );
            assert.ok(publication && typeof publication === "object");
            assert.ok(
              "pid" in publication && typeof publication.pid === "number",
            );
            if (role !== "tree-grandchild") {
              assert.ok(
                "sessionNonce" in publication &&
                  publication.sessionNonce === observer.sessionNonce,
              );
              assert.ok("role" in publication && publication.role === role);
            }
            record("publication-observed", { role, ...publication });
            record("acquire-request", { role, pid: publication.pid });
            const target = await observer.acquire(publication.pid);
            targets.set(role, target);
            record("acquired", { role, ...target });
            if (role !== "tree-grandchild") publish(role, "acquired", target);
          }
          const target = targets.get(role);
          const retirement = location(role, "retire");
          if (target && !certified.has(role) && fs.existsSync(retirement)) {
            const request: unknown = JSON.parse(
              fs.readFileSync(retirement, "utf8"),
            );
            assert.ok(request && typeof request === "object");
            assert.ok(
              "sessionNonce" in request &&
                request.sessionNonce === target.sessionNonce,
            );
            assert.ok(
              "targetId" in request && request.targetId === target.targetId,
            );
            assert.ok("pid" in request && request.pid === target.pid);
            assert.ok("role" in request && request.role === role);
            record("actor-retirement-request-observed", { ...request });
            const retired = await observer.retired(target);
            record("wait0-result", { role, targetId: target.targetId, retired, boundary: "actor-request" });
            assert.equal(
              retired,
              true,
              role + " original lifetime retired",
            );
            publish(role, "retired", target);
            certified.add(role);
          }
        }
        assert.ok(Date.now() < until, "original lifetime rendezvous deadline");
        if (!settled)
          await new Promise<void>((resolve) => {
            const finish = (): void => {
              clearTimeout(timer);
              wakePublicationPoll = undefined;
              resolve();
            };
            const timer = setTimeout(finish, 10);
            wakePublicationPoll = finish;
            if (settled) finish();
          });
      }
      const result = await outcome;
      for (const role of roles) {
        const target = targets.get(role);
        assert.ok(target, role + " enrolled before action");
        const retired = await observer.retired(target);
        record("wait0-result", { role, targetId: target.targetId, retired, boundary: "product-settled" });
        assert.equal(
          retired,
          true,
          role + " original lifetime retired at product join",
        );
      }
      if (result.kind === "rejected") throw result.error;
      return result.value;
    } catch (cause) {
      controller.abort(cause);
      const result = await outcome;
      if (signal?.aborted !== true || cause !== signal.reason)
        retirementUnknown = true;
      if (result.kind === "rejected" && result.error !== cause)
        throw new AggregateError(
          [result.error, cause],
          "Native command and original lifetime verification failed",
          { cause: result.error },
        );
      throw cause;
    } finally {
      captureActorDiagnostics(roles);
      signal?.removeEventListener("abort", abort);
    }
  };
  const check = async (
    name: string,
    run: () => Promise<void>,
  ): Promise<void> => {
    events = [];
    const before = new Set(targets.keys());
    let outcome = "passed";
    let failure: string | undefined;
    let diagnostic: unknown;
    try {
      await run();
    } catch (cause) {
      outcome = "failed";
      failure = cause instanceof Error ? cause.message : String(cause);
      diagnostic = diagnostics.serializeCompilerError(cause);
      failures.push(new Error(name, { cause }));
    } finally {
      const enrolled = [...targets].filter(([role]) => !before.has(role)).map(([role, target]) => ({ role, ...target }));
      console.error("Owned native process row: " + JSON.stringify({
        name, outcome, failure, diagnostic,
        observerSession: observer.sessionNonce,
        observerReady,
        expectedSdkTargetAdmission: ["missing target", "absent supervisor cannot admit target", "legacy supervisor cannot admit target", "invalid receipt cannot certify target retirement"].includes(name) ? "none" : "admitted",
        enrolled,
        events,
      }));
    }
  };
  const run = async (
    mode: string,
    settings: SpawnSyncOptions = {},
    signal?: AbortSignal,
    expectedRetirement: "joined" | "not-started" | "unknown" = "joined",
  ) => {
    if (retirementUnknown && mode !== "marker")
      throw new Error("Command blocked by unresolved fixture readers");
    const observed: string[] = [];
    const role = mode === "tree" ? "tree-parent" : "command-" + ++sequence;
    const helperRole = settings.env?.TTSC_LIFETIME_HELPER_ROLE;
    const roles =
      typeof helperRole === "string"
        ? [helperRole]
        : mode === "marker"
          ? []
          : mode === "tree"
            ? [role, "tree-grandchild"]
            : [role];
    const result = await observe(
        (ownedSignal) =>
          owner.OwnedNativeProcess.run(
            process.execPath,
            [command, mode, root, 'literal $() `" ; & | argument'],
            {
              cwd: root,
              encoding: "utf8",
              timeout: 5000,
              ...settings,
              env: { ...env, TTSC_LIFETIME_ROLE: role, ...settings.env },
            },
            ownedSignal,
            (state, reason) => {
              observed.push(state);
              record("product-retirement", { state, reason });
            },
          ),
        roles,
        signal,
      ).then(
        (value) => ({ kind: "returned" as const, value }),
        (error: unknown) => {
          if (signal?.aborted !== true || error !== signal.reason)
            retirementUnknown = true;
          return { kind: "rejected" as const, error };
        },
      );
    try {
      assert.deepEqual(observed, [expectedRetirement]);
    } catch (assertionError) {
      if (result.kind === "rejected" && result.error !== assertionError)
        throw new AggregateError(
          [result.error, assertionError],
          "Native command and retirement classification failed",
          { cause: result.error },
        );
      throw assertionError;
    }
    if (result.kind === "rejected") throw result.error;
    return result.value;
  };
  const expectUnknown = async (
    operation: Promise<unknown>,
    original: RegExp,
    receipt?: string,
    verifyDiagnostic?: (validation: Error) => void,
  ): Promise<void> => {
    await assert.rejects(operation, (error: unknown) => {
      record("expected-unknown-diagnostic", {
        error: diagnostics.serializeCompilerError(error),
      });
      assert.ok(error instanceof Error);
      const prefix = "ttsc: native retirement is unknown; retained protocol ";
      assert.ok(error.message.startsWith(prefix));
      assert.ok(error.cause instanceof Error);
      assert.match(error.cause.message, original);
      verifyDiagnostic?.(error.cause);
      const directory = error.message.slice(prefix.length);
      assert.ok(path.isAbsolute(directory));
      assert.ok(fs.statSync(directory).isDirectory());
      retainedProtocols.push(directory);
      if (receipt !== undefined)
        assert.equal(
          fs.readFileSync(path.join(directory, "result.json"), "utf8"),
          receipt,
        );
      return true;
    });
  };
  const echo = async (
    settings: SpawnSyncOptions,
    input: string,
    cwd = root,
  ) => {
    const result = await run("echo", settings);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 23);
    assert.equal(result.signal, null);
    assert.equal(result.stderr, "authored diagnostic");
    assert.equal(typeof result.stdout, "string");
    assert.deepEqual(JSON.parse(String(result.stdout)), {
      args: ['literal $() `" ; & | argument'],
      cwd: fs.realpathSync.native(cwd),
      value: "authored environment",
      input,
    });
  };
  try {
    await check("normal output and nonzero status", () =>
      echo({ input: "authored" }, "617574686f726564"),
    );
    await check("DataView slice bytes", () => {
      const bytes = new Uint8Array([99, 0, 255, 42, 98]);
      return echo({ input: new DataView(bytes.buffer, 1, 3) }, "00ff2a");
    });
    await check("latin1 input encoding", () =>
      echo({ input: "\u00e9", encoding: "latin1" }, "e9"),
    );
    await check("relative cwd", () => {
      const nested = path.join(root, "nested");
      fs.mkdirSync(nested);
      return echo(
        { cwd: path.relative(process.cwd(), nested), input: "" },
        "",
        nested,
      );
    });
    await check("missing target", async () => {
      const observed: string[] = [];
      const result = await owner.OwnedNativeProcess.run(
        path.join(root, "absent-command"),
        [],
        { env, timeout: 5000 },
        undefined,
        (state, reason) => {
          observed.push(state);
          record("product-retirement", { state, reason });
        },
      );
      assert.deepEqual(observed, ["joined"]);
      assert.equal(result.status, null);
      assert.ok(result.error && "code" in result.error);
      assert.equal(result.error.code, "ENOENT");
      record("missing-target-result", { status: result.status, errorCode: result.error.code });
    });
    await check("output overflow retires command", async () => {
      const result = await run("overflow", { maxBuffer: 16 });
      assert.ok(result.error && "code" in result.error);
      assert.equal(result.error.code, "ENOBUFS");
      const targetPid = Number(
        fs.readFileSync(path.join(root, "overflow.pid"), "utf8"),
      );
      assert.ok(Number.isSafeInteger(targetPid) && targetPid > 0);
      assert.equal(
        result.pid,
        targetPid,
        "overflow result retains the actually admitted target PID",
      );
      const target = targets.get("command-" + sequence);
      assert.ok(target);
      assert.equal(target.pid, result.pid);
      const retired = await observer.retired(target);
      record("wait0-result", { role: "command-" + sequence, targetId: target.targetId, retired, boundary: "overflow-pid-equality" });
      assert.equal(retired, true);
    });
    await check("cancelled actual parent and grandchild", async () => {
      const controller = new AbortController();
      const reason = new Error("authored active command cancellation");
      const outcome = run("tree", {}, controller.signal).then(
        (value) => ({ kind: "returned" as const, value }),
        (error: unknown) => ({ kind: "rejected" as const, error }),
      );
      let settled = false;
      void outcome.then(() => {
        settled = true;
      });
      let pid: number | undefined;
      let parent: number | undefined;
      let lateAt = 0;
      let joined = false;
      let failed = false;
      let originalFailure: unknown;
      try {
        const until = Date.now() + 5000;
        while (!targets.has("tree-grandchild")) {
          assert.equal(
            settled,
            false,
            "command ended before descendant readiness",
          );
          assert.ok(Date.now() < until, "descendant readiness deadline");
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        const publication: unknown = JSON.parse(
          fs.readFileSync(path.join(root, "grandchild.json"), "utf8"),
        );
        assert.ok(publication && typeof publication === "object");
        assert.ok("pid" in publication && typeof publication.pid === "number");
        assert.ok(
          "lateAt" in publication && typeof publication.lateAt === "number",
        );
        pid = publication.pid;
        lateAt = publication.lateAt;
        parent = Number(fs.readFileSync(path.join(root, "parent.pid"), "utf8"));
        assert.ok(Number.isSafeInteger(parent) && parent > 0);
        controller.abort(reason);
        const result = await outcome;
        assert.equal(result.kind, "rejected");
        if (result.kind === "rejected") assert.equal(result.error, reason);
        const originalParent = targets.get("tree-parent");
        const originalChild = targets.get("tree-grandchild");
        assert.ok(originalParent && originalChild);
        assert.equal(originalParent.pid, parent);
        assert.equal(originalChild.pid, pid);
        const parentRetired = await observer.retired(originalParent);
        record("wait0-result", { role: "tree-parent", targetId: originalParent.targetId, retired: parentRetired, boundary: "tree-publication-equality" });
        assert.equal(parentRetired, true);
        const childRetired = await observer.retired(originalChild);
        record("wait0-result", { role: "tree-grandchild", targetId: originalChild.targetId, retired: childRetired, boundary: "tree-publication-equality" });
        assert.equal(childRetired, true);
        joined = true;
        const remaining = lateAt + 50 - Date.now();
        if (remaining > 0)
          await new Promise((resolve) => setTimeout(resolve, remaining));
        assert.equal(fs.existsSync(path.join(root, "late-marker")), false);
      } catch (cause) {
        failed = true;
        originalFailure = cause;
      } finally {
        controller.abort(reason);
        const result = await outcome;
        if (!joined || result.kind !== "rejected" || result.error !== reason)
          retirementUnknown = true;
        if (result.kind === "rejected" && result.error !== reason && result.error !== originalFailure)
          throw failed
            ? new AggregateError(
                [originalFailure, result.error],
                "Tree readiness and command execution failed",
                { cause: originalFailure },
              )
            : result.error;
        if (failed) throw originalFailure;
      }
    });
    await check("recovery after cancellation", () => echo({ input: "" }, ""));
    await check("actual RPC runtime authority cancellation", async () => {
      const result = await observe(
        (signal) =>
          owner.OwnedNativeProcess.run(
            process.execPath,
            [command, "rpc-cancel", root, sdkIndex],
            {
              env: {
                ...env,
                TTSC_LIFETIME_ROLE: "rpc-cancel-actor",
                TTSC_OWNED_PLUGIN_SOURCE: pluginSource,
                TTSC_OWNED_PROBE_PID: path.join(root, "rpc-probe.pid"),
                NODE_OPTIONS:
                  "--require " + JSON.stringify(path.join(root, "plugin.cjs")),
              },
              encoding: "utf8",
              timeout: 5000,
            },
            signal,
            (state, reason) => record("product-retirement", { state, reason }),
          ),
        ["rpc-cancel-actor", "rpc-probe"],
      );
      assert.equal(result.error, undefined);
      assert.equal(result.status, 0, String(result.stderr));
      assert.equal(result.signal, null);
      assert.equal(
        result.stdout,
        "actual RPC runtime probe cancelled and joined\n",
      );
    });
    await check("explicit close withdraws queued worker command", async () => {
      const result = await observe(
        (signal) => owner.OwnedNativeProcess.run(
          process.execPath, [command, "rpc-close-queued", root, sdkIndex],
          { env: { ...env, TTSC_LIFETIME_ROLE: "rpc-close-actor", NODE_OPTIONS: undefined }, encoding: "utf8", timeout: 5000 },
          signal, (state, reason) => record("product-retirement", { state, reason }),
        ),
        ["rpc-close-actor"],
      );
      assert.equal(result.error, undefined);
      assert.equal(result.signal, null);
      assert.equal(result.status, 0, String(result.stderr));
      assert.equal(result.stdout, "queued worker command withdrawn and owner joined\n");
    });
    await check("unknown RPC retirement rejects queued admission", async () => {
      retirementUnknown = true;
      const result = await observe(
        (signal) =>
          owner.OwnedNativeProcess.run(
            process.execPath,
            [command, "rpc-unknown", root, sdkIndex],
            {
              env: {
                ...env,
                TTSC_LIFETIME_ROLE: "rpc-unknown-actor",
                TTSC_LIFETIME_HELPER_ROLE: "rpc-helper",
                TTSC_OWNED_RPC_BINARY: process.execPath,
                TTSC_OWNED_PLUGIN_SOURCE: pluginSource,
                TTSC_OWNED_HELPER_ADMISSIONS: path.join(
                  root,
                  "rpc-admissions.jsonl",
                ),
                NODE_OPTIONS:
                  "--require " + JSON.stringify(path.join(root, "plugin.cjs")),
              },
              encoding: "utf8",
              timeout: 5000,
            },
            signal,
            (state, reason) => record("product-retirement", { state, reason }),
          ),
        ["rpc-unknown-actor", "rpc-helper"],
      );
      const retained = String(result.stderr).match(
        /Retained RPC native protocol input: ([^\r\n]+)/,
      );
      if (retained?.[1] !== undefined) retainedProtocols.push(retained[1]);
      assert.equal(result.error, undefined);
      assert.equal(result.status, 0, String(result.stderr));
      assert.equal(result.signal, null);
      assert.equal(result.stdout, "queued unknown retirement rejected\n");
      assert.match(
        String(result.stderr),
        /Retained RPC native protocol input: /,
      );
    });
    await check("legacy supervisor cannot admit target", async () => {
      await expectUnknown(
        run(
          "marker",
          {
            env: {
              ...env,
              TTSC_BINARY: process.execPath,
              TTSC_LIFETIME_HELPER_ROLE: "legacy-helper",
              TTSC_OWNED_HELPER_ADMISSIONS: path.join(
                root,
                "legacy-admissions.jsonl",
              ),
              NODE_OPTIONS:
                "--require " + JSON.stringify(path.join(root, "plugin.cjs")),
            },
          },
          undefined,
          "unknown",
        ),
        /did not publish a completion receipt/,
      );
      assert.equal(fs.existsSync(path.join(root, "admitted-marker")), false);
    });
    await check(
      "invalid receipt cannot certify target retirement",
      async () => {
        const invalidFailures: Error[] = [];
        for (const mode of ["null", "object", "malformed"] as const) {
          const role = mode === "null" ? "invalid-helper" : "invalid-" + mode + "-helper";
          try {
            await expectUnknown(
              run(
                "marker",
                {
                  env: {
                    ...env,
                    TTSC_BINARY: process.execPath,
                    TTSC_LIFETIME_HELPER_ROLE: role,
                    TTSC_OWNED_INVALID_RECEIPT_MODE: mode,
                    NODE_OPTIONS:
                      "--require " +
                      JSON.stringify(path.join(root, "invalid-receipt.cjs")),
                  },
                },
                undefined,
                "unknown",
              ),
              /did not confirm process-tree retirement/,
              mode === "null" ? "null" : undefined,
              (validation) => {
                if (mode === "null") assert.equal(validation.cause, null);
                else {
                  const target = targets.get(role);
                  assert.ok(target);
                  assert.deepEqual(validation.cause, {
                    version: 1,
                    pid: target.pid,
                    status: null,
                    signal: null,
                    cancelled: false,
                    error: {
                      code: mode === "malformed" ? { $ttscValue: "object" } : "AUTHORED_CLEANUP",
                      message: "authored unproved cleanup",
                    },
                    cleanup: {
                      directChildJoined: true,
                      boundaryEmpty: false,
                      orphanReaping: mode === "malformed" ? { $ttscValue: "array" } : "owned",
                    },
                  });
                }
              },
            );
            assert.equal(fs.existsSync(path.join(root, "admitted-marker")), false);
          } catch (cause) {
            invalidFailures.push(new Error("Invalid receipt " + mode, { cause }));
          }
        }
        if (invalidFailures.length)
          throw new AggregateError(invalidFailures, "Invalid receipt diagnostic cases");
      },
    );
    await check("absent supervisor cannot admit target", async () => {
      await assert.rejects(
        run(
          "marker",
          {
            env: { ...env, TTSC_BINARY: path.join(root, "absent-supervisor") },
          },
          undefined,
          "not-started",
        ),
        { code: "ENOENT" },
      );
      assert.equal(fs.existsSync(path.join(root, "admitted-marker")), false);
    });
  } finally {
    try {
      await observer.close();
    } catch (cause) {
      retirementUnknown = true;
      failures.push(new Error("Original lifetime observer closure", { cause }));
    }
    for (const directory of retainedProtocols)
      console.error("Retained native protocol input: " + directory);
    if (retirementUnknown)
      try {
        TestProject.retainTemporaryDirectory(
          allocatedRoot,
          "Native command descendant retirement was not observed",
        );
      } catch (cause) {
        failures.push(new Error("Native fixture input retention failed", { cause }));
      }
  }
  if (failures.length !== 0)
    throw new AggregateError(
      failures,
      "Owned native process connection failures",
    );
}

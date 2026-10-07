import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import type { SpawnSyncOptions } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { OwnedNativeProcess } from "../../../../../../packages/ttsc/src/internal/OwnedNativeProcess";
import { FixtureFiles } from "../../../internal/FixtureFiles";

/**
 * Verifies the SDK's native command supervisor joins actual descendants.
 *
 * 1. Reuse the experiment's installed SDK and platform helper with static Node inputs.
 * 2. Collect output, missing-command, input-byte and overflow outcomes independently.
 * 3. Cancel an admitted parent/grandchild tree and require absent PIDs and late effects.
 * 4. Require recovery and reject an incompatible supervisor without fallback admission.
 * 5. Cancel an actual resolver runtime probe and reject active/queued work after unknown proof.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual run calls exercise the Go helper and Node commands. Literal argv, environment, cwd, stdin hex, diagnostic text and status23 assert transport; ENOENT and ENOBUFS assert failure identity. Cancellation waits for actual parent/grandchild publication, then requires original abort identity, both PIDs absent and no authored late marker. Every command observes its joined, not-started or unknown retirement classification. A following successful command proves recovery; incompatible and missing helper selections cannot admit the marker command. Unknown proof retains a real protocol directory and its terminal error preserves the original receipt refusal as cause.
 * @evidence contracts/testing.md#independent-expectations Authored Node inputs independently report their actual argv/cwd/env/stdin and prescribe status23. Literal bytes distinguish DataView slices and latin1 input encoding. Native process existence and a delayed fixture effect are separate cancellation oracles. One explicitly incompatible Node preload writes null to the private receipt channel to require rejection; it never supplies a valid cleanup certificate. Native filesystem observations require the diagnosed retained directory and authored null receipt to remain present; unknown is lack of retirement authority, not an asserted OS termination refusal.
 * @evidence contracts/testing.md#distinguishing-cases Nonzero successful execution, binary DataView offset/length, latin1 string input, relative cwd, nonexistent target, bounded output overflow, active two-generation cancellation, recovery and legacy/invalid-receipt/missing supervisor refusal retain separate failure names. Resolver rows distinguish arbitrary cancellation during the real configured-JavaScript-plugin runtime probe from unknown helper retirement that must reject both later commands in the active request and the queued request. Portable pre-abort and unsupported-option refusal belong to the direct source unit.
 * @evidence contracts/testing.md#execution-ownership This scenario is admitted by the runtime package experiment, loads its installed SDK payload and executes the actual platform helper. Optional explicit module/binary paths support a separately reported partial source/private-helper probe; that probe does not certify installed packaging. No compiler or installation is added by this scenario.
 * @evidence contracts/e2e.md#necessary-boundary Native containment and the SDK's control pipe/result receipt must retire a real Node descendant tree; pure parsing or synthetic promise settlement cannot establish that connection.
 * @evidence contracts/e2e.md#shared-execution The existing shared runtime consumer supplies one SDK installation and one already built platform helper to all rows. Separate command lifetimes are necessary for nonzero, missing target, overflow and cancellation outcomes. Two isolated resolver actors need conflicting helper/preload environments and separate worker owners, so each loads the same installed SDK without another installation, Go build or TypeScript Program. The configured plugin points to the existing utility-host source and actual runtime probing precedes descriptor preparation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity One copied static Node fixture owns its PID publications and markers outside the compiler graph. Every launched command is awaited; cancellation is issued in finally even if readiness/assertions fail. Resolver authority is supplied through actor options.env: only that isolated actor changes its own helper selection, and the test process environment remains unchanged. Actor finally closes the actual worker; separate probe/admission publications prevent cross-row readiness. Unknown retirement retains its exact tracked allocation and blocks subsequent target commands; independent supervisor-refusal rows cannot legitimately admit that target. The deliberate incompatible receipt rows conservatively retain their inputs. Normal roots remain owned by TestProject's exit cleanup. Normal rows have no persistent mutable state; cancellation and refusal markers have distinct names.
 * @evidence contracts/e2e.md#preserved-coverage This new connection case preserves literal process outputs, failure codes, descendant absence, no late publication and subsequent recovery as explicit assertions. Additional actors load the actual SDK index and CapabilityPluginResolver: cancellation preserves the original Error identity through worker close and requires the observed probe PID absent; unknown proof requires first and queued rejection, one actual helper admission, that helper PID absent and exact retained-result directory identity on close failure. It does not replace native platform units or claim cold publication or MCP EOF coverage.
 */
export async function test_owned_native_process_joins_cancelled_command_trees(
  consumerRoot: string,
  options: { sdkModule?: string; binary?: string } = {},
): Promise<void> {
  const installed = createRequire(path.join(consumerRoot, "package.json"));
  const sdkModule =
    options.sdkModule ??
    path.join(
      path.dirname(installed.resolve("ttsc/package.json")),
      "lib/internal/OwnedNativeProcess.js",
    );
  const owner: { OwnedNativeProcess: typeof OwnedNativeProcess } =
    await import(pathToFileURL(sdkModule).href);
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
  const env = {
    ...process.env,
    TTSC_BINARY: options.binary ?? TestProject.NATIVE_BINARY,
    TTSC_OWNED_VALUE: "authored environment",
  };
  const failures: Error[] = [];
  const retainedProtocols: string[] = [];
  let retirementUnknown = false;
  const check = async (name: string, run: () => Promise<void>): Promise<void> => {
    try {
      await run();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
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
    try {
      return await owner.OwnedNativeProcess.run(
        process.execPath,
        [command, mode, root, 'literal $() `" ; & | argument'],
        { cwd: root, env, encoding: "utf8", timeout: 5000, ...settings },
        signal,
        (state) => observed.push(state),
      );
    } catch (error) {
      if (signal?.aborted !== true || error !== signal.reason)
        retirementUnknown = true;
      throw error;
    } finally {
      assert.deepEqual(observed, [expectedRetirement]);
    }
  };
  const expectUnknown = async (
    operation: Promise<unknown>,
    original: RegExp,
    receipt?: string,
  ): Promise<void> => {
    await assert.rejects(operation, (error: unknown) => {
      assert.ok(error instanceof Error);
      const prefix = "ttsc: native retirement is unknown; retained protocol ";
      assert.ok(error.message.startsWith(prefix));
      assert.ok(error.cause instanceof Error);
      assert.match(error.cause.message, original);
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
  const echo = async (settings: SpawnSyncOptions, input: string, cwd = root) => {
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
        (state) => observed.push(state),
      );
      assert.deepEqual(observed, ["joined"]);
      assert.equal(result.status, null);
      assert.ok(result.error && "code" in result.error);
      assert.equal(result.error.code, "ENOENT");
    });
    await check("output overflow retires command", async () => {
      const result = await run("overflow", { maxBuffer: 16 });
      assert.ok(result.error && "code" in result.error);
      assert.equal(result.error.code, "ENOBUFS");
      const targetPid = Number(
        fs.readFileSync(path.join(root, "overflow.pid"), "utf8"),
      );
      assert.ok(Number.isSafeInteger(targetPid) && targetPid > 0);
      try {
        assert.throws(() => process.kill(targetPid, 0), { code: "ESRCH" });
      } catch (error) {
        retirementUnknown = true;
        throw error;
      }
      assert.equal(
        result.pid,
        targetPid,
        "overflow result retains the actually admitted target PID",
      );
      assert.throws(() => process.kill(result.pid, 0), { code: "ESRCH" });
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
      try {
        const until = Date.now() + 5000;
        while (!fs.existsSync(path.join(root, "grandchild.json"))) {
          assert.equal(settled, false, "command ended before descendant readiness");
          assert.ok(Date.now() < until, "descendant readiness deadline");
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        const publication: unknown = JSON.parse(
          fs.readFileSync(path.join(root, "grandchild.json"), "utf8"),
        );
        assert.ok(publication && typeof publication === "object");
        assert.ok("pid" in publication && typeof publication.pid === "number");
        assert.ok("lateAt" in publication && typeof publication.lateAt === "number");
        pid = publication.pid;
        lateAt = publication.lateAt;
        parent = Number(
          fs.readFileSync(path.join(root, "parent.pid"), "utf8"),
        );
        assert.ok(Number.isSafeInteger(parent) && parent > 0);
        controller.abort(reason);
        const result = await outcome;
        assert.equal(result.kind, "rejected");
        if (result.kind === "rejected") assert.equal(result.error, reason);
        assert.throws(() => process.kill(parent!, 0), { code: "ESRCH" });
        assert.throws(() => process.kill(pid!, 0), { code: "ESRCH" });
        joined = true;
        const remaining = lateAt + 50 - Date.now();
        if (remaining > 0)
          await new Promise((resolve) => setTimeout(resolve, remaining));
        assert.equal(fs.existsSync(path.join(root, "late-marker")), false);
      } finally {
        controller.abort(reason);
        const result = await outcome;
        if (!joined || result.kind !== "rejected" || result.error !== reason)
          retirementUnknown = true;
      }
    });
    await check("recovery after cancellation", () => echo({ input: "" }, ""));
    await check("actual RPC runtime authority cancellation", async () => {
      const result = await owner.OwnedNativeProcess.run(
        process.execPath,
        [command, "rpc-cancel", root, sdkIndex],
        {
          env: {
            ...env,
            TTSC_OWNED_PLUGIN_SOURCE: pluginSource,
            TTSC_OWNED_PROBE_PID: path.join(root, "rpc-probe.pid"),
            NODE_OPTIONS:
              "--require " + JSON.stringify(path.join(root, "plugin.cjs")),
          },
          encoding: "utf8",
          timeout: 5000,
        },
      );
      assert.equal(result.error, undefined);
      assert.equal(result.status, 0, String(result.stderr));
      assert.equal(result.signal, null);
      assert.equal(result.stdout, "actual RPC runtime probe cancelled and joined\n");
    });
    await check("unknown RPC retirement rejects queued admission", async () => {
      retirementUnknown = true;
      const result = await owner.OwnedNativeProcess.run(
        process.execPath,
        [command, "rpc-unknown", root, sdkIndex],
        {
          env: {
            ...env,
            TTSC_OWNED_RPC_BINARY: process.execPath,
            TTSC_OWNED_PLUGIN_SOURCE: pluginSource,
            TTSC_OWNED_HELPER_ADMISSIONS: path.join(root, "rpc-admissions.jsonl"),
            NODE_OPTIONS:
              "--require " + JSON.stringify(path.join(root, "plugin.cjs")),
          },
          encoding: "utf8",
          timeout: 5000,
        },
      );
      const retained = String(result.stderr).match(
        /Retained RPC native protocol input: ([^\r\n]+)/,
      );
      if (retained?.[1] !== undefined) retainedProtocols.push(retained[1]);
      assert.equal(result.error, undefined);
      assert.equal(result.status, 0, String(result.stderr));
      assert.equal(result.signal, null);
      assert.equal(result.stdout, "queued unknown retirement rejected\n");
      assert.match(String(result.stderr), /Retained RPC native protocol input: /);
    });
    await check("legacy supervisor cannot admit target", async () => {
      await expectUnknown(
        run(
          "marker",
          { env: { ...env, TTSC_BINARY: process.execPath } },
          undefined,
          "unknown",
        ),
        /did not publish a completion receipt/,
      );
      assert.equal(fs.existsSync(path.join(root, "admitted-marker")), false);
    });
    await check("invalid receipt cannot certify target retirement", async () => {
      await expectUnknown(
        run(
          "marker",
          {
            env: {
              ...env,
              TTSC_BINARY: process.execPath,
              NODE_OPTIONS:
                "--require " +
                JSON.stringify(path.join(root, "invalid-receipt.cjs")),
            },
          },
          undefined,
          "unknown",
        ),
        /did not confirm process-tree retirement/,
        "null",
      );
      assert.equal(fs.existsSync(path.join(root, "admitted-marker")), false);
    });
    await check("absent supervisor cannot admit target", async () => {
      await assert.rejects(
        run(
          "marker",
          { env: { ...env, TTSC_BINARY: path.join(root, "absent-supervisor") } },
          undefined,
          "not-started",
        ),
        { code: "ENOENT" },
      );
      assert.equal(fs.existsSync(path.join(root, "admitted-marker")), false);
    });
  } finally {
    for (const directory of retainedProtocols)
      console.error("Retained native protocol input: " + directory);
    if (retirementUnknown)
      TestProject.retainTemporaryDirectory(
        allocatedRoot,
        "Native command descendant retirement was not observed",
      );
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "Owned native process connection failures");
}

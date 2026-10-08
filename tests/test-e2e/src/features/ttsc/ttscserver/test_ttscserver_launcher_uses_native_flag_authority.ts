import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { resolveTsgo } from "../../../../../../packages/ttsc/lib/compiler/internal/resolveTsgo.js";
import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";
import {
  TtscserverClient,
  assert,
  initializeTtscserverClient,
  runTtscserverSession,
  ttscPackageRoot,
} from "../../../internal/ttsc/internal/ttscserver";

type TraceEvent = {
  event: string;
  argv?: string[];
  cwd?: string;
  data?: {
    writerRuntime?: string;
    origin?: string;
    started?: boolean;
    exitObserved?: boolean;
  };
};

/**
 * Verifies one native argument authority selects the launcher's project setup
 * and the real LSP host, including superseded missing values and native syntax.
 *
 * A and B have different configs and lint rules. The shared suite's actual
 * installed lint producer/cache serve two sequential sessions; changed startup
 * argv requires another session but no additional consumer install or build.
 * Native trace records expose the real upstream cwd and sidecar context, while
 * editor diagnostics retain the client's logical URI spelling. The two runtime
 * receipt sessions opt out of lint config caching because their receipt is an
 * environment-dependent side effect rather than a module-graph result.
 *
 * 1. Launch with existing A values followed by B overrides in equals/space form.
 * 2. Require B's actual upstream cwd, plugin physical context and no-console
 *    finding, with no A no-var finding, then join clean shutdown.
 * 3. Replace missing earlier values with single-dash B alias assignments and
 *    ignore missing trailing values after --; require the same physical B,
 *    logical alias URI and actual project-relative Node runtime receipt.
 * 4. Collect native malformed/unknown/transport errors, metadata dispatch and
 *    genuinely missing final config/binary failures through the launcher; an
 *    isolated config-free project must initialize and join its actual upstream.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual built JavaScript launcher/native LSP sessions must select B for startup/plugin/upstream contexts and publish B's no-console at the client's URI without A's no-var. Native trace observes selected cwd/context argv and private-manifest cleanup; B's CJS configuration records the actual Node executable. Separate real launcher controls require native statuses/diagnostics before unrelated project preparation and ordinary final missing-value errors.
 * @evidence contracts/testing.md#independent-expectations Authored A no-var versus B no-console configs, literal final argv assignments and realpath of the authored B root/config independently prescribe selection. Expected client URI derives from the caller's logical B spelling, and runtime identity compares filesystem dev/ino with a realpath fallback. Omitted cwd may be returned through any native alias, so its physical directory must equal the authored empty root; explicit alias argv and diagnostic URI stay exact. Native FlagSet's documented stop rules and literal diagnostic/status categories prescribe control results; traces observe actual primitives rather than predicting behavior from a reconstructed command.
 * @evidence contracts/testing.md#distinguishing-cases Two sessions distinguish existing superseded A from missing superseded cwd/config/binary, double/single dash and equals/space, physical B from logical alias B and ignored terminator-tail values. Unknown flag, invalid duration, missing string value, false stdio, help/version with invalid tails and missing final config/binary remain individually collected controls. Portable default/equal-duplicate/first-positional/blank/string-value semantics belong to the owning Go unit.
 * @evidence contracts/testing.md#execution-ownership The selected lspSelectionCorpus calls this exported scenario with the shared upfront static fixture root/cache. Real launcher/native/upstream and lint sidecars execute; control subprocesses also enter the actual launcher. The callback bodies and private trace/control helpers are covered by this scenario's assertions rather than separately discovered test entries.
 * @evidence contracts/e2e.md#necessary-boundary Only the actual native query, JavaScript project preparation, manifest transport, native upstream/sidecar launches and editor protocol can establish their agreement. Go units own parser decisions but cannot certify this assembly, logical diagnostic URI or runtime received by config evaluation.
 * @evidence contracts/e2e.md#shared-execution Both initialized sessions borrow the suite's installed lint producer and cache and the same upfront A/B files; their different immutable startup argv require distinct server lifetimes. Native refusal/metadata controls finish without a server lifetime. The initialized empty-project lifetime needs a config-free root outside the shared ancestor config; it requires no installation or plugin build. No per-case native build or copied lint producer is introduced; the project runtime copy changes executable location while retaining Node bytes.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Alias/runtime files are prepared before either session, receipts/traces live outside watched projects, and runTtscserverSession joins each direct close while preserving body and shutdown errors. The existing lint config cache opt-out is scoped to the two child environments whose actual runtime receipt depends on external environment/filesystem state; their unchanged module bytes alone cannot prescribe re-evaluation. Sessions use disjoint tracked trace/receipt roots under the configured absolute collection sink, retained before launch for CI observations, or under the shared cache when no sink is configured. All controls run even after session assertion failures. Failure retains the shared project inputs; the cache fallback follows its existing owner rather than promising post-exit retention. Direct close and trace returns do not claim arbitrary descendant settlement.
 * @evidence contracts/e2e.md#preserved-coverage Adds actual argument-authority assembly while retaining the batch's existing ordinary editor, lifecycle, fingerprint and terminal-selection scenarios. Actual inline tsgo selection and project-relative Node receipt carry the meaningful assertions formerly reached through the recording-host inline-tsgo case; opaque arbitrary Node-as-ttscserver forwarding is not a native server contract.
 */
export async function test_ttscserver_launcher_uses_native_flag_authority(prepared: {
  root: string;
  cache: string;
  retain: (reason: string) => void;
}): Promise<void> {
  const traceSink = process.env.TTSC_E2E_TRACE;
  if (traceSink)
    assert.ok(
      path.isAbsolute(traceSink), "the configured trace sink must be absolute",
    );
  const traceParent = traceSink || prepared.cache;
  const a = path.join(prepared.root, "a");
  const b = path.join(prepared.root, "b");
  const alias = path.join(prepared.root, "b-alias");
  fs.symlinkSync(b, alias, process.platform === "win32" ? "junction" : "dir");
  const runtimeName =
    process.platform === "win32" ? "project-node.exe" : "project-node";
  const runtime = path.join(b, runtimeName);
  fs.copyFileSync(process.execPath, runtime);
  if (process.platform !== "win32") fs.chmodSync(runtime, 0o755);
  const launcher = path.join(ttscPackageRoot(), "lib/launcher/ttscserver.js");
  const tsgo = resolveTsgo({
    cwd: b,
    resolveFrom: path.join(ttscPackageRoot(), "package.json"),
  }).binary;
  const missing = path.join(prepared.root, "missing");
  const failures: unknown[] = [];
  const sessions = [
    {
      name: "existing final overrides",
      cwd: b,
      args: [
        "--stdio",
        "--cwd",
        a,
        `--cwd=${b}`,
        "--tsconfig=tsconfig.json",
        "--tsconfig",
        "project.json",
        `--tsgo=${tsgo}`,
        "--tsgo",
        tsgo,
      ],
      node: process.execPath,
    },
    {
      name: "superseded missing and native alias spelling",
      cwd: alias,
      args: [
        "--stdio",
        "--cwd",
        missing,
        `-cwd=${alias}`,
        `--tsconfig=${missing}`,
        "-tsconfig",
        "project.json",
        `--tsgo=${missing}`,
        "-tsgo",
        tsgo,
        "--",
        `--cwd=${missing}`,
        `--tsconfig=${missing}`,
        `--tsgo=${missing}`,
      ],
      node: `.${path.sep}${runtimeName}`,
    },
  ];
  for (const [index, session] of sessions.entries()) {
    const trace = TestProject.tmpdir("lsp-launch-authority-", traceParent);
    if (traceSink)
      TestProject.retainTemporaryDirectory(
        trace, "LSP launch authority diagnostic observations",
      );
    const receipt = path.join(trace, "runtime.json");
    try {
      const client = new TtscserverClient(launcher, session.cwd, {
        args: session.args,
        useNode: true,
        env: {
          TTSC_CACHE_DIR: prepared.cache,
          TTSC_E2E_TRACE: trace,
          TTSC_LAUNCH_AUTHORITY_RUNTIME_RECEIPT: receipt,
          TTSC_LINT_DISABLE_CONFIG_CACHE: "1",
          TTSC_NODE_BINARY: session.node,
        },
      });
      await runTtscserverSession(client, async () => {
        await initializeTtscserverClient(client, session.cwd);
        // Startup discovery and upstream creation precede initialize's reply.
        // Checking their actual arguments first makes the A/B baseline fail
        // deterministically before waiting for a diagnostic A cannot publish.
        assertLaunchTrace(
          readTrace(trace, false), session.cwd, b, tsgo, session.args,
        );
        const file = path.join(session.cwd, "src/main.ts");
        const uri = pathToFileURL(file).href;
        const publication = client.waitForNotification<{
          uri: string;
          diagnostics: { code?: unknown; source?: string }[];
        }>("textDocument/publishDiagnostics", (params) =>
          params.diagnostics.some((diagnostic) =>
            diagnostic.source === "@ttsc/lint" &&
            (diagnostic.code === "no-console" || diagnostic.code === "no-var"),
          ),
        );
        client.notify("textDocument/didOpen", {
          textDocument: {
            uri,
            languageId: "typescript",
            version: 1,
            text: fs.readFileSync(file, "utf8"),
          },
        });
        const actual = await publication;
        assert.equal(actual.uri, uri, "lint findings retain the client's logical URI");
        const codes = actual.diagnostics
          .filter((diagnostic) => diagnostic.source === "@ttsc/lint")
          .map((diagnostic) => diagnostic.code);
        assert.ok(codes.includes("no-console"), "B's no-console rule must execute");
        assert.equal(codes.includes("no-var"), false, "A's no-var rule must not execute");
      });
      assertLaunchTrace(
        readTrace(trace, true), session.cwd, b, tsgo, session.args,
      );
      const recorded = JSON.parse(fs.readFileSync(receipt, "utf8")) as {
        node: string;
      };
      const expectedRuntime = index === 0 ? process.execPath : runtime;
      assert.ok(path.isAbsolute(recorded.node), "native config evaluation receives an absolute runtime");
      const actualIdentity = fs.statSync(recorded.node);
      const expectedIdentity = fs.statSync(expectedRuntime);
      assert.equal(actualIdentity.dev, expectedIdentity.dev);
      assert.equal(actualIdentity.ino, expectedIdentity.ino);
      if (actualIdentity.ino === 0 || expectedIdentity.ino === 0)
        assert.equal(fs.realpathSync(recorded.node), fs.realpathSync(expectedRuntime));
    } catch (cause) {
      prepared.retain(`LSP launch authority failed: ${session.name}`);
      failures.push(new Error(session.name, { cause }));
    }
  }

  for (const control of [
    { name: "unknown before preparation", args: ["--cwd", missing, "--unknown"], status: 2, diagnostic: "flag provided but not defined: -unknown" },
    { name: "invalid duration before preparation", args: ["--cwd", missing, "--progress-delay=invalid"], status: 2, diagnostic: "invalid value \"invalid\" for flag -progress-delay" },
    { name: "missing string before preparation", args: ["--cwd", missing, "--tsconfig"], status: 2, diagnostic: "flag needs an argument: -tsconfig" },
    { name: "false transport", args: ["--stdio=false", "--cwd", missing], status: 2, diagnostic: "only --stdio transport is supported" },
    { name: "missing final config", args: ["--cwd", b, "--tsconfig=project.json", `-tsconfig=${missing}`], status: 1, diagnostic: "tsconfig not found:" },
    { name: "missing final binary", args: ["--cwd", b, "--tsconfig=project.json", `--tsgo=${tsgo}`, `-tsgo=${missing}`], status: 1, diagnostic: "explicit tsgo binary must be an existing absolute path:" },
    { name: "help ignores trailing flags", args: ["--help", "--stdio", "--cwd", missing, "--unknown"], status: 0, diagnostic: "Language Server Protocol host" },
    { name: "version ignores trailing flags", args: ["--version", "--stdio", "--cwd", missing, "--unknown"], status: 0, diagnostic: "ttscserver " },
  ]) {
    try {
      const result = E2eProcessTrace.spawnSync(process.execPath, [launcher, ...control.args], {
        encoding: "utf8",
        input: "",
        env: { ...process.env, TTSC_CACHE_DIR: prepared.cache, TTSC_NODE_BINARY: process.execPath },
        windowsHide: true,
      });
      if (result.error) throw result.error;
      assert.equal(result.signal, null);
      assert.equal(result.status, control.status, result.stderr);
      assert.ok((result.stdout + result.stderr).includes(control.diagnostic), `${control.name}: ${result.stdout}\n${result.stderr}`);
    } catch (cause) {
      failures.push(new Error(control.name, { cause }));
    }
  }
  const emptyRoot = TestProject.tmpdir("ttscserver-empty-launch-");
  TestProject.retainTemporaryDirectory(emptyRoot);
  try {
    for (let directory = emptyRoot; ; directory = path.dirname(directory)) {
      assert.equal(fs.existsSync(path.join(directory, "tsconfig.json")), false, "the no-config control must have no inherited tsconfig");
      assert.equal(fs.existsSync(path.join(directory, "jsconfig.json")), false, "the no-config control must have no inherited jsconfig");
      if (path.dirname(directory) === directory) break;
    }
    const trace = TestProject.tmpdir("lsp-empty-launch-", traceParent);
    if (traceSink)
      TestProject.retainTemporaryDirectory(
        trace, "LSP empty-project diagnostic observations",
      );
    const client = TtscserverClient.startLauncher(emptyRoot, {
      implicitCwd: true,
      env: {
        TTSC_CACHE_DIR: prepared.cache,
        TTSC_E2E_TRACE: trace,
        TTSC_NODE_BINARY: process.execPath,
      },
    });
    await runTtscserverSession(client, async () => {
      await initializeTtscserverClient(client, emptyRoot);
    });
    const events = readTrace(trace, true);
    const upstream = events.find((event) => event.event === "process-result" && event.argv?.[1] === "--lsp" && event.argv?.[2] === "--stdio");
    assert.ok(upstream, "the actual empty-project upstream must return");
    assert.equal(upstream.data?.started, true);
    assert.equal(upstream.data?.exitObserved, true);
    assert.ok(typeof upstream.cwd === "string");
    assert.equal(
      fs.realpathSync.native(upstream.cwd), fs.realpathSync.native(emptyRoot),
    );
    assert.equal(events.some((event) => event.argv?.includes("--lsp-plugins-file")), false, "no implicit config creates no private plugin manifest");
    fs.rmdirSync(emptyRoot);
  } catch (cause) {
    prepared.retain("empty-project launcher failed; original inputs retained");
    failures.push(new Error("omitted config on an empty project", { cause }));
  }
  if (failures.length) throw new AggregateError(failures, "native launch argument authority");
}

function readTrace(directory: string, settled: boolean): TraceEvent[] {
  const records: TraceEvent[] = [];
  for (const filename of fs.readdirSync(directory).filter((name) => name.endsWith(".jsonl"))) {
    const text = fs.readFileSync(path.join(directory, filename), "utf8");
    if (settled) assert.ok(text.endsWith("\n"), "settled native trace must contain complete records");
    for (const line of text.split("\n").slice(0, -1)) {
      const event = JSON.parse(line) as TraceEvent;
      assert.notEqual(event.event, "integrity-failure", "trace must retain actual command evidence");
      records.push(event);
    }
  }
  return records;
}

function assertLaunchTrace(events: readonly TraceEvent[], logicalRoot: string, physicalRoot: string, tsgo: string, originalArgs: readonly string[]): void {
  const attempts = events.filter((event) => event.event === "process-attempt");
  const upstream = attempts.filter((event) => event.argv?.[1] === "--lsp" && event.argv?.[2] === "--stdio");
  assert.equal(upstream.length, 1, "one actual upstream command must be observed");
  assert.equal(upstream[0]!.cwd, logicalRoot, "native upstream receives final logical cwd");
  assert.equal(upstream[0]!.argv?.[0], tsgo, "native upstream receives final compiler path");
  const sidecars = attempts.filter((event) => event.data?.writerRuntime?.startsWith("go") && event.argv?.some((arg) => arg.startsWith("--project-context-json=")));
  assert.ok(sidecars.length > 0, "actual native plugin calls must carry project context");
  for (const event of sidecars) {
    const argument = event.argv!.find((arg) => arg.startsWith("--project-context-json="))!;
    const context = JSON.parse(argument.slice("--project-context-json=".length)) as { physicalProjectRoot: string; physicalConfigPath: string; logicalConfigPath: string };
    assert.equal(context.physicalProjectRoot, fs.realpathSync(physicalRoot));
    assert.equal(context.physicalConfigPath, fs.realpathSync(path.join(physicalRoot, "project.json")));
    assert.equal(context.logicalConfigPath, path.join(logicalRoot, "project.json"));
    assert.equal(event.cwd, fs.realpathSync(physicalRoot), "native plugin executes from physical B");
  }
  const host = attempts.find((event) => event.data?.origin === "ttscserver" && event.argv?.includes("--lsp-plugins-file"));
  assert.ok(host?.argv, "the actual host receives the private resolved manifest");
  assert.deepEqual(host.argv.slice(-originalArgs.length), originalArgs, "caller argv remains intact");
  const manifest = host.argv[host.argv.indexOf("--lsp-plugins-file") + 1]!;
  assert.equal(fs.existsSync(manifest), false, "native startup consumes its private manifest");
}

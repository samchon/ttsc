import { TestLint, TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  TtscserverClient,
  assert,
  shutdownTtscserverClient,
  waitForTtscserverOutcome,
} from "../../../../internal/ttsc/internal/ttscserver";

type Diagnostic = { code?: unknown };
type PublishDiagnosticsParams = { diagnostics?: Diagnostic[]; uri: string };

const SOURCE = "var legacy = 1;\nexport const kept = legacy;\n";

const CASCADE_SOURCE =
  'const icon = "\uD83D\uDE00"; var legacy = 1; let stable = legacy; if (typeof stable == "number") { console.log(icon, stable); } export {};';
const CASCADE_FIXED =
  'const icon = "\uD83D\uDE00"; const legacy = 1; const stable = legacy; if (typeof stable === "number") { console.log(icon, stable); } export {};';
type CascadeAction = { kind?: string; command?: { command?: string } };
type CascadeEdit = {
  changes?: Record<
    string,
    Array<{
      newText: string;
      range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
      };
    }>
  >;
};

/** Deadline applies only to supported direct close and shutdown. */
const CLOSE_TIMEOUT = 120_000;

/**
 * Verifies a `ttscserver` session ends through the plugin-selection path when
 * what selects its plugins changes: the tsconfig's `compilerOptions.plugins`,
 * or a dependency that publishes a plugin.
 *
 * A session ran the plugins it selected at startup. A tsconfig edit reached it
 * only as a Program refresh, and a project without plugins passed the host no
 * selection inputs at all, so adding or removing a plugin kept the old
 * selection until the user restarted the language server by hand
 * (samchon/ttsc#1511). The config chain and the manifests plugin discovery
 * reads are now selection inputs, as `ttsc --watch` treats them.
 *
 * 1. Start a session on a `no-var` lint project whose tsconfig names no plugin.
 *    Restore `@ttsc/lint` in its `plugins`, report the change, and wait for
 *    `ttsc/pluginSelectionChanged`.
 * 2. Start the next session: it reports `no-var`. Remove the plugin again, report
 *    the change, and wait for `ttsc/pluginSelectionChanged`. The cascade source
 *    explicitly exports an empty module, matching its original owning unit;
 *    script-global var properties remain protected by the unchanged no-var
 *    automatic-fix guard.
 * 3. Start a session with no plugin, write a `package.json` whose dependencies
 *    include `@ttsc/lint`, which publishes itself as a plugin, report it, and
 *    wait for `ttsc/pluginSelectionChanged`.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual sessions must announce pluginSelectionChanged when tsconfig adds or removes the plugin and when a previously plugin-free manifest adds its dependency; the intervening session must publish no-var.
 * @evidence contracts/testing.md#independent-expectations The cascade source and exact expected output both retain export {}; so module-scoped no-var conversion is required, while the maintained no-var global-property unit owns script rejection. Original configured and unconfigured tsconfig bytes, package dependency insertion, literal notification method and no-var publication independently prescribe the selection transitions.
 * @evidence contracts/testing.md#distinguishing-cases Exercises plugin addition and removal through compilerOptions and addition through package discovery, including a plugin-free initial state and a positive next-session diagnostic.
 * @evidence contracts/testing.md#execution-ownership Selected LSP calls this body through lspSelectionCorpus on one upfront island; three actual startup selections and authored editor-style watched-file protocol messages belong to this body. These are not kernel-watch events, packed installation or a count of every child/Program; source fingerprint units do not establish the real notification/close connection.
 * @evidence contracts/e2e.md#necessary-boundary The launcher selection snapshot and live native watched-file handling must agree on restart inputs, including inputs absent from a plugin-free initial selection.
 * @evidence contracts/e2e.md#shared-execution One consumer, unchanged workspace lint producer and explicit suite cache carry the three original sessions. Restart selections cannot collapse to an unchanged host. The cascade transfers two existing requests, one sidecar and three fix cycles from the ordinary editor; one additional upfront source enlarges this selection population without another server, root or prepare. Shared preparation is available, without cache-hit/build-Program-process total/binary-byte/minimum-cost certification.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Only the tracked private config/manifest change. Every client is owned before initialize; selection waiters precede writes and positive no-var readiness is armed before didOpen. Each intentional native selection-error close/status1 is joined before the next session or mutation. Failure retains consumer/already-owned cache before bounded shutdown, preserving original and cleanup errors; no unresolved reset/removal, forced success, arbitrary descendant or loaded-image proof is claimed.
 * @evidence contracts/e2e.md#preserved-coverage The configured-removal lifetime owns the transferred cascade action/command, exact const/equality edit for the authored external module, astral UTF-16 range and unchanged disk under the original three-rule authority before plugin removal. Preserves all three original selection notifications plus the intervening no-var publication and actual lifecycle handling; does not replace the restart assertion with a pure membership predicate.
 */
export async function test_ttscserver_ends_the_session_when_what_selects_its_plugins_changes(prepared?: {
  root: string;
  cache: string;
  retain: (reason: string) => void;
  closed: () => void;
}) {
  const project =
    prepared === undefined
      ? TestLint.createProject({
          name: "ttscserver-plugin-selection-config",
          rules: { "no-var": "error" },
          source: SOURCE,
        })
      : { tmpdir: prepared.root, cleanup: () => undefined };
  const tsconfig = path.join(project.tmpdir, "tsconfig.json");
  const manifest = path.join(project.tmpdir, "package.json");
  const configured = fs.readFileSync(tsconfig, "utf8");
  const unconfigured = JSON.parse(configured) as {
    compilerOptions: { plugins?: unknown };
  };
  delete unconfigured.compilerOptions.plugins;
  const withoutPlugins = JSON.stringify(unconfigured, null, 2);
  const file = path.join(project.tmpdir, "src", "main.ts");
  const uri = pathToFileURL(file).href;
  let activeClient: TtscserverClient | undefined;

  /** Start a session and open the file. */
  const start = async (): Promise<TtscserverClient> => {
    const client = TtscserverClient.startLauncher(project.tmpdir, {
      env: { TTSC_CACHE_DIR: prepared?.cache ?? SHARED_PLUGIN_CACHE_DIR },
    });
    activeClient = client;
    await client.request("initialize", {
      capabilities: {},
      processId: process.pid,
      rootUri: pathToFileURL(project.tmpdir).href,
    });
    client.notify("initialized", {});
    return client;
  };
  /** Write `changed`, report it as the editor would, and await the end. */
  const change = async (
    client: TtscserverClient,
    changed: string,
    text: string,
  ): Promise<void> => {
    const selection = client.waitForNotification(
      "ttsc/pluginSelectionChanged",
      () => true,
    );
    const existed = fs.existsSync(changed);
    fs.writeFileSync(changed, text);
    client.notify("workspace/didChangeWatchedFiles", {
      changes: [{ type: existed ? 2 : 1, uri: pathToFileURL(changed).href }],
    });
    await selection;
    const code = await waitForTtscserverOutcome(
      client.waitForExit(),
      CLOSE_TIMEOUT,
      "plugin selector changed but direct child close was not joined",
    );
    activeClient = undefined;
    assert.equal(
      code,
      1,
      "selection restart must propagate the native sentinel exit",
    );
  };
  const session = async (
    body: (client: TtscserverClient) => Promise<void>,
    expectNoVar = false,
  ): Promise<void> => {
    const client = await start();
    const publication = expectNoVar
      ? client.waitForNotification<PublishDiagnosticsParams>(
          "textDocument/publishDiagnostics",
          (params) =>
            params.uri === uri &&
            (params.diagnostics ?? []).some(
              (diagnostic) => diagnostic.code === "no-var",
            ),
        )
      : undefined;
    client.notify("textDocument/didOpen", {
      textDocument: {
        languageId: "typescript",
        text: SOURCE,
        uri,
        version: 1,
      },
    });
    if (publication !== undefined) {
      const published = await publication;
      assert.ok(published.diagnostics?.length);
    }
    await body(client);
  };

  try {
    // 1. A plugin added to the tsconfig.
    fs.writeFileSync(tsconfig, withoutPlugins);
    await session((client) => change(client, tsconfig, configured));

    // 2. The next session runs it; removing it ends that session too.
    await session(async (client) => {
      if (prepared !== undefined) {
        const cascadeFile = path.join(project.tmpdir, "src/editor-cascade.ts");
        const cascadeUri = pathToFileURL(cascadeFile).href;
        assert.equal(fs.readFileSync(cascadeFile, "utf8"), CASCADE_SOURCE);
        client.notify("textDocument/didOpen", {
          textDocument: {
            uri: cascadeUri,
            languageId: "typescript",
            version: 1,
            text: CASCADE_SOURCE,
          },
        });
        try {
          const actions = await client.request<CascadeAction[]>(
            "textDocument/codeAction",
            {
              textDocument: { uri: cascadeUri },
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: CASCADE_SOURCE.length },
              },
              context: { diagnostics: [], only: ["source.fixAll.ttsc"] },
            },
            60_000,
          );
          const action = actions.find(
            (candidate) => candidate.command?.command === "ttsc.lint.fixAll",
          );
          assert.ok(action, "the native manifest must route ttsc.lint.fixAll");
          assert.equal(action.kind, "source.fixAll.ttsc");
          const edit = await client.request<CascadeEdit>(
            "workspace/executeCommand",
            {
              command: "ttsc.lint.fixAll",
              arguments: [cascadeUri],
            },
            60_000,
          );
          const edits = edit.changes?.[cascadeUri] ?? [];
          assert.deepEqual(Object.keys(edit.changes ?? {}), [cascadeUri]);
          assert.equal(edits.length, 1);
          assert.deepEqual(
            edits[0]?.range,
            {
              start: { line: 0, character: 0 },
              end: { line: 0, character: CASCADE_SOURCE.length },
            },
            "the whole-source edit retains the astral UTF-16 range",
          );
          assert.equal(
            edits[0]?.newText,
            CASCADE_FIXED,
            "the three-rule cascade reaches its const/equality fixed point",
          );
          assert.equal(
            fs.readFileSync(cascadeFile, "utf8"),
            CASCADE_SOURCE,
            "native editor commands return edits without changing disk",
          );
        } finally {
          client.notify("textDocument/didClose", {
            textDocument: { uri: cascadeUri },
          });
        }
      }
      await change(client, tsconfig, withoutPlugins);
    }, true);

    // 3. A dependency that publishes a plugin.
    const previous = fs.existsSync(manifest)
      ? (JSON.parse(fs.readFileSync(manifest, "utf8")) as Record<
          string,
          unknown
        >)
      : { name: "ttscserver-plugin-selection-config", private: true };
    await session((client) =>
      change(
        client,
        manifest,
        JSON.stringify(
          {
            ...previous,
            dependencies: {
              ...((previous.dependencies as object | undefined) ?? {}),
              "@ttsc/lint": "*",
            },
          },
          null,
          2,
        ),
      ),
    );
  } catch (error) {
    const failures: unknown[] = [error];
    const reason = "plugin-selector session startup, body or close failed";
    if (prepared !== undefined) prepared.retain(reason);
    try {
      if (prepared === undefined)
        TestProject.retainTemporaryDirectory(project.tmpdir, reason);
    } catch (retentionError) {
      failures.push(retentionError);
    }
    try {
      TestProject.retainSharedPluginCache(reason);
    } catch (retentionError) {
      failures.push(retentionError);
    }
    if (activeClient !== undefined) {
      try {
        await waitForTtscserverOutcome(
          shutdownTtscserverClient(activeClient),
          CLOSE_TIMEOUT,
          "failed selector session shutdown was not joined",
        );
        activeClient = undefined;
      } catch (shutdownError) {
        failures.push(shutdownError);
      }
    }
    if (activeClient === undefined) prepared?.closed();
    throw new AggregateError(failures, reason);
  }
  project.cleanup();
  prepared?.closed();
}

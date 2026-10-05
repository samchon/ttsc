import { TestProject, retainNativeLintProducer } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { BatchWorkspace } from "../batch/BatchWorkspace";
import {
  PLUGIN_BUILD_TIMEOUT,
  TtscserverClient,
  assert,
  runTtscserverSession,
} from "../internal/ttsc/internal/ttscserver";

type Position = { character?: number; line?: number };

type Range = { end?: Position; start?: Position };

type Diagnostic = {
  code?: unknown;
  message?: string;
  range?: Range;
  severity?: number;
  source?: string;
};

type PublishDiagnosticsParams = {
  diagnostics?: Diagnostic[];
  uri: string;
  version?: number;
};

type CodeAction = {
  command?: { arguments?: unknown[]; command?: string };
  kind?: string;
  title?: string;
};

type InitializeResult = {
  capabilities?: {
    hoverProvider?: unknown;
    documentSymbolProvider?: unknown;
    completionProvider?: unknown;
    codeActionProvider?: boolean | { codeActionKinds?: string[] };
    diagnosticProvider?: unknown;
    documentFormattingProvider?: boolean;
    executeCommandProvider?: { commands?: string[] };
  };
};

type TextEdit = { newText?: string; range?: Range };

type WorkspaceEdit = { changes?: Record<string, TextEdit[]> };

type CompletionItem = { data?: { $ttsc?: string }; detail?: string; filterText?: string; insertText?: string; label?: string; textEdit?: { newText?: string; range?: Range } };
type CompletionResponse = CompletionItem[] | { isIncomplete?: boolean; items?: CompletionItem[] } | null;
type DocumentSymbol = { name?: string; children?: DocumentSymbol[] };
const DOC_PLUGIN_MARKER = "ttsc/completion-hint/v1";
const DOC_CARET = { character: 7, line: 3 };
const DOC_OUTSIDE_BLOCK = { character: 0, line: 5 };
const DOC_TYPED = "par";
const DOC_CORPUS_TIMEOUT = 300_000;
const DOC_POLL_INTERVAL = 2_000;

const OPENED = "var legacy = 1;\nconsole.log(legacy);\n";

const APPENDED_LINE = 'console.log("edited");\n';

/**
 * End of {@link OPENED}. Its trailing newline closes line 1, so the empty line 2
 * is where an editor's caret sits when the user types the next line.
 */
const APPEND_POSITION = { character: 0, line: 2 };

const SAVED = OPENED + APPENDED_LINE;

/** `no-var` alone rewrites the keyword to `let`; `const` needs `prefer-const`. */
const FIXED = SAVED.replace("var legacy", "let legacy");

/**
 * Verifies one ttscserver LSP session carries diagnostics through to a fix.
 *
 * The ordered protocol chain observes merged capabilities, dirty-buffer
 * suppression, saved revalidation and returned edits in one actual server.
 * It exercises the editor protocol without launching an editor extension.
 *
 * 1. Materialize a `@ttsc/lint` project with a `no-var` violation, handshake, and
 *    assert ttsc's command ids and action kinds are merged into tsgo's
 *    advertised capabilities rather than replacing them.
 * 2. Open the file and assert the lint diagnostic underlines the `var` keyword;
 *    edit the buffer and assert the dirty publish drops the finding; save and
 *    assert it returns.
 * 3. Ask for code actions over that diagnostic's own range and assert the
 *    ttsc-owned `ttsc.lint.fixAll` action comes back.
 * 4. Execute that command and assert the returned WorkspaceEdit fixes the
 *    violation without writing the file, then shut the server down cleanly.
 *
 * @evidence contracts/testing.md#behavioral-verification One real editor session preserves merged initialize capabilities, publishes Evidence missing-export and missing-file failures, clears them after native watched repairs, publishes the exact var range/severity/message, suppresses dirty findings, republishes on save and reports a real native command stderr failure before returning a targeted fix without writing disk.
 * @evidence contracts/testing.md#independent-expectations Literal capability ids/kinds, authored source/append range, var underline/severity and expected let rewrite independently prescribe every original editor transition.
 * @evidence contracts/testing.md#distinguishing-cases Separates upstream capability preservation from native actions, dirty suppression from absence by retaining var, and returned WorkspaceEdit from sidecar disk mutation after save.
 * @evidence contracts/testing.md#execution-ownership The shared DAG runner selects this one actual initialized editor session; an actual Evidence missing-export/repair/deletion/restoration chain joins the existing no-var lifecycle without another server. It sends actual initialize/didOpen/incremental didChange/didSave/codeAction/executeCommand across the native proxy and lint producer; it does not launch VS Code itself.
 * @evidence contracts/e2e.md#necessary-boundary Direct rule or synthetic publication units cannot establish ordered editor notifications, dirty-buffer suppression, saved revalidation and actual command manifest routing, bounded stdout decoding and native stderr failure adaptation across the native bridge.
 * @evidence contracts/e2e.md#shared-execution One workspace snapshot producer, project and initialized server execute the ordered lifecycle using the explicit suite cache. This same launcher inherits the owned workspace as process cwd and omits --cwd, exercising native Getwd admission through its actual initialize, project diagnostics and joined shutdown. Direct runLSP tests own explicit --cwd projection; uninitialized EOF remains a separate unresolved boundary. One extra command request with empty arguments starts the existing lint sidecar once, proving failed stderr adaptation before the already planned successful fix; it adds no server or profile and is not preparation with zero cost. Shared availability is not a packed installation, cache-hit, child/build-total or Program-reuse assertion; direct rule units own separate semantic contributions and require their own selection/execution evidence.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Only the temporary source is intentionally saved by the harness; dirty edits remain buffer-only until save and command nonmutation is checked against saved bytes. Successful supported shutdown/direct close precedes cleanup, with a separate REQUEST_TIMEOUT shutdown bound. Startup/body/shutdown failure retains the tracked consumer and already-owned snapshot/cache, preserving retention errors. An independently unmatched notification waiter must reject when that same child actually closes, releasing its owned timer/listener on both body failure and normal close. Timeout does not force termination or certify arbitrary descendant closure.
 * @evidence contracts/e2e.md#preserved-coverage Keeps every capability, range, severity, message, dirty/saved predicate, action target and exact WorkspaceEdit/disk assertion. Upfront disjoint alias islands preserve boolean/string and number/string native rejection plus a valid numeric twin; actual source wrapper units own leaf/JSONC/package-preset configuration derivation. This shared checker session does not claim it replays each original wrapper profile. Upfront LF/CR/CRLF saved documents retain buffer-only param/returns, exact edit and resolution, unchanged disk and outside-block negatives. The same upstream retains inferred legacy number, greet symbol and non-plugin completion after capability registration. Explicit configuration competes with discovered no-console-only JSON after the shared base is moved outside discovery names; positive no-var and negative no-console distinguish the handoff. Necessary internal checker updates are not old per-project launcher recipes, and their total is not asserted to be one.
 */
export async function test_e2e_lsp_batch() {
    const workspace = await BatchWorkspace.open();
    const project = { tmpdir: workspace.root };
    const configPath = path.join(workspace.root, "tsconfig.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    config.compilerOptions.rootDir = ".";
    config.include = [...config.include, "native-errors/**/*.ts", "native-errors/**/*.tsx"];
    config.compilerOptions.paths = {
      ...config.compilerOptions.paths,
      "#lib/*": ["./native-errors/models/*"],
      "#preset/*": ["./native-errors/models/*"],
    };
    const lintEntry = config.compilerOptions.plugins.find((entry: { transform?: string }) => entry.transform === "@ttsc/lint");
    assert.ok(lintEntry, "the actual lint contributor must remain selected");
    lintEntry.configFile = "./lint.lsp.config.cjs";
    fs.renameSync(path.join(workspace.root, "lint.config.cjs"), path.join(workspace.root, "lint-shared-base.cjs"));
    fs.writeFileSync(path.join(workspace.root, "lint.lsp.config.cjs"), `const base = require("./lint-shared-base.cjs");
const graph = base.rules["evidence/graph"][1];
module.exports = { ...base, rules: { ...base.rules, "jsdoc/check-tag-names": "error", "evidence/graph": ["error", { ...graph, claims: [...graph.claims, { type: "markdown", files: ["review.md"], symbol: "h2", reference: { type: "typescript", root: "./external", files: ["*.ts"], symbol: "property" } }] }] } };
`);
    fs.copyFileSync(path.join(workspace.root, "native-errors/lsp-default-decoy.json"), path.join(workspace.root, "lint.config.json"));
    fs.writeFileSync(path.join(workspace.root, "review.md"), "## Review\n<!-- @link external/example.ts#value Reviews the value. -->\n");
    fs.mkdirSync(path.join(workspace.root, "external"), { recursive: true });
    const evidenceTarget = path.join(workspace.root, "external/example.ts");
    fs.writeFileSync(evidenceTarget, "export const other = 1;\n");
    fs.writeFileSync(configPath, JSON.stringify(config));
    fs.writeFileSync(path.join(project.tmpdir, "src/editor.ts"), OPENED);
    const file = path.join(project.tmpdir, "src", "editor.ts");
    const uri = pathToFileURL(file).href;
    try {
      const client = TtscserverClient.startLauncher(project.tmpdir, {
        env: { TTSC_CACHE_DIR: workspace.cache },
        implicitCwd: true,
      });
      let latestPublication: PublishDiagnosticsParams | undefined;
      client.on("textDocument/publishDiagnostics", (params: PublishDiagnosticsParams) => { latestPublication = params; });
      const unmatchedClose = client.waitForNotification<unknown>("textDocument/publishDiagnostics", () => false, PLUGIN_BUILD_TIMEOUT).then(
        () => ({ error: undefined }), (error: unknown) => ({ error }),
      );
      await runTtscserverSession(client, async () => {
        const evidenceInitial = step("initial external Evidence publication", client.waitForNotification<PublishDiagnosticsParams>(
          "textDocument/publishDiagnostics",
          (params) => (params.diagnostics ?? []).some((diagnostic) => diagnostic.message?.includes("Missing TypeScript evidence export")),
          PLUGIN_BUILD_TIMEOUT,
        )).then((value) => ({ value }), (error: unknown) => ({ error }));
        // 1. Handshake. The editor builds its command palette and lightbulb menu
        // from this response, so the advertised ids are editor-visible behavior.
        const initialized = await step(
          "initialize",
          client.request<InitializeResult>(
            "initialize",
            {
              capabilities: {
                workspace: { didChangeWatchedFiles: { dynamicRegistration: true, relativePatternSupport: true } },
                textDocument: {
                  completion: { completionItem: { insertReplaceSupport: true, labelDetailsSupport: true, resolveSupport: { properties: ["detail", "documentation"] }, snippetSupport: false }, contextSupport: true, dynamicRegistration: false },
                  documentSymbol: { hierarchicalDocumentSymbolSupport: true },
                  hover: { contentFormat: ["markdown", "plaintext"] },
                  synchronization: { didSave: true, dynamicRegistration: false },
                },
              },
              processId: process.pid,
              rootUri: pathToFileURL(project.tmpdir).href,
            },
            // Preserve the original unbounded initialize request. Pending
            // requests reject on direct child close; this does not diagnose
            // every delay as a cold build or count construction costs.
          ),
        );
        const capabilities = initialized.capabilities ?? {};
        assert.ok(capabilities.hoverProvider, "the actual upstream hover provider must survive the plugin proxy");
        assert.ok(capabilities.documentSymbolProvider, "the actual upstream symbol provider must survive the plugin proxy");
        assert.ok(capabilities.completionProvider, "the actual upstream completion provider must survive the plugin proxy");
        assert.ok(
          capabilities.executeCommandProvider?.commands?.includes(
            "ttsc.lint.fixAll",
          ),
          `initialize should advertise ttsc.lint.fixAll: ${JSON.stringify(capabilities.executeCommandProvider)}`,
        );
        assert.equal(
          capabilities.documentFormattingProvider,
          true,
          "ttsc owns ttsc.format.document, so formatOnSave must stay advertised",
        );
        // ttsc rewrites the initialize result in flight. Assert both sides of
        // every field it touches: tsgo advertises codeActionProvider as an object
        // carrying its own kinds, and a regression that replaced the capability
        // instead of merging into it would still satisfy either half alone.
        const codeActionKinds =
          typeof capabilities.codeActionProvider === "object"
            ? (capabilities.codeActionProvider.codeActionKinds ?? [])
            : [];
        assert.ok(
          codeActionKinds.includes("source.fixAll.ttsc"),
          `initialize should advertise source.fixAll.ttsc: ${JSON.stringify(capabilities.codeActionProvider)}`,
        );
        assert.ok(
          codeActionKinds.includes("quickfix"),
          `ttsc must merge into tsgo's kinds, not replace them: ${JSON.stringify(capabilities.codeActionProvider)}`,
        );
        // tsgo 7 reports its own findings through the pull channel
        // (`textDocument/diagnostic`) rather than pushing publishDiagnostics, so
        // ttsc's push-side merge has nothing upstream to merge with. Its
        // capability still has to survive the rewrite, or the editor would stop
        // asking tsgo for type errors entirely.
        assert.ok(
          capabilities.diagnosticProvider,
          `ttsc must not drop tsgo's diagnosticProvider: ${JSON.stringify(capabilities)}`,
        );
        client.notify("initialized", {});
        const populationFailures: unknown[] = [];
        const DOC_SAVED = 'var legacy = 1;\nexport function greet(name: string): string {\n  return "Hello, " + name + legacy;\n}\n';
        const DOC_DIRTY = DOC_SAVED.replace("export function", "/**\n * Greets one user.\n * @par\n */\nexport function");
        const published = (response: CompletionResponse): CompletionItem[] => (Array.isArray(response) ? response : response?.items ?? []).filter((item) => item.data?.$ttsc === DOC_PLUGIN_MARKER);
      for (const [name, newline] of [
        ["LF", "\n"],
        ["CR", "\r"],
        ["CRLF", "\r\n"],
      ] as const) {
        const saved = DOC_SAVED.replaceAll("\n", newline);
        const dirty = DOC_DIRTY.replaceAll("\n", newline);
        const file = path.join(project.tmpdir, "native-errors", "lsp-" + name + ".ts");
        const uri = pathToFileURL(file).href;
        const check = (body: () => void): void => {
          try {
            body();
          } catch (error) {
            populationFailures.push(new Error(name + ": completion assertion", { cause: error }));
          }
        };
        try {
          // 2. Open what was saved and wait for the saved file's own lint finding.
          //
          // An actual finding for this URI establishes diagnostic readiness.
          // It does not measure build duration or establish readiness of every
          // later hints request, Program construction or transport step.
          const ready = client.waitForNotification<PublishDiagnosticsParams>(
            "textDocument/publishDiagnostics",
            (params) =>
              params.uri === uri &&
              (params.diagnostics ?? []).some(
                (diagnostic) =>
                  diagnostic.source === "@ttsc/lint" &&
                  diagnostic.code === "no-var",
              ),
            PLUGIN_BUILD_TIMEOUT,
          );
          client.notify("textDocument/didOpen", {
            textDocument: {
              languageId: "typescript",
              text: saved,
              uri,
              version: 1,
            },
          });
          await ready;
          if (name === "LF") {
            try {
            const hover = await client.request<{ contents?: unknown }>("textDocument/hover", { position: { character: 5, line: 0 }, textDocument: { uri } }, REQUEST_TIMEOUT);
            assert.match(JSON.stringify(hover?.contents ?? ""), /legacy: number/, "the upstream checker must answer the independently authored numeric binding");
            assert.ok(client.serverRequestMethods().includes("client/registerCapability"), "the actual upstream registration handshake must be answered");
            const symbols = await client.request<DocumentSymbol[] | null>("textDocument/documentSymbol", { textDocument: { uri } }, REQUEST_TIMEOUT);
            const pendingSymbols = [...(symbols ?? [])];
            const names: string[] = [];
            while (pendingSymbols.length) {
              const symbol = pendingSymbols.pop()!;
              if (symbol.name) names.push(symbol.name);
              if (symbol.children) pendingSymbols.push(...symbol.children);
            }
            assert.ok(names.includes("greet"), "documentSymbol must retain the actual upstream declaration");
            const completion = await client.request<CompletionResponse>("textDocument/completion", { context: { triggerKind: 1 }, position: { character: 2, line: 2 }, textDocument: { uri } }, REQUEST_TIMEOUT);
            const upstream = (Array.isArray(completion) ? completion : completion?.items ?? []).filter((item) => item.data?.$ttsc !== DOC_PLUGIN_MARKER).map((item) => item.label);
            assert.ok(upstream.includes("legacy"), "the plugin merge must preserve the independently named upstream completion");
            } catch (error) {
              populationFailures.push(new Error("upstream language request population", { cause: error }));
            }
          }

          // Now type the JSDoc block into the buffer only. A rangeless
          // contentChange is a full-document replacement, which is what an editor
          // sends when it does not track incremental edits.
          client.notify("textDocument/didChange", {
            contentChanges: [{ text: dirty }],
            textDocument: { uri, version: 2 },
          });

          // 3. Establish whether this session answers completion at all, before
          // asking anything about the corpus.
          //
          // A completion request the proxy does not enrich is forwarded untouched
          // and answered by TypeScript-Go, so a caret in ordinary code has to come
          // back — with items, with null, it does not matter. Without this probe a
          // silent session and an empty corpus produce the same failure, and the two
          // have nothing to do with each other.
          // Ask TypeScript-Go something it alone owns first. A hover reply proves
          // the upstream server is alive and serving this document, which separates
          // "completion is not answered" from "nothing upstream is answered".
          let alive: string;
          try {
            await client.request(
              "textDocument/hover",
              { position: { character: 4, line: 0 }, textDocument: { uri } },
              REQUEST_TIMEOUT,
            );
            alive = "upstream answered hover";
          } catch (error) {
            alive = `upstream never answered hover: ${
              error instanceof Error ? error.message : String(error)
            }`;
          }

          const probeStart = Date.now();
          let probe: string;
          try {
            const response = await client.request<CompletionResponse>(
              "textDocument/completion",
              {
                context: { triggerKind: 1 },
                position: { character: 0, line: 0 },
                textDocument: { uri },
              },
              REQUEST_TIMEOUT,
            );
            const shape = Array.isArray(response)
              ? `${response.length} items`
              : response === null
                ? "null"
                : `list of ${(response.items ?? []).length}`;
            probe = `upstream answered plain completion in ${Date.now() - probeStart}ms (${shape})`;
          } catch (error) {
            probe = `upstream never answered plain completion: ${
              error instanceof Error ? error.message : String(error)
            }`;
          }

          // 4. Poll for the authored corpus under the separate outer deadline.
          // Empty replies and request errors retain context for that deadline;
          // their cause is not independently classified by this observer.
          const deadline = Date.now() + DOC_CORPUS_TIMEOUT;
          let items: CompletionItem[] = [];
          let attempts = 0;
          let last = "no attempt completed";
          while (items.length === 0) {
            attempts++;
            try {
              items = published(
                await client.request<CompletionResponse>(
                  "textDocument/completion",
                  {
                    context: { triggerKind: 1 },
                    position: DOC_CARET,
                    textDocument: { uri },
                  },
                  REQUEST_TIMEOUT,
                ),
              );
            } catch (error) {
              // Preserve the actual request error for the eventual deadline.
              // Retrying does not diagnose it as a cold build or prove recovery.
              last = error instanceof Error ? error.message : String(error);
            }
            if (items.length > 0) break;
            if (Date.now() >= deadline) {
              check(() =>
                assert.ok(
                  Date.now() < deadline,
                  `no rule-published completion after ${attempts} requests in ${DOC_CORPUS_TIMEOUT}ms (last: ${last}) — ${alive}; ${probe}`,
                ),
              );
              break;
            }
            await new Promise<void>((resolve) => setTimeout(resolve, DOC_POLL_INTERVAL));
          }

          // 4. The item an editor shows for the tag the user is halfway through.
          const param = items.find((item) => item.insertText === "param");
          check(() =>
            assert.ok(
              param,
              `expected the validated @param tag: ${JSON.stringify(items.map((item) => item.insertText))}`,
            ),
          );
          check(() =>
            assert.equal(
              param?.filterText,
              "param",
              "the client filters on the inserted text, so it must match the insertion",
            ),
          );
          check(() =>
            assert.ok(
              param?.detail,
              "each published tag carries its own description",
            ),
          );
          check(() =>
            assert.deepEqual(
              param?.textEdit?.range,
              {
                end: DOC_CARET,
                start: {
                  character: DOC_CARET.character - DOC_TYPED.length,
                  line: DOC_CARET.line,
                },
              },
              "accepting the item must replace exactly what was typed after the trigger",
            ),
          );
          check(() =>
            assert.equal(
              param?.textEdit?.newText,
              "param",
              "the edit writes the tag itself, leaving the @ the user already typed",
            ),
          );
          // One tag could be a coincidence. The corpus is the rule's whole
          // validated vocabulary, so a second, unrelated tag has to be there too.
          check(() =>
            assert.ok(
              items.some((item) => item.insertText === "returns"),
              `expected the rule's vocabulary, not a single tag: ${JSON.stringify(items.map((item) => item.insertText))}`,
            ),
          );

          // 5. The proof that this came from the buffer: disk never had a block.
          check(() =>
            assert.equal(
              fs.readFileSync(file, "utf8"),
              saved,
              "the test must not have saved; completion answered from the dirty buffer",
            ),
          );

          // 6. The negative twin, asked only now that the corpus is known to be
          // live. A caret on the declaration below the block is outside any JSDoc
          // scope, and an unscoped corpus would fire there too.
          try {
            const outside = await client.request<CompletionResponse>(
              "textDocument/completion",
              {
                context: { triggerKind: 1 },
                position: DOC_OUTSIDE_BLOCK,
                textDocument: { uri },
              },
              REQUEST_TIMEOUT,
            );
            check(() =>
              assert.deepEqual(
                published(outside),
                [],
                "the JSDoc corpus must not fire outside a JSDoc block",
              ),
            );
          } catch (error) {
            populationFailures.push(new Error(name + ": outside-block request", { cause: error }));
          }

          // 7. Resolve. TypeScript-Go advertises completionItem/resolve for its own
          // items and expects its own private data on every request, so a plugin
          // item has to be answered by ttscserver itself.
          if (param !== undefined) {
            const resolved = await client.request<CompletionItem>(
              "completionItem/resolve",
              param,
              REQUEST_TIMEOUT,
            );
            check(() =>
              assert.equal(
                resolved.insertText,
                "param",
                `resolve must answer the plugin's own item: ${JSON.stringify(resolved)}`,
              ),
            );
            check(() =>
              assert.equal(
                resolved.data?.$ttsc,
                DOC_PLUGIN_MARKER,
                "the ownership marker must survive resolve",
              ),
            );
          }
        } catch (error) {
          populationFailures.push(new Error(name + ": LSP newline corpus", { cause: error }));
        } finally {
          // This corpus owns unsaved editor buffers, not a persistent dirty
          // editor. Closing preserves saved bytes and releases the proxy's
          // project-publication suppression before the external Evidence flow.
          client.notify("textDocument/didClose", { textDocument: { uri } });
        }
      }

        try {
        const negativeFailures: unknown[] = [];
        for (const [name, code] of [["type-error.ts", 2322], ["syntax-error.tsx", 1002], ["alias-lib-error.ts", 2322], ["alias-preset-error.ts", 2322], ["alias-preset-valid.ts", null]] as const) {
          const invalidFile = path.join(workspace.root, "native-errors", name);
          const invalidUri = pathToFileURL(invalidFile).href;
          client.notify("textDocument/didOpen", {
            textDocument: { uri: invalidUri, languageId: name.endsWith("tsx") ? "typescriptreact" : "typescript", version: 1, text: fs.readFileSync(invalidFile, "utf8") },
          });
          const report = await client.request<{ items?: Diagnostic[] }>("textDocument/diagnostic", { textDocument: { uri: invalidUri } }, REQUEST_TIMEOUT);
          try {
            if (code === null)
              assert.equal(report.items?.some((diagnostic) => typeof diagnostic.code === "number"), false, `well-typed preset consumer: ${JSON.stringify(report)}`);
            else
              assert.ok(report.items?.some((diagnostic) => diagnostic.code === code), `native source ${name} must carry diagnostic ${code}: ${JSON.stringify(report)}`);
          } catch (error) { negativeFailures.push(error); }
          client.notify("textDocument/didClose", { textDocument: { uri: invalidUri } });
        }
        if (negativeFailures.length) throw new AggregateError(negativeFailures, "Shared native diagnostic islands failed");

        // 2. didOpen. Register the waiter first: publishDiagnostics is
        // server-initiated and races the notification that triggers it.
        const opened = step(
          "didOpen publishDiagnostics uri=" + uri + " version=1",
          client.waitForNotification<PublishDiagnosticsParams>(
            "textDocument/publishDiagnostics",
            (params) => params.uri === uri && findLint(params) !== undefined,
            PLUGIN_BUILD_TIMEOUT,
          ),
        );
        client.notify("textDocument/didOpen", {
          textDocument: {
            languageId: "typescript",
            text: fs.readFileSync(file, "utf8"),
            uri,
            version: 1,
          },
        });
        const openedPublication = await opened;
        const openedLint = findLint(openedPublication)!;
        const selectedCodes = new Set((openedPublication.diagnostics ?? [])
          .filter((diagnostic) => diagnostic.source === "@ttsc/lint")
          .map((diagnostic) => diagnostic.code));
        assert.ok(selectedCodes.has("no-var"), "the explicit config must reach the native diagnostic producer");
        assert.ok(!selectedCodes.has("no-console"), "the conflicting discovered config must not contribute its rule");
        assert.equal(fs.readFileSync(path.join(workspace.root, "lint.config.json"), "utf8"), '{"rules":{"no-console":"error"}}\n');
        const evidenceObservation = await evidenceInitial;
        if ("error" in evidenceObservation) throw evidenceObservation.error;
        const evidenceFirst = evidenceObservation.value;
        const awaitEvidenceClear = (phase: string) => step(phase + " uri=" + evidenceFirst.uri, client.waitForNotification<PublishDiagnosticsParams>(
          "textDocument/publishDiagnostics",
          (params) => params.uri === evidenceFirst.uri && !(params.diagnostics ?? []).some((diagnostic) => diagnostic.code === "evidence/graph"),
          PLUGIN_BUILD_TIMEOUT,
        ));
        const evidenceCleared = awaitEvidenceClear("external Evidence repair publication");
        fs.writeFileSync(evidenceTarget, "export const value = 1;\n");
        client.notify("workspace/didChangeWatchedFiles", { changes: [{ uri: pathToFileURL(evidenceTarget).href, type: 2 }] });
        await evidenceCleared;
        const evidenceDeleted = step("external Evidence deletion publication uri=" + evidenceFirst.uri, client.waitForNotification<PublishDiagnosticsParams>(
          "textDocument/publishDiagnostics",
          (params) => (params.diagnostics ?? []).some((diagnostic) => diagnostic.message?.includes("Missing TypeScript evidence file")),
          PLUGIN_BUILD_TIMEOUT,
        ));
        fs.unlinkSync(evidenceTarget);
        client.notify("workspace/didChangeWatchedFiles", { changes: [{ uri: pathToFileURL(evidenceTarget).href, type: 3 }] });
        assert.ok((await evidenceDeleted).diagnostics?.length, "the same editor must observe external Evidence deletion");
        const evidenceRestored = awaitEvidenceClear("external Evidence restoration publication");
        fs.writeFileSync(evidenceTarget, "export const value = 1;\n");
        client.notify("workspace/didChangeWatchedFiles", { changes: [{ uri: pathToFileURL(evidenceTarget).href, type: 1 }] });
        await evidenceRestored;
        assert.deepEqual(
          openedLint.range,
          { end: { character: 3, line: 0 }, start: { character: 0, line: 0 } },
          "the lint diagnostic must underline the `var` keyword itself",
        );
        assert.equal(
          openedLint.severity,
          1,
          "no-var is configured as an error",
        );
        assert.match(
          openedLint.message ?? "",
          /Unexpected var, use let or const instead/,
        );

        // 3. didChange. While the buffer is dirty the proxy deliberately drops
        // plugin findings: the sidecar reads disk, so a stale underline would sit
        // on text the user has already changed. The edit keeps the violation, so
        // an empty plugin contribution here is suppression, not absence.
        assert.ok(
          SAVED.includes("var legacy"),
          "the edit must keep the finding",
        );
        const dirty = step(
          "didChange publishDiagnostics uri=" + uri + " version=2",
          client.waitForNotification<PublishDiagnosticsParams>(
            "textDocument/publishDiagnostics",
            (params) =>
              params.uri === uri &&
              params.version === 2 &&
              findLint(params) === undefined,
            DIAGNOSTICS_TIMEOUT,
          ),
        );
        // tsgo advertises `textDocumentSync.change: 2` (Incremental), so send the
        // ranged edit a real client sends rather than a full replacement.
        client.notify("textDocument/didChange", {
          contentChanges: [
            {
              range: { end: APPEND_POSITION, start: APPEND_POSITION },
              text: APPENDED_LINE,
            },
          ],
          textDocument: { uri, version: 2 },
        });
        await dirty;

        // 4. didSave. The editor writes the buffer, then notifies; the sidecar
        // re-reads disk and the findings come back.
        const saved = step(
          "didSave publishDiagnostics uri=" + uri + " saved-version=2",
          client.waitForNotification<PublishDiagnosticsParams>(
            "textDocument/publishDiagnostics",
            (params) => params.uri === uri && findLint(params) !== undefined,
            DIAGNOSTICS_TIMEOUT,
          ),
        );
        fs.writeFileSync(file, SAVED, "utf8");
        client.notify("textDocument/didSave", {
          text: SAVED,
          textDocument: { uri },
        });
        const savedLint = findLint(await saved)!;
        assert.deepEqual(
          savedLint.range,
          openedLint.range,
          "the appended line is below the violation, so its range must not move",
        );

        // 5. The lightbulb request, scoped to the diagnostic the editor is
        // showing: its own range, its own diagnostic object, and the fix-all kind
        // VS Code asks for on a ttsc squiggle.
        const actions = await step(
          "textDocument/codeAction",
          client.request<CodeAction[] | null>(
            "textDocument/codeAction",
            {
              context: {
                diagnostics: [savedLint],
                only: ["source.fixAll.ttsc"],
                triggerKind: 1,
              },
              range: savedLint.range,
              textDocument: { uri },
            },
            REQUEST_TIMEOUT,
          ),
        );
        const fixAll = (actions ?? []).find(
          (action) => action.command?.command === "ttsc.lint.fixAll",
        );
        assert.ok(
          fixAll,
          `expected a ttsc.lint.fixAll action: ${JSON.stringify(actions)}`,
        );
        assert.equal(fixAll.kind, "source.fixAll.ttsc");
        assert.deepEqual(
          fixAll.command?.arguments,
          [uri],
          "the action must target the open document",
        );

        // The advertised native command receives malformed semantic arguments,
        // exits through its real stderr path, and must not retire this session.
        await assert.rejects(
          client.request("workspace/executeCommand", {
            arguments: [],
            command: "ttsc.lint.fixAll",
          }, REQUEST_TIMEOUT),
          /ttsc command "ttsc\.lint\.fixAll" failed:[\s\S]*lsp-execute-command failed:[\s\S]*missing URI argument/,
        );
        assert.equal(fs.readFileSync(file, "utf8"), SAVED, "a failed native command must not mutate the saved input");
        // 6. executeCommand. The extension applies the returned WorkspaceEdit
        // itself, so the sidecar must not touch the file.
        const edit = await step(
          "workspace/executeCommand",
          client.request<WorkspaceEdit>(
            "workspace/executeCommand",
            {
              arguments: fixAll.command?.arguments,
              command: "ttsc.lint.fixAll",
            },
            REQUEST_TIMEOUT,
          ),
        );
        const edits = edit.changes?.[uri] ?? [];
        assert.ok(edits.length > 0, "expected WorkspaceEdit changes");
        assert.equal(
          applyTextEdits(SAVED, edits),
          FIXED,
          "applying the edit must remove the diagnosed `var`",
        );
        assert.equal(
          fs.readFileSync(file, "utf8"),
          SAVED,
          "LSP executeCommand should return edits, not write the file",
        );
        } catch (error) {
          populationFailures.push(new Error("native diagnostics and editor state population " + JSON.stringify({ editorUri: uri, latestPublication }), { cause: error }));
        }
        if (populationFailures.length) throw new AggregateError(populationFailures, "Shared LSP language and newline corpus failures");
      }, REQUEST_TIMEOUT);
      const closedWaiter = await unmatchedClose;
      assert.ok(closedWaiter.error instanceof Error, "actual child close must reject even an unmatched notification wait");
      assert.match(closedWaiter.error.message, /ttscserver exited before response/);
    } catch (error) {
      const failures: unknown[] = [error];
      const reason = "editor session startup, body or shutdown failed";
      try { TestProject.retainTemporaryDirectory(project.tmpdir, reason); }
      catch (retentionError) { failures.push(retentionError); }
      try { retainNativeLintProducer(reason); }
      catch (retentionError) { failures.push(retentionError); }
      throw new AggregateError(failures, reason);
    }

  }

/**
 * Original bound for one publishDiagnostics wait. It is a harness deadline,
 * not a measurement of the number of native attempts or Program constructions.
 */
const DIAGNOSTICS_TIMEOUT = 120_000;

/** Original request bound, also used as a separate supported-shutdown deadline. */
const REQUEST_TIMEOUT = 60_000;

/**
 * Label a bounded wait with the chain step it belongs to. Three steps await the
 * same `textDocument/publishDiagnostics` method, so the harness's own timeout
 * message cannot say which link of the chain broke.
 */
async function step<T>(name: string, pending: Promise<T>): Promise<T> {
  try {
    return await pending;
  } catch (error) {
    throw new Error(
      `ttscserver LSP session step "${name}" never completed: ${
        error instanceof Error ? (error.stack ?? error.message) : String(error)
      }`,
    );
  }
}

function findLint(params: PublishDiagnosticsParams): Diagnostic | undefined {
  return (params.diagnostics ?? []).find(
    (diagnostic) =>
      diagnostic.source === "@ttsc/lint" && diagnostic.code === "no-var",
  );
}

function applyTextEdits(source: string, edits: readonly TextEdit[]): string {
  let next = source;
  for (let i = edits.length - 1; i >= 0; i--) {
    const edit = edits[i]!;
    assert.ok(edit.range?.start && edit.range.end, "expected text edit range");
    const start = offsetAt(next, edit.range.start);
    const end = offsetAt(next, edit.range.end);
    next = next.slice(0, start) + (edit.newText ?? "") + next.slice(end);
  }
  return next;
}

/** Map an LSP (line, UTF-16 character) position onto a JS string offset. */
function offsetAt(source: string, position: Position): number {
  let line = 0;
  let character = 0;
  for (let offset = 0; offset < source.length; ) {
    if (line === position.line && character === position.character) {
      return offset;
    }
    const codePoint = source.codePointAt(offset);
    if (codePoint === undefined) break;
    const size = codePoint > 0xffff ? 2 : 1;
    if (source[offset] === "\n") {
      line++;
      character = 0;
    } else {
      character += size;
    }
    offset += size;
  }
  if (line === position.line && character === position.character) {
    return source.length;
  }
  throw new Error(`position outside source: ${JSON.stringify(position)}`);
}

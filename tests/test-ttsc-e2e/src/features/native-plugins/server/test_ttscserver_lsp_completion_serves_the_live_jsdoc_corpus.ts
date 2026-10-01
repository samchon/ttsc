import { TestLint } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { SHARED_PLUGIN_CACHE_DIR } from "../../../internal/plugin-cache";
import {
  PLUGIN_BUILD_TIMEOUT,
  TtscserverClient,
  assert,
  runTtscserverSession,
} from "../../../internal/ttscserver";

type Position = { character?: number; line?: number };

type Range = { end?: Position; start?: Position };

type CompletionItem = {
  data?: { $ttsc?: string };
  detail?: string;
  filterText?: string;
  insertText?: string;
  label?: string;
  textEdit?: { newText?: string; range?: Range };
};

type Diagnostic = { code?: unknown; source?: string };

type PublishDiagnosticsParams = { diagnostics?: Diagnostic[]; uri: string };

type CompletionResponse =
  | CompletionItem[]
  | { isIncomplete?: boolean; items?: CompletionItem[] }
  | null;

/** The private marker `ttscserver` stamps on every item it owns. */
const PLUGIN_MARKER = "ttsc/completion-hint/v1";

/**
 * What the editor saved. It has no JSDoc block anywhere, and it opens with a
 * `no-var` violation whose diagnostic is the signal that the lint sidecar has
 * finished building and started answering.
 */
const SAVED =
  'var legacy = 1;\nexport function greet(name: string): string {\n  return "Hello, " + name + legacy;\n}\n';

/** What the user has typed since, and has not saved. */
const DIRTY = SAVED.replace(
  "export function",
  "/**\n * Greets one user.\n * @par\n */\nexport function",
);

/**
 * Caret at the end of the half-typed tag line of {@link DIRTY}. Line 0 is the
 * saved declaration, line 1 opens the block, line 2 is the summary, and line 3
 * is the tag the user is typing.
 */
const CARET = { character: 7, line: 3 };

/** The declaration in {@link DIRTY}, below the block's closing delimiter. */
const OUTSIDE_BLOCK = { character: 0, line: 5 };

/** The half-typed tag itself: `par`, three UTF-16 units behind {@link CARET}. */
const TYPED = "par";

/**
 * What the client tells the server it can render.
 *
 * A previous revision sent `capabilities: {}`, and no completion request in the
 * session was ever answered — not even at a caret the proxy leaves untouched
 * and forwards to TypeScript-Go. A language server is entitled to serve nothing
 * to a client that has not said it understands completion, so the request has
 * to come from a client that has.
 */
const CLIENT_CAPABILITIES = {
  textDocument: {
    completion: {
      completionItem: {
        insertReplaceSupport: true,
        labelDetailsSupport: true,
        resolveSupport: { properties: ["detail", "documentation"] },
        snippetSupport: false,
      },
      contextSupport: true,
      dynamicRegistration: false,
    },
    hover: { contentFormat: ["markdown", "plaintext"] },
    synchronization: { didSave: true, dynamicRegistration: false },
  },
};

/**
 * Verifies LF, CR and CRLF live buffers receive rule-published completion.
 *
 * The same UTF-16 caret must select the half-typed JSDoc tag under each
 * supported newline spelling. A proxy that counts LF alone can still forward
 * native completions while losing every plugin item in a CR-only document.
 * Saved files contain no JSDoc block, so a result read from disk cannot satisfy
 * the dirty-buffer assertions.
 *
 * 1. Open three saved documents with LF, CR and CRLF endings in one real server,
 *    requiring each document's own no-var readiness finding.
 * 2. Type the same JSDoc block into each buffer without saving and poll its corpus.
 * 3. Require param, its exact edit and description, returns, unchanged saved
 *    bytes and no plugin item outside the block for every newline spelling.
 * 4. Resolve each actual plugin item locally and collect all document failures
 *    before shutting down the shared session and cleaning its fixture.
 *
 * @evidence contracts/testing.md#behavioral-verification The real rule-published JSDoc corpus must return param/returns and exact replacement range from an unsaved buffer, remain absent outside its block and resolve its own item locally.
 * @evidence contracts/testing.md#independent-expectations Saved bytes without JSDoc, authored dirty block/caret/typed fragment and literal param/returns and ownership marker independently prescribe the published item and resolve response.
 * @evidence contracts/testing.md#distinguishing-cases LF and CRLF controls distinguish the CR-only coordinate branch with identical authored carets and vocabulary. Every document retains disk versus dirty-buffer authority, in-block versus outside scope, two vocabulary entries and ownership-preserving resolve; upstream probes retain failure context.
 * @evidence contracts/testing.md#execution-ownership The named server E2E entry executes all three document rows through one actual jsdoc registration, lsp-hints transport, proxy merge and completionItem resolve session; row callbacks are reviewed with this entry.
 * @evidence contracts/e2e.md#necessary-boundary Matcher/merge units cannot prove the lint contributor corpus crosses lsp-hints into the live editor buffer and that plugin-owned resolve stays out of TypeScript-Go.
 * @evidence contracts/e2e.md#shared-execution One immutable lint producer, configuration, project and server supply the same JSDoc vocabulary to LF, CR and CRLF documents. Every row sends its own open/change requests and waits for its own readiness; buffer coordinates do not require a second producer or server, and this case does not assert native Program-load counts.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Distinct URIs and saved bytes isolate dirty buffers and diagnostics. No disk source is changed, each saved-source assertion verifies authority separation, and awaited session shutdown precedes fixture cleanup. Assertions and document operation failures accumulate before shutdown.
 * @evidence contracts/e2e.md#preserved-coverage All original LF corpus entries, filter/detail, exact edit range/text, unchanged disk, empty outside-block result and resolve marker also execute for CR and CRLF. Original readiness, corpus and request budgets remain; resolve requires an actual published param and is blocked when that dependent input is absent.
 */
export async function test_ttscserver_lsp_completion_serves_the_live_jsdoc_corpus() {
  const project = TestLint.createProject({
    nativeProducer: "snapshot",
    name: "ttscserver-lsp-completion-corpus",
    rules: { "jsdoc/check-tag-names": "error", "no-var": "error" },
    source: SAVED,
    sourcePath: "src/LF.ts",
    extraSources: {
      "src/CR.ts": SAVED.replaceAll("\n", "\r"),
      "src/CRLF.ts": SAVED.replaceAll("\n", "\r\n"),
    },
  });
  const failures: unknown[] = [];
  try {
    const client = TtscserverClient.startLauncher(project.tmpdir, {
      env: { TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR },
    });
    await runTtscserverSession(client, async () => {
      // 1. Handshake. Deliberately unbounded, matching the sibling session
      // test: the launcher builds project plugins before spawning the server,
      // so a cold `@ttsc/lint` build is charged entirely to this request.
      await client.request("initialize", {
        capabilities: CLIENT_CAPABILITIES,
        processId: process.pid,
        rootUri: pathToFileURL(project.tmpdir).href,
      });
      client.notify("initialized", {});

      for (const [name, newline] of [
        ["LF", "\n"],
        ["CR", "\r"],
        ["CRLF", "\r\n"],
      ] as const) {
        const saved = SAVED.replaceAll("\n", newline);
        const dirty = DIRTY.replaceAll("\n", newline);
        const file = path.join(project.tmpdir, "src", name + ".ts");
        const uri = pathToFileURL(file).href;
        const check = (body: () => void): void => {
          try {
            body();
          } catch (error) {
            failures.push(new Error(name + ": completion assertion", { cause: error }));
          }
        };
        try {
          // 2. Open what was saved and wait for the saved file's own lint finding.
          //
          // This wait is what absorbs the cold plugin build. The sidecar compiles
          // `@ttsc/lint` from Go source on first use — minutes on a cold cache — and
          // answers no verb until it does, so a completion request sent before this
          // point does not come back empty, it does not come back at all. Once a
          // plugin diagnostic has arrived, the sidecar is known to be answering.
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

          // 4. Wait for the corpus. `lsp-hints` is answered from a Program the
          // sidecar loads in the background, and the proxy answers nothing until it
          // lands, so an early empty reply is the documented state rather than a
          // failure.
          const deadline = Date.now() + CORPUS_TIMEOUT;
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
                    position: CARET,
                    textDocument: { uri },
                  },
                  REQUEST_TIMEOUT,
                ),
              );
            } catch (error) {
              // A request that never came back is the cold-build state, not a
              // failure: the sidecar builds `@ttsc/lint` from Go source on first
              // use, which the build itself documents as minutes on a cold cache.
              // Only the outer deadline decides that the corpus is never coming.
              last = error instanceof Error ? error.message : String(error);
            }
            if (items.length > 0) break;
            if (Date.now() >= deadline) {
              check(() =>
                assert.ok(
                  Date.now() < deadline,
                  `no rule-published completion after ${attempts} requests in ${CORPUS_TIMEOUT}ms (last: ${last}) — ${alive}; ${probe}`,
                ),
              );
              break;
            }
            await sleep(POLL_INTERVAL);
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
                end: CARET,
                start: {
                  character: CARET.character - TYPED.length,
                  line: CARET.line,
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
                position: OUTSIDE_BLOCK,
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
            failures.push(new Error(name + ": outside-block request", { cause: error }));
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
                PLUGIN_MARKER,
                "the ownership marker must survive resolve",
              ),
            );
          }
        } catch (error) {
          failures.push(new Error(name + ": LSP newline corpus", { cause: error }));
        }
      }
    });
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      project.cleanup();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "LSP newline corpus assertions failed");
}

/**
 * Bound for the corpus wait, measured from a sidecar already known to answer.
 * All that remains behind `lsp-hints` is the Program load.
 */
const CORPUS_TIMEOUT = 300_000;

/**
 * Bound for one completion attempt. A request that outlives it is retried
 * rather than failed, so a slow Program load costs a retry instead of the run.
 */
const REQUEST_TIMEOUT = 60_000;

/** Gap between corpus polls. Long enough not to spin, short enough to be cheap. */
const POLL_INTERVAL = 2_000;

/**
 * The items `ttscserver` added to whatever TypeScript-Go replied with. The
 * private marker is the only thing that separates them, which is exactly what
 * the proxy uses to keep resolve local.
 */
function published(response: CompletionResponse): CompletionItem[] {
  const all = Array.isArray(response) ? response : (response?.items ?? []);
  return all.filter((item) => item.data?.$ttsc === PLUGIN_MARKER);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

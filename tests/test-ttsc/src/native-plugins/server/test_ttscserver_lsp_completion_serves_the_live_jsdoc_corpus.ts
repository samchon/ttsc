import { TestLint } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import {
  TtscserverClient,
  assert,
  shutdownTtscserverClient,
} from "../../internal/ttscserver";

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
 * Verifies rule-published completion reaches an editor from the live buffer.
 *
 * Every existing test for this channel stops at a package boundary: the matcher
 * is unit-tested, the merge is unit-tested against a synthetic response, and
 * the driver test only proves an embedder can implement the interface. Nothing
 * has ever driven `jsdoc/check-tag-names` → the lint sidecar's `lsp-hints` verb
 * → the proxy's merge → an LSP `textDocument/completion` reply in one process,
 * so a break in any seam between them would leave the whole suite green while
 * the editor offered nothing. The channel has shipped unproven since #736.
 *
 * The buffer half matters just as much as the wire half. Plugin diagnostics
 * come from a sidecar that reads disk, so they are deliberately suppressed
 * while a file is dirty — completion is the one plugin feature that must answer
 * from the unsaved buffer instead, because a corpus the user cannot reach until
 * they save is a corpus they will never use. Writing the JSDoc block only into
 * the buffer, and leaving disk without one, is what separates the two paths: an
 * answer built from disk cannot see the block at all.
 *
 * 1. Open a saved file that has no JSDoc block and wait for its own `no-var`
 *    finding. That wait is what pays for the cold plugin build: until the
 *    sidecar is compiled it answers no verb at all, so a completion request
 *    sent before this point does not come back empty, it does not come back.
 * 2. Type the JSDoc block into the buffer without saving, then poll completion at
 *    the half-typed tag until the corpus lands. Discovery is asynchronous by
 *    design — it loads a Program — so the first replies may carry no item.
 * 3. Assert the reply an editor consumes: the validated tag, an edit that replaces
 *    exactly what was typed, and a sibling tag proving this is the rule's
 *    vocabulary rather than one lucky guess.
 * 4. Assert disk still has no JSDoc block, and that a caret outside one is refused
 *    after the corpus is known to be live.
 * 5. Resolve a plugin item and assert `ttscserver` answers it without handing
 *    TypeScript-Go an item it never produced.
 */
export const test_ttscserver_lsp_completion_serves_the_live_jsdoc_corpus =
  async () => {
    const project = TestLint.createProject({
      name: "ttscserver-lsp-completion-corpus",
      rules: { "jsdoc/check-tag-names": "error", "no-var": "error" },
      source: SAVED,
    });
    const file = path.join(project.tmpdir, "src", "main.ts");
    const uri = pathToFileURL(file).href;
    const client = TtscserverClient.startLauncher(project.tmpdir, {
      env: { TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR },
    });

    try {
      // 1. Handshake. Deliberately unbounded, matching the sibling session
      // test: the launcher builds project plugins before spawning the server,
      // so a cold `@ttsc/lint` build is charged entirely to this request.
      await client.request("initialize", {
        capabilities: CLIENT_CAPABILITIES,
        processId: process.pid,
        rootUri: pathToFileURL(project.tmpdir).href,
      });
      client.notify("initialized", {});

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
        BUILD_TIMEOUT,
      );
      client.notify("textDocument/didOpen", {
        textDocument: {
          languageId: "typescript",
          text: SAVED,
          uri,
          version: 1,
        },
      });
      await ready;

      // Now type the JSDoc block into the buffer only. A rangeless
      // contentChange is a full-document replacement, which is what an editor
      // sends when it does not track incremental edits.
      client.notify("textDocument/didChange", {
        contentChanges: [{ text: DIRTY }],
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
        assert.ok(
          Date.now() < deadline,
          `no rule-published completion after ${attempts} requests in ${CORPUS_TIMEOUT}ms (last: ${last}) — ${alive}; ${probe}`,
        );
        await sleep(POLL_INTERVAL);
      }

      // 4. The item an editor shows for the tag the user is halfway through.
      const param = items.find((item) => item.insertText === "param");
      assert.ok(
        param,
        `expected the validated @param tag: ${JSON.stringify(items.map((item) => item.insertText))}`,
      );
      assert.equal(
        param.filterText,
        "param",
        "the client filters on the inserted text, so it must match the insertion",
      );
      assert.ok(param.detail, "each published tag carries its own description");
      assert.deepEqual(
        param.textEdit?.range,
        {
          end: CARET,
          start: {
            character: CARET.character - TYPED.length,
            line: CARET.line,
          },
        },
        "accepting the item must replace exactly what was typed after the trigger",
      );
      assert.equal(
        param.textEdit?.newText,
        "param",
        "the edit writes the tag itself, leaving the @ the user already typed",
      );
      // One tag could be a coincidence. The corpus is the rule's whole
      // validated vocabulary, so a second, unrelated tag has to be there too.
      assert.ok(
        items.some((item) => item.insertText === "returns"),
        `expected the rule's vocabulary, not a single tag: ${JSON.stringify(items.map((item) => item.insertText))}`,
      );

      // 5. The proof that this came from the buffer: disk never had a block.
      assert.equal(
        fs.readFileSync(file, "utf8"),
        SAVED,
        "the test must not have saved; completion answered from the dirty buffer",
      );

      // 6. The negative twin, asked only now that the corpus is known to be
      // live. A caret on the declaration below the block is outside any JSDoc
      // scope, and an unscoped corpus would fire there too.
      assert.deepEqual(
        published(
          await client.request<CompletionResponse>(
            "textDocument/completion",
            {
              context: { triggerKind: 1 },
              position: OUTSIDE_BLOCK,
              textDocument: { uri },
            },
            REQUEST_TIMEOUT,
          ),
        ),
        [],
        "the JSDoc corpus must not fire outside a JSDoc block",
      );

      // 7. Resolve. TypeScript-Go advertises completionItem/resolve for its own
      // items and expects its own private data on every request, so a plugin
      // item has to be answered by ttscserver itself.
      const resolved = await client.request<CompletionItem>(
        "completionItem/resolve",
        param,
        REQUEST_TIMEOUT,
      );
      assert.equal(
        resolved.insertText,
        "param",
        `resolve must answer the plugin's own item: ${JSON.stringify(resolved)}`,
      );
      assert.equal(
        resolved.data?.$ttsc,
        PLUGIN_MARKER,
        "the ownership marker must survive resolve",
      );
    } finally {
      await shutdownTtscserverClient(client);
      project.cleanup();
    }
  };

/**
 * Bound for the first plugin answer of the lane, which pays for compiling
 * `@ttsc/lint` from Go source. The build message itself documents that as
 * minutes on a cold cache; every later test in the lane hits the shared warm
 * cache instead.
 */
const BUILD_TIMEOUT = 900_000;

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

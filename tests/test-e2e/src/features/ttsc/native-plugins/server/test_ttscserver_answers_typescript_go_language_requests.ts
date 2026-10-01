import { TestLint } from "@ttsc/testing";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  PLUGIN_BUILD_TIMEOUT,
  TtscserverClient,
  assert,
  runTtscserverSession,
} from "../../../../internal/ttsc/internal/ttscserver";

type Diagnostic = { code?: unknown; source?: string };

type PublishDiagnosticsParams = { diagnostics?: Diagnostic[]; uri: string };

type Hover = { contents?: unknown } | null;

type DocumentSymbol = { children?: DocumentSymbol[]; name?: string };

type CompletionItem = { data?: { $ttsc?: string }; label?: string };

type CompletionResponse =
  | CompletionItem[]
  | { isIncomplete?: boolean; items?: CompletionItem[] }
  | null;

type InitializeResult = {
  capabilities?: {
    completionProvider?: unknown;
    documentSymbolProvider?: unknown;
    hoverProvider?: unknown;
  };
};

/** The private marker `ttscserver` stamps on the completion items it owns. */
const PLUGIN_MARKER = "ttsc/completion-hint/v1";

/**
 * A `no-var` violation so the ttsc half of the stream is observable, plus a
 * declaration and a body so the TypeScript-Go half has a symbol to describe, a
 * symbol to list, and a scope to complete in.
 */
const SOURCE =
  'var legacy = 1;\nexport function greet(name: string): string {\n  return "Hello, " + name + legacy;\n}\n';

/** Inside the `legacy` identifier of line 0, which TypeScript-Go types. */
const HOVER_POSITION = { character: 5, line: 0 };

/** Start of the function body, an ordinary identifier-completion caret. */
const COMPLETION_POSITION = { character: 2, line: 2 };

/**
 * What a real editor tells the server it can render. `capabilities: {}` would
 * be answered too, but a language server may legitimately serve less to a
 * client that never claimed to understand a feature, so the probe declares the
 * three features it asks about.
 */
const CLIENT_CAPABILITIES = {
  textDocument: {
    completion: { contextSupport: true, dynamicRegistration: false },
    documentSymbol: { hierarchicalDocumentSymbolSupport: true },
    hover: { contentFormat: ["markdown", "plaintext"] },
    synchronization: { didSave: true, dynamicRegistration: false },
  },
};

/**
 * Verifies ttscserver answers the language requests only TypeScript-Go can.
 *
 * The proxy exists so that TypeScript-Go's language features and ttsc's plugin
 * features arrive on one stream, and only the plugin half was ever asserted:
 * every request the server suite sent was one ttscserver answers itself
 * (`textDocument/codeAction`, `workspace/executeCommand`), so a session in
 * which nothing upstream came back at all stayed green. That is exactly what
 * #863 caught — and the cause was the client, not the proxy. TypeScript-Go
 * sends `client/registerCapability` from its `initialized` handler and blocks
 * its dispatch loop until the reply lands, so a client that ignores
 * server→client requests receives ttscserver's own publications forever while
 * every forwarded request queues behind a loop that never advances.
 *
 * 1. Handshake as a completion/hover/symbol-capable client and assert
 *    TypeScript-Go's own providers survive ttsc's rewrite of the result.
 * 2. Open the file and wait for the `@ttsc/lint` `no-var` finding, so the ttsc
 *    half is known to be answering before the upstream half is asked anything.
 * 3. Ask hover, documentSymbol, and completion, and assert each comes back with
 *    TypeScript-Go's own answer rather than merely coming back.
 * 4. Assert `client/registerCapability` was answered, the handshake the whole
 *    upstream stream hangs on.
 *
 * @evidence contracts/testing.md#behavioral-verification A real mixed LSP session must retain upstream hover/symbol/completion providers and return inferred legacy number, greet symbol and upstream legacy completion after native no-var publication.
 * @evidence contracts/testing.md#independent-expectations Authored declaration and caret positions prescribe literal inferred type, symbol and scope completion; the public provider keys and registerCapability method are independent handshake expectations.
 * @evidence contracts/testing.md#distinguishing-cases Distinguishes native lint readiness from actual upstream hover, explicitly forwarded symbol requests and merged completion items filtered to exclude plugin ownership markers.
 * @evidence contracts/testing.md#execution-ownership The named server entry owns the actual launcher/proxy/upstream stream and server-initiated capability registration, with bounded language requests after one native diagnostic readiness wait.
 * @evidence contracts/e2e.md#necessary-boundary Synthetic merge or rule units cannot establish that real TypeScript-Go advances its dispatch loop after registerCapability and its responses survive the proxy.
 * @evidence contracts/e2e.md#shared-execution One source, one handshake and one server answer all three upstream feature requests plus native readiness; no separate native producer or language-feature session is built for each verb.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The temporary source and lint config stay immutable, requests follow the required initialization/opening order, exact lint build identity may be shared, and session shutdown precedes cleanup.
 * @evidence contracts/e2e.md#preserved-coverage All provider, type, registration, symbol and non-plugin completion assertions remain, including the original timeout context that distinguishes an upstream hang from native diagnostics readiness.
 */
export async function test_ttscserver_answers_typescript_go_language_requests() {
    const project = TestLint.createProject({
      nativeProducer: "snapshot",
      name: "ttscserver-typescript-go-requests",
      rules: { "no-var": "error" },
      source: SOURCE,
    });
    const file = path.join(project.tmpdir, "src", "main.ts");
    const uri = pathToFileURL(file).href;
    const client = TtscserverClient.startLauncher(project.tmpdir, {
      env: { TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR },
    });

    try {
      await runTtscserverSession(client, async () => {
        // 1. Handshake. Deliberately unbounded, matching the sibling session
        // test: the launcher builds project plugins before it spawns the server,
        // so a cold `@ttsc/lint` source build is charged to this one request.
        const initialized = await client.request<InitializeResult>(
          "initialize",
          {
            capabilities: CLIENT_CAPABILITIES,
            processId: process.pid,
            rootUri: pathToFileURL(project.tmpdir).href,
          },
        );
        const capabilities = initialized.capabilities ?? {};
        // ttsc rewrites this result to add its own commands and action kinds.
        // The providers below are TypeScript-Go's alone, and each one is the
        // capability an editor gates the matching request on.
        assert.ok(
          capabilities.hoverProvider,
          `ttsc must not drop tsgo's hoverProvider: ${JSON.stringify(capabilities)}`,
        );
        assert.ok(
          capabilities.documentSymbolProvider,
          `ttsc must not drop tsgo's documentSymbolProvider: ${JSON.stringify(capabilities)}`,
        );
        assert.ok(
          capabilities.completionProvider,
          `ttsc must not drop tsgo's completionProvider: ${JSON.stringify(capabilities)}`,
        );
        client.notify("initialized", {});

        // 2. Open the file and wait for ttsc's own finding. Register the waiter
        // first: publishDiagnostics races the notification that triggers it.
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
            text: SOURCE,
            uri,
            version: 1,
          },
        });
        await ready;

        // 3. Hover. Nothing about it is ttsc's: the proxy neither intercepts nor
        // enriches it, so the reply is TypeScript-Go's checker talking.
        //
        // The wait above cannot order this: the finding it waits for comes from
        // ttsc's own sidecar, not from TypeScript-Go, so it says nothing about
        // whether the upstream dispatch loop ever advanced. The failure message
        // therefore carries the handshake that decides it, and a hang here reads
        // as "the registration was never answered" rather than a bare timeout.
        const hover = await client
          .request<Hover>(
            "textDocument/hover",
            { position: HOVER_POSITION, textDocument: { uri } },
            REQUEST_TIMEOUT,
          )
          .catch((error: unknown) => {
            throw new Error(
              `hover was never answered (server→client requests received: ${JSON.stringify(client.serverRequestMethods())}): ${
                error instanceof Error ? (error.stack ?? error.message) : error
              }`,
            );
          });
        assert.match(
          hoverText(hover),
          /legacy: number/,
          `hover must carry tsgo's inferred type: ${JSON.stringify(hover)}`,
        );

        // 4. The handshake that let step 3 happen at all. tsgo issues it from its
        // `initialized` handler and parks the loop that dispatches every later
        // request until the client replies, so an answered hover proves it was
        // answered; asserting it makes the mechanism explicit rather than
        // incidental.
        assert.ok(
          client.serverRequestMethods().includes("client/registerCapability"),
          `an answered hover implies the registration was answered: ${JSON.stringify(client.serverRequestMethods())}`,
        );

        // 5. documentSymbol. The proxy owns a handler for this method and
        // forwards it whenever tsgo advertises the capability, so the forwarding
        // branch — not just the untouched path hover exercises — is covered too.
        const symbols = await client.request<DocumentSymbol[] | null>(
          "textDocument/documentSymbol",
          { textDocument: { uri } },
          REQUEST_TIMEOUT,
        );
        const names = symbolNames(symbols ?? []);
        assert.ok(
          names.includes("greet"),
          `documentSymbol must list tsgo's declarations: ${JSON.stringify(names)}`,
        );

        // 6. Completion. The proxy merges plugin items into the upstream reply,
        // so an upstream answer has to survive that merge. `legacy` is in scope
        // at the caret and no ttsc rule publishes it, which is what separates
        // tsgo's vocabulary from ttsc's contribution.
        const completion = await client.request<CompletionResponse>(
          "textDocument/completion",
          {
            context: { triggerKind: 1 },
            position: COMPLETION_POSITION,
            textDocument: { uri },
          },
          REQUEST_TIMEOUT,
        );
        const upstreamLabels = completionItems(completion)
          .filter((item) => item.data?.$ttsc !== PLUGIN_MARKER)
          .map((item) => item.label);
        assert.ok(
          upstreamLabels.includes("legacy"),
          `completion must carry tsgo's own items: ${JSON.stringify(upstreamLabels.slice(0, 40))}`,
        );
      });
    } finally {
      project.cleanup();
    }
  }

/**
 * Bound for one upstream request. Every one of them is asked after tsgo has
 * loaded the project for the diagnostics above, so this bounds an answer that
 * should be immediate — and turns the #863 hang into a named failure.
 */
const REQUEST_TIMEOUT = 60_000;

/** Flatten a hover result to text regardless of which content shape tsgo used. */
function hoverText(hover: Hover): string {
  if (!hover || typeof hover !== "object") return "";
  return JSON.stringify(hover.contents ?? "");
}

/**
 * Names in a documentSymbol reply. LSP allows either a flat `SymbolInformation`
 * array or a nested `DocumentSymbol` tree, so both are flattened.
 */
function symbolNames(symbols: readonly DocumentSymbol[]): string[] {
  const names: string[] = [];
  for (const symbol of symbols) {
    if (symbol.name) names.push(symbol.name);
    if (symbol.children) names.push(...symbolNames(symbol.children));
  }
  return names;
}

/** Items of a completion reply in either the array or the list shape. */
function completionItems(response: CompletionResponse): CompletionItem[] {
  if (Array.isArray(response)) return response;
  return response?.items ?? [];
}

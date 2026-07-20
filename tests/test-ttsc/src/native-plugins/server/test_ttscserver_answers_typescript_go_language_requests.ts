import { TestLint } from "@ttsc/testing";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import {
  TtscserverClient,
  assert,
  shutdownTtscserverClient,
} from "../../internal/ttscserver";

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
 * 3. Assert `client/registerCapability` was answered — the handshake the whole
 *    upstream stream hangs on.
 * 4. Ask hover, documentSymbol, and completion, and assert each comes back with
 *    TypeScript-Go's own answer rather than merely coming back.
 */
export const test_ttscserver_answers_typescript_go_language_requests =
  async () => {
    const project = TestLint.createProject({
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
      // 1. Handshake. Deliberately unbounded, matching the sibling session
      // test: the launcher builds project plugins before it spawns the server,
      // so a cold `@ttsc/lint` source build is charged to this one request.
      const initialized = await client.request<InitializeResult>("initialize", {
        capabilities: CLIENT_CAPABILITIES,
        processId: process.pid,
        rootUri: pathToFileURL(project.tmpdir).href,
      });
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
        DIAGNOSTICS_TIMEOUT,
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

      // 3. The handshake the upstream stream depends on. Asserting it directly
      // means a regression names the cause instead of reporting three timeouts.
      assert.ok(
        client.serverRequestMethods().includes("client/registerCapability"),
        `tsgo registers its configuration watcher from initialized and blocks until the client replies: ${JSON.stringify(client.serverRequestMethods())}`,
      );

      // 4. Hover. Nothing about it is ttsc's: the proxy neither intercepts nor
      // enriches it, so the reply is TypeScript-Go's checker talking.
      const hover = await client.request<Hover>(
        "textDocument/hover",
        { position: HOVER_POSITION, textDocument: { uri } },
        REQUEST_TIMEOUT,
      );
      assert.match(
        hoverText(hover),
        /legacy: number/,
        `hover must carry tsgo's inferred type: ${JSON.stringify(hover)}`,
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
    } finally {
      await shutdownTtscserverClient(client);
      project.cleanup();
    }
  };

/**
 * Bound for the `@ttsc/lint` finding. `lsp-diagnostics` goes to the resident
 * sidecar daemon, which the proxy bounds at 30s per verb and falls back to a
 * fresh spawn on timeout, so one wait can cost two attempts plus a Program
 * load.
 */
const DIAGNOSTICS_TIMEOUT = 120_000;

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

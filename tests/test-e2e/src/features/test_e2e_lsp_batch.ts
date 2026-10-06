import { TestProject, retainNativeLintProducer } from "@ttsc/testing";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { BatchWorkspace } from "../batch/BatchWorkspace";
import { lspSelectionCorpus } from "../batch/lspSelectionCorpus";
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

type CompletionItem = {
  data?: { $ttsc?: string };
  detail?: string;
  filterText?: string;
  insertText?: string;
  label?: string;
  textEdit?: { newText?: string; range?: Range };
};
type CompletionResponse =
  | CompletionItem[]
  | { isIncomplete?: boolean; items?: CompletionItem[] }
  | null;
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

const CASCADE_SOURCE =
  'const icon = "\uD83D\uDE00"; var legacy = 1; let stable = legacy; if (typeof stable == "number") { console.log(icon, stable); }';
const CASCADE_FIXED =
  'const icon = "\uD83D\uDE00"; const legacy = 1; const stable = legacy; if (typeof stable === "number") { console.log(icon, stable); }';
const FORMAT_SOURCE = "var legacy = 1\nJSON.stringify(legacy)\n";
const FORMAT_FIXED = "var legacy = 1;\nJSON.stringify(legacy);\n";
/** Independent disk bytes must not replace either live formatting buffer. */
const FORMAT_DISK = "const onDisk = 999;\n";

/**
 * Verifies one ttscserver LSP session carries diagnostics through to a fix.
 *
 * The ordered protocol chain observes merged capabilities, dirty-buffer
 * suppression, saved revalidation and returned edits in one actual server. It
 * exercises the editor protocol without launching an editor extension.
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
 *    Startup failure additionally retains the same launcher's existing private
 *    runtime preparation trace, including actual filename/module options and
 *    the first eight consumed source lines. It creates no replacement server or
 *    compiler request and does not infer the nested cause from a package
 *    marker.
 * 5. Open the nine language-scope documents in that same server before requiring
 *    their URI-specific diagnostics. These nine protocol messages add real
 *    document-check work; Program inclusion alone is not publication.
 */
async function runEditorCorpus() {
  const workspace = await BatchWorkspace.open();
  const project = { tmpdir: workspace.lspEditorRoot };
  const configPath = path.join(workspace.lspEditorRoot, "tsconfig.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  config.compilerOptions.rootDir = ".";
  config.include = [
    ...config.include,
    "native-errors/**/*.ts",
    "native-errors/**/*.tsx",
  ];
  config.compilerOptions.paths = {
    ...config.compilerOptions.paths,
    "#lib/*": ["./native-errors/models/*"],
    "#preset/*": ["./native-errors/models/*"],
  };
  const lintEntry = config.compilerOptions.plugins.find(
    (entry: { transform?: string }) => entry.transform === "@ttsc/lint",
  );
  assert.ok(lintEntry, "the actual lint contributor must remain selected");
  const languageRoot = path.join(
    workspace.lspEditorRoot,
    "tools/lint-language",
  );
  fs.cpSync(
    path.resolve(
      import.meta.dirname,
      "../../fixtures/lint/workspace/config-language",
    ),
    languageRoot,
    { recursive: true },
  );
  fs.writeFileSync(
    path.join(languageRoot, "package.json"),
    JSON.stringify({ name: "config-language-boundary-batch", private: true }),
  );
  fs.mkdirSync(path.join(languageRoot, "src"));
  fs.copyFileSync(
    path.resolve(
      import.meta.dirname,
      "../../fixtures/lint/workspace/config-language-source.ts",
    ),
    path.join(languageRoot, "src/main.ts"),
  );
  // The typed evaluator's Node globals belong only to its original local
  // owner. They must not enter the consumer's types:[] compilation surface.
  const languageTypes = path.join(languageRoot, "node_modules/@types");
  fs.mkdirSync(languageTypes, { recursive: true });
  fs.symlinkSync(
    path.join(TestProject.WORKSPACE_ROOT, "node_modules/@types/node"),
    path.join(languageTypes, "node"),
    "junction",
  );
  const languageConfigPath = path.join(languageRoot, "tsconfig.json");
  const languageConfig = JSON.parse(
    fs.readFileSync(languageConfigPath, "utf8"),
  );
  languageConfig.compilerOptions.types = ["node"];
  languageConfig.compilerOptions.plugins = [];
  fs.writeFileSync(languageConfigPath, JSON.stringify(languageConfig));
  const languageCases = [
    { name: "commonjs-globals", line: 1, rule: "no-console" },
    { name: "cts", line: 1, rule: "no-console" },
    { name: "exported-types", line: 0, rule: "no-var" },
    { name: "js-sibling", line: 1, rule: "no-console" },
    { name: "json", line: 0, rule: "no-var" },
    { name: "mjs", line: 0, rule: "no-var" },
    { name: "module-meta", line: 1, rule: "no-console" },
    { name: "mts", line: 0, rule: "no-var" },
    { name: "plain-ts", line: 0, rule: "no-var" },
  ];
  const languageFiles = languageCases.map(({ name }) =>
    path.join(languageRoot, "configs", name, name + ".ts"),
  );
  config.include.push(...languageFiles);
  const jsonLanguageConfig = path.join(
    languageRoot,
    "configs/json/ttsc-lint.config.json",
  );
  const languageTerminal = JSON.parse(
    fs.readFileSync(jsonLanguageConfig, "utf8"),
  );
  languageTerminal.extends = "../../language-base.cjs";
  fs.writeFileSync(jsonLanguageConfig, JSON.stringify(languageTerminal));
  fs.writeFileSync(
    path.join(languageRoot, "language-base.cjs"),
    `module.exports = {
  extends: "../../lint.lsp.base.config.cjs",
  files: ["configs/**/*.ts"],
  rules: { "no-var": "off", "no-console": "off" },
};
`,
  );
  lintEntry.configFile = "./lint.lsp.config.cjs";
  fs.renameSync(
    path.join(workspace.lspEditorRoot, "lint.config.cjs"),
    path.join(workspace.lspEditorRoot, "lint-shared-base.cjs"),
  );
  fs.writeFileSync(
    path.join(workspace.lspEditorRoot, "lint.lsp.base.config.cjs"),
    `const base = require("./lint-shared-base.cjs");
const graph = base.rules["evidence/graph"][1];
module.exports = { ...base, rules: { ...base.rules, "jsdoc/check-tag-names": "error", "evidence/graph": ["error", { ...graph, claims: [...graph.claims, { type: "markdown", files: ["review.md"], symbol: "h2", reference: { type: "typescript", root: "./external", files: ["*.ts"], symbol: "property" } }] }] } };
`,
  );
  fs.writeFileSync(
    path.join(workspace.lspEditorRoot, "lint.lsp.cascade.config.cjs"),
    `module.exports = {
  extends: "./tools/lint-language/ttsc-lint.config.json",
  files: ["src/editor-cascade.ts"],
  rules: { "prefer-const": "error", "eqeqeq": "error" },
};
`,
  );
  fs.writeFileSync(
    path.join(workspace.lspEditorRoot, "lint.lsp.config.cjs"),
    `module.exports = {
  extends: "./lint.lsp.cascade.config.cjs",
  files: ["src/editor-format.ts"],
  format: { semi: true },
};
`,
  );
  fs.copyFileSync(
    path.join(workspace.lspEditorRoot, "native-errors/lsp-default-decoy.json"),
    path.join(workspace.lspEditorRoot, "lint.config.json"),
  );
  fs.writeFileSync(
    path.join(workspace.lspEditorRoot, "review.md"),
    "## Review\n<!-- @link external/example.ts#value Reviews the value. -->\n",
  );
  fs.mkdirSync(path.join(workspace.lspEditorRoot, "external"), {
    recursive: true,
  });
  const evidenceTarget = path.join(
    workspace.lspEditorRoot,
    "external/example.ts",
  );
  fs.writeFileSync(evidenceTarget, "export const other = 1;\n");
  fs.writeFileSync(configPath, JSON.stringify(config));
  fs.writeFileSync(path.join(project.tmpdir, "src/editor.ts"), OPENED);
  fs.writeFileSync(
    path.join(project.tmpdir, "src/editor-cascade.ts"),
    CASCADE_SOURCE,
  );
  fs.writeFileSync(
    path.join(project.tmpdir, "src/editor-format.ts"),
    FORMAT_SOURCE,
  );
  const file = path.join(project.tmpdir, "src", "editor.ts");
  const uri = pathToFileURL(file).href;
  const runtimeTraceRoot = path.join(
    workspace.cache,
    "lsp-runtime-observations",
  );
  fs.mkdirSync(runtimeTraceRoot, { recursive: true });
  try {
    const client = TtscserverClient.startLauncher(project.tmpdir, {
      env: {
        TTSC_CACHE_DIR: workspace.cache,
        TTSC_E2E_TRACE: runtimeTraceRoot,
      },
      implicitCwd: true,
    });
    let latestPublication: PublishDiagnosticsParams | undefined;
    const languagePublications = new Map<string, PublishDiagnosticsParams>();
    const languageUris = new Set(
      languageFiles.map((file) => pathToFileURL(file).href),
    );
    client.on(
      "textDocument/publishDiagnostics",
      (params: PublishDiagnosticsParams) => {
        latestPublication = params;
        if (
          languageUris.has(params.uri) &&
          params.diagnostics?.some(
            (diagnostic) => diagnostic.source === "@ttsc/lint",
          )
        )
          languagePublications.set(params.uri, params);
      },
    );
    const languageReady = client.waitForNotification<PublishDiagnosticsParams>(
      "textDocument/publishDiagnostics",
      () => languagePublications.size === languageCases.length,
      PLUGIN_BUILD_TIMEOUT,
    );
    void languageReady.catch(() => {});
    const unmatchedClose = client
      .waitForNotification<unknown>(
        "textDocument/publishDiagnostics",
        () => false,
        PLUGIN_BUILD_TIMEOUT,
      )
      .then(
        () => ({ error: undefined }),
        (error: unknown) => ({ error }),
      );
    await runTtscserverSession(
      client,
      async () => {
        const evidenceInitial = step(
          "initial external Evidence publication",
          client.waitForNotification<PublishDiagnosticsParams>(
            "textDocument/publishDiagnostics",
            (params) =>
              (params.diagnostics ?? []).some((diagnostic) =>
                diagnostic.message?.includes(
                  "Missing TypeScript evidence export",
                ),
              ),
            PLUGIN_BUILD_TIMEOUT,
          ),
        ).then(
          (value) => ({ value }),
          (error: unknown) => ({ error }),
        );
        // 1. Handshake. The editor builds its command palette and lightbulb menu
        // from this response, so the advertised ids are editor-visible behavior.
        const initialized = await step(
          "initialize",
          client.request<InitializeResult>(
            "initialize",
            {
              capabilities: {
                workspace: {
                  didChangeWatchedFiles: {
                    dynamicRegistration: true,
                    relativePatternSupport: true,
                  },
                },
                textDocument: {
                  completion: {
                    completionItem: {
                      insertReplaceSupport: true,
                      labelDetailsSupport: true,
                      resolveSupport: {
                        properties: ["detail", "documentation"],
                      },
                      snippetSupport: false,
                    },
                    contextSupport: true,
                    dynamicRegistration: false,
                  },
                  documentSymbol: { hierarchicalDocumentSymbolSupport: true },
                  hover: { contentFormat: ["markdown", "plaintext"] },
                  synchronization: {
                    didSave: true,
                    dynamicRegistration: false,
                  },
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
        assert.ok(
          capabilities.hoverProvider,
          "the actual upstream hover provider must survive the plugin proxy",
        );
        assert.ok(
          capabilities.documentSymbolProvider,
          "the actual upstream symbol provider must survive the plugin proxy",
        );
        assert.ok(
          capabilities.completionProvider,
          "the actual upstream completion provider must survive the plugin proxy",
        );
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
        const DOC_SAVED =
          'var legacy = 1;\nexport function greet(name: string): string {\n  return "Hello, " + name + legacy;\n}\n';
        const DOC_DIRTY = DOC_SAVED.replace(
          "export function",
          "/**\n * Greets one user.\n * @par\n */\nexport function",
        );
        const published = (response: CompletionResponse): CompletionItem[] =>
          (Array.isArray(response) ? response : (response?.items ?? [])).filter(
            (item) => item.data?.$ttsc === DOC_PLUGIN_MARKER,
          );
        for (const [name, newline] of [
          ["LF", "\n"],
          ["CR", "\r"],
          ["CRLF", "\r\n"],
        ] as const) {
          const saved = DOC_SAVED.replaceAll("\n", newline);
          const dirty = DOC_DIRTY.replaceAll("\n", newline);
          const file = path.join(
            project.tmpdir,
            "native-errors",
            "lsp-" + name + ".ts",
          );
          const uri = pathToFileURL(file).href;
          const check = (body: () => void): void => {
            try {
              body();
            } catch (error) {
              populationFailures.push(
                new Error(name + ": completion assertion", { cause: error }),
              );
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
                const hover = await client.request<{ contents?: unknown }>(
                  "textDocument/hover",
                  {
                    position: { character: 5, line: 0 },
                    textDocument: { uri },
                  },
                  REQUEST_TIMEOUT,
                );
                assert.match(
                  JSON.stringify(hover?.contents ?? ""),
                  /legacy: number/,
                  "the upstream checker must answer the independently authored numeric binding",
                );
                assert.ok(
                  client
                    .serverRequestMethods()
                    .includes("client/registerCapability"),
                  "the actual upstream registration handshake must be answered",
                );
                const symbols = await client.request<DocumentSymbol[] | null>(
                  "textDocument/documentSymbol",
                  { textDocument: { uri } },
                  REQUEST_TIMEOUT,
                );
                const pendingSymbols = [...(symbols ?? [])];
                const names: string[] = [];
                while (pendingSymbols.length) {
                  const symbol = pendingSymbols.pop()!;
                  if (symbol.name) names.push(symbol.name);
                  if (symbol.children) pendingSymbols.push(...symbol.children);
                }
                assert.ok(
                  names.includes("greet"),
                  "documentSymbol must retain the actual upstream declaration",
                );
                const completion = await client.request<CompletionResponse>(
                  "textDocument/completion",
                  {
                    context: { triggerKind: 1 },
                    position: { character: 2, line: 2 },
                    textDocument: { uri },
                  },
                  REQUEST_TIMEOUT,
                );
                const upstream = (
                  Array.isArray(completion)
                    ? completion
                    : (completion?.items ?? [])
                )
                  .filter((item) => item.data?.$ttsc !== DOC_PLUGIN_MARKER)
                  .map((item) => item.label);
                assert.ok(
                  upstream.includes("legacy"),
                  "the plugin merge must preserve the independently named upstream completion",
                );
              } catch (error) {
                populationFailures.push(
                  new Error("upstream language request population", {
                    cause: error,
                  }),
                );
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
              await new Promise<void>((resolve) =>
                setTimeout(resolve, DOC_POLL_INTERVAL),
              );
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
              populationFailures.push(
                new Error(name + ": outside-block request", { cause: error }),
              );
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
            populationFailures.push(
              new Error(name + ": LSP newline corpus", { cause: error }),
            );
          } finally {
            // This corpus owns unsaved editor buffers, not a persistent dirty
            // editor. Closing preserves saved bytes and releases the proxy's
            // project-publication suppression before the external Evidence flow.
            client.notify("textDocument/didClose", { textDocument: { uri } });
          }
        }

        try {
          const negativeFailures: unknown[] = [];
          for (const [name, code] of [
            ["type-error.ts", 2322],
            ["syntax-error.tsx", 1002],
            ["alias-lib-error.ts", 2322],
            ["alias-preset-error.ts", 2322],
            ["alias-preset-valid.ts", null],
          ] as const) {
            const invalidFile = path.join(
              workspace.lspEditorRoot,
              "native-errors",
              name,
            );
            const invalidUri = pathToFileURL(invalidFile).href;
            client.notify("textDocument/didOpen", {
              textDocument: {
                uri: invalidUri,
                languageId: name.endsWith("tsx")
                  ? "typescriptreact"
                  : "typescript",
                version: 1,
                text: fs.readFileSync(invalidFile, "utf8"),
              },
            });
            const report = await client.request<{ items?: Diagnostic[] }>(
              "textDocument/diagnostic",
              { textDocument: { uri: invalidUri } },
              REQUEST_TIMEOUT,
            );
            try {
              if (code === null)
                assert.equal(
                  report.items?.some(
                    (diagnostic) => typeof diagnostic.code === "number",
                  ),
                  false,
                  `well-typed preset consumer: ${JSON.stringify(report)}`,
                );
              else
                assert.ok(
                  report.items?.some((diagnostic) => diagnostic.code === code),
                  `native source ${name} must carry diagnostic ${code}: ${JSON.stringify(report)}`,
                );
            } catch (error) {
              negativeFailures.push(error);
            }
            client.notify("textDocument/didClose", {
              textDocument: { uri: invalidUri },
            });
          }
          if (negativeFailures.length)
            throw new AggregateError(
              negativeFailures,
              "Shared native diagnostic islands failed",
            );

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
          // Program membership does not broadcast document diagnostics. Send
          // each source through this session's actual document-open boundary.
          for (const languageFile of languageFiles) {
            client.notify("textDocument/didOpen", {
              textDocument: {
                languageId: "typescript",
                text: fs.readFileSync(languageFile, "utf8"),
                uri: pathToFileURL(languageFile).href,
                version: 1,
              },
            });
          }
          await step(
            "native config-language graph publishes nine independently scoped documents",
            languageReady,
          );
          const languageFindings = languageCases.flatMap((row, index) => {
            const params = languagePublications.get(
              pathToFileURL(languageFiles[index]!).href,
            )!;
            return (params.diagnostics ?? [])
              .filter((diagnostic) => diagnostic.source === "@ttsc/lint")
              .map((diagnostic) => ({
                name: row.name,
                line: diagnostic.range?.start?.line,
                rule: diagnostic.code,
                severity: diagnostic.severity,
              }));
          });
          assert.deepEqual(
            languageFindings,
            languageCases.map((row) => ({ ...row, severity: 1 })),
            "one actual evaluator/selector graph must publish exactly the original nine findings, without global-rule leakage",
          );

          const openedLint = findLint(openedPublication)!;
          const selectedCodes = new Set(
            (openedPublication.diagnostics ?? [])
              .filter((diagnostic) => diagnostic.source === "@ttsc/lint")
              .map((diagnostic) => diagnostic.code),
          );
          assert.ok(
            selectedCodes.has("no-var"),
            "the explicit config must reach the native diagnostic producer",
          );
          assert.ok(
            !selectedCodes.has("no-console"),
            "the conflicting discovered config must not contribute its rule",
          );
          assert.equal(
            fs.readFileSync(
              path.join(workspace.lspEditorRoot, "lint.config.json"),
              "utf8",
            ),
            '{"rules":{"no-console":"error"}}\n',
          );
          const evidenceObservation = await evidenceInitial;
          if ("error" in evidenceObservation) throw evidenceObservation.error;
          const evidenceFirst = evidenceObservation.value;
          const awaitEvidenceClear = (phase: string) =>
            step(
              phase + " uri=" + evidenceFirst.uri,
              client.waitForNotification<PublishDiagnosticsParams>(
                "textDocument/publishDiagnostics",
                (params) =>
                  params.uri === evidenceFirst.uri &&
                  !(params.diagnostics ?? []).some(
                    (diagnostic) => diagnostic.code === "evidence/graph",
                  ),
                PLUGIN_BUILD_TIMEOUT,
              ),
            );
          const evidenceCleared = awaitEvidenceClear(
            "external Evidence repair publication",
          );
          fs.writeFileSync(evidenceTarget, "export const value = 1;\n");
          client.notify("workspace/didChangeWatchedFiles", {
            changes: [{ uri: pathToFileURL(evidenceTarget).href, type: 2 }],
          });
          await evidenceCleared;
          const evidenceDeleted = step(
            "external Evidence deletion publication uri=" + evidenceFirst.uri,
            client.waitForNotification<PublishDiagnosticsParams>(
              "textDocument/publishDiagnostics",
              (params) =>
                (params.diagnostics ?? []).some((diagnostic) =>
                  diagnostic.message?.includes(
                    "Missing TypeScript evidence file",
                  ),
                ),
              PLUGIN_BUILD_TIMEOUT,
            ),
          );
          fs.unlinkSync(evidenceTarget);
          client.notify("workspace/didChangeWatchedFiles", {
            changes: [{ uri: pathToFileURL(evidenceTarget).href, type: 3 }],
          });
          assert.ok(
            (await evidenceDeleted).diagnostics?.length,
            "the same editor must observe external Evidence deletion",
          );
          const evidenceRestored = awaitEvidenceClear(
            "external Evidence restoration publication",
          );
          fs.writeFileSync(evidenceTarget, "export const value = 1;\n");
          client.notify("workspace/didChangeWatchedFiles", {
            changes: [{ uri: pathToFileURL(evidenceTarget).href, type: 1 }],
          });
          await evidenceRestored;
          assert.deepEqual(
            openedLint.range,
            {
              end: { character: 3, line: 0 },
              start: { character: 0, line: 0 },
            },
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
            client.request(
              "workspace/executeCommand",
              {
                arguments: [],
                command: "ttsc.lint.fixAll",
              },
              REQUEST_TIMEOUT,
            ),
            /ttsc command "ttsc\.lint\.fixAll" failed:[\s\S]*lsp-execute-command failed:[\s\S]*missing URI argument/,
          );
          assert.equal(
            fs.readFileSync(file, "utf8"),
            SAVED,
            "a failed native command must not mutate the saved input",
          );
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
          populationFailures.push(
            new Error(
              "native diagnostics and editor state population " +
                JSON.stringify({ editorUri: uri, latestPublication }),
              { cause: error },
            ),
          );
        }
        // These two disjoint documents belong to this same initialized graph.
        // Native commands are real request costs, not another project or server.
        for (const control of [
          {
            filename: "editor-cascade.ts",
            source: CASCADE_SOURCE,
            expected: CASCADE_FIXED,
            only: "source.fixAll.ttsc",
            command: "ttsc.lint.fixAll",
            wholeRange: true,
          },
          {
            filename: "editor-format.ts",
            source: FORMAT_SOURCE,
            expected: FORMAT_FIXED,
            only: "source.format",
            command: "ttsc.format.document",
            wholeRange: false,
          },
        ]) {
          const controlFile = path.join(
            project.tmpdir,
            "src",
            control.filename,
          );
          const controlUri = pathToFileURL(controlFile).href;
          try {
            client.notify("textDocument/didOpen", {
              textDocument: {
                uri: controlUri,
                languageId: "typescript",
                version: 1,
                text: control.source,
              },
            });
            const actions = await step(
              control.filename + " code action",
              client.request<CodeAction[]>(
                "textDocument/codeAction",
                {
                  textDocument: { uri: controlUri },
                  range: {
                    start: { line: 0, character: 0 },
                    end: {
                      line: control.wholeRange ? 0 : 2,
                      character: control.wholeRange ? control.source.length : 0,
                    },
                  },
                  context: { diagnostics: [], only: [control.only] },
                },
                REQUEST_TIMEOUT,
              ),
            );
            const action = actions.find(
              (candidate) => candidate.command?.command === control.command,
            );
            assert.ok(
              action,
              "the native manifest must route " + control.command,
            );
            assert.equal(action.kind, control.only);
            if (control.command === "ttsc.format.document") {
              // The code-action query owns saved findings. After its actual
              // reply, the supported format command instead owns live stdin;
              // an independently formatted disk must not replace that buffer.
              assert.equal(fs.readFileSync(controlFile, "utf8"), FORMAT_SOURCE);
              fs.writeFileSync(controlFile, FORMAT_DISK);
              assert.equal(fs.readFileSync(controlFile, "utf8"), FORMAT_DISK);
            }
            const edit = await step(
              control.filename + " execute command",
              client.request<WorkspaceEdit>(
                "workspace/executeCommand",
                { command: control.command, arguments: [controlUri] },
                REQUEST_TIMEOUT,
              ),
            );
            const edits = edit.changes?.[controlUri] ?? [];
            assert.ok(edits.length > 0);
            if (control.wholeRange) {
              assert.equal(edits[0]!.range?.end?.line, 0);
              assert.equal(
                edits[0]!.range?.end?.character,
                control.source.length,
                "the whole-source edit counts the non-BMP control as two UTF-16 units",
              );
            }
            assert.equal(
              applyTextEdits(control.source, edits),
              control.expected,
              "cascade reaches const/equality fixed point; formatting retains the var rule violation",
            );
            assert.equal(
              fs.readFileSync(controlFile, "utf8"),
              control.command === "ttsc.format.document"
                ? FORMAT_DISK
                : control.source,
              "native editor commands return edits without changing disk",
            );
            if (control.command === "ttsc.format.document") {
              assert.deepEqual(Object.keys(edit.changes ?? {}), [controlUri]);
              assert.equal(edits.length, 1);
              assert.equal(edits[0]?.newText, FORMAT_FIXED);
              assert.notEqual(edits[0]?.newText, FORMAT_DISK);
              client.notify("textDocument/didChange", {
                textDocument: { uri: controlUri, version: 2 },
                contentChanges: [{ text: FORMAT_FIXED }],
              });
              const cleanEdit = await step(
                "editor-format clean command",
                client.request<WorkspaceEdit | null>(
                  "workspace/executeCommand",
                  { command: control.command, arguments: [controlUri] },
                  REQUEST_TIMEOUT,
                ),
              );
              assert.equal(cleanEdit, null);
              assert.equal(fs.readFileSync(controlFile, "utf8"), FORMAT_DISK);
              // These are this session's completed native invocation buffers,
              // not JSON-RPC replies interpreted as raw sidecar stdout.
              const isRecord = (
                value: unknown,
              ): value is Record<string, unknown> =>
                typeof value === "object" &&
                value !== null &&
                !Array.isArray(value);
              const rows: Record<string, unknown>[] = [];
              for (const name of fs
                .readdirSync(runtimeTraceRoot)
                .filter((name) => name.endsWith(".jsonl"))) {
                for (const line of fs
                  .readFileSync(path.join(runtimeTraceRoot, name), "utf8")
                  .split(/\r?\n/)
                  .filter(Boolean)) {
                  const row: unknown = JSON.parse(line);
                  assert.ok(isRecord(row));
                  rows.push(row);
                }
              }
              const selectedOutputs = rows.filter(
                (row) =>
                  row.event === "process-output" &&
                  Array.isArray(row.argv) &&
                  row.argv.includes("--command=ttsc.format.document") &&
                  row.argv.includes(
                    "--arguments-json=" + JSON.stringify([controlUri]),
                  ),
              );
              assert.equal(
                selectedOutputs.length,
                2,
                "the shared dirty and clean commands each have one actual native invocation",
              );
              const outputs: string[] = [];
              for (const output of selectedOutputs) {
                assert.ok(
                  typeof output.invocation === "string" &&
                    typeof output.pid === "number" &&
                    output.pid > 0,
                );
                assert.ok(Array.isArray(output.argv));
                const argv = output.argv;
                assert.ok(
                  argv.every((argument) => typeof argument === "string"),
                );
                assert.equal(argv[1], "lsp-execute-command");
                assert.ok(argv.includes("--content-stdin"));
                const nativeRoot = fs.realpathSync.native(project.tmpdir);
                assert.ok(argv.includes("--cwd=" + nativeRoot));
                assert.ok(
                  argv.includes(
                    "--tsconfig=" + path.join(nativeRoot, "tsconfig.json"),
                  ),
                );
                const manifest = argv.find((argument: string) =>
                  argument.startsWith("--plugins-json="),
                );
                assert.ok(typeof manifest === "string");
                const parsedManifest: unknown = JSON.parse(
                  manifest.slice("--plugins-json=".length),
                );
                assert.ok(
                  Array.isArray(parsedManifest) && parsedManifest.length > 0,
                  "the actual opaque plugin manifest remains on argv",
                );
                const results = rows.filter(
                  (row) =>
                    row.event === "process-result" &&
                    row.invocation === output.invocation &&
                    row.pid === output.pid,
                );
                assert.equal(results.length, 1);
                const result = results[0];
                assert.ok(result && isRecord(result.data));
                assert.deepEqual(result.argv, argv);
                assert.equal(result.data.status, 0);
                assert.equal(result.data.exitObserved, true);
                assert.ok(isRecord(output.data));
                const data = output.data;
                assert.equal(data.outcome, "complete");
                assert.equal(data.stdoutTruncated, false);
                assert.equal(data.stderrTruncated, false);
                const readStream = (key: "stdout" | "stderr"): Buffer => {
                  const stream: unknown = data[key];
                  assert.ok(isRecord(stream) && isRecord(stream.raw));
                  assert.ok(
                    typeof stream.raw.path === "string" &&
                      typeof stream.raw.bytes === "number",
                  );
                  const payload = path.resolve(
                    runtimeTraceRoot,
                    stream.raw.path,
                  );
                  assert.equal(path.dirname(payload), runtimeTraceRoot);
                  const body = fs.readFileSync(payload);
                  assert.equal(body.length, stream.raw.bytes);
                  assert.equal(
                    createHash("sha256").update(body).digest("hex"),
                    stream.sha256,
                  );
                  return body;
                };
                assert.equal(readStream("stderr").length, 0);
                outputs.push(readStream("stdout").toString("utf8"));
              }
              const cleanOutputs = outputs.filter(
                (body) => body.trim() === "null",
              );
              assert.equal(
                cleanOutputs.length,
                1,
                "the clean native sidecar emits literal null",
              );
              const dirtyOutputs = outputs.filter(
                (body) => body.trim() !== "null",
              );
              assert.equal(dirtyOutputs.length, 1);
              const dirtyBody = dirtyOutputs[0];
              assert.ok(typeof dirtyBody === "string");
              const rawDirty: unknown = JSON.parse(dirtyBody);
              assert.deepEqual(
                rawDirty,
                edit,
                "the dirty WorkspaceEdit is the actual same-invocation raw output",
              );
            }
          } catch (error) {
            populationFailures.push(
              new Error("shared native editor action " + control.filename, {
                cause: error,
              }),
            );
          } finally {
            client.notify("textDocument/didClose", {
              textDocument: { uri: controlUri },
            });
          }
        }
        if (populationFailures.length)
          throw new AggregateError(
            populationFailures,
            "Shared LSP language and newline corpus failures",
          );
      },
      REQUEST_TIMEOUT,
    );
    const closedWaiter = await unmatchedClose;
    assert.ok(
      closedWaiter.error instanceof Error,
      "actual child close must reject even an unmatched notification wait",
    );
    assert.match(
      closedWaiter.error.message,
      /ttscserver exited before response/,
    );
  } catch (error) {
    const failures: unknown[] = [error];
    const reason = "editor session startup, body or shutdown failed";
    try {
      const preparations = fs
        .readdirSync(runtimeTraceRoot)
        .filter((name) => name.endsWith(".jsonl"))
        .flatMap((name) =>
          fs
            .readFileSync(path.join(runtimeTraceRoot, name), "utf8")
            .split(/\r?\n/)
            .filter(Boolean)
            .map((line) => JSON.parse(line)),
        )
        .filter(
          (row) =>
            row.event === "runtime-source-preparation" ||
            row.event === "integrity-failure",
        )
        .map((row) => {
          const sourcePath = row.data?.source?.path;
          if (
            row.event !== "runtime-source-preparation" ||
            typeof sourcePath !== "string"
          )
            return row;
          const payloadPath = path.resolve(runtimeTraceRoot, sourcePath);
          if (path.dirname(payloadPath) !== runtimeTraceRoot)
            throw new Error("runtime trace payload is outside its owned root");
          const source = fs.readFileSync(payloadPath).toString("utf16le");
          return {
            ...row,
            consumedHead: source.split(/\r?\n/).slice(0, 8),
            containsImportMeta: source.includes("import.meta"),
          };
        });
      failures.push(
        new Error(
          "same-session runtime preparation observations: " +
            JSON.stringify(preparations),
        ),
      );
    } catch (traceError) {
      failures.push(traceError);
    }
    try {
      // Preserve only this session's bounded format output records and payloads
      // before shared-cache cleanup; never copy plugin source or Go caches.
      const isRecord = (value: unknown): value is Record<string, unknown> =>
        typeof value === "object" && value !== null && !Array.isArray(value);
      const rows: Record<string, unknown>[] = [];
      for (const name of fs
        .readdirSync(runtimeTraceRoot)
        .filter((name) => name.endsWith(".jsonl"))) {
        for (const line of fs
          .readFileSync(path.join(runtimeTraceRoot, name), "utf8")
          .split(/\r?\n/)
          .filter(Boolean)) {
          const row: unknown = JSON.parse(line);
          if (
            isRecord(row) &&
            Array.isArray(row.argv) &&
            row.argv.includes("--command=ttsc.format.document")
          )
            rows.push(row);
        }
      }
      if (rows.length) {
        const retained = path.join(
          workspace.allocatedRoot,
          "lsp-format-observations",
        );
        fs.mkdirSync(retained, { recursive: true });
        fs.writeFileSync(
          path.join(retained, "invocations.jsonl"),
          rows.map((row) => JSON.stringify(row)).join("\n") + "\n",
        );
        for (const row of rows.filter(
          (row) => row.event === "process-output",
        )) {
          assert.ok(isRecord(row.data));
          for (const key of ["stdout", "stderr"] as const) {
            const stream: unknown = row.data[key];
            assert.ok(isRecord(stream) && isRecord(stream.raw));
            assert.ok(
              typeof stream.raw.path === "string" &&
                typeof stream.raw.bytes === "number",
            );
            const selected = path.resolve(runtimeTraceRoot, stream.raw.path);
            assert.equal(path.dirname(selected), runtimeTraceRoot);
            const stat = fs.lstatSync(selected);
            assert.ok(stat.isFile() && !stat.isSymbolicLink());
            assert.ok(
              stat.size <= (key === "stdout" ? 4 * 1024 * 1024 : 1024 * 1024),
            );
            const body = fs.readFileSync(selected);
            assert.equal(body.length, stream.raw.bytes);
            assert.equal(
              createHash("sha256").update(body).digest("hex"),
              stream.sha256,
            );
            fs.writeFileSync(
              path.join(retained, path.basename(selected)),
              body,
              { flag: "wx" },
            );
          }
        }
        console.error("LSP format observations retained: " + retained);
      }
    } catch (retentionError) {
      failures.push(retentionError);
    }
    try {
      TestProject.retainTemporaryDirectory(workspace.allocatedRoot, reason);
    } catch (retentionError) {
      failures.push(retentionError);
    }
    try {
      retainNativeLintProducer(reason);
    } catch (retentionError) {
      failures.push(retentionError);
    }
    throw new AggregateError(failures, reason);
  }
}

/**
 * Join ordinary editor behavior and independent terminal selections.
 *
 * @evidence contracts/testing.md#behavioral-verification One real editor session preserves merged initialize capabilities, publishes Evidence missing-export and missing-file failures, clears them after native watched repairs, publishes the exact var range/severity/message, suppresses dirty findings, republishes on save and reports a real native command stderr failure before returning a targeted let fix without writing disk. Disjoint configured documents additionally require actual cascade const/equality fixed-point edits with UTF-16 end coordinates and format-only semicolon edits that retain var while independently authored disk999 bytes stay unchanged. The format action first observes its original unformatted saved source; only after that actual reply does the harness replace disk with the authored formatted control, so the unchanged dirty buffer still supplies the command. The same opened formatting document then receives its formatted clean buffer and returns null; same-invocation raw output, empty stderr, nontruncation, actual argv and successful native status distinguish sidecar transport from JSON-RPC interpretation. The original editor body retains all diagnostic/edit/capability assertions; the selection body retains actual native restart notifications and terminal outcomes. Both results are collected even if one body fails.
 * @evidence contracts/testing.md#independent-expectations Literal capability ids/kinds, authored source/append range, var underline/severity and expected let rewrite independently prescribe every original editor transition. Literal disk999, FORMAT_SOURCE/FORMAT_FIXED, one URI/one edit and trimmed raw null independently prescribe both formatting calls; saved buffer SHA and byte counts bind raw output to its actual result invocation. Each owning body supplies authored diagnostics, source coordinates and literal native outcomes; this collector does not reinterpret failure as acceptance.
 * @evidence contracts/testing.md#distinguishing-cases Separates upstream capability preservation from native actions, dirty suppression from absence by retaining var, and returned WorkspaceEdit from sidecar disk mutation after save. Dirty stdin differs from already formatted disk, then clean stdin differs from dirty output; raw null, empty stderr and actual status0 remain required. Ordinary supported shutdown and five intentionally terminal selection changes are different lifetimes, all required to settle.
 * @evidence contracts/testing.md#execution-ownership The shared DAG runner selects this one actual initialized editor session; an actual Evidence missing-export/repair/deletion/restoration chain joins the existing no-var lifecycle without another server. It sends actual initialize/didOpen/incremental didChange/didSave/codeAction/executeCommand across the native proxy and lint producer; it does not launch VS Code itself. This is the single selected LSP entry. On failure, only its bounded formatting invocation records and verified raw payloads are copied into the retained allocation before shared-cache cleanup; retention failures remain alongside the original failure. It acquires no host itself beyond the explicit bodies and aggregates every rejection.
 * @evidence contracts/e2e.md#necessary-boundary Direct rule or synthetic publication units cannot establish ordered editor notifications, dirty-buffer suppression, saved revalidation and actual command manifest routing, bounded stdout decoding and native stderr failure adaptation across the native bridge. Editor notifications and native termination are actual process boundaries owned by the invoked bodies, not mocked policy calls.
 * @evidence contracts/e2e.md#shared-execution One workspace snapshot producer prepares a dedicated editor island with the complete original src/native-errors/docs population, actual module links and lint/Evidence configuration. Transform-only producers and other actors' tools/outputs are outside this command-copy root; their emission assertions remain in their owning batches. This same launcher inherits the island as process cwd and omits --cwd, exercising native Getwd admission through actual initialize, project diagnostics and joined shutdown. The malformed command, ordinary fix, cascade fix and formatter retain their real native requests and complete checker Programs; no deadline or rule is weakened. The independent terminal-selection island and five launcher lifetimes remain unchanged. Both bodies borrow the same preparation and source producer/cache; shared availability does not certify packed installation, cache hits, child/build totals or Program reuse.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Only the temporary source is intentionally saved by the harness; dirty edits remain buffer-only until save and command nonmutation is checked against saved bytes. Successful supported shutdown/direct close precedes cleanup, with a separate REQUEST_TIMEOUT shutdown bound. Startup/body/shutdown failure retains the tracked consumer and already-owned snapshot/cache, preserving retention errors. An independently unmatched notification waiter must reject when that same child actually closes, releasing its owned timer/listener on both body failure and normal close. Timeout does not force termination or certify arbitrary descendant closure. Promise.allSettled joins both owners before error propagation. Each body alone owns its shutdown and restoration; failed or unknown closure retains shared inputs.
 * @evidence contracts/e2e.md#preserved-coverage Keeps every capability, range, severity, message, dirty/saved predicate, action target and exact WorkspaceEdit/disk assertion. Upfront disjoint alias islands preserve boolean/string and number/string native rejection plus a valid numeric twin; actual source wrapper units own leaf/JSONC/package-preset configuration derivation. This shared checker session does not claim it replays each original wrapper profile. Upfront LF/CR/CRLF saved documents retain buffer-only param/returns, exact edit and resolution, unchanged disk and outside-block negatives. The same upstream retains inferred legacy number, greet symbol and non-plugin completion after capability registration. Explicit configuration competes with discovered no-console-only JSON after the shared base is moved outside discovery names; positive no-var and negative no-console distinguish the handoff. Necessary internal checker updates are not old per-project launcher recipes, and their total is not asserted to be one. Retains the complete ordinary editor body and original config/dependency/source/descriptor selection terminal assertions. Saved code-action eligibility and live-buffer formatting are distinct supported inputs: replacing the saved control only after action delivery preserves both, without bypassing discovery or stale suggestion validation. This extra saved edit is real watcher/checker work, not zero Program cost. Actual extra launcher sessions number five; native/descendant totals remain unmeasured.
 */
export async function test_e2e_lsp_batch(): Promise<void> {
  const workspace = await BatchWorkspace.open();
  const outcomes = await Promise.allSettled([
    runEditorCorpus(),
    lspSelectionCorpus(workspace),
  ]);
  const failures = outcomes
    .filter(
      (outcome): outcome is PromiseRejectedResult =>
        outcome.status === "rejected",
    )
    .map((outcome) => outcome.reason);
  if (failures.length)
    throw new AggregateError(
      failures,
      "ordinary editor and terminal selection boundaries",
    );
}

/**
 * Original bound for one publishDiagnostics wait. It is a harness deadline, not
 * a measurement of the number of native attempts or Program constructions.
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

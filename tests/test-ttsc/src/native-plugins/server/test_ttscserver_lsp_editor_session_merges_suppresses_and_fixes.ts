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
    codeActionProvider?: boolean | { codeActionKinds?: string[] };
    diagnosticProvider?: unknown;
    documentFormattingProvider?: boolean;
    executeCommandProvider?: { commands?: string[] };
  };
};

type TextEdit = { newText?: string; range?: Range };

type WorkspaceEdit = { changes?: Record<string, TextEdit[]> };

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
 * The VS Code extension's whole job is this JSON-RPC conversation, yet each
 * sibling server test pins a single verb in its own process. Nothing reads the
 * `initialize` capabilities the editor registers its commands and lightbulb
 * kinds from, and nothing sends `didChange` or `didSave` at all — so the
 * dirty-buffer suppression between an edit and its save, and the republication
 * that ends it, have no coverage. A break anywhere along initialize → didOpen →
 * didChange → didSave → codeAction → executeCommand would leave every existing
 * test green while the editor showed nothing.
 *
 * 1. Materialize a `@ttsc/lint` project with a `no-var` violation, handshake,
 *    and assert ttsc's command ids and action kinds are merged into tsgo's
 *    advertised capabilities rather than replacing them.
 * 2. Open the file and assert the lint diagnostic underlines the `var` keyword;
 *    edit the buffer and assert the dirty publish drops the finding; save and
 *    assert it returns.
 * 3. Ask for code actions over that diagnostic's own range and assert the
 *    ttsc-owned `ttsc.lint.fixAll` action comes back.
 * 4. Execute that command and assert the returned WorkspaceEdit fixes the
 *    violation without writing the file, then shut the server down cleanly.
 */
export const test_ttscserver_lsp_editor_session_merges_suppresses_and_fixes =
  async () => {
    const project = TestLint.createProject({
      name: "ttscserver-lsp-editor-session",
      rules: { "no-var": "error" },
      source: OPENED,
    });
    const file = path.join(project.tmpdir, "src", "main.ts");
    const uri = pathToFileURL(file).href;
    const client = TtscserverClient.startLauncher(project.tmpdir, {
      env: { TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR },
    });

    try {
      // 1. Handshake. The editor builds its command palette and lightbulb menu
      // from this response, so the advertised ids are editor-visible behavior.
      const initialized = await step(
        "initialize",
        client.request<InitializeResult>(
          "initialize",
          {
            capabilities: {},
            processId: process.pid,
            rootUri: pathToFileURL(project.tmpdir).href,
          },
          // Deliberately unbounded, matching
          // test_ttscserver_lsp_honors_explicit_lint_config_file: the launcher
          // builds project plugins before it spawns the server, so a cold
          // `@ttsc/lint` source build — minutes, and measured at over ten on a
          // cold Go cache — is charged entirely to this one request. Any bound
          // small enough to be a useful hang signal is small enough to flake.
          // The wait still ends on server death: the client rejects every
          // pending request when the child closes.
        ),
      );
      const capabilities = initialized.capabilities ?? {};
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

      // 2. didOpen. Register the waiter first: publishDiagnostics is
      // server-initiated and races the notification that triggers it.
      const opened = step(
        "didOpen publishDiagnostics",
        client.waitForNotification<PublishDiagnosticsParams>(
          "textDocument/publishDiagnostics",
          (params) => params.uri === uri && findLint(params) !== undefined,
          DIAGNOSTICS_TIMEOUT,
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
      const openedLint = findLint(await opened)!;
      assert.deepEqual(
        openedLint.range,
        { end: { character: 3, line: 0 }, start: { character: 0, line: 0 } },
        "the lint diagnostic must underline the `var` keyword itself",
      );
      assert.equal(openedLint.severity, 1, "no-var is configured as an error");
      assert.match(
        openedLint.message ?? "",
        /Unexpected var, use let or const instead/,
      );

      // 3. didChange. While the buffer is dirty the proxy deliberately drops
      // plugin findings: the sidecar reads disk, so a stale underline would sit
      // on text the user has already changed. The edit keeps the violation, so
      // an empty plugin contribution here is suppression, not absence.
      assert.ok(SAVED.includes("var legacy"), "the edit must keep the finding");
      const dirty = step(
        "didChange publishDiagnostics",
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
        "didSave publishDiagnostics",
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

      // 6. executeCommand. The extension applies the returned WorkspaceEdit
      // itself, so the sidecar must not touch the file.
      const edit = await step(
        "workspace/executeCommand",
        client.request<WorkspaceEdit>(
          "workspace/executeCommand",
          { arguments: fixAll.command?.arguments, command: "ttsc.lint.fixAll" },
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
    } finally {
      await shutdownTtscserverClient(client);
      project.cleanup();
    }
  };

/**
 * Bound for a publishDiagnostics wait. `lsp-diagnostics` goes to the resident
 * sidecar daemon, which the proxy bounds at 30s per verb and falls back to a
 * fresh spawn on timeout — so a single wait can legitimately cost two attempts
 * plus the first one's Program load.
 */
const DIAGNOSTICS_TIMEOUT = 120_000;

/** Bound for a request the sidecar answers with a Program already loaded. */
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

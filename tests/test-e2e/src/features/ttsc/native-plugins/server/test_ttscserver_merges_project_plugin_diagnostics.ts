import { FixtureFiles } from "../../../../internal/FixtureFiles";
import { TestLint } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  PLUGIN_BUILD_TIMEOUT,
  TtscserverClient,
  assert,
  initializeTtscserverClient,
  runTtscserverSession,
} from "../../../../internal/ttsc/internal/ttscserver";

type CodeAction = {
  command?: {
    command?: string;
  };
  kind?: string;
  title?: string;
};

type WorkspaceEdit = {
  changes?: Record<
    string,
    {
      newText?: string;
      range?: {
        start?: { line?: number; character?: number };
        end?: { line?: number; character?: number };
      };
    }[]
  >;
};


type PublishDiagnosticsParams = {
  uri: string;
  diagnostics?: {
    code?: unknown;
    message?: string;
    source?: string;
  }[];
};

/**
 * Verifies ttscserver merges project plugin diagnostics into LSP output.
 *
 * `ttscserver` previously wired `NullPluginSource`, so the VS Code extension
 * could only show TypeScript-Go diagnostics even when the project configured
 * `@ttsc/lint`. This pins the real launcher path: Node discovers and builds the
 * lint sidecar, the Go proxy asks it for diagnostics, and the editor sees them
 * on `textDocument/publishDiagnostics`.
 *
 * 1. Materialize a project with `@ttsc/lint` and a `no-var` violation.
 * 2. Start ttscserver through the JavaScript launcher.
 * 3. Open the file over LSP and wait for publishDiagnostics.
 * 4. Assert the editor-visible diagnostics include `ttsc/lint` `no-var`.
 *
 * @evidence contracts/testing.md#behavioral-verification One real launcher publishes the original no-var diagnostic, returns cascade fix-all and format actions, and resolves both commands into exact edits without writing their source file.
 * @evidence contracts/testing.md#independent-expectations The original diagnostic message, fix cascade string, formatter-only string, action identifiers/kinds, UTF-16 end range and unchanged disk source literals during each command independently prescribe all three responses.
 * @evidence contracts/testing.md#distinguishing-cases Three original source phases separate diagnostic publication, no-var/prefer-const/eqeqeq cascade and formatting with a retained var keyword; both edit commands must leave disk untouched.
 * @evidence contracts/testing.md#execution-ownership The named server entry owns all three original native manifest/sidecar/LSP command connections in one temporary consumer and launcher; rule and format decision matrices remain in the shared Go units.
 * @evidence contracts/e2e.md#necessary-boundary Owning rule units cannot establish JavaScript manifest loading, native diagnostics publication or editor-facing codeAction and executeCommand WorkspaceEdit routing across the actual proxy.
 * @evidence contracts/e2e.md#shared-execution One immutable lint producer and one initialized LSP session serve three original source phases; no second launcher or contributor build is used for the independent scenarios.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each phase closes the preceding document and writes its original source bytes to the same configured root file before reopening it, shared configuration enables their original policies, and failures are collected before session shutdown and project cleanup; no workspace source is edited.
 * @evidence contracts/e2e.md#preserved-coverage Original publication/message, two action identifiers/kinds, exact cascade/format edits, range checks and both disk nonmutation assertions remain; the shared native success shutdown remains mandatory after every scenario.
 */
export async function test_ttscserver_merges_project_plugin_diagnostics() {
  const project = TestLint.createProject({
      nativeProducer: "snapshot",
    name: "ttscserver-lsp-diagnostics",
    extraSources: FixtureFiles.read("ttsc/ttscserver_merges_project_plugin_diagnostics/inputs-1"),
    source: "var legacy = 1;\nconsole.log(legacy);\n",
  });
  const file = path.join(project.tmpdir, "src", "main.ts");
  const uri = pathToFileURL(file).href;
  const client = TtscserverClient.startLauncher(project.tmpdir, {
    env: { TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR },
  });

  try {
    await runTtscserverSession(client, async () => {
      await initializeTtscserverClient(client, project.tmpdir);
      const failures: unknown[] = [];
      try {
        const diagnostics = client.waitForNotification<PublishDiagnosticsParams>(
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
                  uri,
                  languageId: "typescript",
                  version: 1,
                  text: fs.readFileSync(file, "utf8"),
                },
              });
        const params = await diagnostics;
        const lintDiagnostic = (params.diagnostics ?? []).find(
                (diagnostic) =>
                  diagnostic.source === "@ttsc/lint" && diagnostic.code === "no-var",
              );
        assert.ok(lintDiagnostic, "expected @ttsc/lint diagnostic");
        assert.match(
                lintDiagnostic.message ?? "",
                /Unexpected var, use let or const instead/,
              );
      } catch (error) {
        failures.push(new Error("test_ttscserver_merges_project_plugin_diagnostics", { cause: error }));
      } finally {
        client.notify("textDocument/didClose", { textDocument: { uri } });
      }
      try {
        const source = 'const icon = "😀"; var legacy = 1; let stable = legacy; if (typeof stable == "number") { console.log(icon, stable); }';
        const file = path.join(project.tmpdir, "src", "main.ts");
        const uri = pathToFileURL(file).href;
        fs.writeFileSync(file, source, "utf8");
        client.notify("textDocument/didOpen", {
                  textDocument: {
                    uri,
                    languageId: "typescript",
                    version: 1,
                    text: fs.readFileSync(file, "utf8"),
                  },
                });
        const actions = await client.request<CodeAction[]>(
                  "textDocument/codeAction",
                  {
                    textDocument: { uri },
                    range: {
                      start: { line: 0, character: source.indexOf("var legacy") },
                      end: { line: 0, character: source.indexOf("var legacy") + 3 },
                    },
                    context: { diagnostics: [], only: ["source.fixAll.ttsc"] },
                  },
                );
        const fixAll = actions.find(
                  (action) => action.command?.command === "ttsc.lint.fixAll",
                );
        assert.ok(fixAll, "expected ttsc.lint.fixAll code action");
        assert.equal(fixAll.kind, "source.fixAll.ttsc");
        const edit = await client.request<WorkspaceEdit>(
                  "workspace/executeCommand",
                  {
                    command: "ttsc.lint.fixAll",
                    arguments: [uri],
                  },
                );
        const edits = edit.changes?.[uri] ?? [];
        assert.ok(edits.length > 0, "expected WorkspaceEdit changes");
        const original = fs.readFileSync(file, "utf8");
        assert.equal(edits[0]?.range?.end?.line, 0);
        assert.equal(edits[0]?.range?.end?.character, original.length);
        assert.equal(
                  applyWorkspaceEdits(original, edits),
                  'const icon = "😀"; const legacy = 1; const stable = legacy; if (typeof stable === "number") { console.log(icon, stable); }',
                  "expected fix-all command to reach the lint cascade fixed point",
                );
        assert.equal(
                  fs.readFileSync(file, "utf8"),
                  source,
                  "LSP executeCommand should return edits, not write the file",
                );
      } catch (error) {
        failures.push(new Error("ttscserver serves project plugin code actions and executes the command", { cause: error }));
      } finally {
        client.notify("textDocument/didClose", { textDocument: { uri } });
      }
      try {
        const source = "var legacy = 1\nJSON.stringify(legacy)\n";
        const file = path.join(project.tmpdir, "src", "main.ts");
        const uri = pathToFileURL(file).href;
        fs.writeFileSync(file, source, "utf8");
        client.notify("textDocument/didOpen", {
                  textDocument: {
                    uri,
                    languageId: "typescript",
                    version: 1,
                    text: fs.readFileSync(file, "utf8"),
                  },
                });
        const actions = await client.request<CodeAction[]>(
                  "textDocument/codeAction",
                  {
                    textDocument: { uri },
                    range: {
                      start: { line: 0, character: 0 },
                      end: { line: 0, character: source.length },
                    },
                    context: { diagnostics: [], only: ["source.format"] },
                  },
                );
        const format = actions.find(
                  (action) => action.command?.command === "ttsc.format.document",
                );
        assert.ok(format, "expected ttsc.format.document code action");
        assert.equal(format.kind, "source.format");
        const edit = await client.request<WorkspaceEdit>(
                  "workspace/executeCommand",
                  {
                    command: "ttsc.format.document",
                    arguments: [uri],
                  },
                );
        const edits = edit.changes?.[uri] ?? [];
        assert.ok(edits.length > 0, "expected WorkspaceEdit changes");
        assert.equal(
                  applyWorkspaceEdits(source, edits),
                  "var legacy = 1;\nJSON.stringify(legacy);\n",
                  "expected format command to apply only formatter edits",
                );
        assert.equal(
                  fs.readFileSync(file, "utf8"),
                  source,
                  "LSP executeCommand should return edits, not write the file",
                );
      } catch (error) {
        failures.push(new Error("ttscserver serves the project plugin format action and command", { cause: error }));
      } finally {
        client.notify("textDocument/didClose", { textDocument: { uri } });
      }
      if (failures.length) throw new AggregateError(failures, "Project plugin LSP boundary scenarios failed");
    });
  } finally {
    project.cleanup();
  }
}

function applyWorkspaceEdits(
  source: string,
  edits: NonNullable<WorkspaceEdit["changes"]>[string],
): string {
  let next = source;
  for (let i = edits.length - 1; i >= 0; i--) {
    const edit = edits[i]!;
    const range = edit.range;
    assert.ok(range?.start && range.end, "expected text edit range");
    const start = offsetAt(next, range.start);
    const end = offsetAt(next, range.end);
    next = next.slice(0, start) + (edit.newText ?? "") + next.slice(end);
  }
  return next;
}

function offsetAt(
  source: string,
  position: { character?: number; line?: number },
): number {
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

import { TestLint, TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  TtscserverClient,
  assert,
  initializeTtscserverClient,
  shutdownTtscserverClient,
} from "../../internal/ttscserver";

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

/**
 * Verifies ttscserver serves project plugin code actions and commands.
 *
 * The VS Code command buttons are only useful if the LSP bridge returns actions
 * and resolves `workspace/executeCommand` to a `WorkspaceEdit` instead of
 * mutating files inside the sidecar. This locks the `@ttsc/lint` fix cascade:
 * `no-var` enables `prefer-const`, then `eqeqeq` rewrites the comparison. The
 * source includes a non-BMP prefix so returned LSP UTF-16 positions are applied
 * through the same shape VS Code sees.
 *
 * 1. Materialize a project with `@ttsc/lint` and cascading fixable findings.
 * 2. Start ttscserver through the JavaScript launcher and open the file.
 * 3. Request code actions and assert `ttsc.lint.fixAll` is present.
 * 4. Execute the command and assert the returned WorkspaceEdit reaches the cascade
 *    fixed point without writing the file.
 */
export const test_ttscserver_serves_project_plugin_code_actions_and_executes_command =
  async () => {
    const source =
      'const icon = "😀"; var legacy = 1; let stable = legacy; if (typeof stable == "number") { console.log(icon, stable); }';
    const project = TestLint.createProject({
      name: "ttscserver-lsp-code-actions",
      rules: { eqeqeq: "error", "no-var": "error", "prefer-const": "error" },
      source,
    });
    const cache = TestProject.tmpdir("ttscserver-lsp-cache-");
    const file = path.join(project.tmpdir, "src", "main.ts");
    const uri = pathToFileURL(file).href;
    const client = TtscserverClient.startLauncher(project.tmpdir, {
      env: { TTSC_CACHE_DIR: cache },
    });

    try {
      await initializeTtscserverClient(client, project.tmpdir);
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
    } finally {
      await shutdownTtscserverClient(client);
      project.cleanup();
    }
  };

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

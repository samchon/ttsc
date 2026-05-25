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
};

type WorkspaceEdit = {
  changes?: Record<
    string,
    {
      newText?: string;
      range?: {
        end?: { character?: number; line?: number };
        start?: { character?: number; line?: number };
      };
    }[]
  >;
};

/**
 * Verifies ttscserver serves project plugin format actions and commands.
 *
 * The fix-all e2e pins lint command routing, but VS Code also exposes document
 * formatting through the same launcher → native manifest → sidecar path. This
 * locks the `source.format` branch so format commands survive the real LSP
 * bridge and return edits without applying lint rewrites or mutating disk.
 *
 * 1. Materialize a project with one lint fix and one format fix.
 * 2. Start ttscserver through the JavaScript launcher and open the file.
 * 3. Request `source.format` code actions and assert `ttsc.format.document`.
 * 4. Execute the command and assert only formatting edits are returned.
 */
export const test_ttscserver_serves_project_plugin_format_action_and_command =
  async () => {
    const source = "var legacy = 1\nJSON.stringify(legacy)\n";
    const project = TestLint.createProject({
      name: "ttscserver-lsp-format-action",
      rules: {
        "format/semi": "error",
        "no-var": "error",
      },
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

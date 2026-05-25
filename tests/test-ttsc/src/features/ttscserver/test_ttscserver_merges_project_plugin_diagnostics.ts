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
 */
export const test_ttscserver_merges_project_plugin_diagnostics = async () => {
  const project = TestLint.createProject({
    name: "ttscserver-lsp-diagnostics",
    rules: { "no-var": "error" },
    source: "var legacy = 1;\nconsole.log(legacy);\n",
  });
  const cache = TestProject.tmpdir("ttscserver-lsp-cache-");
  const file = path.join(project.tmpdir, "src", "main.ts");
  const uri = pathToFileURL(file).href;
  const client = TtscserverClient.startLauncher(project.tmpdir, {
    env: { TTSC_CACHE_DIR: cache },
  });

  try {
    await initializeTtscserverClient(client, project.tmpdir);
    const diagnostics = client.waitForNotification<PublishDiagnosticsParams>(
      "textDocument/publishDiagnostics",
      (params) =>
        params.uri === uri &&
        (params.diagnostics ?? []).some(
          (diagnostic) =>
            diagnostic.source === "ttsc/lint" && diagnostic.code === "no-var",
        ),
      120_000,
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
        diagnostic.source === "ttsc/lint" && diagnostic.code === "no-var",
    );
    assert.ok(lintDiagnostic, "expected @ttsc/lint diagnostic");
    assert.match(
      lintDiagnostic.message ?? "",
      /Unexpected var, use let or const instead/,
    );
  } finally {
    await shutdownTtscserverClient(client);
    project.cleanup();
  }
};

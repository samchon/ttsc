import { TestLint, TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import {
  TtscserverClient,
  assert,
  shutdownTtscserverClient,
} from "../../internal/ttscserver";

type Publication = {
  uri: string;
  diagnostics?: { code?: unknown; message?: string }[];
};

/**
 * Verifies an editor refreshes file-qualified evidence after external changes.
 *
 * The code population is outside the Program. The real evidence contributor
 * must publish its dependency and re-run through the LSP project channel.
 *
 * 1. Open a session with a Markdown link to a missing exported name.
 * 2. Repair the external file and send the editor's watched-file event.
 * 3. Verify the project diagnostic clears, then returns on deletion.
 */
export const test_ttscserver_revalidates_file_qualified_evidence_links =
  async (): Promise<void> => {
    const entry = path.join(
      TestProject.WORKSPACE_ROOT,
      "packages/evidence/lib/index.js",
    );
    const project = TestLint.createProject({
      name: "lsp-evidence-file-links",
      source: "export {};\n",
      pluginConfig: { configFile: "./lint.config.cjs" },
      extraSources: {
        "lint.config.cjs": `const { evidence } = require(${JSON.stringify(entry)});
module.exports = { plugins: { evidence }, rules: { "evidence/graph": ["error", { claims: [{ type: "markdown", files: ["review.md"], symbol: "h2", reference: { type: "typescript", root: "./external", files: ["*.ts"], symbol: "property" } }] }] } };
`,
        "review.md":
          "## Review\n<!-- @link external/example.ts#value Reviews the value. -->\n",
        "external/example.ts": "export const other = 1;\n",
      },
    });
    const target = path.join(project.tmpdir, "external/example.ts");
    const client = TtscserverClient.startLauncher(project.tmpdir, {
      env: { TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR },
    });
    try {
      const initial = client.waitForNotification<Publication>(
        "textDocument/publishDiagnostics",
        (value) =>
          (value.diagnostics ?? []).some((diagnostic) =>
            diagnostic.message?.includes("Missing TypeScript evidence export"),
          ),
        900_000,
      );
      await client.request("initialize", {
        capabilities: {
          workspace: { didChangeWatchedFiles: { dynamicRegistration: true } },
        },
        processId: process.pid,
        rootUri: pathToFileURL(project.tmpdir).href,
      });
      client.notify("initialized", {});
      const first = await initial;
      const cleared = client.waitForNotification<Publication>(
        "textDocument/publishDiagnostics",
        (value) =>
          value.uri === first.uri &&
          !(value.diagnostics ?? []).some(
            (diagnostic) => diagnostic.code === "evidence/graph",
          ),
        120_000,
      );
      fs.writeFileSync(target, "export const value = 1;\n");
      client.notify("workspace/didChangeWatchedFiles", {
        changes: [{ uri: pathToFileURL(target).href, type: 2 }],
      });
      await cleared;
      const deleted = client.waitForNotification<Publication>(
        "textDocument/publishDiagnostics",
        (value) =>
          (value.diagnostics ?? []).some((diagnostic) =>
            diagnostic.message?.includes("Missing TypeScript evidence file"),
          ),
        120_000,
      );
      fs.unlinkSync(target);
      client.notify("workspace/didChangeWatchedFiles", {
        changes: [{ uri: pathToFileURL(target).href, type: 3 }],
      });
      assert.ok(
        (await deleted).diagnostics?.length,
        "The editor must observe external deletion.",
      );
    } finally {
      await shutdownTtscserverClient(client);
      project.cleanup();
    }
  };

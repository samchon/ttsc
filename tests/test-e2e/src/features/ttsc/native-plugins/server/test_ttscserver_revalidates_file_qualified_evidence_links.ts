import { TestLint, TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  PLUGIN_BUILD_TIMEOUT,
  TtscserverClient,
  assert,
  runTtscserverSession,
} from "../../../../internal/ttsc/internal/ttscserver";

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
 *
 * @evidence contracts/testing.md#behavioral-verification A real evidence contributor must publish the missing export, clear it after external file repair, then publish the missing file after deletion and watched-file notification.
 * @evidence contracts/testing.md#independent-expectations The Markdown file-qualified reference, initial other export, repaired value export and literal missing-export/file messages prescribe each original transition independently.
 * @evidence contracts/testing.md#distinguishing-cases The reference population is outside the Program; an external content repair and file deletion distinguish contributor dependency invalidation from ordinary edited source diagnostics.
 * @evidence contracts/testing.md#execution-ownership The named server entry connects built evidence descriptor, linked contributor, project diagnostics and editor watched-file notifications in one real session.
 * @evidence contracts/e2e.md#necessary-boundary Graph decision units cannot prove that contributor-declared external dependencies reach the native LSP project channel and trigger publication after editor events.
 * @evidence contracts/e2e.md#shared-execution One evidence/lint producer, one initialized server and one unchanged Program source serve the entire missing-repaired-deleted transition sequence.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity All Markdown/external/config paths are private; each waiter precedes its triggering write and notification, session shutdown and project cleanup always run, and contributor inputs are not bypassed by a warm build.
 * @evidence contracts/e2e.md#preserved-coverage Original missing-export wait, same-URI clearing predicate, missing-file wait and nonempty deletion assertion remain; exact graph decision matrices stay with evidence units.
 */
export async function test_ttscserver_revalidates_file_qualified_evidence_links() {
    const entry = path.join(
      TestProject.WORKSPACE_ROOT,
      "packages/evidence/lib/index.js",
    );
    const project = TestLint.createProject({
      nativeProducer: "snapshot",
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
      await runTtscserverSession(client, async () => {
        const initial = client.waitForNotification<Publication>(
          "textDocument/publishDiagnostics",
          (value) =>
            (value.diagnostics ?? []).some((diagnostic) =>
              diagnostic.message?.includes(
                "Missing TypeScript evidence export",
              ),
            ),
          PLUGIN_BUILD_TIMEOUT,
        );
        await client.request("initialize", {
          capabilities: {
            workspace: {
              didChangeWatchedFiles: {
                dynamicRegistration: true,
                relativePatternSupport: true,
              },
            },
          },
          processId: process.pid,
          rootUri: pathToFileURL(project.tmpdir).href,
        });
        client.notify("initialized", {});
        client.notify("textDocument/didOpen", {
          textDocument: {
            uri: pathToFileURL(path.join(project.tmpdir, "src/main.ts")).href,
            languageId: "typescript",
            version: 1,
            text: "export {};\n",
          },
        });
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
      });
    } finally {
      project.cleanup();
    }
  }

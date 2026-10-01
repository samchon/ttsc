import { FixtureFiles } from "../../../../internal/FixtureFiles";
import { TestLint } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  TtscserverClient,
  assert,
  initializeTtscserverClient,
  runTtscserverSession,
} from "../../../../internal/ttsc/internal/ttscserver";

type PublishDiagnosticsParams = {
  uri: string;
  diagnostics?: {
    code?: unknown;
    source?: string;
  }[];
};

/**
 * Verifies ttscserver LSP honors an explicit @ttsc/lint config file.
 *
 * The JavaScript launcher serializes project plugin entries into its private
 * manifest file for the Go proxy. This pins the config handoff: a project-level
 * `configFile` must survive into the sidecar invocation instead of falling back
 * to the auto-discovered `lint.config.json` next to tsconfig.
 *
 * 1. Materialize a project with two lint configs: explicit `no-var`, default
 *    `no-console`.
 * 2. Start ttscserver through the JavaScript launcher and open the file.
 * 3. Wait for plugin diagnostics on the edited file.
 * 4. Assert `no-var` is present and `no-console` is absent.
 *
 * @evidence contracts/testing.md#behavioral-verification The real launcher must preserve configFile through its manifest so the no-var finding appears and the conflicting default no-console rule remains absent.
 * @evidence contracts/testing.md#independent-expectations The authored custom and default config JSON select opposite rules for the same var and console source; literal positive and negative codes decide the result.
 * @evidence contracts/testing.md#distinguishing-cases A valid explicit config competes with an existing default config; checking both no-var presence and no-console absence distinguishes actual precedence from loading both.
 * @evidence contracts/testing.md#execution-ownership The named server entry starts one real launcher and observes native diagnostics; descriptor/config decision units do not own the private manifest to sidecar handoff.
 * @evidence contracts/e2e.md#necessary-boundary The actual manifest serializer, Go proxy and sidecar invocation must agree on configFile; direct rule execution cannot prove that connection.
 * @evidence contracts/e2e.md#shared-execution One source document and one server session exercise both precedence controls, using the shared immutable lint build instead of another standalone installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Both configs and the source belong to one temporary consumer; no producer bytes change, and runTtscserverSession shuts down before project cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Keeps both original code assertions and the actual publication wait; a default fallback remains a failure rather than being hidden by a weaker rule check.
 */
export async function test_ttscserver_lsp_honors_explicit_lint_config_file() {
    const project = TestLint.createProject({
      nativeProducer: "snapshot",
      name: "ttscserver-lsp-explicit-lint-config",
      pluginConfig: { configFile: "./custom-lint.config.json" },
      source: "var legacy = 1;\nconsole.log(legacy);\n",
      extraSources: FixtureFiles.read("ttsc/ttscserver_lsp_honors_explicit_lint_config_file/inputs-1"),
    });
    const file = path.join(project.tmpdir, "src", "main.ts");
    const uri = pathToFileURL(file).href;
    const client = TtscserverClient.startLauncher(project.tmpdir, {
      env: { TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR },
    });

    try {
      await runTtscserverSession(client, async () => {
        await initializeTtscserverClient(client, project.tmpdir);
        // No timeout: on an isolated lane this is the first test to build
        // `@ttsc/lint` from source, so the diagnostics follow a cold multi-minute
        // sidecar build. The wait ends when the diagnostics arrive or the server
        // dies.
        const diagnostics =
          client.waitForNotification<PublishDiagnosticsParams>(
            "textDocument/publishDiagnostics",
            (params) =>
              params.uri === uri &&
              (params.diagnostics ?? []).some(
                (diagnostic) => diagnostic.source === "@ttsc/lint",
              ),
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
        const codes = new Set(
          (params.diagnostics ?? [])
            .filter((diagnostic) => diagnostic.source === "@ttsc/lint")
            .map((diagnostic) => diagnostic.code),
        );
        assert.ok(codes.has("no-var"), "expected explicit config diagnostic");
        assert.ok(
          !codes.has("no-console"),
          "default lint.config.json should not override configFile",
        );
      });
    } finally {
      project.cleanup();
    }
  }

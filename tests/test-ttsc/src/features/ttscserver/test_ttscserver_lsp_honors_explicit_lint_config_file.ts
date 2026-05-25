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
    source?: string;
  }[];
};

/**
 * Verifies ttscserver LSP honors an explicit @ttsc/lint config file.
 *
 * The JavaScript launcher serializes project plugin entries into
 * `TTSC_LSP_PLUGINS_JSON` for the Go proxy. This pins the config handoff: a
 * project-level `configFile` must survive into the sidecar invocation instead
 * of falling back to the auto-discovered `lint.config.json` next to tsconfig.
 *
 * 1. Materialize a project with two lint configs: explicit `no-var`, default
 *    `no-console`.
 * 2. Start ttscserver through the JavaScript launcher and open the file.
 * 3. Wait for plugin diagnostics on the edited file.
 * 4. Assert `no-var` is present and `no-console` is absent.
 */
export const test_ttscserver_lsp_honors_explicit_lint_config_file =
  async () => {
    const project = TestLint.createProject({
      name: "ttscserver-lsp-explicit-lint-config",
      pluginConfig: { configFile: "./custom-lint.config.json" },
      source: "var legacy = 1;\nconsole.log(legacy);\n",
      extraSources: {
        "custom-lint.config.json": JSON.stringify(
          { rules: { "no-var": "error" } },
          null,
          2,
        ),
        "lint.config.json": JSON.stringify(
          { rules: { "no-console": "error" } },
          null,
          2,
        ),
      },
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
            (diagnostic) => diagnostic.source === "ttsc/lint",
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
      const codes = new Set(
        (params.diagnostics ?? [])
          .filter((diagnostic) => diagnostic.source === "ttsc/lint")
          .map((diagnostic) => diagnostic.code),
      );
      assert.ok(codes.has("no-var"), "expected explicit config diagnostic");
      assert.ok(
        !codes.has("no-console"),
        "default lint.config.json should not override configFile",
      );
    } finally {
      await shutdownTtscserverClient(client);
      project.cleanup();
    }
  };

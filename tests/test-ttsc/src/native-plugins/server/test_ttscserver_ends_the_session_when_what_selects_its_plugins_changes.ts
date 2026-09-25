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

type Diagnostic = { code?: unknown };
type PublishDiagnosticsParams = { diagnostics?: Diagnostic[]; uri: string };

const SOURCE = "var legacy = 1;\nexport const kept = legacy;\n";

/** Long enough for a cold `@ttsc/lint` build; it only bounds a failure. */
const BUILD_TIMEOUT = 900_000;

/** How long a session may take to act on one watched-file notification. */
const SELECTION_TIMEOUT = 120_000;

/**
 * Verifies a `ttscserver` session ends through the plugin-selection path when
 * what selects its plugins changes: the tsconfig's `compilerOptions.plugins`,
 * or a dependency that publishes a plugin.
 *
 * A session ran the plugins it selected at startup. A tsconfig edit reached it
 * only as a Program refresh, and a project without plugins passed the host no
 * selection inputs at all, so adding or removing a plugin kept the old
 * selection until the user restarted the language server by hand
 * (samchon/ttsc#1511). The config chain and the manifests plugin discovery
 * reads are now selection inputs, as `ttsc --watch` treats them.
 *
 * 1. Start a session on a `no-var` lint project whose tsconfig names no plugin.
 *    Restore `@ttsc/lint` in its `plugins`, report the change, and wait for
 *    `ttsc/pluginSelectionChanged`.
 * 2. Start the next session: it reports `no-var`. Remove the plugin again, report
 *    the change, and wait for `ttsc/pluginSelectionChanged`.
 * 3. Start a session with no plugin, write a `package.json` whose dependencies
 *    include `@ttsc/lint`, which publishes itself as a plugin, report it, and
 *    wait for `ttsc/pluginSelectionChanged`.
 */
export const test_ttscserver_ends_the_session_when_what_selects_its_plugins_changes =
  async () => {
    const project = TestLint.createProject({
      name: "ttscserver-plugin-selection-config",
      rules: { "no-var": "error" },
      source: SOURCE,
    });
    const tsconfig = path.join(project.tmpdir, "tsconfig.json");
    const manifest = path.join(project.tmpdir, "package.json");
    const configured = fs.readFileSync(tsconfig, "utf8");
    const unconfigured = JSON.parse(configured) as {
      compilerOptions: { plugins?: unknown };
    };
    delete unconfigured.compilerOptions.plugins;
    const withoutPlugins = JSON.stringify(unconfigured, null, 2);
    const file = path.join(project.tmpdir, "src", "main.ts");
    const uri = pathToFileURL(file).href;

    /** Start a session and open the file. */
    const start = async (): Promise<TtscserverClient> => {
      const client = TtscserverClient.startLauncher(project.tmpdir, {
        env: { TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR },
      });
      await client.request("initialize", {
        capabilities: {},
        processId: process.pid,
        rootUri: pathToFileURL(project.tmpdir).href,
      });
      client.notify("initialized", {});
      client.notify("textDocument/didOpen", {
        textDocument: {
          languageId: "typescript",
          text: SOURCE,
          uri,
          version: 1,
        },
      });
      return client;
    };
    /** Write `changed`, report it as the editor would, and await the end. */
    const change = async (
      client: TtscserverClient,
      changed: string,
      text: string,
    ): Promise<void> => {
      const selection = client.waitForNotification(
        "ttsc/pluginSelectionChanged",
        () => true,
        SELECTION_TIMEOUT,
      );
      const existed = fs.existsSync(changed);
      fs.writeFileSync(changed, text);
      client.notify("workspace/didChangeWatchedFiles", {
        changes: [{ type: existed ? 2 : 1, uri: pathToFileURL(changed).href }],
      });
      await selection;
    };
    const session = async (
      body: (client: TtscserverClient) => Promise<void>,
    ): Promise<void> => {
      const client = await start();
      try {
        await body(client);
      } finally {
        await shutdownTtscserverClient(client).catch(() => undefined);
      }
    };

    try {
      // 1. A plugin added to the tsconfig.
      fs.writeFileSync(tsconfig, withoutPlugins);
      await session((client) => change(client, tsconfig, configured));

      // 2. The next session runs it; removing it ends that session too.
      await session(async (client) => {
        const published =
          await client.waitForNotification<PublishDiagnosticsParams>(
            "textDocument/publishDiagnostics",
            (params) =>
              params.uri === uri &&
              (params.diagnostics ?? []).some(
                (diagnostic) => diagnostic.code === "no-var",
              ),
            BUILD_TIMEOUT,
          );
        assert.ok(published.diagnostics?.length);
        await change(client, tsconfig, withoutPlugins);
      });

      // 3. A dependency that publishes a plugin.
      const previous = fs.existsSync(manifest)
        ? (JSON.parse(fs.readFileSync(manifest, "utf8")) as Record<
            string,
            unknown
          >)
        : { name: "ttscserver-plugin-selection-config", private: true };
      await session((client) =>
        change(
          client,
          manifest,
          JSON.stringify(
            {
              ...previous,
              dependencies: {
                ...((previous.dependencies as object | undefined) ?? {}),
                "@ttsc/lint": "*",
              },
            },
            null,
            2,
          ),
        ),
      );
    } finally {
      project.cleanup();
    }
  };

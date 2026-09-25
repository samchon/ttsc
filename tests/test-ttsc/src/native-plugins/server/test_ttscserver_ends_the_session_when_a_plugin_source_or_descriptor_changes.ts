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

type Diagnostic = { code?: unknown; message?: string };
type PublishDiagnosticsParams = { diagnostics?: Diagnostic[]; uri: string };

const SOURCE = "var legacy = 1;\nexport const kept = legacy;\n";

/** Long enough for a cold `@ttsc/lint` build; it only bounds a failure. */
const BUILD_TIMEOUT = 900_000;

/** How long a session may take to act on one watched-file notification. */
const SELECTION_TIMEOUT = 120_000;

/**
 * Verifies a `ttscserver` session ends through the plugin-selection path when a
 * plugin's Go source or its descriptor changes, so the editor starts one that
 * runs the current plugin.
 *
 * A session runs the sidecar binaries and capabilities one plugin load resolved
 * at startup, and ended only when a plugin's own declared reload input changed.
 * An edit to a plugin's Go sources, or to its descriptor, was an ordinary file
 * change: the session kept serving the old binary until the user restarted the
 * language server by hand (samchon/ttsc#1507). The launcher now hands the
 * session what its selection was loaded from, and a change to it ends the
 * session like any reload input.
 *
 * 1. Link a copy of `@ttsc/lint` into a `no-var` project, start a session, and
 *    wait for the rule's diagnostic.
 * 2. Change the rule's message in the copy's Go source and report the change as
 *    the editor would: the session announces `ttsc/pluginSelectionChanged`.
 * 3. Start a new session: it reports the new message.
 * 4. Change the copy's descriptor module and report it: that session announces
 *    `ttsc/pluginSelectionChanged` too.
 */
export const test_ttscserver_ends_the_session_when_a_plugin_source_or_descriptor_changes =
  async () => {
    const project = TestLint.createProject({
      name: "ttscserver-plugin-selection-inputs",
      rules: { "no-var": "error" },
      source: SOURCE,
    });
    const workspaceLint = path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "lint",
    );
    // A copy, so the test edits no workspace file; its dependencies resolve
    // through the workspace package's own node_modules.
    const copy = TestProject.tmpdir("ttsc-lint-copy-");
    for (const entry of [
      "package.json",
      "go.mod",
      "go.sum",
      "internal",
      "lib",
      "linthost",
      "plugin",
      "rule",
      "src",
    ]) {
      const from = path.join(workspaceLint, entry);
      if (fs.existsSync(from))
        fs.cpSync(from, path.join(copy, entry), { recursive: true });
    }
    fs.symlinkSync(
      path.join(workspaceLint, "node_modules"),
      path.join(copy, "node_modules"),
      process.platform === "win32" ? "junction" : "dir",
    );
    const link = path.join(project.tmpdir, "node_modules", "@ttsc", "lint");
    fs.rmSync(link, { force: true, recursive: true });
    fs.symlinkSync(
      copy,
      link,
      process.platform === "win32" ? "junction" : "dir",
    );
    const file = path.join(project.tmpdir, "src", "main.ts");
    const uri = pathToFileURL(file).href;

    /** Start a session and return it once the rule answers, with its message. */
    const start = async (): Promise<{
      client: TtscserverClient;
      message: string | undefined;
    }> => {
      const client = TtscserverClient.startLauncher(project.tmpdir, {
        env: { TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR },
      });
      await client.request("initialize", {
        capabilities: {},
        processId: process.pid,
        rootUri: pathToFileURL(project.tmpdir).href,
      });
      client.notify("initialized", {});
      const published = client.waitForNotification<PublishDiagnosticsParams>(
        "textDocument/publishDiagnostics",
        (params) =>
          params.uri === uri &&
          (params.diagnostics ?? []).some(
            (diagnostic) => diagnostic.code === "no-var",
          ),
        BUILD_TIMEOUT,
      );
      client.notify("textDocument/didOpen", {
        textDocument: {
          languageId: "typescript",
          text: SOURCE,
          uri,
          version: 1,
        },
      });
      const message = (await published).diagnostics?.find(
        (diagnostic) => diagnostic.code === "no-var",
      )?.message;
      return { client, message };
    };
    /** Report `changed` as the editor would, and wait for the selection change. */
    const reportChange = async (
      client: TtscserverClient,
      changed: string,
    ): Promise<void> => {
      const selection = client.waitForNotification(
        "ttsc/pluginSelectionChanged",
        () => true,
        SELECTION_TIMEOUT,
      );
      client.notify("workspace/didChangeWatchedFiles", {
        changes: [{ type: 2, uri: pathToFileURL(changed).href }],
      });
      await selection;
    };

    try {
      // 1-2. The rule's Go source.
      const first = await start();
      try {
        assert.equal(
          first.message,
          "Unexpected var, use let or const instead.",
        );
        const rule = path.join(copy, "linthost", "rules_var.go");
        fs.writeFileSync(
          rule,
          fs
            .readFileSync(rule, "utf8")
            .replace(
              '"Unexpected var, use let or const instead."',
              '"Unexpected var, from the edited rule."',
            ),
        );
        await reportChange(first.client, rule);
      } finally {
        await shutdownTtscserverClient(first.client).catch(() => undefined);
      }

      // 3-4. A new session runs the edited rule; its descriptor is an input too.
      const second = await start();
      try {
        assert.equal(second.message, "Unexpected var, from the edited rule.");
        const descriptor = path.join(copy, "lib", "index.js");
        fs.appendFileSync(descriptor, "\n// edited\n");
        await reportChange(second.client, descriptor);
      } finally {
        await shutdownTtscserverClient(second.client).catch(() => undefined);
      }
    } finally {
      project.cleanup();
    }
  };

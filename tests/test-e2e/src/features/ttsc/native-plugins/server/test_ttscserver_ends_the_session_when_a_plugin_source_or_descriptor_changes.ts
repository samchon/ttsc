import { TestLint, TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  PLUGIN_BUILD_TIMEOUT,
  TtscserverClient,
  assert,
  shutdownTtscserverClient,
  waitForTtscserverOutcome,
} from "../../../../internal/ttsc/internal/ttscserver";

type Diagnostic = { code?: unknown; message?: string };
type PublishDiagnosticsParams = { diagnostics?: Diagnostic[]; uri: string };

const SOURCE = "var legacy = 1;\nexport const kept = legacy;\n";

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
 *
 * @evidence contracts/testing.md#behavioral-verification A real session announces selection change after copied Go rule changes and is joined before restart; the next startup returns the edited message and descriptor mutation announces selection change again. Both intentional restart exits preserve native error status1 instead of falsely requiring normal shutdown0.
 * @evidence contracts/testing.md#independent-expectations Original/replacement literal messages and pluginSelectionChanged independently prescribe the original observations. Direct close is separately required before reset; the maintained selection sentinel/native command error-status contract supplies the explicit restart1 expectation, not a fabricated clean-shutdown result.
 * @evidence contracts/testing.md#distinguishing-cases Go-source mutation must affect the next actual binary message; descriptor-only mutation must also end selection even though the diagnostic rule source is unchanged.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this named server export in the generic E2E population. Two actual native startups use a private workspace-package copy and authored editor-style watched-file protocol notifications; these are not kernel-watch events, packed installation or an inferred Program/process total. Source-key units do not prove edited native code reaches the editor.
 * @evidence contracts/e2e.md#necessary-boundary Source fingerprinting, native compilation, launcher manifest and LSP restart policy must agree on the current artifact rather than retaining an old binary or descriptor.
 * @evidence contracts/e2e.md#shared-execution One copied producer/consumer and explicit suite cache carry both sessions; Go-object preparation is available for reuse. Original and edited source/restart are distinct inputs, so canonical immutable source cannot replace the edited rule. Messages and close outcomes do not certify hits, binary-byte identity, total builds/Programs/processes or minimum preparation cost.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The copied package/node_modules link isolate edits from workspace files. Each client is owned immediately on startup; after the original selection notification, direct-child close/status1 is joined before restart. Selection-change sentinel returns1 through the maintained native command/launcher, so it is not incorrectly treated as clean shutdown0. Startup/body/join failure preserves attempted shutdown errors and conservatively retains consumer/copy/already-owned shared cache; no unresolved input is reset or removed. Close is not arbitrary descendant or loaded-image proof.
 * @evidence contracts/e2e.md#preserved-coverage Keeps original message equality, actual source edit, edited-message equality and both selection notifications; no capability stub or cache opt-out substitutes for rebuilt source.
 */
export async function test_ttscserver_ends_the_session_when_a_plugin_source_or_descriptor_changes() {
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
  const realCopy = fs.realpathSync.native(copy);
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
  fs.symlinkSync(copy, link, process.platform === "win32" ? "junction" : "dir");
  const file = path.join(project.tmpdir, "src", "main.ts");
  const uri = pathToFileURL(file).href;
  let activeClient: TtscserverClient | undefined;

  /** Start a session and return it once the rule answers, with its message. */
  const start = async (): Promise<{
    client: TtscserverClient;
    message: string | undefined;
  }> => {
    const client = TtscserverClient.startLauncher(project.tmpdir, {
      env: { TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR },
    });
    activeClient = client;
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
      PLUGIN_BUILD_TIMEOUT,
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
    const code = await waitForTtscserverOutcome(
      client.waitForExit(),
      SELECTION_TIMEOUT,
      "plugin selection notified but direct child close was not joined",
    );
    activeClient = undefined;
    assert.equal(
      code,
      1,
      "plugin-selection restart must propagate the native sentinel exit",
    );
  };

  try {
    // 1-2. The rule's Go source.
    const first = await start();
    assert.equal(first.message, "Unexpected var, use let or const instead.");
    const rule = path.join(copy, "linthost", "rules_var.go");
    assert.equal(fs.lstatSync(rule).isFile(), true);
    const ruleRelative = path.relative(realCopy, fs.realpathSync.native(rule));
    assert.equal(path.isAbsolute(ruleRelative), false);
    assert.notEqual(ruleRelative, "..");
    assert.equal(ruleRelative.startsWith(".." + path.sep), false);
    const originalRule = fs.readFileSync(rule, "utf8");
    const editedRule = originalRule.replace(
      '"Unexpected var, use let or const instead."',
      '"Unexpected var, from the edited rule."',
    );
    assert.notEqual(
      editedRule,
      originalRule,
      "expected to change the copied rule message",
    );
    fs.writeFileSync(rule, editedRule);
    await reportChange(first.client, rule);

    // 3-4. A new session runs the edited rule; its descriptor is an input too.
    const second = await start();
    assert.equal(second.message, "Unexpected var, from the edited rule.");
    const descriptor = path.join(copy, "lib", "index.js");
    assert.equal(fs.lstatSync(descriptor).isFile(), true);
    const descriptorRelative = path.relative(
      realCopy,
      fs.realpathSync.native(descriptor),
    );
    assert.equal(path.isAbsolute(descriptorRelative), false);
    assert.notEqual(descriptorRelative, "..");
    assert.equal(descriptorRelative.startsWith(".." + path.sep), false);
    fs.appendFileSync(descriptor, "\n// edited\n");
    await reportChange(second.client, descriptor);
  } catch (error) {
    const failures: unknown[] = [error];
    const reason =
      "copied plugin-selection session startup, body or join failed";
    try {
      TestProject.retainTemporaryDirectory(project.tmpdir, reason);
    } catch (retentionError) {
      failures.push(retentionError);
    }
    try {
      TestProject.retainTemporaryDirectory(copy, reason);
    } catch (retentionError) {
      failures.push(retentionError);
    }
    try {
      TestProject.retainSharedPluginCache(reason);
    } catch (retentionError) {
      failures.push(retentionError);
    }
    if (activeClient !== undefined) {
      try {
        await waitForTtscserverOutcome(
          shutdownTtscserverClient(activeClient),
          SELECTION_TIMEOUT,
          "failed plugin-selection session shutdown was not joined",
        );
      } catch (shutdownError) {
        failures.push(shutdownError);
      }
    }
    throw new AggregateError(failures, reason);
  }
  project.cleanup();
}

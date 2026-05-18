import * as path from "node:path";
import {
  ExtensionContext,
  OutputChannel,
  commands,
  window,
  workspace,
} from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient | undefined;

/**
 * Resolve the ttscserver launcher the extension should spawn. The extension
 * intentionally ships no binary of its own: every project already owns a ttsc
 * version that pins the right shim of tsgo, so the extension just discovers the
 * workspace's installed launcher.
 *
 * Resolution order:
 *
 * 1. `ttsc.serverPath` setting (absolute path, used verbatim).
 * 2. `require.resolve("ttsc/lib/launcher/ttscserver.js", { paths })` with `paths`
 *    rooted at the directory of the active text editor (so a child project in a
 *    multi-root workspace resolves its own ttsc) and then each workspace
 *    folder. Single-file mode and multi-root workspaces both work.
 *
 * No bare-module fallback: the VSIX bundle ships nothing under
 * `node_modules/ttsc` (the extension declares ttsc as a devDependency for
 * type-checking only), so the fallback would always fail with an opaque "Cannot
 * find module" inside vscode-languageclient. Returning undefined here lets
 * `activate` surface a clean, actionable message.
 */
function resolveServerLauncher(): ServerOptions | undefined {
  const config = workspace.getConfiguration("ttsc");
  const explicit = config.get<string>("serverPath", "").trim();
  const bases = collectResolutionBases();
  if (explicit && path.isAbsolute(explicit)) {
    return {
      command: explicit,
      args: ["--stdio"],
      options: serverProcessOptions(bases[0]),
      transport: TransportKind.stdio,
    };
  }

  for (const base of bases) {
    try {
      const launcher = require.resolve("ttsc/lib/launcher/ttscserver.js", {
        paths: [base],
      });
      return {
        module: launcher,
        args: ["--stdio"],
        options: serverProcessOptions(base),
        transport: TransportKind.stdio,
      };
    } catch {
      /* try the next candidate */
    }
  }

  return undefined;
}

function serverProcessOptions(base?: string) {
  const tsgo = base ? resolveTsgoBinary(base) : undefined;
  if (!base && !tsgo) {
    return undefined;
  }
  return {
    cwd: base,
    env: tsgo
      ? {
          ...process.env,
          TTSC_TSGO_BINARY: tsgo,
        }
      : process.env,
  };
}

function resolveTsgoBinary(base: string): string | undefined {
  try {
    const packageJson = require.resolve(
      "@typescript/native-preview/package.json",
      { paths: [base] },
    );
    const packageRoot = path.dirname(packageJson);
    const platformPackage = `@typescript/native-preview-${process.platform}-${process.arch}`;
    const platformPackageJson = require.resolve(
      `${platformPackage}/package.json`,
      { paths: [packageRoot] },
    );
    return path.join(
      path.dirname(platformPackageJson),
      "lib",
      process.platform === "win32" ? "tsgo.exe" : "tsgo",
    );
  } catch {
    return undefined;
  }
}

/**
 * Build the list of directories Node's `require.resolve` will walk when looking
 * up `ttsc/lib/launcher/ttscserver.js`. The active document's directory takes
 * priority so a monorepo with a child project that pins its own ttsc version
 * resolves to that version. Non-`file:` schemes (Output panel, Git diff,
 * untitled) are skipped because their `fsPath` is synthetic and would walk the
 * entire filesystem root. Workspace folders come next. If both lists are empty
 * (single file opened with no workspace) the function returns an empty slice so
 * `activate` can report the missing project-local ttsc installation. Pushing
 * `process.cwd()` is not useful because the VSCode extension-host cwd is `/`,
 * the install dir, or `C:\Windows\System32` depending on platform, never the
 * user's project.
 */
function collectResolutionBases(): string[] {
  const bases: string[] = [];
  const active = window.activeTextEditor?.document.uri;
  if (active?.scheme === "file") {
    bases.push(path.dirname(active.fsPath));
  }
  for (const folder of workspace.workspaceFolders ?? []) {
    if (folder.uri.scheme === "file") {
      bases.push(folder.uri.fsPath);
    }
  }
  return bases;
}

function buildClientOptions(
  traceChannel: OutputChannel,
): LanguageClientOptions {
  return {
    documentSelector: [
      { scheme: "file", language: "typescript" },
      { scheme: "file", language: "typescriptreact" },
      { scheme: "file", language: "javascript" },
      { scheme: "file", language: "javascriptreact" },
      { scheme: "untitled", language: "typescript" },
      { scheme: "untitled", language: "typescriptreact" },
    ],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher(
        "**/{tsconfig,jsconfig}*.json",
      ),
      configurationSection: "ttsc",
    },
    outputChannelName: "ttsc",
    traceOutputChannel: traceChannel,
  };
}

/**
 * Execute a ttsc-owned workspace command. The server returns the WorkspaceEdit
 * inline in the result; we hand the JSON to VSCode's protocol converter so
 * `documentChanges`, `changeAnnotations`, and `changes` are all applied without
 * a hand-written converter.
 */
async function executeServerCommand(
  command: string,
  uri: string,
): Promise<void> {
  if (!client) {
    window.showWarningMessage("ttsc language server is not running yet.");
    return;
  }
  try {
    const result = await client.sendRequest("workspace/executeCommand", {
      command,
      arguments: [uri],
    });
    if (!result || typeof result !== "object") {
      return;
    }
    const protoEdit = result as Parameters<
      typeof client.protocol2CodeConverter.asWorkspaceEdit
    >[0];
    const edit = await client.protocol2CodeConverter.asWorkspaceEdit(protoEdit);
    if (edit) {
      await workspace.applyEdit(edit);
    }
  } catch (error) {
    window.showErrorMessage(`ttsc command ${command} failed: ${error}`);
  }
}

function activeUri(): string | undefined {
  return window.activeTextEditor?.document.uri.toString();
}

export async function activate(context: ExtensionContext): Promise<void> {
  const serverOptions = resolveServerLauncher();
  if (!serverOptions) {
    window.showErrorMessage(
      "ttsc: could not resolve ttscserver from any workspace folder. Set ttsc.serverPath to an absolute path.",
    );
    return;
  }

  // The trace channel forwards LSP messages verbatim, so we ask for a
  // plain OutputChannel rather than a LogOutputChannel — the latter
  // prepends timestamps and level tags that mangle the wire frames.
  const traceChannel = window.createOutputChannel("ttsc (trace)");
  context.subscriptions.push(traceChannel);

  client = new LanguageClient(
    "ttsc",
    "ttsc",
    serverOptions,
    buildClientOptions(traceChannel),
  );

  context.subscriptions.push(
    commands.registerCommand("ttsc.lint.fixAll", async () => {
      const uri = activeUri();
      if (uri) await executeServerCommand("ttsc.lint.fixAll", uri);
    }),
    commands.registerCommand("ttsc.format.document", async () => {
      const uri = activeUri();
      if (uri) await executeServerCommand("ttsc.format.document", uri);
    }),
    commands.registerCommand("ttsc.server.restart", async () => {
      if (!client) {
        window.showWarningMessage("ttsc: language server is not running.");
        return;
      }
      try {
        await client.restart();
        window.showInformationMessage("ttsc: language server restarted.");
      } catch (error) {
        window.showErrorMessage(`ttsc: restart failed — ${error}`);
      }
    }),
  );

  try {
    await client.start();
  } catch (error) {
    window.showErrorMessage(`ttsc: failed to start language server — ${error}`);
  }
}

export async function deactivate(): Promise<void> {
  if (!client) return;
  try {
    await client.stop();
  } finally {
    client = undefined;
  }
}

import * as path from "node:path";
import {
  ExtensionContext,
  OutputChannel,
  Range,
  RelativePattern,
  Uri,
  WorkspaceEdit,
  WorkspaceFolder,
  commands,
  window,
  workspace,
} from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
} from "vscode-languageclient/node";

import {
  type NormalizedTextEdit,
  collectWorkspaceEditChanges,
  commandArgumentsContainDirtyURI,
  shouldApplyCommandWorkspaceEdit,
  workspaceEditChangesTouchDirtyURI,
} from "./commandEdits";
import {
  createDocumentSelectorPattern,
  createResolutionCandidates,
  createServerLaunchCommand,
  executeCommandIDPrefix,
  filterNonOverlappingCandidates,
  isPathInsideRoot,
  planNonOverlappingClientRoots,
  resolveTtscServerLauncher,
  rootKey,
  rootsInsideRemovedWorkspace,
  rootsToStopForPlan,
  rootsToStopForTarget,
  selectDeepestRootForPath,
  serverProcessOptions,
} from "./serverResolution";

type ServerLaunchSpec = {
  cwd: string;
  id: string;
  name: string;
  serverOptions: ServerOptions;
  workspaceFolder: WorkspaceFolder;
};

type ClientEntry = {
  client: LanguageClient;
  ready: Promise<void>;
  root: string;
};

const clients = new Map<string, ClientEntry>();
let reconcileQueue: Promise<void> = Promise.resolve();
let sharedTraceChannel: OutputChannel | undefined;
let deactivating = false;
const warnedRelativeServerPaths = new Set<string>();

/**
 * Resolve the ttscserver launcher the extension should spawn. The extension
 * intentionally ships no binary of its own: every project already owns a ttsc
 * version that pins the right shim of tsgo, so the extension just discovers the
 * workspace's installed launcher.
 *
 * Resolution order:
 *
 * 1. `ttsc.serverPath` setting (absolute path, used verbatim).
 * 2. Resolve `ttsc/package.json` from the active text editor's directory and each
 *    workspace folder, then use that exported anchor to locate
 *    `bin.ttscserver`.
 *
 * No bare-module fallback: the VSIX bundle ships nothing under
 * `node_modules/ttsc` (the extension declares ttsc as a devDependency for
 * type-checking only), so the fallback would always fail with an opaque "Cannot
 * find module" inside vscode-languageclient. Returning undefined here lets
 * `activate` surface a clean, actionable message.
 */
function resolveServerLaunchSpecs(): ServerLaunchSpec[] {
  const candidates = filterNonOverlappingCandidates(
    collectResolutionCandidates(),
  );
  return createServerLaunchSpecs(candidates);
}

function createServerLaunchSpecs(
  candidates: ReturnType<typeof createResolutionCandidates>,
): ServerLaunchSpec[] {
  const specs: ServerLaunchSpec[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const key = rootKey(candidate.cwd);
    if (seen.has(key)) {
      continue;
    }
    const config = workspace.getConfiguration("ttsc", Uri.file(candidate.cwd));
    const explicit = config.get<string>("serverPath", "").trim();
    const launcher =
      resolveConfiguredServerPath(explicit, candidate.cwd) ??
      resolveTtscServerLauncher(candidate.resolveFrom);
    if (!launcher) {
      continue;
    }
    seen.add(key);
    specs.push({
      cwd: candidate.cwd,
      id: key,
      name: `ttsc (${path.basename(candidate.cwd)})`,
      serverOptions: createServerOptions(launcher, candidate),
      workspaceFolder: workspaceFolderFor(candidate.cwd, specs.length),
    });
  }
  return specs;
}

function resolveConfiguredServerPath(
  configuredPath: string,
  cwd: string,
): string | undefined {
  if (!configuredPath) {
    return undefined;
  }
  if (path.isAbsolute(configuredPath)) {
    return configuredPath;
  }
  const key = `${rootKey(cwd)}\0${configuredPath}`;
  if (!warnedRelativeServerPaths.has(key)) {
    warnedRelativeServerPaths.add(key);
    window.showWarningMessage(
      `ttsc.serverPath must be an absolute path; ignoring ${configuredPath}.`,
    );
  }
  return undefined;
}

function resolveServerLaunchSpecForUri(uri: Uri): ServerLaunchSpec | undefined {
  if (uri.scheme !== "file") return undefined;
  const folder = workspace.getWorkspaceFolder(uri);
  const candidates = createResolutionCandidates({
    activeFile: uri.fsPath,
    activeWorkspaceRoot:
      folder?.uri.scheme === "file" ? folder.uri.fsPath : undefined,
  });
  return createServerLaunchSpecs(candidates)[0];
}

function createServerOptions(
  launcher: string,
  candidate: ReturnType<typeof createResolutionCandidates>[number],
): ServerOptions {
  const launch = createServerLaunchCommand(launcher, candidate);
  return {
    command: launch.command,
    args: launch.args,
    options: serverProcessOptions(candidate.cwd),
  };
}

function workspaceFolderFor(root: string, index: number): WorkspaceFolder {
  const folder = workspace.workspaceFolders?.find(
    (candidate) =>
      candidate.uri.scheme === "file" &&
      path.resolve(candidate.uri.fsPath) === path.resolve(root),
  );
  if (folder) {
    return folder;
  }
  return {
    index,
    name: path.basename(root),
    uri: Uri.file(root),
  };
}

/**
 * Build the list of candidate project roots used for module resolution and
 * server cwd selection. The active document takes priority so a nested package
 * in a multi-root workspace resolves its own ttsc install, but the server cwd
 * is the nearest tsconfig/jsconfig root rather than the document's `src/`
 * directory.
 */
function collectResolutionCandidates() {
  const active = window.activeTextEditor?.document.uri;
  const activeFolder =
    active?.scheme === "file"
      ? workspace.getWorkspaceFolder(active)
      : undefined;
  const activeWorkspaceRoot =
    activeFolder?.uri.scheme === "file" ? activeFolder.uri.fsPath : undefined;
  const workspaceRoots = (workspace.workspaceFolders ?? [])
    .filter((folder) => folder.uri.scheme === "file")
    .map((folder) => folder.uri.fsPath);
  return createResolutionCandidates({
    activeFile: active?.scheme === "file" ? active.fsPath : undefined,
    activeWorkspaceRoot,
    workspaceRoots,
  });
}

/**
 * Build the `vscode-languageclient` options that configure which documents the
 * client handles and how it synchronises configuration with the server.
 *
 * The trace channel is a plain `OutputChannel` (not `LogOutputChannel`) because
 * `vscode-languageclient` owns trace line formatting already.
 */
function buildClientOptions(
  traceChannel: OutputChannel,
  spec: ServerLaunchSpec,
): LanguageClientOptions {
  // vscode-languageclient types this as the protocol string pattern, but the
  // value is passed through to VS Code's DocumentFilter where RelativePattern is
  // supported and keeps roots with glob metacharacters literal.
  const pattern = createDocumentSelectorPattern(
    RelativePattern,
    spec.cwd,
  ) as unknown as string;
  const commandPrefix = executeCommandIDPrefix(spec.cwd);
  return {
    documentSelector: [
      { scheme: "file", language: "typescript", pattern },
      { scheme: "file", language: "typescriptreact", pattern },
      { scheme: "file", language: "javascript", pattern },
      { scheme: "file", language: "javascriptreact", pattern },
    ],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher(
        new RelativePattern(spec.cwd, "**/{tsconfig,jsconfig}*.json"),
      ),
      configurationSection: "ttsc",
    },
    middleware: {
      executeCommand: async (command, args, next) => {
        const shouldApplyEdit = shouldApplyCommandWorkspaceEdit(
          command,
          commandPrefix,
        );
        if (shouldApplyEdit && commandArgumentsContainDirtyDocument(args)) {
          showDiskBackedCommandWarning();
          return null;
        }
        const result = await next(command, args);
        if (shouldApplyEdit) {
          await applyCommandWorkspaceEdit(command, result, args);
        }
        return result;
      },
    },
    outputChannelName: "ttsc",
    traceOutputChannel: traceChannel,
    workspaceFolder: spec.workspaceFolder,
  };
}

async function executeServerCommand(
  command: string,
  uriArg?: string | Uri,
): Promise<void> {
  const target = resolveCommandTarget(uriArg);
  if (!target) return;
  const document = workspace.textDocuments.find(
    (candidate) => candidate.uri.toString() === target.toString(),
  );
  if (document?.isDirty) {
    showDiskBackedCommandWarning();
    return;
  }
  if (!clientEntryForUri(target) && sharedTraceChannel) {
    await ensureClientForUri(target, sharedTraceChannel);
  }
  const entry = clientEntryForUri(target);
  if (!entry) {
    window.showWarningMessage(
      "ttsc language server is not running for this file.",
    );
    return;
  }
  try {
    await entry.ready;
    const result = await entry.client.sendRequest("workspace/executeCommand", {
      command,
      arguments: [target.toString()],
    });
    if (!result || typeof result !== "object") {
      return;
    }
    const protoEdit = result as Parameters<
      typeof entry.client.protocol2CodeConverter.asWorkspaceEdit
    >[0];
    const edit =
      await entry.client.protocol2CodeConverter.asWorkspaceEdit(protoEdit);
    if (edit) {
      if (hasDirtyDocument(target, edit)) {
        showDiskBackedCommandWarning();
        return;
      }
      const applied = await workspace.applyEdit(edit);
      if (!applied) {
        window.showWarningMessage(
          `ttsc command ${command} could not apply the returned edits.`,
        );
      }
    }
  } catch (error) {
    window.showErrorMessage(`ttsc command ${command} failed: ${error}`);
  }
}

function hasDirtyDocument(target: Uri, edit?: WorkspaceEdit): boolean {
  const touched = new Set<string>([target.toString()]);
  for (const [uri] of edit?.entries() ?? []) {
    touched.add(uri.toString());
  }
  return workspace.textDocuments.some(
    (document) => document.isDirty && touched.has(document.uri.toString()),
  );
}

async function applyCommandWorkspaceEdit(
  command: string,
  result: unknown,
  args: readonly unknown[],
): Promise<void> {
  const changes = collectWorkspaceEditChanges(result);
  if (!changes) {
    return;
  }
  if (
    commandArgumentsContainDirtyDocument(args) ||
    workspaceEditChangesTouchDirtyURI(changes, dirtyDocumentURIs())
  ) {
    showDiskBackedCommandWarning();
    return;
  }
  const edit = workspaceEditFromChanges(changes);
  const applied = await workspace.applyEdit(edit);
  if (!applied) {
    window.showWarningMessage(
      `ttsc command ${command} could not apply the returned edits.`,
    );
  }
}

function workspaceEditFromChanges(changes: readonly NormalizedTextEdit[]) {
  const edit = new WorkspaceEdit();
  for (const textEdit of changes) {
    edit.replace(
      Uri.parse(textEdit.uri),
      new Range(
        textEdit.range.start.line,
        textEdit.range.start.character,
        textEdit.range.end.line,
        textEdit.range.end.character,
      ),
      textEdit.newText,
    );
  }
  return edit;
}

function commandArgumentsContainDirtyDocument(
  args: readonly unknown[],
): boolean {
  return commandArgumentsContainDirtyURI(args, dirtyDocumentURIs());
}

function dirtyDocumentURIs(): Set<string> {
  return new Set(
    workspace.textDocuments
      .filter((document) => document.isDirty)
      .map((document) => document.uri.toString()),
  );
}

function showDiskBackedCommandWarning(): void {
  window.showWarningMessage(
    "ttsc plugin fixes and formatting use the saved project state. Save the file before running this command.",
  );
}

function resolveCommandTarget(uriArg?: string | Uri): Uri | undefined {
  if (uriArg instanceof Uri) {
    return uriArg;
  }
  if (typeof uriArg === "string") {
    return path.isAbsolute(uriArg) ? Uri.file(uriArg) : Uri.parse(uriArg);
  }
  return window.activeTextEditor?.document.uri;
}

function clientEntryForUri(uri: Uri): ClientEntry | undefined {
  if (uri.scheme !== "file") return undefined;
  const root = selectDeepestRootForPath(
    uri.fsPath,
    [...clients.values()].map((entry) => entry.root),
  );
  return root ? clients.get(rootKey(root)) : undefined;
}

async function ensureClientForUri(
  uri: Uri,
  traceChannel: OutputChannel,
): Promise<void> {
  await enqueueClientReconciliation(async () => {
    const spec = resolveServerLaunchSpecForUri(uri);
    if (!spec || clients.has(spec.id)) return;
    await stopClientRoots(rootsToStopForTarget(clientRoots(), spec.cwd));
    await startClient(spec, traceChannel);
  });
}

async function reconcileClientsForDocuments(
  documents: readonly { languageId: string; uri: Uri }[],
  traceChannel: OutputChannel,
  fallbackSpecs: readonly ServerLaunchSpec[] = [],
  preferredUri?: Uri,
): Promise<void> {
  const active =
    preferredUri && preferredUri.scheme === "file"
      ? { languageId: "", uri: preferredUri }
      : window.activeTextEditor?.document;
  const activeUri =
    active && (active.languageId === "" || isSupportedDocument(active))
      ? active.uri
      : undefined;
  const orderedDocuments = documents
    .filter(isSupportedDocument)
    .filter((document) => document.uri.toString() !== activeUri?.toString())
    .sort((left, right) => left.uri.fsPath.localeCompare(right.uri.fsPath));
  const specs = new Map<string, ServerLaunchSpec>();
  const pushSpec = (spec: ServerLaunchSpec | undefined) => {
    if (spec && !specs.has(spec.id)) {
      specs.set(spec.id, spec);
    }
  };
  if (activeUri) {
    pushSpec(resolveServerLaunchSpecForUri(activeUri));
  }
  for (const document of orderedDocuments) {
    pushSpec(resolveServerLaunchSpecForUri(document.uri));
  }
  for (const spec of fallbackSpecs) {
    pushSpec(spec);
  }
  const plannedRoots = planNonOverlappingClientRoots(
    [...specs.values()].map((spec) => spec.cwd),
    activeUri ? resolveServerLaunchSpecForUri(activeUri)?.cwd : undefined,
  );
  await stopClientRoots(rootsToStopForPlan(clientRoots(), plannedRoots));
  for (const root of plannedRoots) {
    const spec = specs.get(rootKey(root));
    if (spec && !clients.has(spec.id)) {
      await startClient(spec, traceChannel);
    }
  }
}

async function enqueueClientReconciliation(
  task: () => Promise<void>,
): Promise<void> {
  const guarded = async () => {
    if (deactivating) {
      return;
    }
    await task();
  };
  const run = reconcileQueue.then(guarded, guarded);
  const handled = run.catch((error) => {
    window.showErrorMessage(`ttsc: language server planning failed — ${error}`);
  });
  reconcileQueue = handled;
  await handled;
}

function documentsOutsideRoots(
  documents: readonly { languageId: string; uri: Uri }[],
  roots: readonly string[],
): { languageId: string; uri: Uri }[] {
  if (roots.length === 0) {
    return [...documents];
  }
  return documents.filter(
    (document) =>
      document.uri.scheme !== "file" ||
      !roots.some((root) => isPathInsideRoot(document.uri.fsPath, root)),
  );
}

function clientRoots(): string[] {
  return [...clients.values()].map((entry) => entry.root);
}

async function stopClientRoots(roots: readonly string[]): Promise<void> {
  const results = await Promise.allSettled(
    roots.map((root) => stopClientRoot(root)),
  );
  for (const result of results) {
    if (result.status === "rejected") {
      sharedTraceChannel?.appendLine(
        `ttsc: failed to stop language server: ${result.reason}`,
      );
    }
  }
}

async function stopClientRoot(root: string): Promise<void> {
  const key = rootKey(root);
  const entry = clients.get(key);
  if (!entry) {
    return;
  }
  clients.delete(key);
  await entry.client.stop();
}

function isSupportedDocument(document: {
  languageId: string;
  uri: Uri;
}): boolean {
  return (
    document.uri.scheme === "file" &&
    ["typescript", "typescriptreact", "javascript", "javascriptreact"].includes(
      document.languageId,
    )
  );
}

async function startClient(
  spec: ServerLaunchSpec,
  traceChannel: OutputChannel,
): Promise<void> {
  const client = new LanguageClient(
    "ttsc",
    spec.name,
    spec.serverOptions,
    buildClientOptions(traceChannel, spec),
  );
  const ready = client.start().catch((error) => {
    if (clients.get(spec.id)?.client === client) {
      clients.delete(spec.id);
    }
    window.showErrorMessage(
      `ttsc: failed to start language server for ${spec.cwd} — ${error}`,
    );
    throw error;
  });
  clients.set(spec.id, { client, ready, root: spec.cwd });
  try {
    await ready;
  } catch (error) {
    // Error already surfaced above. Reconciliation keeps going so one broken
    // workspace folder does not prevent other clients from starting.
  }
}

/**
 * VS Code extension entry point — called by the host when the extension is
 * first activated.
 *
 * Resolves the ttscserver launcher, creates the `LanguageClient`, registers the
 * restart command, and starts the language server. Shows a clear error message
 * if the initial launcher cannot be resolved while leaving commands registered
 * so a later file-open or command target can trigger lazy resolution.
 */
export async function activate(context: ExtensionContext): Promise<void> {
  deactivating = false;
  const specs = resolveServerLaunchSpecs();
  if (specs.length === 0) {
    window.showErrorMessage(
      "ttsc: could not resolve ttscserver from the active file or any workspace folder. Set ttsc.serverPath to an absolute path.",
    );
  }

  // Keep this as a plain OutputChannel; vscode-languageclient already prefixes
  // trace lines with its own timestamp and channel markers.
  const traceChannel = window.createOutputChannel("ttsc (trace)");
  sharedTraceChannel = traceChannel;
  context.subscriptions.push(traceChannel);

  context.subscriptions.push(
    commands.registerCommand("ttsc.lint.fixAll", (uri?: string | Uri) =>
      executeServerCommand("ttsc.lint.fixAll", uri),
    ),
    commands.registerCommand("ttsc.format.document", (uri?: string | Uri) =>
      executeServerCommand("ttsc.format.document", uri),
    ),
    commands.registerCommand("ttsc.server.restart", async () => {
      await enqueueClientReconciliation(async () => {
        const active = window.activeTextEditor?.document;
        const activeUri =
          active && isSupportedDocument(active) ? active.uri : undefined;
        await stopClientRoots(clientRoots());
        await reconcileClientsForDocuments(
          workspace.textDocuments,
          traceChannel,
          resolveServerLaunchSpecs(),
          activeUri,
        );
        if (clients.size === 0) {
          window.showWarningMessage(
            "ttsc: language server is not running for any open file.",
          );
        } else {
          window.showInformationMessage("ttsc: language server restarted.");
        }
      });
    }),
    workspace.onDidOpenTextDocument((document) => {
      if (!isSupportedDocument(document)) return;
      void enqueueClientReconciliation(() =>
        reconcileClientsForDocuments(
          workspace.textDocuments,
          traceChannel,
          [],
          document.uri,
        ),
      );
    }),
    workspace.onDidCloseTextDocument((document) => {
      if (!isSupportedDocument(document)) return;
      void enqueueClientReconciliation(() =>
        reconcileClientsForDocuments(workspace.textDocuments, traceChannel),
      );
    }),
    window.onDidChangeActiveTextEditor((editor) => {
      const document = editor?.document;
      void enqueueClientReconciliation(() =>
        reconcileClientsForDocuments(
          workspace.textDocuments,
          traceChannel,
          [],
          document && isSupportedDocument(document) ? document.uri : undefined,
        ),
      );
    }),
    workspace.onDidChangeWorkspaceFolders((event) => {
      void enqueueClientReconciliation(async () => {
        const removedFolders = event.removed
          .filter((folder) => folder.uri.scheme === "file")
          .map((folder) => folder.uri.fsPath);
        const removedRoots: string[] = [];
        for (const folder of event.removed) {
          if (folder.uri.scheme !== "file") continue;
          removedRoots.push(
            ...rootsInsideRemovedWorkspace(clientRoots(), folder.uri.fsPath),
          );
        }
        await stopClientRoots(removedRoots);
        const addedRoots = event.added
          .filter((folder) => folder.uri.scheme === "file")
          .map((folder) => folder.uri.fsPath);
        const addedSpecs = createServerLaunchSpecs(
          createResolutionCandidates({ workspaceRoots: addedRoots }),
        );
        await reconcileClientsForDocuments(
          documentsOutsideRoots(workspace.textDocuments, removedFolders),
          traceChannel,
          addedSpecs,
        );
      });
    }),
    workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration("ttsc.serverPath")) {
        return;
      }
      void enqueueClientReconciliation(async () => {
        const active = window.activeTextEditor?.document;
        const activeUri =
          active && isSupportedDocument(active) ? active.uri : undefined;
        await stopClientRoots(clientRoots());
        await reconcileClientsForDocuments(
          workspace.textDocuments,
          traceChannel,
          resolveServerLaunchSpecs(),
          activeUri,
        );
      });
    }),
  );

  await enqueueClientReconciliation(() =>
    reconcileClientsForDocuments(workspace.textDocuments, traceChannel, specs),
  );
}

/**
 * VS Code extension teardown — called by the host when the extension is
 * deactivated or the window is closed.
 *
 * Stops the language server if it is running and clears the module-level
 * `client` reference so any stale event handlers cannot interact with a stopped
 * client.
 */
export async function deactivate(): Promise<void> {
  deactivating = true;
  const teardown = reconcileQueue
    .then(async () => {
      const stopping = [...clients.values()].map((entry) =>
        entry.client.stop(),
      );
      clients.clear();
      const results = await Promise.allSettled(stopping);
      for (const result of results) {
        if (result.status === "rejected") {
          sharedTraceChannel?.appendLine(
            `ttsc: failed to stop language server during deactivate: ${result.reason}`,
          );
        }
      }
    })
    .finally(() => {
      sharedTraceChannel = undefined;
    });
  reconcileQueue = teardown.catch(() => {});
  await teardown;
}

import * as path from "node:path";
import {
  ExtensionContext,
  FileSystemWatcher,
  LogOutputChannel,
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
  CloseAction,
  type ErrorHandler,
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
  type ExpectedServerRestartHandler,
  createExpectedServerRestartHandler,
} from "./expectedServerRestart";
import {
  type ResolutionCandidate,
  createDocumentSelectorPattern,
  createResolutionCandidates,
  createServerExecutable,
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
} from "./serverResolution";

type ServerLaunchSpec = {
  candidate: ResolutionCandidate;
  cwd: string;
  id: string;
  launcher: string;
  name: string;
  workspaceFolder: WorkspaceFolder;
};

type ClientEntry = {
  client: TtscLanguageClient;
  id: string;
  ready: Promise<void>;
  root: string;
  watcher: FileSystemWatcher;
};

const METHOD_PLUGIN_SELECTION_CHANGED = "ttsc/pluginSelectionChanged";
const expectedRestartHandlers = new WeakMap<
  TtscLanguageClient,
  ExpectedServerRestartHandler
>();

class TtscLanguageClient extends LanguageClient {
  public override createDefaultErrorHandler(
    maxRestartCount?: number,
  ): ErrorHandler {
    const controller = createExpectedServerRestartHandler(
      super.createDefaultErrorHandler(maxRestartCount),
      {
        action: CloseAction.Restart,
        handled: true,
        message: "ttsc plugin selection changed; restarting language server.",
      },
    );
    expectedRestartHandlers.set(this, controller);
    return controller.errorHandler;
  }

  public expectPluginSelectionRestart(): void {
    expectedRestartHandlers.get(this)?.expectRestart();
  }
}

const clients = new Map<string, ClientEntry>();
let reconcileQueue: Promise<void> = Promise.resolve();
let sharedTraceChannel: LogOutputChannel | undefined;
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
 * types and for the `ttsc/path-identity` source that esbuild bundles into
 * `lib/extension.js`), so the fallback would always fail with an opaque
 * "Cannot find module" inside vscode-languageclient. An empty result lets
 * `activate` surface a clean, actionable message.
 */
function resolveServerLaunchSpecs(): ServerLaunchSpec[] {
  const candidates = filterNonOverlappingCandidates(
    collectResolutionCandidates(),
  );
  return createServerLaunchSpecs(candidates);
}

function createServerLaunchSpecs(
  candidates: readonly ResolutionCandidate[],
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
      candidate,
      cwd: candidate.cwd,
      id: key,
      launcher,
      name: `ttsc (${path.basename(candidate.cwd)})`,
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

/**
 * Resolve the launch spec that serves one file, reusing an earlier answer for
 * the same module-resolution directory and workspace root.
 *
 * The memo belongs to one reconciliation, so a later event rediscovers the
 * project from disk instead of trusting a stale answer.
 */
function resolveServerLaunchSpecForUri(
  uri: Uri,
  memo: Map<string, ServerLaunchSpec | undefined> = new Map(),
): ServerLaunchSpec | undefined {
  if (uri.scheme !== "file") return undefined;
  const folder = workspace.getWorkspaceFolder(uri);
  const activeWorkspaceRoot =
    folder?.uri.scheme === "file" ? folder.uri.fsPath : undefined;
  const memoKey = `${path.dirname(uri.fsPath)}\0${activeWorkspaceRoot ?? ""}`;
  if (memo.has(memoKey)) {
    return memo.get(memoKey);
  }
  const spec = createServerLaunchSpecs(
    createResolutionCandidates({
      activeFile: uri.fsPath,
      activeWorkspaceRoot,
    }),
  )[0];
  memo.set(memoKey, spec);
  return spec;
}

function createServerOptions(
  launcher: string,
  candidate: ResolutionCandidate,
): ServerOptions {
  // `ServerExecutable.options` carries the Node-only `windowsVerbatimArguments`
  // flag that `ExecutableOptions` does not declare; the client forwards it to
  // `child_process.spawn` verbatim, so it is structurally compatible here.
  return createServerExecutable(launcher, candidate);
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
 * Vscode-languageclient 10 uses the channel's log level and structured trace
 * methods, so the shared trace sink must be a `LogOutputChannel`.
 */
function buildClientOptions(
  traceChannel: LogOutputChannel,
  spec: ServerLaunchSpec,
  watcher: FileSystemWatcher,
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
      fileEvents: watcher,
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
    workspaceEditChangesTouchDirtyURI(
      changes,
      dirtyDocumentURIs(),
      canonicalDocumentURI,
    )
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
  return commandArgumentsContainDirtyURI(
    args,
    dirtyDocumentURIs(),
    canonicalDocumentURI,
  );
}

/**
 * Spell a file URI the way the editor does, so a server's `file:///C:/x` and
 * the editor's `file:///c%3A/x` compare equal. Other strings stay unchanged.
 */
function canonicalDocumentURI(value: string): string {
  if (!/^file:/i.test(value)) {
    return value;
  }
  try {
    return Uri.parse(value, true).toString();
  } catch {
    return value;
  }
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
  const root = selectDeepestRootForPath(uri.fsPath, clientRoots());
  return root ? findClientEntry(root) : undefined;
}

/**
 * Find the client entry for a root taken from clientRoots(). The stored root
 * spelling is matched first because its identity key is observed from the
 * filesystem and can change after the entry was created, for example when the
 * directory behind a link is removed.
 */
function findClientEntry(root: string): ClientEntry | undefined {
  for (const entry of clients.values()) {
    if (entry.root === root) {
      return entry;
    }
  }
  return clients.get(rootKey(root));
}

async function ensureClientForUri(
  uri: Uri,
  traceChannel: LogOutputChannel,
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
  traceChannel: LogOutputChannel,
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
  const memo = new Map<string, ServerLaunchSpec | undefined>();
  const activeSpec = activeUri
    ? resolveServerLaunchSpecForUri(activeUri, memo)
    : undefined;
  pushSpec(activeSpec);
  for (const document of orderedDocuments) {
    pushSpec(resolveServerLaunchSpecForUri(document.uri, memo));
  }
  for (const spec of fallbackSpecs) {
    pushSpec(spec);
  }
  const plannedRoots = planNonOverlappingClientRoots(
    [...specs.values()].map((spec) => spec.cwd),
    activeSpec?.cwd,
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
  const entry = findClientEntry(root);
  if (!entry) {
    return;
  }
  clients.delete(entry.id);
  try {
    await entry.client.stop();
  } finally {
    entry.watcher.dispose();
  }
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
  traceChannel: LogOutputChannel,
): Promise<void> {
  const watcher = workspace.createFileSystemWatcher(
    new RelativePattern(spec.cwd, "**/{tsconfig,jsconfig}*.json"),
  );
  try {
    const client = new TtscLanguageClient(
      "ttsc",
      spec.name,
      createServerOptions(spec.launcher, spec.candidate),
      buildClientOptions(traceChannel, spec, watcher),
    );
    client.onNotification(METHOD_PLUGIN_SELECTION_CHANGED, () => {
      client.expectPluginSelectionRestart();
    });
    const ready = client.start().catch((error) => {
      if (clients.get(spec.id)?.client === client) {
        clients.delete(spec.id);
      }
      watcher.dispose();
      window.showErrorMessage(
        `ttsc: failed to start language server for ${spec.cwd} — ${error}`,
      );
      throw error;
    });
    clients.set(spec.id, {
      client,
      id: spec.id,
      ready,
      root: spec.cwd,
      watcher,
    });
    try {
      await ready;
    } catch (error) {
      // Error already surfaced above. Reconciliation keeps going so one broken
      // workspace folder does not prevent other clients from starting.
    }
  } catch (error) {
    watcher.dispose();
    throw error;
  }
}

/**
 * Register extension commands and workspace events, then reconcile
 * project-owned language clients.
 *
 * One serialized queue prevents overlapping root plans. Active documents select
 * their own project; startup failures are shown and remove the failed entry
 * while other roots continue. Client entries own config watchers; subscriptions
 * own command and event handlers and the trace channel.
 *
 * @evidence contracts/common.md#principled-implementation
 *   VS Code commands/events, RelativePattern, WorkspaceEdit and the
 *   LanguageClient subclass error-handler override are supported extension
 *   points. Extension-owned client routing, warning history and trace state
 *   change through these boundaries.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Activation registers editor boundaries and delegates root planning, client
 *   lifetime and saved-state edits to named helpers. One queue serializes all
 *   reconciliation, including command-initiated startup and workspace events.
 *
 * @evidence contracts/performance.md#efficient-algorithms
 *   Reconciliation sorts d open documents and plans r roots in O(d log d +
 *   r squared) local work beyond project discovery. Root sets are workspace
 *   projects, not source files. Each event rediscovers projects from disk, with
 *   one upward config walk and one launcher and toolchain resolution per
 *   distinct document directory, not per document.
 *
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The client map and each entry's ready promise share existing and in-flight
 *   clients by physical root identity. Within one reconciliation, documents in
 *   the same directory share one discovery result, and the active launch spec
 *   serves both the candidate set and the preferred-root decision. Server
 *   launch options are built only when a client starts. Later events rediscover
 *   configuration instead of caching stale disk state.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The context owns subscriptions and the trace channel. Client entries own
 *   transports and config watchers for planned roots; superseded roots stop
 *   before replacements, failed starts release watchers, and deactivation
 *   stops and releases all entries.
 *   Serialized event tasks remain queued until processed; there is no hard
 *   backlog cap, and stop failures are reported rather than certified as release.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Disk-backed commands reject dirty targets before sending and before
 *   applying results; real server failures are surfaced without test-mode
 *   branches or replaced foreign methods.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   File URIs use Uri.fsPath for Node resolution and Uri.parse/Uri.file at
 *   explicit conversion boundaries. Shared root identity handles native
 *   aliases; server launchers use platform-specific argument preparation.
 *   Protocol ranges remain zero-based UTF-16, not compiler byte offsets.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc separates command/event registration, serialized reconciliation,
 *   startup failure handling and subscription ownership. Purpose, conditions
 *   and reasons use separate native paragraphs under the documentation skill;
 *   member comments remain beside their fields.
 */
export async function activate(context: ExtensionContext): Promise<void> {
  deactivating = false;
  warnedRelativeServerPaths.clear();
  const specs = resolveServerLaunchSpecs();
  if (specs.length === 0) {
    window.showErrorMessage(
      "ttsc: could not resolve ttscserver from the active file or any workspace folder. Set ttsc.serverPath to an absolute path.",
    );
  }

  const traceChannel = window.createOutputChannel("ttsc (trace)", {
    log: true,
  });
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
          for (const root of rootsInsideRemovedWorkspace(
            clientRoots(),
            folder.uri.fsPath,
          )) {
            removedRoots.push(root);
          }
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
      warnedRelativeServerPaths.clear();
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
 * Stop every retained language client and release its config watcher after
 * queued reconciliation, then clear the shared trace reference.
 *
 * The deactivating flag makes queued startup tasks no-ops. Promise.allSettled
 * attempts every stop and logs rejected stops, so one failure does not prevent
 * other client teardown. Each watcher is released even when its client stop
 * rejects.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The supported LanguageClient.stop lifecycle and Promise queue own
 *   teardown. Clearing the owned map before awaiting stops prevents stale
 *   routing; errors are reported instead of pretending every process stopped.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One teardown waits for reconciliation and collects all stop outcomes.
 *   The finalizer clears the trace reference even if teardown fails, while
 *   the deactivating flag prevents queued work from reopening clients.
 *
 * @evidence contracts/performance.md#efficient-algorithms
 *   With r retained clients, teardown creates O(r) stop promises and inspects
 *   O(r) outcomes. Promise.allSettled lets independent stops proceed together
 *   and preserves each rejection for reporting.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Client stops are ownership-ending effects, not equivalent computations to
 *   cache or share across subsequent activation sessions.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The extension clears client routing, awaits every retained transport's
 *   stop and releases its watcher, trace reference and warning history. Context
 *   subscriptions own editor registrations and channel disposal. Rejected
 *   stops are logged; successful OS process release is not assumed on failure.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No foreign methods or host globals are patched.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   No new process command or filesystem operation occurs here. Each client
 *   owns its supported native transport shutdown; all roots follow the same
 *   settled-results policy.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains the deactivation flag, queue ordering, all-client stop
 *   attempts and rejected-stop logging so one failure does not skip teardown.
 *   Purpose, conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 */
export async function deactivate(): Promise<void> {
  deactivating = true;
  const teardown = reconcileQueue
    .then(async () => {
      const stopping = [...clients.values()].map(async (entry) => {
        try {
          await entry.client.stop();
        } finally {
          entry.watcher.dispose();
        }
      });
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
      warnedRelativeServerPaths.clear();
    });
  reconcileQueue = teardown.catch(() => {});
  await teardown;
}

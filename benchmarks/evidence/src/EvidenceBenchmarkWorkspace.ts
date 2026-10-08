import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import typia from "typia";
import YAML from "yaml";

import { EvidenceBenchmarkLayout } from "./EvidenceBenchmarkLayout";
import { EvidenceBenchmarkRuntime } from "./EvidenceBenchmarkRuntime";
import type { ITtscEvidenceBenchmarkWorkspaceArtifact } from "./structures/ITtscEvidenceBenchmarkWorkspaceArtifact";
import type { ITtscEvidenceBenchmarkWorkspaceRequest } from "./structures/ITtscEvidenceBenchmarkWorkspaceRequest";
import type { ITtscEvidenceBenchmarkWorkspaceResult } from "./structures/ITtscEvidenceBenchmarkWorkspaceResult";
import type { ITtscEvidenceBenchmarkWorkspaceVariables } from "./structures/ITtscEvidenceBenchmarkWorkspaceVariables";

/**
 * Materializes one immutable benchmark workspace before native model work.
 *
 * It applies the selected template treatment, copies opaque requirements,
 * settles the directory before installing path-sensitive dependencies, and
 * commits the neutral baseline before returning the prepared workspace.
 */
export namespace EvidenceBenchmarkWorkspace {
  /**
   * Renders one arm's instructions without creating a measured workspace.
   *
   * The caller owns the returned temporary root and must remove it when its
   * instruction comparison ends; failures remove that root before throwing.
   *
   * @evidence contracts/common.md#principled-implementation Copies the common instruction files, substitutes the supplied variables and applies only AGENTS.md or .agents overlays; the arm's other workspace files cannot enter this instruction-only result.
   * @evidence contracts/common.md#clear-and-simple-design Uses the same renderer and overlay operation as workspace preparation, with a path predicate limiting this operation to its instruction responsibility.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Reads the actual arm overlay and base files rather than returning a precomputed instruction string or modifying a measured cell.
   * @evidence contracts/common.md#meaningful-documentation States the instruction-only role and the returned directory's caller-owned cleanup obligation, including cleanup on failure.
   * @evidence contracts/performance.md#efficient-algorithms Traverses the base instruction tree and overlay once and renders each accepted file once; time and temporary bytes follow the files and their text sizes.
   * @evidence contracts/performance.md#reuse-equivalent-work The shared renderer reuses the preparation policy; each result is a separate caller-owned directory because callers may alter or delete its files and no immutable shared result contract exists.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Owns one mkdtemp root until success transfers it to the caller; any preparation exception removes that exact root, while successful historical roots remain the caller's responsibility.
   * @evidence contracts/portability.md#os-neutral-implementation Native temporary paths and filesystem copy operations use Node APIs; overlay predicates use repository-relative slash spelling and joins convert those segments into native paths.
   */
  export function prepareInstructionSurface(request: {
    repository: string;
    arm: "plain" | "evidence";
    variables: ITtscEvidenceBenchmarkWorkspaceVariables;
  }): string {
    const root: string = fs.mkdtempSync(
      path.join(os.tmpdir(), "evidence-benchmark-instructions-"),
    );
    try {
      const template: string = path.resolve(
        EvidenceBenchmarkLayout.assetsRoot(request.repository),
        "template",
      );
      fs.copyFileSync(
        path.join(template, "base", "AGENTS.md"),
        path.join(root, "AGENTS.md"),
      );
      fs.cpSync(
        path.join(template, "base", ".agents"),
        path.join(root, ".agents"),
        { recursive: true },
      );
      renderBase(root, request.variables);
      applyOverlay(
        path.join(template, request.arm),
        root,
        request.variables,
        (relative) =>
          relative === "AGENTS.md" || relative.startsWith(".agents/"),
      );
      return root;
    } catch (error) {
      fs.rmSync(root, { recursive: true, force: true });
      throw error;
    }
  }

  /**
   * Reinstalls ignored dependencies after a checkpoint workspace is restored.
   *
   * Uses the launching pnpm entry and removes the launcher identity from the
   * child environment. An install error rejects without deleting the restored
   * workspace, which remains owned by the checkpoint recovery operation.
   *
   * @evidence contracts/common.md#principled-implementation Runs the actual package manager against the restored workspace's manifest, lockfile and retained workspace configuration; strips only archive and launcher identity environment inputs that must not enter a measured child.
   * @evidence contracts/common.md#clear-and-simple-design This recovery operation prepares the environment and delegates package-manager execution to the same pnpm/run adapters used for initial preparation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Performs a real install and propagates spawn or nonzero exit failure; no dependency presence check or capability assertion substitutes for installation.
   * @evidence contracts/common.md#meaningful-documentation Documents restored-workspace ownership, the launch-entry requirement and rejection behavior rather than promising atomic recovery.
   * @evidence contracts/performance.md#efficient-algorithms Copies and filters the environment once; dependency graph and byte costs belong to pnpm, whose retained store and lockfile remain available rather than being deleted for every recovery.
   * @evidence contracts/performance.md#reuse-equivalent-work Recovery reuses the workspace's installed/store artifacts when pnpm permits, while each invocation revalidates the restored manifests because a checkpoint can change dependency inputs.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The run adapter owns one child until close or spawn failure, with inherited streams and no retained output buffer; the restored tree stays with its recovery caller. No cancellation signal is exposed by this API, so an abandoned caller must await its child.
   * @evidence contracts/portability.md#os-neutral-implementation Starts process.execPath with npm_execpath as a separate argv element and shell:false, avoiding platform shell quoting and .cmd execution differences; cwd is a native resolved path.
   */
  export async function installDependencies(workspace: string): Promise<void> {
    const environment: NodeJS.ProcessEnv = { ...process.env };
    for (const name of Object.keys(environment))
      if (name.toUpperCase() === "EVIDENCE_BENCHMARK_ARCHIVE")
        delete environment[name];
    // Restoring a checkpoint installs the same way preparation does, so it must
    // strip the launching agent's identity for the same reason.
    EvidenceBenchmarkRuntime.stripLauncherIdentity(environment);
    await pnpm(
      ["install", "--no-frozen-lockfile"],
      path.resolve(workspace),
      environment,
    );
  }

  /**
   * Builds the prepared workspace for one cell at its permanent path.
   *
   * The tree settles at its final path before installation so pnpm's native
   * links target its permanent location. Failure removes the settled root or
   * private staging root; callers must await completion before using the tree.
   *
   * @evidence contracts/common.md#principled-implementation Copies the base and selected overlay, renders variables, copies opaque requirements and exact archives, then settles before pnpm creates path-sensitive links. Neutral catalog/toolchain bindings apply to both arms; only the Evidence dependency and overlay distinguish the treatment.
   * @evidence contracts/common.md#clear-and-simple-design One transaction owns rendering, requirements, archive injection, settlement, installation, executable validation and baseline commit; helpers separate those operations without introducing another preparation path.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Uses real archives, pnpm installation and git baseline publication. It does not edit frozen requirements or repair measured workspaces, and conflicting toolchain bindings or a broken executable reject preparation.
   * @evidence contracts/common.md#meaningful-documentation Describes settlement before installation and the await-before-use requirement; its comment no longer claims the final directory remains invisible during preparation.
   * @evidence contracts/performance.md#efficient-algorithms Each template/requirement/archive tree is copied once, configuration scans are linear in their bytes and exact bindings use maps/sets. Native install and baseline commit costs follow dependency and workspace size; per-arm destination copies are necessary physical deliveries.
   * @evidence contracts/performance.md#reuse-equivalent-work Callers can share immutable packed archives across arms; this operation creates each arm's distinct mutable tree and baseline, so those effectful installs cannot be shared solely because compiler archives match. Restores subsequently retain ignored dependency stores.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Owns one stage and transfers the settled output on success; any exception removes the exact owned stage/output after child close. Returned trees remain caller-owned. Windows shortenVirtualStore places a path-keyed store outside output, whose reclamation is not performed here; this existing retention limitation remains.
   * @evidence contracts/portability.md#os-neutral-implementation Settles before install to preserve Windows junction destinations, uses native resolved paths and argv-based Node/pnpm/git spawning, and shortens/validates executable paths at the explicit Windows CreateProcess boundary rather than inferring filesystem case identity from OS names.
   */
  export async function prepareWorkspace(
    request: ITtscEvidenceBenchmarkWorkspaceRequest,
  ): Promise<ITtscEvidenceBenchmarkWorkspaceResult> {
    const output: string = path.resolve(request.output);
    if (fs.existsSync(output))
      throw new Error(`Benchmark workspace already exists: ${output}.`);
    const parent: string = path.dirname(output);
    fs.mkdirSync(parent, { recursive: true });
    const stage: string = fs.mkdtempSync(path.join(parent, ".tmp-"));
    const workspace: string = path.join(stage, "workspace");
    // Set once the rename succeeds, so a later failure cleans the settled tree
    // rather than a staging directory that no longer exists.
    let settled: string | undefined;
    try {
      const template: string = path.resolve(
        EvidenceBenchmarkLayout.assetsRoot(request.repository),
        "template",
      );
      fs.cpSync(path.join(template, "base"), workspace, { recursive: true });
      renderBase(workspace, request.variables);
      applyOverlay(
        path.join(template, request.arm),
        workspace,
        request.variables,
      );
      const requirements: string = path.resolve(
        EvidenceBenchmarkLayout.assetsRoot(request.repository),
        "requirements",
        request.project,
      );
      const analysis: string = path.join(workspace, "docs", "analysis");
      fs.mkdirSync(path.dirname(analysis), { recursive: true });
      fs.cpSync(requirements, analysis, { recursive: true });
      if (request.arm === "evidence") {
        if (request.artifact === undefined)
          throw new Error("Evidence workspace requires a package artifact.");
        injectEvidence(workspace, request.artifact);
      }
      // Both arms compile with this repository's toolchain, so both receive the
      // same archives. Only the Evidence plugin is an arm treatment.
      copyToolchainArchives(workspace, request.toolchain);
      const environment: NodeJS.ProcessEnv = { ...process.env };
      for (const name of Object.keys(environment))
        if (name.toUpperCase() === "EVIDENCE_BENCHMARK_ARCHIVE")
          delete environment[name];
      // Preparation runs the same package manager the cell will, so it must not
      // carry the launching agent's identity either.
      EvidenceBenchmarkRuntime.stripLauncherIdentity(environment);
      // Settle the workspace before installing into it. A package manager links
      // a workspace dependency by absolute path — pnpm writes a junction on
      // Windows — so an install that runs while the tree is still staged leaves
      // every `packages/*/node_modules/<dep>` pointing at a staging directory
      // the rename then destroys. The delivered tree resolves nothing, and the
      // agent's first act is a repair it should never have had to make.
      fs.renameSync(stage, output);
      settled = path.join(output, "workspace");
      adoptRepositoryCatalog(request.repository, settled);
      overrideToolchainResolution(settled, request.toolchain);
      shortenVirtualStore(settled);
      await pnpm(["install", "--no-frozen-lockfile"], settled, environment);
      assertExecutablesAreRunnable(settled);
      await run("git", ["init", "-b", "benchmark"], settled, environment);
      await run("git", ["add", "-A"], settled, environment);
      await run(
        "git",
        [
          "-c",
          "user.name=Benchmark Runner",
          "-c",
          "user.email=benchmark-runner@localhost",
          "commit",
          "-m",
          "Prepare benchmark workspace",
        ],
        settled,
        environment,
      );
      return {
        root: output,
        workspace: settled,
      };
    } catch (error) {
      fs.rmSync(settled === undefined ? stage : output, {
        recursive: true,
        force: true,
      });
      throw error;
    }
  }
  /**
   * Windows refuses to start a program whose path exceeds `MAX_PATH`.
   *
   * `CreateProcess` has no long-path escape. Node prefixes its own file
   * syscalls with `\\?\`, so a package manager creates these files happily and
   * a directory walk finds them; only the moment something tries to _run_ one
   * does the limit appear, as `The directory name is invalid`.
   */
  const WINDOWS_EXECUTABLE_PATH_LIMIT = 259;

  /**
   * Moves the package manager's virtual store to a short absolute path.
   *
   * A run directory is deep by construction — subject, engine, arm, and a
   * 36-character run id sit under the benchmark's output tree — and pnpm's
   * store adds an encoded package name and a second `node_modules` on top of
   * it. The platform package carries a bundled Go toolchain, whose deepest tool
   * is 142 characters below the workspace root, so the two together put `go
   * build` past `MAX_PATH` and every source-plugin build in the cell fails with
   * a message about a directory rather than about a path length.
   *
   * The store holds hard links, so it goes on the workspace's own drive. Its
   * name is derived from the workspace path rather than randomly, so a resumed
   * or checkpoint-restored run installs into the store it already had.
   */
  function shortenVirtualStore(workspace: string): void {
    if (process.platform !== "win32") return;
    const resolved: string = path.resolve(workspace);
    const digest: string = crypto
      .createHash("sha256")
      .update(resolved.toLowerCase())
      .digest("hex")
      .slice(0, 12);
    const store: string = path.join(
      path.parse(resolved).root,
      ".ttsc-vstore",
      digest,
    );
    const configuration: string = path.join(resolved, ".npmrc");
    const existing: string = fs.existsSync(configuration)
      ? fs.readFileSync(configuration, "utf8").replace(/\s*$/u, "\n")
      : "";
    fs.writeFileSync(
      configuration,
      `${existing}virtual-store-dir=${store}\n`,
      "utf8",
    );
  }

  /**
   * Refuses a workspace holding a program Windows cannot start.
   *
   * The failure this catches is silent in every way that matters: the install
   * succeeds, the tree looks complete, and the cell only discovers it hours
   * later when a build reports a directory name it never named. Measuring that
   * cell measures the path length of its own run directory, so preparation
   * fails here instead, before a model is ever asked to do anything.
   */
  function assertExecutablesAreRunnable(workspace: string): void {
    if (process.platform !== "win32") return;
    const offenders: string[] = [];
    const walk = (directory: string): void => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(directory, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const location: string = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          walk(location);
          continue;
        }
        if (
          entry.name.toLowerCase().endsWith(".exe") &&
          location.length > WINDOWS_EXECUTABLE_PATH_LIMIT
        )
          offenders.push(location);
      }
    };
    walk(path.resolve(workspace));
    if (offenders.length === 0) return;
    throw new Error(
      [
        `The prepared workspace holds ${String(offenders.length)} program(s) Windows cannot start,`,
        `because their paths exceed ${String(WINDOWS_EXECUTABLE_PATH_LIMIT)} characters.`,
        "A cell installed here would fail every build that runs one of them.",
        "",
        ...offenders
          .slice(0, 3)
          .map((file) => `  ${String(file.length)} chars: ${file}`),
      ].join(" "),
    );
  }

  function renderBase(
    root: string,
    variables: ITtscEvidenceBenchmarkWorkspaceVariables,
  ): void {
    visitFiles(root, (file) => {
      const source: string = fs.readFileSync(file, "utf8");
      fs.writeFileSync(file, render(source, variables));
    });
  }
  function applyOverlay(
    overlay: string,
    workspace: string,
    variables: ITtscEvidenceBenchmarkWorkspaceVariables,
    accept: (relative: string) => boolean = () => true,
  ): void {
    if (!fs.existsSync(overlay)) return;
    visitFiles(overlay, (source, relative) => {
      if (!accept(relative)) return;
      const target: string = path.join(workspace, ...relative.split("/"));
      let content: string = fs.readFileSync(source, "utf8");
      if (content.includes("{{base}}")) {
        if (path.extname(source).toLowerCase() !== ".md")
          throw new Error(
            `Only Markdown overlays may splice {{base}}: ${relative}.`,
          );
        const body: string = markdownBody(fs.readFileSync(target, "utf8"));
        const marker = "<!-- benchmark-template-splice: base-body -->";
        content = content
          .replaceAll(`${marker}\n{{base}}`, () => body)
          .replaceAll(`${marker}\r\n{{base}}`, () => body);
      }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, render(content, variables));
    });
  }
  /**
   * Binds requested workspace versions to this repository's catalog.
   *
   * The measured workspace is its own pnpm workspace, so nothing about it
   * follows the repository that packs the plugin into it. That skew is not
   * theoretical: the archive is compiled against this repository's `ttsc` and
   * `@ttsc/lint`, and a workspace pinned to an older pair evaluates the same
   * `lint.config.ts` under a different loader.
   *
   * Repository-governed versions carry `{{version:<package>}}` tokens, which
   * this substitutes from `pnpm-workspace.yaml`. Explicit consumer versions,
   * including the compatible Nestia/typia pair, remain template-owned literals.
   * Text substitution preserves YAML anchors, so a package bound to `*ttsc`
   * follows without needing its own catalog entry.
   *
   * An unknown token throws. A version the template asks for and the repository
   * does not declare is a broken binding, and resolving it to whatever pnpm
   * finds would measure a dependency nobody chose.
   */
  function adoptRepositoryCatalog(repository: string, workspace: string): void {
    const target: string = path.join(workspace, "pnpm-workspace.yaml");
    const source: string = fs.readFileSync(target, "utf8");
    if (!source.includes("{{version:")) return;
    const versions: Map<string, string> = repositoryCatalogVersions(repository);
    const output: string = source.replace(
      /\{\{version:([^}]+)\}\}/g,
      (_match, name: string) => {
        const version: string | undefined = versions.get(name);
        if (version === undefined)
          throw new Error(
            `Benchmark template requests "${name}" from the repository catalog, which does not declare it.`,
          );
        return version;
      },
    );
    fs.writeFileSync(target, output);
  }

  /**
   * Points every packed toolchain package at its local archive.
   *
   * `adoptRepositoryCatalog` substitutes requested repository versions, while
   * the template selects its external consumer dependencies. Published workspace
   * packages need a further binding: `^0.24.0` resolves to whatever the registry
   * last received, so a cell would measure a released compiler while reporting
   * on the tree under test.
   *
   * The binding lands in `overrides` rather than in the catalog for two
   * reasons. pnpm refuses a `file:` entry inside a catalog outright
   * (`ERR_PNPM_CATALOG_ENTRY_INVALID_SPEC`), and the platform package carrying
   * the native compiler binary never appears in the catalog at all, because
   * `ttsc` pulls it as an optional dependency. One override reaches both, and
   * reaches every transitive edge between them as well. Its `file:` path stays
   * relative because pnpm resolves an override against the workspace root: the
   * delivered tree therefore keeps working after the atomic rename and after a
   * checkpoint restore copies it somewhere else.
   *
   * A name the template already overrides throws instead of being appended
   * beside the existing entry. Two keys of one name in one mapping is a file
   * whose meaning depends on which parser reads it.
   */
  function overrideToolchainResolution(
    workspace: string,
    toolchain: readonly ITtscEvidenceBenchmarkWorkspaceArtifact[],
  ): void {
    if (toolchain.length === 0) return;
    const target: string = path.join(workspace, "pnpm-workspace.yaml");
    const source: string = fs.readFileSync(target, "utf8");
    const declared: Record<string, string> | undefined = typia.assert<{
      overrides?: Record<string, string>;
    }>(YAML.parse(source)).overrides;
    for (const artifact of toolchain)
      if (declared?.[artifact.name] !== undefined)
        throw new Error(
          `Benchmark workspace already overrides "${artifact.name}".`,
        );
    // Text insertion rather than a re-emit, for the reason
    // `adoptRepositoryCatalog` substitutes text: re-emitting the parsed
    // document would drop the anchors and the comments the template relies on.
    const eol: string = source.includes("\r\n") ? "\r\n" : "\n";
    const block: string = toolchain
      .map(
        (artifact) =>
          `  ${JSON.stringify(artifact.name)}: ${JSON.stringify(
            `file:.benchmark-deps/${path.basename(artifact.archive)}`,
          )}`,
      )
      .join(eol);
    const heading: RegExpExecArray | null = /^overrides:[ \t]*(?=\r?$)/m.exec(
      source,
    );
    const output: string =
      heading === null
        ? `${source.endsWith(eol) ? source : `${source}${eol}`}${eol}overrides:${eol}${block}${eol}`
        : `${source.slice(0, heading.index + heading[0].length)}${eol}${block}${source.slice(heading.index + heading[0].length)}`;
    fs.writeFileSync(target, output);
  }

  /** Flattens every repository catalog group into one package-to-version map. */
  function repositoryCatalogVersions(repository: string): Map<string, string> {
    const parsed: unknown = YAML.parse(
      fs.readFileSync(path.join(repository, "pnpm-workspace.yaml"), "utf8"),
    );
    const catalogs = typia.assert<{
      catalogs?: Record<string, Record<string, string>>;
    }>(parsed).catalogs;
    const versions: Map<string, string> = new Map();
    for (const group of Object.values(catalogs ?? {}))
      for (const [name, version] of Object.entries(group)) {
        const previous: string | undefined = versions.get(name);
        if (previous !== undefined && previous !== version)
          throw new Error(
            `Repository catalog declares "${name}" as both ${previous} and ${version}.`,
          );
        versions.set(name, version);
      }
    for (const [name, version] of workspacePackageVersions(repository))
      if (!versions.has(name)) versions.set(name, `^${version}`);
    return versions;
  }

  /**
   * Every `name`/`version` pair declared by a package inside `repository`.
   *
   * A template asks for a version by package name, and this workspace's own
   * packages answer no catalog lookup, so their manifests answer instead.
   */
  function workspacePackageVersions(repository: string): Map<string, string> {
    const found: Map<string, string> = new Map();
    for (const group of ["packages", "benchmarks"])
      for (const entry of readDirectoryQuietly(path.join(repository, group))) {
        const manifest: string = path.join(
          repository,
          group,
          entry,
          "package.json",
        );
        if (!fs.existsSync(manifest)) continue;
        const parsed: unknown = JSON.parse(fs.readFileSync(manifest, "utf8"));
        const { name, version } = typia.assert<{
          name?: string;
          version?: string;
        }>(parsed);
        if (name !== undefined && version !== undefined)
          found.set(name, version);
      }
    return found;
  }

  function readDirectoryQuietly(directory: string): string[] {
    try {
      return fs.readdirSync(directory);
    } catch {
      return [];
    }
  }

  function markdownBody(source: string): string {
    const withoutFrontmatter: string = source.replace(
      /^(?:\uFEFF)?---\r?\n[\s\S]*?\r?\n---\r?\n/,
      "",
    );
    return withoutFrontmatter.replace(/^# [^\r\n]*(?:\r?\n){1,2}/, "");
  }
  function render(
    source: string,
    variables: ITtscEvidenceBenchmarkWorkspaceVariables,
  ): string {
    let output: string = source;
    for (const [name, value] of Object.entries(variables))
      output = output.replaceAll(`{{${name}}}`, () => value);
    return output;
  }
  function injectEvidence(
    workspace: string,
    artifact: ITtscEvidenceBenchmarkWorkspaceArtifact,
  ): void {
    const dependency: string = ".benchmark-deps/evidence.tgz";
    const target: string = path.join(workspace, ...dependency.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.resolve(artifact.archive), target);
    const location: string = path.join(workspace, "package.json");
    const manifest = typia.assert<{
      devDependencies?: Record<string, string>;
    }>(JSON.parse(fs.readFileSync(location, "utf8")));
    manifest.devDependencies ??= {};
    manifest.devDependencies[artifact.name] = `file:${dependency}`;
    fs.writeFileSync(location, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  /**
   * Copies every packed toolchain archive beside the workspace it belongs to.
   *
   * The archives live inside the tree, next to the Evidence one, so a snapshot,
   * a restore, or the publishing rename carries them with the workspace. That
   * is what lets {@link overrideToolchainResolution} name each one relatively.
   *
   * An archive that would land on a name already taken throws. A silent
   * overwrite would install one package's bytes under another's name, and the
   * digest a launch pins would still match the file it wrote.
   */
  function copyToolchainArchives(
    workspace: string,
    toolchain: readonly ITtscEvidenceBenchmarkWorkspaceArtifact[],
  ): void {
    for (const artifact of toolchain) {
      const target: string = path.join(
        workspace,
        ".benchmark-deps",
        path.basename(artifact.archive),
      );
      if (fs.existsSync(target))
        throw new Error(
          `Benchmark dependency archive already exists: ${path.basename(artifact.archive)}.`,
        );
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.resolve(artifact.archive), target);
    }
  }
  function visitFiles(
    root: string,
    closure: (file: string, relative: string) => void,
  ): void {
    const visit = (directory: string, relative: string): void => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const child: string = path.posix.join(relative, entry.name);
        const location: string = path.join(root, ...child.split("/"));
        if (entry.isDirectory()) visit(location, child);
        else if (entry.isFile()) closure(location, child);
        else throw new Error(`Template entry is not a regular file: ${child}.`);
      }
    };
    visit(root, "");
  }
  async function pnpm(
    arguments_: readonly string[],
    workspace: string,
    environment: NodeJS.ProcessEnv,
  ): Promise<void> {
    const entrypoint: string | undefined = process.env.npm_execpath;
    if (entrypoint === undefined)
      throw new Error("prepareWorkspace must be launched through pnpm.");
    return run(
      process.execPath,
      [entrypoint, ...arguments_],
      workspace,
      environment,
    );
  }
  async function run(
    command: string,
    arguments_: readonly string[],
    cwd: string,
    environment: NodeJS.ProcessEnv,
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(command, arguments_, {
        cwd,
        env: environment,
        shell: false,
        windowsHide: true,
        stdio: "inherit",
      });
      child.once("error", reject);
      child.once("close", (status) =>
        status === 0
          ? resolve()
          : reject(
              new Error(`${command} exited with status ${String(status)}.`),
            ),
      );
    });
  }
}

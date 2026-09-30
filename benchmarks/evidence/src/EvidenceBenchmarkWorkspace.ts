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
 * installs dependencies, commits the neutral baseline, and publishes the
 * workspace with one atomic rename.
 */
export namespace EvidenceBenchmarkWorkspace {
  /** Renders the current non-product agent instruction surface. */
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

  /** Reinstalls ignored dependencies after a checkpoint workspace is restored. */
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
   * Builds and atomically publishes the prepared workspace for one cell.
   *
   * Failure removes only the private stage directory and never exposes a
   * partially prepared final run path.
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
      adoptRepositoryPatches(request.repository, settled);
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
   * Binds the workspace catalog to this repository's own dependency versions.
   *
   * The measured workspace is its own pnpm workspace, so nothing about it
   * follows the repository that packs the plugin into it. That skew is not
   * theoretical: the archive is compiled against this repository's `ttsc` and
   * `@ttsc/lint`, and a workspace pinned to an older pair evaluates the same
   * `lint.config.ts` under a different loader.
   *
   * The template therefore carries `{{version:<package>}}` where a governed
   * version would go, and this substitutes each one from `pnpm-workspace.yaml`.
   * Keeping the token instead of a literal is what stops the template from
   * stating a version it does not decide, and text substitution preserves the
   * YAML anchors, so a package bound to `*ttsc` follows without needing its own
   * catalog entry.
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
   * Carries exact dependency corrections into both neutral arms.
   *
   * A prepared workspace installs independently of the repository. Catalog
   * versions alone therefore drop native-host corrections recorded in pnpm's
   * patchedDependencies. Repository patches and this benchmark's consumer-owned
   * patches combine as exact package/version bindings. Their bytes and neutral
   * version overrides travel before installation, so both baseline commits and
   * checkpoint restores retain the same dependency implementation without editing either arm's template.
   * Existing bindings, conflicting versions and occupied patch directories are
   * refused before copying. Patch basenames must also remain unique on
   * case-insensitive filesystems.
   *
   * @evidence contracts/common.md#principled-implementation Preparation merges repository and consumer-owned exact selectors, copies their declared regular patch bytes and registers matching neutral version overrides before the actual pnpm install; template configuration and arm treatment remain unchanged.
   * @evidence contracts/common.md#clear-and-simple-design One preparation operation owns patch path validation, case-folded destination collisions, exact version conflicts, copying and YAML mapping insertion, shared by both arm preparations.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The package manager applies actual source corrections; no descriptor capability, compiler response, provenance record or assertion is fabricated and an incompatible patch remains an installation failure.
   * @evidence contracts/common.md#meaningful-documentation Documents independent workspace installation, neutral arm ownership, baseline/checkpoint retention and exact binding/collision refusal rather than claiming that source copying proves emitted provenance.
   * @evidence contracts/performance.md#efficient-algorithms Each exact binding is validated once with map/set lookup and each declared patch is copied once; dominant work is linear in configuration and total patch bytes, with temporary metadata linear in binding count.
   * @evidence contracts/performance.md#reuse-equivalent-work Both neutral arms use the same declared patch and version inputs, but their independent destination trees each require physical copies; baseline commits and checkpoint snapshots carry those files so subsequent restores reuse the prepared dependency implementation.
   * @evidence contracts/performance.md#bound-retention-and-release-resources This synchronous preparation retains only invocation-local mapping metadata; copied patches transfer to the owning workspace and its existing stage cleanup or final workspace lifecycle, while filesystem exhaustion remains a preparation failure.
   * @evidence contracts/portability.md#os-neutral-implementation Native path resolution, realpath and relative containment distinguish repository identity from relative pnpm spelling; joined destination paths use Node filesystem operations, occupied directories are refused including symlinks, and basename collisions are conservatively refused under case folding on every platform.
   */
  export function adoptRepositoryPatches(repository: string, workspace: string): void {
    const repositoryPatches = dependencyBindings(
      fs.readFileSync(path.join(repository, "pnpm-workspace.yaml"), "utf8"),
      "patchedDependencies",
    ) ?? {};
    const consumerPatches = dependencyBindings(
      fs.readFileSync(path.join(EvidenceBenchmarkLayout.assetsRoot(repository), "dependency-patches.json"), "utf8"),
      "patchedDependencies",
    ) ?? {};
    const declared = new Map(Object.entries(repositoryPatches));
    for (const [name, location] of Object.entries(consumerPatches)) {
      if (declared.has(name) && declared.get(name) !== location)
        throw new Error(`Benchmark and repository disagree on dependency patch "${name}".`);
      declared.set(name, location);
    }
    if (declared.size === 0) return;
    const target = path.join(workspace, "pnpm-workspace.yaml");
    const source = fs.readFileSync(target, "utf8");
    const existing = dependencyBindings(source, "patchedDependencies");
    const overrides = dependencyBindings(source, "overrides");
    const repositoryRoot = fs.realpathSync.native(repository);
    const prepared: Array<{ name: string; source: string; relative: string }> = [];
    const destinations = new Set<string>();
    const patchDirectory = path.join(workspace, ".benchmark-patches");
    try {
      fs.lstatSync(patchDirectory);
      throw new Error("Benchmark dependency patch directory is already occupied.");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const versions = new Map<string, string>();
    for (const [name, patch] of declared) {
      if (existing?.[name] !== undefined)
        throw new Error(`Benchmark workspace already patches "${name}".`);
      const separator = name.lastIndexOf("@");
      const packageName = name.slice(0, separator);
      const version = name.slice(separator + 1);
      if (separator <= 0 || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(version))
        throw new Error(`Benchmark dependency patch requires an exact package version: ${name}.`);
      if (versions.has(packageName) || (overrides?.[packageName] !== undefined && overrides[packageName] !== version))
        throw new Error(`Benchmark dependency patch version conflicts for "${packageName}".`);
      versions.set(packageName, version);
      const location = fs.realpathSync.native(path.resolve(repositoryRoot, patch));
      const within = path.relative(repositoryRoot, location);
      if (within === "" || within === ".." || within.startsWith(`..${path.sep}`) || path.isAbsolute(within))
        throw new Error(`Benchmark dependency patch leaves its repository: ${patch}.`);
      if (!fs.statSync(location).isFile())
        throw new Error(`Benchmark dependency patch is not a regular file: ${patch}.`);
      const relative = `.benchmark-patches/${path.basename(location)}`;
      if (destinations.has(relative.toLowerCase()))
        throw new Error(`Benchmark dependency patch destination collides: ${relative}.`);
      destinations.add(relative.toLowerCase());
      prepared.push({ name, source: location, relative });
    }
    const eol = source.includes("\r\n") ? "\r\n" : "\n";
    const block = prepared.map((patch) =>
      `  ${JSON.stringify(patch.name)}: ${JSON.stringify(patch.relative)}`,
    ).join(eol);
    const heading = /^patchedDependencies:[ \t]*(?=\r?$)/m.exec(source);
    if (existing !== undefined && heading === null)
      throw new Error("Benchmark patchedDependencies must use a block mapping.");
    let output = heading === null
      ? `${source.endsWith(eol) ? source : `${source}${eol}`}${eol}patchedDependencies:${eol}${block}${eol}`
      : `${source.slice(0, heading.index + heading[0].length)}${eol}${block}${source.slice(heading.index + heading[0].length)}`;
    const overrideBlock = [...versions].filter(([name]) => overrides?.[name] === undefined).map(([name, version]) =>
      `  ${JSON.stringify(name)}: ${JSON.stringify(version)}`,
    ).join(eol);
    if (overrideBlock !== "") {
      const overrideHeading = /^overrides:[ \t]*(?=\r?$)/m.exec(output);
      if (overrides !== undefined && overrideHeading === null)
        throw new Error("Benchmark dependency overrides must use a block mapping.");
      output = overrideHeading === null
        ? `${output.endsWith(eol) ? output : `${output}${eol}`}${eol}overrides:${eol}${overrideBlock}${eol}`
        : `${output.slice(0, overrideHeading.index + overrideHeading[0].length)}${eol}${overrideBlock}${output.slice(overrideHeading.index + overrideHeading[0].length)}`;
    }
    for (const patch of prepared) {
      const destination = path.join(workspace, ...patch.relative.split("/"));
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(patch.source, destination, fs.constants.COPYFILE_EXCL);
    }
    fs.writeFileSync(target, output);
  }

  /** Reads pnpm patch bindings without requiring a generated typia checker. */
  function dependencyBindings(source: string, field: "patchedDependencies" | "overrides"): Record<string, string> | undefined {
    const document: unknown = YAML.parse(source);
    if (typeof document !== "object" || document === null || Array.isArray(document))
      throw new Error("Benchmark workspace configuration must be an object.");
    const patches: unknown = (document as Record<string, unknown>)[field];
    if (patches === undefined) return undefined;
    if (typeof patches !== "object" || patches === null || Array.isArray(patches) ||
      Object.values(patches).some((value) => typeof value !== "string" || value.length === 0))
      throw new Error(`Benchmark ${field} bindings must contain nonempty strings.`);
    return patches as Record<string, string>;
  }

  /**
   * Points every packed toolchain package at its local archive.
   *
   * `adoptRepositoryCatalog` binds the catalog to the versions this repository
   * declares, which is the right answer for a dependency the repository merely
   * consumes and the wrong one for a package it publishes: `^0.24.0` resolves
   * to whatever the registry last received, so a cell would measure a released
   * compiler while reporting on the tree under test.
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

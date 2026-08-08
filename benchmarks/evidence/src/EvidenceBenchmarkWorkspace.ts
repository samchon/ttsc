import { spawn } from "node:child_process";
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
      overrideToolchainResolution(settled, request.toolchain);
      await pnpm(["install", "--no-frozen-lockfile"], settled, environment);
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

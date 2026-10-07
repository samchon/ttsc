import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { TtscBenchmarkPerformanceCommand } from "./TtscBenchmarkPerformanceCommand.ts";
import { TtscBenchmarkPerformancePackage } from "./TtscBenchmarkPerformancePackage.ts";
import { TtscBenchmarkPerformanceProcess } from "./TtscBenchmarkPerformanceProcess.ts";
import { TtscBenchmarkPerformanceWorktree } from "./TtscBenchmarkPerformanceWorktree.ts";
import type { ITtscBenchmarkPerformanceCell } from "./structures/ITtscBenchmarkPerformanceCell.ts";
import type { ITtscBenchmarkPerformanceCommand } from "./structures/ITtscBenchmarkPerformanceCommand.ts";
import type { ITtscBenchmarkPerformanceProject } from "./structures/ITtscBenchmarkPerformanceProject.ts";
import type { ITtscBenchmarkPerformanceTarball } from "./structures/ITtscBenchmarkPerformanceTarball.ts";

/**
 * Prepares performance fixtures without contaminating measured commands.
 *
 * One instance owns tarball packing, persistent clone refresh, dependency
 * installation, manifest snapshots, stale local-package scrubbing, and pinned
 * TypeScript-Go materialization for a benchmark invocation.
 */
export class TtscBenchmarkPerformanceSetup {
  private static readonly TYPESCRIPT_GO_LEGACY_PACKAGE_REGEXP: RegExp =
    /^@typescript\/native-preview(?:-.+)?$/;

  /**
   * Creates the setup service from the invocation's immutable paths and
   * dependencies.
   *
   * @param options Packing, clone, version, platform, and process policy.
   */
  public constructor(
    private readonly options: TtscBenchmarkPerformanceSetup.IOptions,
  ) {}

  /**
   * Builds the current workspace packages and packs the configured local
   * tarballs.
   *
   * `--no-pack` and `TTSC_BENCH_SKIP_PACK=1` retain the existing staging
   * directory so an explicitly pre-populated tarball set can be reused.
   */
  public packTarballs(): void {
    if (
      this.options.flags.has("--no-pack") ||
      process.env.TTSC_BENCH_SKIP_PACK === "1"
    ) {
      process.stdout.write(
        `Skipping tarball pack; using ${this.options.paths.tarballRoot}\n`,
      );
      return;
    }
    this.options.process.time(
      `pack local ttsc tarballs into ${this.options.paths.tarballRoot}`,
      (): void => {
        fs.mkdirSync(this.options.paths.tarballRoot, { recursive: true });
        this.options.process.shell(
          "pnpm run build",
          this.options.paths.repositoryRoot,
          {
            label: "build current ttsc",
          },
        );
        for (const target of this.options.tarballs) {
          const output: string = path.join(
            this.options.paths.tarballRoot,
            target.file,
          );
          fs.rmSync(output, { force: true });
          this.options.process.shell(
            `pnpm pack --out ${this.options.process.quote(output)}`,
            path.join(this.options.paths.repositoryRoot, target.dir),
            {
              label: `pack ${target.name}`,
            },
          );
        }
      },
    );
  }

  /**
   * Clones or refreshes one fixture branch, installs its dependencies, warms
   * ttsc plugins, runs prerequisites, and restores dependency files.
   *
   * @param project Fixture whose persistent clone is prepared.
   * @param branch Benchmark branch checked out and normalized.
   */
  public setupClone(
    project: ITtscBenchmarkPerformanceProject,
    branch: ITtscBenchmarkPerformanceCell.Branch,
  ): void {
    return this.options.process.time(
      `setup ${project.repoName}@${branch}`,
      (): void => {
        const directory: string = this.options.worktree.cloneDirectory(
          project,
          branch,
        );
        fs.mkdirSync(this.options.paths.workRoot, { recursive: true });
        if (!fs.existsSync(directory)) {
          process.stdout.write(`Cloning ${project.repoName}@${branch}\n`);
          this.options.process.shell(
            `git clone --branch ${this.options.process.quote(branch)} ` +
              `${this.options.process.quote(project.repo)} ` +
              `${this.options.process.quote(directory)}`,
            this.options.paths.workRoot,
            {
              quiet: true,
              label: `clone ${project.repoName}@${branch}`,
            },
          );
        } else if (!fs.existsSync(path.join(directory, ".git"))) {
          throw new Error(`${directory} exists but is not a git clone`);
        }

        const current: string | undefined = this.options.process
          .shell("git branch --show-current", directory, {
            quiet: true,
            check: false,
            timing: false,
          })
          .stdout?.trim();
        if (current && current !== branch) {
          const dirty: string =
            this.options.process.shell("git status --short", directory, {
              quiet: true,
              check: false,
              timing: false,
            }).stdout ?? "";
          if (dirty.trim()) {
            throw new Error(
              `${directory} is on ${current}, expected ${branch}, and has local changes`,
            );
          }
          this.options.process.shell(
            `git checkout ${this.options.process.quote(branch)}`,
            directory,
            {
              quiet: true,
              label: `checkout ${project.repoName}@${branch}`,
            },
          );
        }

        // Refresh reused clones unless the invocation explicitly measures the
        // exact dependency state already present on disk.
        if (!this.options.flags.has("--no-install")) {
          this.options.process.shell(
            `git fetch --depth=1 origin ${this.options.process.quote(branch)}`,
            directory,
            {
              quiet: true,
              check: false,
              label: `fetch ${project.repoName}@${branch}`,
            },
          );
          this.options.process.shell("git reset --hard FETCH_HEAD", directory, {
            quiet: true,
            check: false,
            label: `reset ${project.repoName}@${branch}`,
          });
        }

        this.options.worktree.cleanup(directory, project);
        this.withDependencyFileSnapshot(directory, (): void => {
          this.options.process.ensurePnpmWorkspaceBoundary(project, directory);

          if (!this.options.flags.has("--no-install")) {
            this.installIfNeeded(project, directory, branch);
          }

          if (branch === "ttsc" || branch === "ttsc-lint") {
            const command: string = project.prepareCommand
              ? this.options.process.commandForProject(
                  project.prepareCommand,
                  directory,
                )
              : project.packageManager === "npm"
                ? "npm exec -- ttsc prepare"
                : project.packageManager === "pnpm"
                  ? this.options.process.pnpmProjectCommand(
                      directory,
                      "exec ttsc prepare",
                    )
                  : this.options.process.yarnCommand("exec ttsc prepare");
            const result = this.options.process.shell(command, directory, {
              quiet: true,
              check: false,
              label: `ttsc prepare ${project.repoName}@${branch}`,
            });
            if (result.status !== 0) {
              process.stdout.write(
                `${project.repoName}@${branch}: ttsc prepare exited ${result.status}; ` +
                  "continuing only if this project has no source plugins\n",
              );
            }
          }

          for (const step of TtscBenchmarkPerformanceCommand.normalize(
            project.prerequisites ?? [],
          )) {
            const cwd: string = path.resolve(directory, step.cwd ?? ".");
            const command: string = this.options.process.commandForProject(
              step.cmd,
              directory,
            );
            process.stdout.write(
              `${project.repoName}@${branch}: prerequisite ${command}\n`,
            );
            this.options.process.shell(command, cwd, {
              env: step.env ? { ...process.env, ...step.env } : process.env,
              quiet: true,
              label: `prerequisite ${project.repoName}@${branch}`,
            });
          }
        });
        this.options.worktree.cleanup(directory, project);
      },
    );
  }

  /**
   * Requires every branch-relevant workspace tarball before fixture mutation.
   *
   * @param branch Branch whose package set is required; lint adds `@ttsc/lint`.
   */
  public assertLocalTarballs(
    branch: ITtscBenchmarkPerformanceCell.Branch,
  ): void {
    const missing: string[] = this.localTarballPaths(branch).filter(
      (file: string): boolean => !fs.existsSync(file),
    );
    if (missing.length !== 0) {
      throw new Error(
        "missing local ttsc tarballs; run without --no-pack or populate " +
          `${this.options.paths.tarballRoot}\n` +
          missing.map((file: string): string => `- ${file}`).join("\n"),
      );
    }
  }

  private installIfNeeded(
    project: ITtscBenchmarkPerformanceProject,
    directory: string,
    branch: ITtscBenchmarkPerformanceCell.Branch,
  ): void {
    return this.options.process.time(
      `install ${path.basename(directory)}`,
      (): void => {
        const mustRefreshTarballs: boolean =
          branch === "ttsc" || branch === "ttsc-lint";
        const hasNodeModules: boolean = fs.existsSync(
          path.join(directory, "node_modules"),
        );
        if (
          !mustRefreshTarballs &&
          !this.options.flags.has("--force-install") &&
          hasNodeModules
        ) {
          process.stdout.write(
            `Reusing installed node_modules in ${path.basename(directory)}\n`,
          );
          return;
        }

        const packageManager = project.packageManager;
        if (mustRefreshTarballs) this.assertLocalTarballs(branch);
        const command: string =
          project.installCommand ??
          (packageManager === "pnpm"
            ? this.options.process.pnpmProjectCommand(
                directory,
                "install --no-frozen-lockfile --config.minimumReleaseAge=0",
              )
            : packageManager === "yarn"
              ? this.options.process.yarnCommand(
                  "install --ignore-engines --update-checksums",
                )
              : "npm install --legacy-peer-deps --prefer-online");
        const shouldForceInstall: boolean =
          !hasNodeModules || this.options.flags.has("--force-install");
        const install = (): void => {
          this.options.process.shell(command, directory, {
            label: `install dependencies ${path.basename(directory)}`,
            env:
              packageManager === "yarn"
                ? this.yarnCacheEnvironment()
                : undefined,
          });
        };

        if (mustRefreshTarballs) {
          let installed: boolean = false;
          this.withDependencyFileSnapshot(directory, (): void => {
            const typeScriptGoChanged: boolean =
              this.scrubTypeScriptGoInstallState(directory);
            if (shouldForceInstall || typeScriptGoChanged) {
              process.stdout.write(
                `Installing ${path.basename(directory)} with ${packageManager}\n`,
              );
              this.scrubLocalTarballInstallState(
                directory,
                this.localTarballTargets(branch),
              );
              install();
              installed = true;
            }
          });
          if (!installed) {
            process.stdout.write(
              `Reusing installed node_modules in ${path.basename(directory)}\n`,
            );
          }
        } else if (shouldForceInstall) {
          process.stdout.write(
            `Installing ${path.basename(directory)} with ${packageManager}\n`,
          );
          install();
        } else {
          process.stdout.write(
            `Reusing installed node_modules in ${path.basename(directory)}\n`,
          );
        }

        if (mustRefreshTarballs) {
          this.installLocalTarballs(project, directory, branch);
        }
        if (
          mustRefreshTarballs &&
          !this.hasPinnedTypeScriptGoRuntimeDeps(directory)
        ) {
          this.installPinnedTypeScriptGoRuntimeDeps(project, directory, branch);
        }
      },
    );
  }

  private localTarballTargets(
    branch: ITtscBenchmarkPerformanceCell.Branch,
  ): ITtscBenchmarkPerformanceTarball[] {
    return this.options.tarballs.filter(
      (target: ITtscBenchmarkPerformanceTarball): boolean =>
        branch === "ttsc-lint" || target.name !== "@ttsc/lint",
    );
  }

  private localTarballPaths(
    branch: ITtscBenchmarkPerformanceCell.Branch,
  ): string[] {
    return this.localTarballTargets(branch).map(
      (target: ITtscBenchmarkPerformanceTarball): string =>
        path.join(this.options.paths.tarballRoot, target.file),
    );
  }

  private defaultInstallTarballsCommand(
    packageManager: ITtscBenchmarkPerformanceCommand.PackageManager,
    directory: string,
    specs: string,
  ): string {
    if (packageManager === "pnpm") {
      return this.options.process.ownsPnpmWorkspace(directory)
        ? `pnpm add -w -D --config.minimumReleaseAge=0 ${specs}`
        : `pnpm add --ignore-workspace -D --config.minimumReleaseAge=0 ${specs}`;
    }
    if (packageManager === "yarn") {
      return this.options.process.yarnCommand(
        `add --dev --force --update-checksums --ignore-engines ` +
          `--ignore-workspace-root-check ${specs}`,
      );
    }
    return `npm install --legacy-peer-deps --prefer-online --save-dev ${specs}`;
  }

  private installLocalTarballs(
    project: ITtscBenchmarkPerformanceProject,
    directory: string,
    branch: ITtscBenchmarkPerformanceCell.Branch,
  ): void {
    return this.options.process.time(
      `install local tarballs ${path.basename(directory)}`,
      (): void => {
        this.withDependencyFileSnapshot(directory, (): void => {
          const targets: ITtscBenchmarkPerformanceTarball[] =
            this.localTarballTargets(branch);
          this.scrubLocalTarballInstallState(directory, targets);
          if (project.packageManager === "yarn") {
            this.materializeLocalTarballs(targets, directory);
            return;
          }
          const specs: string = targets
            .map((target: ITtscBenchmarkPerformanceTarball): string =>
              this.options.process.quote(
                path.join(this.options.paths.tarballRoot, target.file),
              ),
            )
            .join(" ");
          const command: string =
            project.installTarballsCommand?.(specs) ??
            this.defaultInstallTarballsCommand(
              project.packageManager,
              directory,
              specs,
            );
          process.stdout.write(
            `Installing local tarballs into ${path.basename(directory)}: ` +
              `${targets.map((target) => target.name).join(", ")}\n`,
          );
          this.options.process.shell(command, directory, {
            label: `install local tarballs ${path.basename(directory)}`,
          });
        });
      },
    );
  }

  private withDependencyFileSnapshot<T>(directory: string, task: () => T): T {
    const snapshot: ITtscBenchmarkPerformanceProject.IDependencyFileSnapshot[] =
      this.snapshotDependencyFiles(directory);
    try {
      return task();
    } finally {
      this.restoreDependencyFiles(snapshot);
    }
  }

  private snapshotDependencyFiles(
    directory: string,
  ): ITtscBenchmarkPerformanceProject.IDependencyFileSnapshot[] {
    const dependencyFileNames: string[] = [
      "package.json",
      "package-lock.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "yarn.lock",
    ];
    const files: Set<string> = new Set(
      this.findProjectFiles(directory, dependencyFileNames),
    );
    for (const name of dependencyFileNames) {
      files.add(path.join(directory, name));
    }
    return [...files].map(
      (
        file: string,
      ): ITtscBenchmarkPerformanceProject.IDependencyFileSnapshot => {
        const exists: boolean = fs.existsSync(file);
        return {
          file,
          exists,
          content: exists ? fs.readFileSync(file, "utf8") : undefined,
        };
      },
    );
  }

  private restoreDependencyFiles(
    snapshot: ITtscBenchmarkPerformanceProject.IDependencyFileSnapshot[],
  ): void {
    for (const entry of snapshot) {
      if (entry.exists) {
        if (entry.content === undefined) {
          throw new Error(
            `dependency snapshot is missing content for ${entry.file}`,
          );
        }
        fs.mkdirSync(path.dirname(entry.file), { recursive: true });
        fs.writeFileSync(entry.file, entry.content);
      } else {
        fs.rmSync(entry.file, { force: true });
      }
    }
  }

  private scrubLocalTarballInstallState(
    directory: string,
    targets: ITtscBenchmarkPerformanceTarball[],
  ): void {
    const specs: Record<string, string> = Object.fromEntries(
      targets.map(
        (target: ITtscBenchmarkPerformanceTarball): [string, string] => [
          target.name,
          `file:${path.join(this.options.paths.tarballRoot, target.file)}`,
        ],
      ),
    );
    for (const packageJson of this.findProjectFiles(
      directory,
      "package.json",
    )) {
      this.rewritePackageJsonTarballs(packageJson, specs);
    }
    for (const workspaceFile of this.findProjectFiles(
      directory,
      "pnpm-workspace.yaml",
    )) {
      this.rewriteTextTarballs(workspaceFile, targets);
    }
    for (const lockfile of this.findProjectFiles(directory, [
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
    ])) {
      const text: string = fs.readFileSync(lockfile, "utf8");
      if (text.includes("ttsc-tgz")) fs.rmSync(lockfile);
    }
    fs.rmSync(path.join(directory, "node_modules", ".pnpm", "lock.yaml"), {
      force: true,
    });
  }

  private scrubTypeScriptGoInstallState(directory: string): boolean {
    let changed: boolean = false;
    for (const packageJson of this.findProjectFiles(
      directory,
      "package.json",
    )) {
      if (this.rewritePackageJsonTarballs(packageJson, {})) {
        changed = true;
      }
    }
    for (const lockfile of this.findProjectFiles(directory, [
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
    ])) {
      const text: string = fs.readFileSync(lockfile, "utf8");
      if (text.includes("@typescript/native-preview")) {
        fs.rmSync(lockfile);
        changed = true;
      }
    }
    fs.rmSync(path.join(directory, "node_modules", ".pnpm", "lock.yaml"), {
      force: true,
    });
    return changed;
  }

  private findProjectFiles(root: string, names: string | string[]): string[] {
    const wanted: Set<string> = new Set(Array.isArray(names) ? names : [names]);
    const skip: Set<string> = new Set([
      ".git",
      "node_modules",
      "dist",
      "lib",
      "out",
    ]);
    const files: string[] = [];
    const walk = (directory: string): void => {
      for (const entry of fs.readdirSync(directory, {
        withFileTypes: true,
      })) {
        if (entry.isDirectory()) {
          if (!skip.has(entry.name)) {
            walk(path.join(directory, entry.name));
          }
        } else if (wanted.has(entry.name)) {
          files.push(path.join(directory, entry.name));
        }
      }
    };
    walk(root);
    return files;
  }

  private rewritePackageJsonTarballs(
    file: string,
    specs: Record<string, string>,
  ): boolean {
    const manifest: Record<string, unknown> =
      TtscBenchmarkPerformancePackage.parseJsonRecord(
        fs.readFileSync(file, "utf8"),
        file,
      );
    let changed: boolean = false;
    let needsTypeScriptGoPin: boolean = false;
    const rewriteMap = (
      map: unknown,
      options: ITtscBenchmarkPerformanceProject.IRewriteMapOptions = {},
    ): void => {
      if (!TtscBenchmarkPerformancePackage.isRecord(map)) return;
      for (const [name, spec] of Object.entries(specs)) {
        const current: unknown = map[name];
        if (typeof current === "string" && current.includes("ttsc-tgz")) {
          map[name] = spec;
          changed = true;
        }
      }
      let needsPlatformTarball: boolean = false;
      for (const [name, current] of Object.entries(map)) {
        if (
          typeof current !== "string" ||
          !current.includes("ttsc-tgz") ||
          specs[name]
        ) {
          continue;
        }
        if (this.options.platform.packages.has(name)) {
          delete map[name];
          needsPlatformTarball = true;
          changed = true;
        } else if (name === "ttsc" || name === "@ttsc/lint") {
          delete map[name];
          changed = true;
        }
      }
      for (const name of Object.keys(map)) {
        if (
          TtscBenchmarkPerformanceSetup.TYPESCRIPT_GO_LEGACY_PACKAGE_REGEXP.test(
            name,
          )
        ) {
          delete map[name];
          needsTypeScriptGoPin = true;
          changed = true;
        }
      }
      if (typeof map.typescript === "string") {
        needsTypeScriptGoPin = true;
        if (
          options.pinTypeScript &&
          map.typescript !== this.options.version.typescriptGo
        ) {
          map.typescript = this.options.version.typescriptGo;
          changed = true;
        }
      }
      if (
        needsPlatformTarball &&
        specs[this.options.platform.packageName] &&
        map[this.options.platform.packageName] !==
          specs[this.options.platform.packageName]
      ) {
        map[this.options.platform.packageName] =
          specs[this.options.platform.packageName];
        changed = true;
      }
    };
    for (const key of [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "overrides",
      "resolutions",
    ]) {
      rewriteMap(manifest[key], { pinTypeScript: true });
    }
    rewriteMap(manifest.peerDependencies);
    rewriteMap(
      TtscBenchmarkPerformancePackage.isRecord(manifest.pnpm)
        ? manifest.pnpm.overrides
        : undefined,
      { pinTypeScript: true },
    );
    if (needsTypeScriptGoPin) {
      const devDependencies: Record<string, unknown> =
        TtscBenchmarkPerformancePackage.isRecord(manifest.devDependencies)
          ? manifest.devDependencies
          : (manifest.devDependencies = {});
      if (devDependencies.typescript !== this.options.version.typescriptGo) {
        devDependencies.typescript = this.options.version.typescriptGo;
        changed = true;
      }
    }
    if (changed) {
      fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
    }
    return changed;
  }

  private rewriteTextTarballs(
    file: string,
    targets: ITtscBenchmarkPerformanceTarball[],
  ): void {
    let text: string = fs.readFileSync(file, "utf8");
    let changed: boolean = false;
    const versionSuffix: string = `-${this.options.version.ttsc}.tgz`;
    for (const target of targets) {
      const stem: string = target.file.endsWith(versionSuffix)
        ? target.file.slice(0, -versionSuffix.length)
        : target.file.replace(/-[\d][\w.-]*\.tgz$/, "");
      const pattern: RegExp = new RegExp(
        `(?:file:)?[^\\s'",}]*ttsc-tgz[^\\s'",}]*/` +
          `${this.escapeRegExp(stem)}-[\\d][\\w.-]*\\.tgz`,
        "g",
      );
      const next: string = text.replace(
        pattern,
        `file:${path.join(this.options.paths.tarballRoot, target.file)}`,
      );
      if (next !== text) {
        text = next;
        changed = true;
      }
    }
    if (changed) fs.writeFileSync(file, text);
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private materializeLocalTarballs(
    targets: ITtscBenchmarkPerformanceTarball[],
    directory: string,
  ): void {
    const nodeModules: string = path.join(directory, "node_modules");
    fs.mkdirSync(nodeModules, { recursive: true });
    fs.mkdirSync(path.join(nodeModules, ".bin"), { recursive: true });
    for (const target of targets) {
      const packageDirectory: string = path.join(
        nodeModules,
        ...target.name.split("/"),
      );
      const temporaryDirectory: string = fs.mkdtempSync(
        path.join(os.tmpdir(), "ttsc-bench-tgz-"),
      );
      try {
        fs.rmSync(packageDirectory, { recursive: true, force: true });
        fs.mkdirSync(path.dirname(packageDirectory), { recursive: true });
        this.options.process.shell(
          `tar --force-local -xzf ${this.options.process.quote(
            this.tarPath(
              path.join(this.options.paths.tarballRoot, target.file),
            ),
          )} -C ${this.options.process.quote(this.tarPath(temporaryDirectory))}`,
          directory,
          { quiet: true },
        );
        fs.cpSync(path.join(temporaryDirectory, "package"), packageDirectory, {
          recursive: true,
        });
      } finally {
        fs.rmSync(temporaryDirectory, { recursive: true, force: true });
      }
      this.linkPackageBins(packageDirectory, nodeModules);
    }
    process.stdout.write(
      `Materialized local tarballs into ${path.basename(directory)}: ` +
        `${targets.map((target) => target.name).join(", ")}\n`,
    );
  }

  private tarPath(file: string): string {
    return this.options.platform.operatingSystem === "win32"
      ? file.replace(/\\/g, "/")
      : file;
  }

  private isErrnoException(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error;
  }

  private linkPackageBins(packageDirectory: string, nodeModules: string): void {
    const packageJson: string = path.join(packageDirectory, "package.json");
    if (!fs.existsSync(packageJson)) return;
    const manifest: Record<string, unknown> =
      TtscBenchmarkPerformancePackage.parseJsonRecord(
        fs.readFileSync(packageJson, "utf8"),
        packageJson,
      );
    const bins: unknown =
      typeof manifest.bin === "string"
        ? {
            [TtscBenchmarkPerformancePackage.requireString(
              manifest.name,
              `${packageJson} has no package name`,
            )]: manifest.bin,
          }
        : manifest.bin;
    if (!TtscBenchmarkPerformancePackage.isRecord(bins)) return;
    const binDirectory: string = path.join(nodeModules, ".bin");
    for (const [name, bin] of Object.entries(bins)) {
      if (typeof bin !== "string") {
        throw new Error(`${packageJson} bin.${name} must be a string`);
      }
      const link: string = path.join(binDirectory, name);
      const target: string = path.relative(
        binDirectory,
        path.join(packageDirectory, bin),
      );
      fs.rmSync(link, { force: true });
      fs.rmSync(`${link}.cmd`, { force: true });
      try {
        fs.symlinkSync(target, link);
      } catch (error) {
        if (
          this.options.platform.operatingSystem !== "win32" ||
          !this.isErrnoException(error) ||
          error.code !== "EPERM"
        ) {
          throw error;
        }
        this.writeWindowsBinShim(link, target);
      }
    }
  }

  private writeWindowsBinShim(link: string, target: string): void {
    const commandTarget: string = target.replace(/\//g, "\\");
    const shellTarget: string = target.replace(/\\/g, "/");
    fs.writeFileSync(
      `${link}.cmd`,
      `@ECHO off\r\nnode "%~dp0\\${commandTarget}" %*\r\n`,
    );
    fs.writeFileSync(
      link,
      '#!/bin/sh\nbasedir=$(dirname "$(echo "$0" | ' +
        `sed -e 's,\\\\,/,g')")\nexec node "$basedir/${shellTarget}" "$@"\n`,
    );
  }

  private installPinnedTypeScriptGoRuntimeDeps(
    project: ITtscBenchmarkPerformanceProject,
    directory: string,
    branch: ITtscBenchmarkPerformanceCell.Branch,
  ): void {
    const specs: string = this.options.process.quote(
      `typescript@${this.options.version.typescriptGo}`,
    );
    const packageManager = project.packageManager;
    const command: string =
      packageManager === "pnpm"
        ? this.options.process.ownsPnpmWorkspace(directory)
          ? `pnpm add -w -D --config.minimumReleaseAge=0 ${specs}`
          : `pnpm add --ignore-workspace --virtual-store-dir ` +
            `node_modules/.pnpm -D --config.minimumReleaseAge=0 ${specs}`
        : packageManager === "yarn"
          ? this.options.process.yarnCommand(
              `add --dev --force --update-checksums --ignore-engines ` +
                `--ignore-workspace-root-check ${specs}`,
            )
          : `npm install --legacy-peer-deps --ignore-scripts ` +
            `--prefer-online --save-dev ${specs}`;
    process.stdout.write(
      `Installing pinned TypeScript-Go runtime deps into ${path.basename(directory)}: ` +
        `typescript@${this.options.version.typescriptGo}\n`,
    );
    this.withDependencyFileSnapshot(directory, (): void => {
      this.scrubLocalTarballInstallState(
        directory,
        this.localTarballTargets(branch),
      );
      this.options.process.shell(command, directory, {
        env:
          packageManager === "yarn" ? this.yarnCacheEnvironment() : undefined,
      });
    });
  }

  private yarnCacheEnvironment(): NodeJS.ProcessEnv {
    return { ...process.env, YARN_CACHE_FOLDER: ".yarn-cache" };
  }

  private hasPinnedTypeScriptGoRuntimeDeps(directory: string): boolean {
    return (
      TtscBenchmarkPerformancePackage.dependencyVersion(
        directory,
        "typescript",
      ) === this.options.version.typescriptGo
    );
  }
}

/** Constructor contracts for {@link TtscBenchmarkPerformanceSetup}. */
export namespace TtscBenchmarkPerformanceSetup {
  /** Filesystem roots used by packing and persistent fixture setup. */
  export interface IPaths {
    /** Absolute repository root containing the workspace packages to pack. */
    repositoryRoot: string;

    /** Absolute root containing persistent per-branch fixture clones. */
    workRoot: string;

    /** Absolute staging root containing deterministic local package archives. */
    tarballRoot: string;
  }

  /** Versions whose exact values are materialized into fixture dependencies. */
  export interface IVersion {
    /** Current ttsc package version embedded in local tarball filenames. */
    ttsc: string;

    /** Lockfile-selected TypeScript-Go runtime version installed in fixtures. */
    typescriptGo: string;
  }

  /** Platform package identity and operating-system behavior for local archives. */
  export interface IPlatform {
    /** Current `@ttsc/*` platform package installed from the local tarball. */
    packageName: string;

    /** Complete platform package set removed when stale tarballs are scrubbed. */
    packages: ReadonlySet<string>;

    /** Host operating system used for tar paths and Windows bin shims. */
    operatingSystem: NodeJS.Platform;
  }

  /** Immutable setup policy and shared services for one benchmark invocation. */
  export interface IOptions {
    /** Repository, clone, and tarball staging roots for setup mutations. */
    paths: IPaths;

    /** Parsed command-line flags controlling pack, install, and refresh work. */
    flags: ReadonlySet<string>;

    /** Workspace package archives packed and installed into ttsc fixtures. */
    tarballs: readonly ITtscBenchmarkPerformanceTarball[];

    /** Pinned ttsc and TypeScript-Go versions applied during setup. */
    version: IVersion;

    /** Current platform package and operating-system behavior. */
    platform: IPlatform;

    /** Shared untimed command runner used for all setup subprocesses. */
    process: TtscBenchmarkPerformanceProcess;

    /** Persistent clone lifecycle service used before and after installation. */
    worktree: TtscBenchmarkPerformanceWorktree;
  }
}

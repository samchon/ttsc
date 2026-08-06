import os from "node:os";
import path from "node:path";

import { TtscBenchmarkConstant } from "./TtscBenchmarkConstant.ts";
import { TtscBenchmarkObject } from "./TtscBenchmarkObject.ts";
import { TtscBenchmarkPerformanceCell } from "./TtscBenchmarkPerformanceCell.ts";
import { TtscBenchmarkPerformanceConfiguration } from "./TtscBenchmarkPerformanceConfiguration.ts";
import { TtscBenchmarkPerformanceConstant } from "./TtscBenchmarkPerformanceConstant.ts";
import { TtscBenchmarkPerformanceMeasurement } from "./TtscBenchmarkPerformanceMeasurement.ts";
import { TtscBenchmarkPerformanceOption } from "./TtscBenchmarkPerformanceOption.ts";
import { TtscBenchmarkPerformancePackage } from "./TtscBenchmarkPerformancePackage.ts";
import { TtscBenchmarkPerformanceProcess } from "./TtscBenchmarkPerformanceProcess.ts";
import { TtscBenchmarkPerformanceReport } from "./TtscBenchmarkPerformanceReport.ts";
import { TtscBenchmarkPerformanceRunner } from "./TtscBenchmarkPerformanceRunner.ts";
import { TtscBenchmarkPerformanceSetup } from "./TtscBenchmarkPerformanceSetup.ts";
import { TtscBenchmarkPerformanceVerifier } from "./TtscBenchmarkPerformanceVerifier.ts";
import { TtscBenchmarkPerformanceWorktree } from "./TtscBenchmarkPerformanceWorktree.ts";
import type { ITtscBenchmarkPerformanceProject } from "./structures/ITtscBenchmarkPerformanceProject.ts";
import type { ITtscBenchmarkPerformanceTarball } from "./structures/ITtscBenchmarkPerformanceTarball.ts";

/**
 * Composes the performance benchmark services and applies command-line policy.
 *
 * Keeping composition outside the executable wrapper makes the wrapper location
 * explicit while leaving setup and measurement behavior injectable.
 */
export namespace TtscBenchmarkPerformanceExecutable {
  /**
   * Resolves one CLI invocation and delegates it to the performance runner.
   *
   * @param executableDirectory Absolute directory containing the performance
   *   wrappers, including the tsconfig-file selector.
   */
  export async function main(executableDirectory: string): Promise<void> {
    const { cellFilters, flags, projectArgs, positional } =
      TtscBenchmarkPerformanceOption.parse(process.argv.slice(2));
    const repositoryRoot = TtscBenchmarkConstant.REPOSITORY_ROOT;
    const workRoot =
      process.env.TTSC_BENCH_WORK ?? TtscBenchmarkConstant.WORK_ROOT;
    const tarballRoot =
      process.env.TTSC_BENCH_TGZ ??
      path.join(
        os.tmpdir(),
        flags.has("--no-pack") ? "ttsc-tgz" : `ttsc-tgz-${process.pid}`,
      );
    // Anchored to the root this run resolved, not to the package constant.
    // `TTSC_BENCH_WORK` exists so a sweep can put its clones on another volume;
    // leaving the report behind splits one run's state across two roots and
    // lets two runs isolated by that variable overwrite each other's report.
    const outputMarkdown =
      process.env.TTSC_BENCH_OUT ?? path.resolve(workRoot, "report.md");
    const websiteJson = path.resolve(
      repositoryRoot,
      "website",
      "public",
      "benchmark",
      "performance.json",
    );
    const reportJson = outputMarkdown.replace(/\.md$/, ".json");
    const checkpointJson =
      process.env.TTSC_BENCH_CHECKPOINT ??
      path.resolve(workRoot, "benchmark.checkpoint.json");
    const tsconfigFiles = path.join(executableDirectory, "tsconfig-files.ts");

    const runs = TtscBenchmarkPerformanceOption.number("TTSC_BENCH_RUNS", 5);
    const warmup = TtscBenchmarkPerformanceOption.number(
      "TTSC_BENCH_WARMUP",
      1,
      { allowZero: true },
    );
    const retries = TtscBenchmarkPerformanceOption.number(
      "TTSC_BENCH_RETRIES",
      2,
    );
    const performanceProcess = new TtscBenchmarkPerformanceProcess({
      tsconfigFiles,
      verbose: flags.has("--verbose"),
    });
    const cell: TtscBenchmarkPerformanceCell.IOptions = {
      cellFilters,
      flags,
    };
    const worktree = new TtscBenchmarkPerformanceWorktree({
      workRoot,
      cell,
      process: performanceProcess,
    });
    const measurement = new TtscBenchmarkPerformanceMeasurement({
      runs,
      warmup,
      retries,
      process: performanceProcess,
      worktree,
    });
    const verifier = new TtscBenchmarkPerformanceVerifier({
      cell,
      process: performanceProcess,
      worktree,
    });
    const ttscVersion = TtscBenchmarkPerformancePackage.readRequiredVersion(
      path.join(repositoryRoot, "packages/ttsc/package.json"),
    );
    const typescriptGoVersion = TtscBenchmarkPerformancePackage.requireString(
      TtscBenchmarkPerformancePackage.readTypeScriptGoLockVersion(
        repositoryRoot,
      ) ??
        TtscBenchmarkPerformancePackage.version(
          path.join(repositoryRoot, "node_modules", "typescript"),
        ) ??
        TtscBenchmarkPerformancePackage.readTypeScriptGoCatalogVersion(
          repositoryRoot,
        ),
      "unable to resolve the pinned TypeScript-Go version",
    );
    const platformKey = `${process.platform}-${process.arch}`;
    const platformPackage = `@ttsc/${platformKey}`;
    const tarballs: ITtscBenchmarkPerformanceTarball[] = [
      {
        dir: "packages/ttsc",
        file: `ttsc-${ttscVersion}.tgz`,
        name: "ttsc",
      },
      {
        dir: "packages/lint",
        file: `ttsc-lint-${ttscVersion}.tgz`,
        name: "@ttsc/lint",
      },
      {
        dir: `packages/ttsc-${platformKey}`,
        file: `ttsc-${platformKey}-${ttscVersion}.tgz`,
        name: platformPackage,
      },
    ];
    const setup = new TtscBenchmarkPerformanceSetup({
      paths: {
        repositoryRoot,
        workRoot,
        tarballRoot,
      },
      flags,
      tarballs,
      version: {
        ttsc: ttscVersion,
        typescriptGo: typescriptGoVersion,
      },
      platform: {
        packageName: platformPackage,
        packages: TtscBenchmarkPerformanceConstant.PLATFORM_PACKAGES,
        operatingSystem: process.platform,
      },
      process: performanceProcess,
      worktree,
    });

    const projects: ITtscBenchmarkPerformanceProject[] = [
      ...TtscBenchmarkPerformanceConfiguration.PROJECTS,
    ];
    const report = new TtscBenchmarkPerformanceReport({
      checkpointJson,
      legacyTypescriptDisplayVersion:
        TtscBenchmarkPerformanceConstant.LEGACY_TYPESCRIPT_DISPLAY_VERSION,
      outputMarkdown,
      projects,
      publishWebsite: !flags.has("--no-website"),
      reportJson,
      reset: flags.has("--reset"),
      runs,
      ttscVersion,
      typescriptGoVersion,
      warmup,
      websiteJson,
      worktree,
    });

    const projectSelection = [...projectArgs, ...positional];
    const selectedProjects: ITtscBenchmarkPerformanceProject[] =
      projectSelection.length !== 0
        ? projectSelection
            .map((project) =>
              TtscBenchmarkPerformanceConfiguration.project(project),
            )
            .filter(TtscBenchmarkObject.isDefined)
        : projects;
    const runner = new TtscBenchmarkPerformanceRunner({
      flags,
      projects: selectedProjects,
      paths: {
        workRoot,
        tarballRoot,
        outputMarkdown,
        websiteJson,
      },
      cell,
      measurement,
      process: performanceProcess,
      report,
      setup,
      verifier,
      worktree,
    });

    if (
      projectSelection.length !== 0 &&
      selectedProjects.length !== projectSelection.length
    ) {
      const known = projects
        .map((project) => `${project.name} (${project.repoName})`)
        .join(", ");
      throw new Error(`unknown project selection. Known: ${known}`);
    }
    if (flags.has("--list")) {
      runner.printConfig();
      return;
    }
    runner.main();
  }
}

import { FixtureFiles } from "../../FixtureFiles";
import fs from "node:fs";
import path from "node:path";
import { createLintProject, runLintProject } from "./config-file";

/** One immutable contributor producer and one real project load for three wire consumers. */
let completed: ReturnType<typeof runLintProject> | undefined;
let failed: { error: unknown } | undefined;

/** Release the completed contributor population with its experiment owner. */
export function releaseContributorBoundary(): void {
  completed = undefined;
  failed = undefined;
}

export function contributorBoundaryResult(): ReturnType<typeof runLintProject> {
  if (failed) throw failed.error;
  if (completed) return completed;
  try {
    const project = createLintProject({
      name: "contributor-wire-batch",
      source: fs.readFileSync(path.resolve(import.meta.dirname, "../../../../fixtures/lint/workspace/contributor-source.ts"), "utf8"),
      pluginConfig: { configFile: "./lint.config.ts" },
      extraSources: FixtureFiles.read("lint/contributor-boundary/inputs-1"),
      linkNodeModules: ["lint-contributor-demo"],
    });
    try {
      completed = runLintProject(project.tmpdir);
      return completed;
    } finally {
      project.cleanup();
    }
  } catch (error) {
    failed = { error };
    throw error;
  }
}

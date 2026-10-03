import { FixtureFiles } from "../../FixtureFiles";
import fs from "node:fs";
import path from "node:path";
import { createLintProject, runLintProject } from "./config-file";

let completed: ReturnType<typeof runLintProject> | undefined;
let failed: { error: unknown } | undefined;

/** Release the completed diagnostic population with its experiment owner. */
export function releaseConfigLanguageBoundary(): void {
  completed = undefined;
  failed = undefined;
}

/** One launcher result for nine scoped configs; native child/Program totals are not asserted here. */
export function configLanguageBoundaryResult(): ReturnType<typeof runLintProject> {
  if (failed) throw failed.error;
  if (completed) return completed;
  try {
    const project = createLintProject({
      name: "config-language-boundary-batch",
      source: fs.readFileSync(path.resolve(import.meta.dirname, "../../../../fixtures/lint/workspace/config-language-source.ts"), "utf8"),
      pluginConfig: { configFile: "./ttsc-lint.config.json" },
      extraSources: FixtureFiles.read("lint/workspace/config-language"),
      linkNodeModules: ["@types/node"],
    });
    try {
      completed = runLintProject(project.tmpdir);
      return completed;
    } finally {
      project.cleanup();
    }
  } catch(error) {
    failed = {error};
    throw error;
  }
}

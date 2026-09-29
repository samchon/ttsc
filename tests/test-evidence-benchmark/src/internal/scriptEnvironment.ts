import { sanitizeBenchmarkEnvironment } from "../../../../benchmarks/evidence/src/sanitizeBenchmarkEnvironment";
import { pluginCacheDirectory } from "./pluginCacheDirectory";

/** Prepares the same isolated consumer environment for one-shot and watch gates. */
export const scriptEnvironment = (
  additions: Readonly<Record<string, string>> = {},
): NodeJS.ProcessEnv => {
  const environment = sanitizeBenchmarkEnvironment(process.env);
  for (const name of Object.keys(environment))
    if (
      name.startsWith("npm_package_") ||
      name.startsWith("npm_lifecycle_") ||
      name.toUpperCase() === "EVIDENCE_BENCHMARK_ARCHIVE" ||
      name.toUpperCase() === "INIT_CWD"
    )
      delete environment[name];
  return {
    ...environment,
    TTSC_CACHE_DIR: pluginCacheDirectory(),
    ...additions,
  };
};

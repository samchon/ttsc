import fs from "node:fs";
import path from "node:path";

import { TestExecutor } from "../../utils/src/TestExecutor";

const features = path.join(import.meta.dirname, "features");
const selection =
  process.env.TTSC_TEST_DIRS?.split(",").filter(Boolean) ??
  (process.env.TTSC_TEST_DIR ? [process.env.TTSC_TEST_DIR] : undefined);
const packages = [
  "banner",
  "evidence",
  "graph",
  "lint",
  "metro",
  "paths",
  "playground",
  "strip",
  "ttsc",
  "unplugin",
  "wasm",
];

// `--package=a,b` selects several package experiments for one executor process.
const packageArgument = process.argv.find((value) =>
  value.startsWith("--package="),
);
const selectedPackages = packageArgument
  ?.slice("--package=".length)
  .split(",")
  .filter(Boolean);
for (const name of selectedPackages ?? [])
  if (!packages.includes(name)) throw new Error("Unknown E2E package: " + name);
const locations = [
  ...new Set(
    selection?.length
      ? selection.map((directory) => {
          const location = path.join(import.meta.dirname, directory);
          return ["banner", "paths", "strip"].some(
            (name) => location === path.join(features, name),
          )
            ? path.join(features, "test_e2e_utilities.ts")
            : location;
        })
      : (selectedPackages ?? packages).map((name) => {
          // The new shared host is admitted only by consolidatedE2eIndex;
          // the instrumented legacy baseline keeps its original donor tree.
          if (name === "unplugin") return path.join(features, name);
          const owner = ["banner", "paths", "strip"].includes(name)
            ? "utilities"
            : name;
          const experiment = path.join(features, `test_e2e_${owner}.ts`);
          return fs.existsSync(experiment)
            ? experiment
            : path.join(features, name);
        }),
  ),
];

if (process.argv.includes("--installation")) {
  const { test_e2e_installation } =
    await import("./features/test_e2e_installation");
  await test_e2e_installation();
} else {
  await TestExecutor.main({
    location: selectedPackages
      ? locations.filter((location) =>
          selectedPackages.some((name) => {
            const root = path.join(features, name);
            return (
              location ===
                path.join(
                  features,
                  `test_e2e_${["banner", "paths", "strip"].includes(name) ? "utilities" : name}.ts`,
                ) ||
              location === root ||
              location.startsWith(root + path.sep)
            );
          }),
        )
      : locations,
  });
}

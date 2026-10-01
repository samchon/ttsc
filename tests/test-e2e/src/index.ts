import path from "node:path";

import { TestExecutor } from "../../utils/src/TestExecutor";

const features = path.join(import.meta.dirname, "features");
const selection = process.env.TTSC_TEST_DIRS?.split(",").filter(Boolean)
  ?? (process.env.TTSC_TEST_DIR ? [process.env.TTSC_TEST_DIR] : undefined);
const packages = ["banner", "evidence", "graph", "lint", "metro", "paths", "playground", "strip", "ttsc", "unplugin", "wasm"];

// `--package=a,b` selects several package experiments for one executor process.
const packageArgument = process.argv.find((value) => value.startsWith("--package="));
const selectedPackages = packageArgument?.slice("--package=".length).split(",").filter(Boolean);
for (const name of selectedPackages ?? [])
  if (!packages.includes(name)) throw new Error("Unknown E2E package: " + name);
const locations = selection?.length
  ? selection.map((directory) => path.join(import.meta.dirname, directory))
  : (selectedPackages ?? packages).map((name) => path.join(features, name));

if (process.argv.includes("--installation")) {
  const { test_e2e_installation } = await import("./features/installation/test_e2e_installation");
  await test_e2e_installation();
} else {
  await TestExecutor.main({
    location: selectedPackages
      ? locations.filter((location) => selectedPackages.some((name) => {
          const root = path.join(features, name);
          return location === root || location.startsWith(root + path.sep);
        }))
      : locations,
  });
}

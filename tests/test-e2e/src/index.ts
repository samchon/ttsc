import path from "node:path";

import { TestExecutor } from "../../utils/src/TestExecutor";

const features = path.join(import.meta.dirname, "features");
const selection = process.env.TTSC_TEST_DIRS?.split(",").filter(Boolean)
  ?? (process.env.TTSC_TEST_DIR ? [process.env.TTSC_TEST_DIR] : undefined);
const packages = ["banner", "evidence", "graph", "lint", "metro", "paths", "playground", "strip", "ttsc", "unplugin", "wasm"];
const packageArgument = process.argv.find((value) => value.startsWith("--package="));
const selectedPackage = packageArgument?.slice("--package=".length);
if (selectedPackage !== undefined && !packages.includes(selectedPackage))
  throw new Error("Unknown E2E package: " + selectedPackage);
const locations = selection?.length
  ? selection.map((directory) => path.join(import.meta.dirname, directory))
  : (selectedPackage ? [selectedPackage] : packages).map((name) => path.join(features, name));

if (process.argv.includes("--installation")) {
  const { test_e2e_installation } = await import("./features/installation/test_e2e_installation");
  await test_e2e_installation();
} else {
  await TestExecutor.main({
    location: selectedPackage
      ? locations.filter((location) => location === path.join(features, selectedPackage) || location.startsWith(path.join(features, selectedPackage) + path.sep))
      : locations,
  });
}

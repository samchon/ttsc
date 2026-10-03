import path from "node:path";

import { TestExecutor } from "../../utils/src/TestExecutor";

// Explicit opt-in population: retained legacy locations are never recursively
// mixed into these shared preparations. The coordinator checks baseline identity
// before launching this entry. Registration is not an observed coverage count.
const registered = {
  runtime: "test_e2e_runtime.ts",
  consumer: "test_e2e_consumer.ts",
  native: "test_e2e_native.ts",
  "compiler-stub": "test_e2e_compiler_stub.ts",
  compiler: "test_e2e_compiler.ts",
  metro: "test_e2e_metro_host.ts",
} as const;
const argument = process.argv.find((value) => value.startsWith("--family="));
const selected = argument
  ? argument.slice("--family=".length).split(",").filter(Boolean)
  : Object.keys(registered);
for (const name of selected)
  if (!(name in registered))
    throw new Error("Unregistered consolidated E2E family: " + name);
if (selected.length === 0)
  throw new Error("No consolidated E2E family selected");
await TestExecutor.main({
  location: [...new Set(selected)].map((name) =>
    path.join(
      import.meta.dirname,
      "features",
      registered[name as keyof typeof registered],
    ),
  ),
});

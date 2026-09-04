import fs from "node:fs";

import { ADAPTER_CASES } from "./cases/adapters";
import { NATIVE_CASES } from "./cases/native";
import { TRANSFORM_CASES } from "./cases/transform";

type TestLayer = "all" | "integration" | "unit";

interface ITestCase {
  name: string;
  run: () => unknown;
}

const EXPECTED_CASES = 205;
const UNIT_CASES = new Set([
  "case_adapter_entrypoints_support_node_cjs_require",
  "case_adapter_entrypoints_support_node_esm_default_import",
  "case_bun_adapter_excludes_nul_virtual_ids",
  "case_next_adapter_does_not_double_register_across_globs",
  "case_next_adapter_preserves_an_existing_webpack_hook",
  "case_next_adapter_preserves_turbopack_config",
  "case_next_adapter_warns_about_a_suppressed_webpack_hook",
  "case_next_adapter_wires_both_bundlers",
  "case_package_build_keeps_runtime_dependencies_external",
  "case_resolveoptions_keeps_only_the_public_ttsc_adapter_contract",
  "case_shared_adapter_filter_accepts_source_files_and_skips_declarations",
  "case_transformttsc_declaration_classification_is_separator_neutral",
  "case_transformttsc_ignores_bundler_virtual_modules",
  "case_transformttsc_predicate_proofs_cover_filesystem_kinds_and_transitions",
  "case_turbopack_loader_passes_through_declarations_and_node_modules",
  "case_turbopack_loader_passes_through_non_source_ids",
]);

/**
 * Execute the unplugin contract as one package test while retaining named
 * scenario diagnostics and substring filters.
 *
 * Scenario modules are inputs to this contract, not independent E2E jobs. The
 * unit layer is deliberately restricted to cases that require neither a Go host
 * nor a bundler process. Every other scenario shares one integration process,
 * native cache, and fixed source-plugin identity.
 */
export async function test_unplugin_package_contract(): Promise<void> {
  const layer = readLayer();
  const include = readArguments("include");
  const exclude = readArguments("exclude");
  const inventory = Object.entries({
    ...ADAPTER_CASES,
    ...TRANSFORM_CASES,
    ...NATIVE_CASES,
  }).map(([name, run]) => ({ name, run }));
  assertInventory(inventory);
  const selected = inventory.filter(
    (entry) =>
      belongsToLayer(entry.name, layer) &&
      (include.length === 0 ||
        include.some((value) => entry.name.includes(value))) &&
      (exclude.length === 0 ||
        exclude.every((value) => !entry.name.includes(value))),
  );
  if (selected.length === 0) {
    throw new Error(
      include.length === 0
        ? `No ${layer} cases were selected.`
        : `No ${layer} cases matched --include=${include.join(",")}.`,
    );
  }
  const started = Date.now();
  const failures: Error[] = [];
  for (const entry of selected) {
    const caseStarted = Date.now();
    try {
      await entry.run();
      console.log(
        `  - \x1b[32m${entry.name}\x1b[0m: \x1b[33m${Math.max(0, Date.now() - caseStarted).toLocaleString()} ms\x1b[0m`,
      );
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      failures.push(failure);
      console.log(
        `  - \x1b[32m${entry.name}\x1b[0m: \x1b[31m${failure.name}\x1b[0m`,
      );
    }
  }
  for (const failure of failures) console.error(failure);
  console.log(failures.length === 0 ? "Success" : "Failed");
  console.log(
    `Executed ${selected.length} ${layer} cases in ${Math.max(0, Date.now() - started).toLocaleString()} ms`,
  );
  if (failures.length !== 0) process.exitCode = 1;
}

function assertInventory(inventory: ITestCase[]): void {
  const names = new Set(inventory.map((entry) => entry.name));
  if (names.size !== inventory.length) {
    throw new Error(
      "The unplugin scenario inventory contains duplicate names.",
    );
  }
  if (inventory.length !== EXPECTED_CASES) {
    throw new Error(
      `The unplugin scenario inventory changed from ${EXPECTED_CASES} to ${inventory.length}; classify the change before updating the budget.`,
    );
  }
  for (const name of UNIT_CASES) {
    if (!names.has(name)) {
      throw new Error(`The unit scenario inventory lost ${name}.`);
    }
  }
}

function belongsToLayer(name: string, layer: TestLayer): boolean {
  return (
    layer === "all" ||
    (layer === "unit" ? UNIT_CASES.has(name) : !UNIT_CASES.has(name))
  );
}

function readLayer(): TestLayer {
  const argument = process.argv
    .slice(2)
    .find((value) => value.startsWith("--layer="));
  const layer = argument?.slice("--layer=".length) ?? "all";
  if (layer === "all" || layer === "integration" || layer === "unit") {
    return layer;
  }
  throw new Error(`Unknown unplugin test layer: ${layer}`);
}

function readArguments(key: string): string[] {
  const prefix = `--${key}=`;
  return process.argv
    .slice(2)
    .filter((argument) => argument.startsWith(prefix))
    .flatMap((argument) => argument.slice(prefix.length).split(","))
    .map((argument) => argument.trim())
    .filter(Boolean);
}

let finished = false;
process.on("exit", (code) => {
  if (!finished && code === 0) {
    fs.writeSync(
      2,
      "The unplugin package contract exited before every selected case finished.\n",
    );
    process.exitCode = 1;
  }
});

test_unplugin_package_contract()
  .then(() => {
    finished = true;
  })
  .catch((error) => {
    finished = true;
    console.error(error);
    process.exitCode = 1;
  });

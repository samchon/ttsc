import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Execute native filesystem cases against the already installed candidate SDK.
 *
 * @evidence contracts/testing.md#behavioral-verification Resolves the packed SDK from the owned CLI consumer and calls the three named volume/path-identity cases and held-generation retirement case with its actual exported operations, followed by the ordinary-volume installed compiler case-only resolution probe and the installed ttsx junction runtime and ttsc short-cwd compiler cases and the two source-owned VS Code command-shim cases on Windows; each original case owns its filesystem assertions and a failure cannot hide another case.
 * @evidence contracts/testing.md#independent-expectations The preceding CLI smoke owns installation identity; the cases compare candidate identity decisions with actual native alias, case-marker and fsutil observations, not a second implementation of their decision algorithm.
 * @evidence contracts/testing.md#distinguishing-cases Physical aliases, ordinary empty/missing-directory authority, Windows sensitive-directory overrides and open-descriptor rename refusal retain their distinct named cases. Portable injected authority remains in source units and Windows Go kernel cases run in their own same-install batch.
 * @evidence contracts/testing.md#execution-ownership test_installed_os_boundaries is the explicit sole setup matrix entry for these four filesystem cases, one ordinary-volume compiler resolution case, the Windows junction runtime and short-cwd compiler cases and two Windows command-shim cases, separate from Linux units and E2E; it prepares no new installer or native producer and uses the already installed compiler for the resolution, junction and short-cwd connections.
 * @evidence contracts/e2e.md#necessary-boundary The installed SDK identity, retirement and compiler-resolution operations must agree with real filesystem and volume behavior. Windows junction/short-cwd runtime and source-owned VS Code shim transport additionally cross their actual native boundaries; Linux source units cannot prove those connections.
 * @evidence contracts/e2e.md#shared-execution All cases consume the preceding installation and one Node session; the existing setup matrix owns every OS row and no case prepares another SDK or Go build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The CLI consumer marker and canonical temporary parent establish cleanup ownership. Each named case owns its separate filesystem inputs; the Windows consumer survives until the immediately following Go kernel batch, while other OS consumers are removed in finally.
 * @evidence contracts/e2e.md#preserved-coverage Calls each original filesystem OS function with the candidate operation and retains the real Windows junction runtime, short-cwd compiler and both VS Code shim argv cases and preserves every assertion, existing capability guard and failure identity; it collects independent failures before reporting them, and adds no skip or simulated OS result.
 */
export async function test_installed_os_boundaries(): Promise<void> {
  const repository = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const consumer = process.env.TTSC_INSTALLED_SMOKE_ROOT;
  assert(consumer, "The preceding installed CLI consumer is required");
  assert.equal(fs.readFileSync(path.join(consumer, ".ttsc-cli-smoke"), "utf8"), repository);
  const physicalConsumer = fs.realpathSync.native(consumer);
  const parent = fs.realpathSync.native(os.tmpdir());
  const parentIdentity = (value: string): string => process.platform === "win32" ? value.toLowerCase() : value;
  assert.equal(parentIdentity(path.dirname(physicalConsumer)), parentIdentity(parent));
  assert(path.basename(physicalConsumer).startsWith("ttsc-cli-smoke-"));
  const failures: Error[] = [];
  try {
    const requireInstalled = createRequire(path.join(consumer, "package.json"));
    const sdk = path.dirname(requireInstalled.resolve("ttsc/package.json"));
    const cases = [
      ["watch", "test_project_input_snapshot_merge_uses_filesystem_identities", "lib/compiler/internal/build/mergeProjectInputSnapshots.js", "mergeProjectInputSnapshots"],
      ["watch", "test_project_input_path_identity_defaults_to_platform_case_semantics", "ttsc/path-identity", "createProjectInputPathIdentityContext"],
      ["watch", "test_project_input_path_identity_respects_directory_case_semantics", "ttsc/path-identity", "createProjectInputPathIdentityContext"],
      ["source-plugin", "test_buildlock_retire_waits_out_a_peers_read_of_the_held_generation", "lib/internal/retireLockDirectory.js", "retireLockDirectory"],
    ] as const;
    const modules = new Map<string, Promise<Record<string, unknown>>>();
    for (const [category, name, specifier, exportName] of cases) {
      const started = performance.now();
      try {
        const file = specifier.startsWith("lib/") ? path.join(sdk, specifier) : requireInstalled.resolve(specifier);
        const url = pathToFileURL(file).href;
        if (!modules.has(url)) modules.set(url, import(url));
        const operation = (await modules.get(url)!)[exportName];
        assert.equal(typeof operation, "function", `Installed SDK operation ${exportName}`);
        const entry = await import(new URL(`../test-ttsc/src/os-boundaries/${category}/${name}.ts`, import.meta.url).href);
        await entry[name](operation);
        console.log(`${name}: PASS ${(performance.now() - started).toFixed(1)} ms`);
      } catch (error) {
        failures.push(new Error(name, { cause: error }));
        console.error(name, error);
      }
    }
    const policyCase = "test_installed_compiler_resolves_case_only_imports_with_its_host_policy";
    const policyStarted = performance.now();
    try {
      const policy = await import(pathToFileURL(requireInstalled.resolve("ttsc/tsconfig")).href);
      const entry = await import(new URL(`../test-ttsc/src/os-boundaries/platform/${policyCase}.ts`, import.meta.url).href);
      await entry[policyCase](policy.compilerUsesCaseSensitiveFileNames, path.join(sdk, "lib", "launcher", "ttsc.js"), physicalConsumer);
      console.log(`${policyCase}: PASS ${(performance.now() - policyStarted).toFixed(1)} ms`);
    } catch (error) {
      failures.push(new Error(policyCase, { cause: error }));
      console.error(policyCase, error);
    }
    if (process.platform === "win32") {
      const runtimeCase = "test_ttsx_virtual_layout_junctions_symlinked_directory_entries_on_windows";
      const started = performance.now();
      try {
        const entry = await import(new URL(`../test-ttsc/src/os-boundaries/ttsx-runtime/${runtimeCase}.ts`, import.meta.url).href);
        await entry[runtimeCase](path.join(sdk, "lib", "launcher", "ttsx.js"), physicalConsumer);
        console.log(`${runtimeCase}: PASS ${(performance.now() - started).toFixed(1)} ms`);
      } catch (error) {
        failures.push(new Error(runtimeCase, { cause: error }));
        console.error(runtimeCase, error);
      }
      const compilerCase = "test_ttsc_relates_output_paths_through_a_windows_short_cwd";
      const compilerStarted = performance.now();
      try {
        const entry = await import(new URL(`../test-ttsc/src/os-boundaries/compiler/${compilerCase}.ts`, import.meta.url).href);
        const covered = await entry[compilerCase](path.join(sdk, "lib", "launcher", "ttsc.js"), physicalConsumer);
        console.log(`${compilerCase}: ${covered ? "PASS" : "SKIP (8.3 alias unavailable; no coverage claimed)"} ${(performance.now() - compilerStarted).toFixed(1)} ms`);
      } catch (error) {
        failures.push(new Error(compilerCase, { cause: error }));
        console.error(compilerCase, error);
      }
      const commandCases = [
        "test_vscode_install_command_preserves_arguments_through_real_windows_shim",
        "test_vscode_server_launch_command_spawns_windows_command_shim",
      ] as const;
      for (const name of commandCases) {
        const started = performance.now();
        try {
          const entry = await import(new URL(`../test-ttsc/src/os-boundaries/ttscserver/${name}.ts`, import.meta.url).href);
          await entry[name]();
          console.log(`${name}: PASS ${(performance.now() - started).toFixed(1)} ms`);
        } catch (error) {
          failures.push(new Error(name, { cause: error }));
          console.error(name, error);
        }
      }
    }
  } catch (error) {
    failures.push(new Error("Installed SDK resolution failed", { cause: error }));
  } finally {
    if (process.platform !== "win32") {
      try {
        fs.rmSync(physicalConsumer, { recursive: true, force: true });
      } catch (error) {
        failures.push(new Error("Installed SDK consumer cleanup failed", { cause: error }));
      }
    }
  }
  if (failures.length) throw new AggregateError(failures, "Installed OS boundary failures");
}

await test_installed_os_boundaries();

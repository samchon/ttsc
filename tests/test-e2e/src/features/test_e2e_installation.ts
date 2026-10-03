import assert from "node:assert/strict";
import nodeChildProcessForTrace from "node:child_process";
import { E2eProcessTrace } from "../../../utils/src/E2eProcessTrace";
const cp = { ...nodeChildProcessForTrace, ...E2eProcessTrace };
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { GoBoundary } from "../internal/GoBoundary";

/**
 * Verifies installed SDK filesystem identities and actual process lifetimes.
 *
 * This entry packs and installs its own SDK consumer. Testing a source copy
 * would miss a stale or missing owner in the package that users actually install.
 * Independent failures must also leave the other native boundaries observable.
 *
 * 1. Pack and install the owned consumer and validate its confined temporary identity.
 * 2. Execute each filesystem, process and compiler case with its installed owner.
 * 3. Collect independent failures and release the consumer through its OS owner.
 *
 * @evidence contracts/testing.md#behavioral-verification Resolves the packed SDK from the owned CLI consumer and calls the three volume/path-identity cases, held-generation retirement case and real child/pipe lifetime entry with its actual exported owners. The ordinary-volume compiler case-only resolution probe, Windows ttsx junction and ttsc short-cwd cases and two source-owned VS Code command-shim cases retain their original assertions; each failure leaves independent cases observable.
 * @evidence contracts/testing.md#independent-expectations This entry resolves its SDK from its authored tarball dependencies and compares the consumer's physical parent and basename with independent temporary-root facts, not a marker. Filesystem scenes own their native alias/case premises; observed authority is not an independent OS-name classifier oracle. Process scenes use authored exit statuses and inherited pipes rather than fabricated close events.
 * @evidence contracts/testing.md#distinguishing-cases Physical aliases, ordinary empty/missing-directory authority, Windows sensitive-directory overrides and open-descriptor rename refusal retain their distinct named cases. Installed process closure additionally distinguishes EOF zero/two, forced termination and short/long inherited pipe holds. Portable injected authority remains in source units and Windows Go kernel cases run in their own same-install batch.
 * @evidence contracts/testing.md#execution-ownership This entry performs its own two packs and install, resolves SDK operations and calls the named filesystem/process/compiler scenes. The Graph line-peer scene explicitly imports authored Graph source, and VS Code command scenes own their source-side shim transport; those are not installed SDK owners. Per-case failures and final cleanup failures remain named and observable.
 * @evidence contracts/e2e.md#necessary-boundary The installed SDK identity, retirement, process-closure and compiler-resolution owners must agree with real filesystem, child and pipe behavior. Windows junction/short-cwd runtime and source-owned VS Code shim transport additionally cross their actual native boundaries; direct source units cannot prove these installed connections.
 * @evidence contracts/e2e.md#shared-execution Installed SDK scenes share one prepared consumer and the caller's Node process, with distinct child/pipe lifetimes. Windows selects driver/windowsjunction::TestCreateTreatsPathsAsData through the Go boundary; its direct owning operation has no SDK prerequisite. Parent calls or terminal Go status do not establish internal process/Program totals or executed coverage on an unavailable platform.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The exact created temporary root is the cleanup owner; successful setup independently checks its physical parent and prefix. Each scene owns separate inputs and closure checks. Finally attempts root removal and asserts absence, including setup failure, retaining cleanup errors; removal is not arbitrary descendant shutdown or loaded-image identity. Go inputs/environment retain their own test owners.
 * @evidence contracts/e2e.md#preserved-coverage Calls each original filesystem OS function with the candidate operation and retains the real Windows junction runtime, short-cwd compiler and both VS Code shim argv cases. The six child/pipe lifetimes also retain their exact assertions with the actual installed constructor. Independent failures are collected before reporting; no assertion, existing capability guard or failure identity is dropped and no simulated OS result is introduced.
 */
export async function test_e2e_installation(): Promise<void> {
  const repository = path.resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
  const consumer = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-cli-smoke-"));
  const failures: Error[] = [];
  try {
    const target = `${process.platform}-${process.arch}`;
    const pnpm = (args: string[], cwd: string) =>
      cp.execFileSync("pnpm", args, { cwd, shell: process.platform === "win32", stdio: "inherit" });
    for (const name of ["ttsc", `ttsc-${target}`])
      pnpm(["pack", "--out", path.join(consumer, `${name}.tgz`)], path.join(repository, "packages", name));
    fs.writeFileSync(
      path.join(consumer, "package.json"),
      JSON.stringify({
        private: true,
        dependencies: {
          ttsc: "file:./ttsc.tgz",
          [`@ttsc/${target}`]: `file:./ttsc-${target}.tgz`,
          typescript: "7.0.2",
        },
      }),
    );
    pnpm(["install", "--ignore-scripts", "--no-frozen-lockfile"], consumer);
    const physicalConsumer = fs.realpathSync.native(consumer);
    const parent = fs.realpathSync.native(os.tmpdir());
    const parentIdentity = (value: string): string => process.platform === "win32" ? value.toLowerCase() : value;
    assert.equal(parentIdentity(path.dirname(physicalConsumer)), parentIdentity(parent));
    assert(path.basename(physicalConsumer).startsWith("ttsc-cli-smoke-"));
    const requireInstalled = createRequire(path.join(consumer, "package.json"));
    const sdk = path.dirname(requireInstalled.resolve("ttsc/package.json"));
    const cases = [
      ["watch", "case_project_input_snapshot_merge_uses_filesystem_identities", "lib/compiler/internal/build/mergeProjectInputSnapshots.js", "mergeProjectInputSnapshots"],
      ["watch", "case_project_input_path_identity_defaults_to_platform_case_semantics", "ttsc/path-identity", "createProjectInputPathIdentityContext"],
      ["watch", "case_project_input_path_identity_respects_directory_case_semantics", "ttsc/path-identity", "createProjectInputPathIdentityContext"],
      ["source-plugin", "case_buildlock_retire_waits_out_a_peers_read_of_the_held_generation", "lib/internal/retireLockDirectory.js", "retireLockDirectory"],
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
        const entry = await import(new URL(`./ttsc/os-boundaries/${category}/${name}.ts`, import.meta.url).href);
        await entry[name](operation);
        console.log(`${name}: PASS ${(performance.now() - started).toFixed(1)} ms`);
      } catch (error) {
        failures.push(new Error(name, { cause: error }));
        console.error(name, error);
      }
    }
    const lifetimeCase = "case_resident_check_process_joins_actual_child_lifetimes";
    const lifetimeStarted = performance.now();
    try {
      const owner = await import(pathToFileURL(path.join(sdk, "lib/compiler/internal/ResidentCheckProcess.js")).href);
      assert.equal(typeof owner.ResidentCheckProcess, "function", "Installed process lifetime owner");
      const entry = await import(new URL(`./ttsc/os-boundaries/process/${lifetimeCase}.ts`, import.meta.url).href);
      await entry[lifetimeCase]({ ResidentCheckProcess: owner.ResidentCheckProcess, moduleURL: pathToFileURL(path.join(sdk, "lib/compiler/internal/ResidentCheckProcess.js")).href });
      console.log(`${lifetimeCase}: PASS ${(performance.now() - lifetimeStarted).toFixed(1)} ms`);
    } catch (error) {
      failures.push(new Error(lifetimeCase, { cause: error }));
      console.error(lifetimeCase, error);
    }
    const policyCase = "case_installed_compiler_resolves_case_only_imports_with_its_host_policy";
    const policyStarted = performance.now();
    try {
      const policy = await import(pathToFileURL(requireInstalled.resolve("ttsc/tsconfig")).href);
      const entry = await import(new URL(`./ttsc/os-boundaries/platform/${policyCase}.ts`, import.meta.url).href);
      await entry[policyCase](policy.compilerUsesCaseSensitiveFileNames, path.join(sdk, "lib", "launcher", "ttsc.js"), physicalConsumer);
      console.log(`${policyCase}: PASS ${(performance.now() - policyStarted).toFixed(1)} ms`);
    } catch (error) {
      failures.push(new Error(policyCase, { cause: error }));
      console.error(policyCase, error);
    }
    const graphCase = "case_ttscgraph_line_peer_joins_actual_child_lifetimes";
    const graphStarted = performance.now();
    try {
      const owner = await import(new URL("../../../../packages/graph/src/model/TtscGraphLinePeer.ts", import.meta.url).href);
      const entry = await import(new URL(`./graph/os-boundaries/process/${graphCase}.ts`, import.meta.url).href);
      await entry[graphCase](owner.TtscGraphLinePeer.open);
      console.log(`${graphCase}: PASS ${(performance.now() - graphStarted).toFixed(1)} ms`);
    } catch (error) {
      failures.push(new Error(graphCase, { cause: error }));
      console.error(graphCase, error);
    }
    if (process.platform === "win32") {
      try {
        GoBoundary.run("ttsc", "./driver/windowsjunction", ["TestCreateTreatsPathsAsData"]);
      } catch (error) {
        failures.push(new Error("TestCreateTreatsPathsAsData", { cause: error }));
      }
      const runtimeCase = "case_ttsx_virtual_layout_junctions_symlinked_directory_entries_on_windows";
      const started = performance.now();
      try {
        const entry = await import(new URL(`./ttsc/os-boundaries/ttsx-runtime/${runtimeCase}.ts`, import.meta.url).href);
        await entry[runtimeCase](path.join(sdk, "lib", "launcher", "ttsx.js"), physicalConsumer);
        console.log(`${runtimeCase}: PASS ${(performance.now() - started).toFixed(1)} ms`);
      } catch (error) {
        failures.push(new Error(runtimeCase, { cause: error }));
        console.error(runtimeCase, error);
      }
      const compilerCase = "case_ttsc_relates_output_paths_through_a_windows_short_cwd";
      const compilerStarted = performance.now();
      try {
        const entry = await import(new URL(`./ttsc/os-boundaries/compiler/${compilerCase}.ts`, import.meta.url).href);
        const covered = await entry[compilerCase](path.join(sdk, "lib", "launcher", "ttsc.js"), physicalConsumer);
        console.log(`${compilerCase}: ${covered ? "PASS" : "SKIP (8.3 alias unavailable; no coverage claimed)"} ${(performance.now() - compilerStarted).toFixed(1)} ms`);
      } catch (error) {
        failures.push(new Error(compilerCase, { cause: error }));
        console.error(compilerCase, error);
      }
      const commandCases = [
        "case_vscode_install_command_preserves_arguments_through_real_windows_shim",
        "case_vscode_server_launch_command_spawns_windows_command_shim",
      ] as const;
      for (const name of commandCases) {
        const started = performance.now();
        try {
          const entry = await import(new URL(`./ttsc/os-boundaries/ttscserver/${name}.ts`, import.meta.url).href);
          await entry[name]();
          console.log(`${name}: PASS ${(performance.now() - started).toFixed(1)} ms`);
        } catch (error) {
          failures.push(new Error(name, { cause: error }));
          console.error(name, error);
        }
      }
    }
  } catch (error) {
    failures.push(new Error("Installation or installed SDK resolution failed", { cause: error }));
  } finally {
    try {
      fs.rmSync(consumer, { recursive: true, force: true });
      assert.equal(fs.existsSync(consumer), false, "Installed SDK consumer must be removed on every OS");
    } catch (error) {
      failures.push(new Error("Installed SDK consumer cleanup failed", { cause: error }));
    }
  }
  if (failures.length) throw new AggregateError(failures, "Installed OS boundary failures");
}

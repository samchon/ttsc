import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { readProjectConfig } from "../../../../../packages/ttsc/src/compiler/internal/project/readProjectConfig";
import { PluginPackageResolution } from "../../../../../packages/ttsc/src/plugin/internal/load/PluginPackageResolution";
import { ProjectPluginEntries } from "../../../../../packages/ttsc/src/plugin/internal/load/ProjectPluginEntries";
import { collectProjectHostInputs } from "../../../../../packages/ttsc/src/plugin/internal/load/collectProjectHostInputs";
import { hashHostInputPaths } from "../../../../../packages/ttsc/src/plugin/internal/load/hashHostInputPaths";
import { realpathHostInput } from "../../../../../packages/ttsc/src/plugin/internal/load/realpathHostInput";
import { realpathHostInputPaths } from "../../../../../packages/ttsc/src/plugin/internal/load/realpathHostInputPaths";

/**
 * Verifies host-input and nearest-manifest observations avoid redundant calls
 * within one phase and re-observe afresh in a new phase or after a change.
 *
 * `realpathHostInputPaths` and `hashHostInputPaths` were called repeatedly on
 * overlapping path sets inside one post-evaluation verification phase, and
 * `PluginPackageResolution.findNearestPackageJson` ran `existingFile` twice per
 * ancestor (once in `collectNearestPackageJsonCandidates` and again in
 * `.find(existingFile)`).
 *
 * 1. Call `realpathHostInputPaths` and `hashHostInputPaths` twice in one phase
 *    sharing an `observed` map and with duplicate paths; assert each distinct
 *    resolved path is observed once.
 * 2. Retarget a symlink and edit a file, then observe in a fresh phase (no shared
 *    map) and assert the new realpath and hash are observed.
 * 3. Call `PluginPackageResolution.findNearestPackageJson` from a nested directory
 *    with a counting `isFile` callback; assert each ancestor `package.json` is
 *    probed once (not twice), and a nearer manifest created before a second
 *    call is discovered.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercises realpathHostInputPaths, hashHostInputPaths and PluginPackageResolution.findNearestPackageJson over real files and symlinks with counting observation callbacks, checking exact call counts and updated results after mutations.
 * @evidence contracts/testing.md#independent-expectations Exact distinct path counts, literal file contents and real filesystem symlink targets define expected counts and observations independently of implementation internals.
 * @evidence contracts/testing.md#distinguishing-cases Duplicate inputs and shared same-phase maps contrast with fresh phases after symlink retargeting, file content edits and nearer manifest creation.
 * @evidence contracts/testing.md#execution-ownership Discovered unit calls the maintained source helpers directly over an owned temporary directory removed in finally; no compiler, Go process or host runs.
 */
export function test_host_input_observations_deduplicate_within_phase(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-host-input-dedup-")),
  );
  try {
    const fileA = path.join(root, "a.txt");
    const fileB = path.join(root, "b.txt");
    const link = path.join(root, "link.txt");
    fs.writeFileSync(fileA, "alpha\n");
    fs.writeFileSync(fileB, "bravo\n");
    fs.symlinkSync(fileA, link, "file");

    const failures: unknown[] = [];
    const verify = (name: string, run: () => void): void => {
      try {
        run();
      } catch (cause) {
        failures.push(new Error(name, { cause }));
      }
    };

    verify(
      "realpathHostInputPaths deduplicates duplicates and shared phase map",
      () => {
        const seen: string[] = [];
        const observe = (file: string): string | null => {
          seen.push(path.resolve(file));
          return realpathHostInput(file);
        };
        const phase = new Map<string, string | null>();
        const first = realpathHostInputPaths(
          [fileA, link, fileA],
          phase,
          observe,
        );
        const second = realpathHostInputPaths(
          [link, fileB, fileA],
          phase,
          observe,
        );
        assert.equal(first[fileA], fileA);
        assert.equal(first[link], fileA);
        assert.equal(second[fileB], fileB);
        assert.equal(
          seen.length,
          3,
          `expected 3 realpath observations across 3 distinct paths in one phase, got ${seen.length}: ${JSON.stringify(seen)}`,
        );

        // Retarget symlink and verify a fresh phase observes the new target.
        fs.rmSync(link, { force: true });
        fs.symlinkSync(fileB, link, "file");
        const fresh = realpathHostInputPaths([link]);
        assert.equal(
          fresh[link],
          fileB,
          "a fresh phase without the previous map must observe the retargeted link",
        );
      },
    );

    verify(
      "hashHostInputPaths deduplicates duplicates and shared phase map",
      () => {
        const seen: string[] = [];
        const phase = new Map<string, string | null>();
        const first = hashHostInputPaths([fileA, fileA], phase, (file) => {
          seen.push(path.resolve(file));
          return hashHostInputPaths([file])[path.resolve(file)]!;
        });
        const second = hashHostInputPaths([fileA, fileB], phase, (file) => {
          seen.push(path.resolve(file));
          return hashHostInputPaths([file])[path.resolve(file)]!;
        });
        assert.equal(first[fileA], second[fileA]);
        assert.equal(
          seen.length,
          2,
          `expected 2 hash observations across 2 distinct files in one phase, got ${seen.length}: ${JSON.stringify(seen)}`,
        );

        fs.writeFileSync(fileA, "alpha-updated\n");
        const fresh = hashHostInputPaths([fileA]);
        assert.notEqual(
          fresh[fileA],
          first[fileA],
          "a fresh phase must re-hash edited content",
        );
      },
    );

    verify("findNearestPackageJson probes each ancestor once", () => {
      const pkgRoot = path.join(root, "pkg");
      const nested = path.join(pkgRoot, "a", "b", "c");
      fs.mkdirSync(nested, { recursive: true });
      const rootManifest = path.join(pkgRoot, "package.json");
      fs.writeFileSync(rootManifest, '{"name":"root"}');
      const probes: string[] = [];
      const found = PluginPackageResolution.findNearestPackageJson(
        nested,
        (file) => {
          probes.push(file);
          return PluginPackageResolution.existingFile(file);
        },
      );
      assert.equal(found, rootManifest);
      assert.equal(
        probes.length,
        4,
        `expected 4 ancestor probes (c, b, a, pkg), got ${probes.length}: ${JSON.stringify(probes)}`,
      );

      // Creating a nearer package.json must be observed by the next call.
      const nearerManifest = path.join(pkgRoot, "a", "b", "package.json");
      fs.writeFileSync(nearerManifest, '{"name":"nearer"}');
      assert.equal(
        PluginPackageResolution.findNearestPackageJson(nested),
        nearerManifest,
      );
    });

    verify(
      "resolvePluginEntries reuses bracketed discovery manifests and re-resolves without them",
      () => {
        const proj = path.join(root, "proj");
        const depA = path.join(proj, "node_modules", "dep-a");
        const depPlugin = path.join(proj, "node_modules", "dep-plugin");
        fs.mkdirSync(depA, { recursive: true });
        fs.mkdirSync(depPlugin, { recursive: true });
        fs.writeFileSync(
          path.join(proj, "tsconfig.json"),
          '{"compilerOptions":{}}',
        );
        fs.writeFileSync(
          path.join(proj, "package.json"),
          JSON.stringify({
            name: "proj",
            dependencies: { "dep-a": "1.0.0", "dep-plugin": "1.0.0" },
          }),
        );
        fs.writeFileSync(
          path.join(depA, "package.json"),
          JSON.stringify({ name: "dep-a" }),
        );
        fs.writeFileSync(
          path.join(depPlugin, "package.json"),
          JSON.stringify({
            name: "dep-plugin",
            ttsc: { plugin: { transform: "./plugin.js" } },
          }),
        );
        fs.writeFileSync(
          path.join(depPlugin, "plugin.js"),
          "module.exports = {};",
        );
        const project = readProjectConfig({ cwd: proj });
        const discovered = {
          dependencyManifests: new Map<string, string | undefined>(),
        };
        collectProjectHostInputs(project, true, undefined, discovered);

        let fallbackResolves = 0;
        const withDiscovery = ProjectPluginEntries.resolvePluginEntries(
          project,
          undefined,
          undefined,
          {
            ...discovered,
            resolveDependencyPackageJson: (name, projectRoot) => {
              fallbackResolves += 1;
              return PluginPackageResolution.resolveDependencyPackageJson(
                name,
                projectRoot,
              );
            },
          },
        );
        assert.equal(
          fallbackResolves,
          0,
          "bracketed discovery readings must avoid re-resolving direct dependencies",
        );
        assert.equal(withDiscovery.length, 1);
        assert.equal(withDiscovery[0]!.config.transform, "./plugin.js");

        // A second load without discovery readings must resolve afresh.
        let freshResolves = 0;
        const withoutDiscovery = ProjectPluginEntries.resolvePluginEntries(
          project,
          undefined,
          undefined,
          {
            resolveDependencyPackageJson: (name, projectRoot) => {
              freshResolves += 1;
              return PluginPackageResolution.resolveDependencyPackageJson(
                name,
                projectRoot,
              );
            },
          },
        );
        assert.equal(freshResolves, 2);
        assert.deepEqual(withoutDiscovery, withDiscovery);

        // Through a symlinked project directory, collectProjectHostInputs must
        // not populate dependencyManifests for a mismatched physical root.
        const linkedProj = path.join(root, "linked-proj");
        fs.symlinkSync(
          proj,
          linkedProj,
          process.platform === "win32" ? "junction" : "dir",
        );
        const linkedProject = readProjectConfig({ cwd: linkedProj });
        const linkedDiscovered = {
          dependencyManifests: new Map<string, string | undefined>(),
        };
        collectProjectHostInputs(
          linkedProject,
          true,
          linkedProj,
          linkedDiscovered,
        );
        assert.equal(
          linkedDiscovered.dependencyManifests.size,
          0,
          "symlinked project root must fall back to physical dependency resolution",
        );
      },
    );

    if (failures.length !== 0)
      throw new AggregateError(
        failures,
        "host input and manifest observation deduplication failed",
      );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

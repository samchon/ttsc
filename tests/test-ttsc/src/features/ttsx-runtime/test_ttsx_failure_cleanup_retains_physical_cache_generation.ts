import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx cleanup retains the physical runtime-cache generation.
 *
 * An explicit cache root can be a symlink or Windows junction. A descriptor
 * runs after the runtime output exists and can retarget that alias before a
 * later preparation failure; cleanup through the original lexical spelling
 * would then delete an unrelated same-named generation below the new target.
 *
 * 1. Point a cache alias at a test-owned physical cache and start ttsx.
 * 2. Retarget the alias from a descriptor, seed a victim generation, and fail
 *    plugin preparation with a missing source.
 * 3. Assert failure cleanup removes the original generation but preserves the
 *    victim sentinel below the retargeted alias.
 *
 * @evidence contracts/testing.md#behavioral-verification The descriptor retargets the explicit cache-root alias then fails preparation; assertions require the missing-source error, one surviving victim generation and no original generations.
 * @evidence contracts/testing.md#independent-expectations Literal victim bytes under a distinct native physical target supply the independent deletion oracle; generation identity is observed only to seed the same-name victim.
 * @evidence contracts/testing.md#distinguishing-cases The root cache alias changes after allocation, unlike the linked child-index case; success cleanup is exercised separately by the linked-run execution case.
 * @evidence contracts/testing.md#execution-ownership The named feature entry owns the actual ttsx host and fixture descriptor side effect; its failure assertions execute in the E2E population.
 * @evidence contracts/e2e.md#necessary-boundary The real allocation-to-descriptor-to-failure-cleanup connection must retain physical ownership despite lexical alias mutation; a direct resolver unit does not execute that ordering.
 * @evidence contracts/e2e.md#shared-execution One actual preparation consumes the existing compiler artifact and one descriptor evaluation; missing plugin source intentionally prevents an unnecessary native plugin build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Dedicated original/victim roots and a cold generation isolate the mutation. Finally unlinks or removes the alias without removing the target, and TestProject owns the fixture roots.
 * @evidence contracts/e2e.md#preserved-coverage Nonzero status, missing-source diagnostic, victim singleton and bytes, and original empty index remain; no failure-path assertion has been removed.
 */
export function test_ttsx_failure_cleanup_retains_physical_cache_generation(): void {
    const root = TestProject.tmpdir("ttsx-cache-alias-retarget-");
    const project = path.join(root, "project");
    const physicalCache = path.join(root, "physical-cache");
    const victimCache = path.join(root, "victim-cache");
    const cacheAlias = path.join(root, "cache-alias");
    fs.mkdirSync(physicalCache);
    fs.mkdirSync(victimCache);
    fs.symlinkSync(
      physicalCache,
      cacheAlias,
      process.platform === "win32" ? "junction" : "dir",
    );
    TestProject.writeFiles(project, {
      "package.json": JSON.stringify({ private: true }),
      "tsconfig.json": TestProject.tsconfig({
        module: "commonjs",
        outDir: "dist",
        plugins: [{ transform: "./plugin.cjs" }],
        rootDir: "src",
        strict: true,
        target: "ES2022",
      }),
      "src/main.ts": 'console.log("unreached");\n',
      "plugin.cjs": [
        'const fs = require("node:fs");',
        'const path = require("node:path");',
        'const generations = fs.readdirSync(path.join(process.env.TTSC_TEST_PHYSICAL_CACHE, "project"));',
        'if (generations.length !== 1) throw new Error("expected one runtime generation");',
        "fs.rmSync(process.env.TTSC_TEST_CACHE_ALIAS, { force: true, recursive: true });",
        'fs.symlinkSync(process.env.TTSC_TEST_VICTIM_CACHE, process.env.TTSC_TEST_CACHE_ALIAS, process.platform === "win32" ? "junction" : "dir");',
        'const victim = path.join(process.env.TTSC_TEST_VICTIM_CACHE, "project", generations[0]);',
        "fs.mkdirSync(victim, { recursive: true });",
        'fs.writeFileSync(path.join(victim, "keep.txt"), "victim", "utf8");',
        'module.exports = { name: "retarget", source: path.join(process.env.TTSC_TEST_PROJECT, "missing-plugin") };',
        "",
      ].join("\n"),
    });
    try {
      const result = TestProject.spawn(
        TestProject.TTSX_BIN,
        ["--cwd", project, "--cache-dir", cacheAlias, "src/main.ts"],
        {
          cwd: project,
          env: {
            TTSC_TEST_CACHE_ALIAS: cacheAlias,
            TTSC_TEST_PHYSICAL_CACHE: physicalCache,
            TTSC_TEST_PROJECT: project,
            TTSC_TEST_VICTIM_CACHE: victimCache,
          },
        },
      );

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /plugin "retarget" source does not exist/);
      const [generation, ...extraGenerations] = fs.readdirSync(
        path.join(victimCache, "project"),
      );
      assert.ok(generation);
      assert.deepEqual(extraGenerations, []);
      assert.equal(
        fs.readFileSync(
          path.join(victimCache, "project", generation, "keep.txt"),
          "utf8",
        ),
        "victim",
      );
      assert.deepEqual(fs.readdirSync(path.join(physicalCache, "project")), []);
    } finally {
      try {
        fs.unlinkSync(cacheAlias);
      } catch {
        try {
          fs.rmdirSync(cacheAlias);
        } catch {
          // The tracked root remains safe to remove if the alias is gone.
        }
      }
    }
  }

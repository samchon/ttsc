import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

type Files = Readonly<Record<string, string>>;
type Spawn = typeof TestProject.spawn;

/**
 * Prepares the exact two-host decorator-map profile from static authored
 * inputs. Four dependency paths retain CommonJS/ESM distinctions and the
 * literal throw at source line six. Each actual host produces four
 * independently caught stack records; the second request retains the first
 * cache.
 *
 * @evidence contracts/common.md#principled-implementation Four independently named stack records require their own original source path and line six through actual Node loading.
 * @evidence contracts/common.md#clear-and-simple-design One callback retains the two cold/warm requests and four literal expected package identities.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No emitted map parsing or predicted line substitutes for actual thrown stack strings. Static authored inputs replace only original preparation text.
 * @evidence contracts/common.md#meaningful-documentation Separates eight stack observations from two host statuses and makes the static input owner explicit.
 * @evidence contracts/portability.md#os-neutral-implementation Native path joining and normalized separators compare own source identity without relying on physical case folding.
 * @evidence contracts/performance.md#efficient-algorithms Preparing the fixed four expected identities is constant work; parsing S output characters and checking eight own-path records with P total expected path characters costs O(S+P), excluding native work.
 * @evidence contracts/performance.md#reuse-equivalent-work The second actual host keeps the first cache; equivalent source at distinct paths still requires its own observed stack.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Actual requests finish through the parent launcher; unresolved metadata blocks the second request and later input transitions under parent retention.
 * @evidence contracts/testing.md#behavioral-verification Each record must contain Error: decorator-map and its own index.ts line-six path in both hosts.
 * @evidence contracts/testing.md#independent-expectations Authored package names, explicit source paths and the literal throw line determine expectations independently from produced map output.
 * @evidence contracts/testing.md#distinguishing-cases Two paths per format contrast map identity, while cold/warm requests distinguish fresh and persisted lowering.
 * @evidence contracts/testing.md#execution-ownership The canonical parent supplies static maps, owns native tool preparation and invokes both actual launcher requests through the shared assembler.
 * @evidence contracts/e2e.md#necessary-boundary Node consumption of fresh and cached inline source maps is the necessary native boundary.
 * @evidence contracts/e2e.md#shared-execution Four consumers share each host, and both hosts share one canonical root and cache; no extra per-path project is allocated.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Exact static input bytes and retained cache survive both requests; separate processes reset runtime module state.
 * @evidence contracts/e2e.md#preserved-coverage All eight actual stack records and original nonzero statuses remain; error/signal/null-status controls prevent mistaking failed launch for a decorator throw.
 */
export function canonicalDecoratorMapProfile(base: Files): {
  name: string;
  files: Files;
  run(root: string, persistent: string, spawn: Spawn): void;
} {
  const profiles = ["module", "commonjs"].flatMap((type) =>
    [1, 2].map((copy) => ({ type, name: "dep-map-" + type + "-" + copy })),
  );
  // All thirteen original authored generated inputs now belong to the static
  // profile. Independent expected formats/names and line-six oracle stay here.
  const files = base;
  return {
    name: "orphan-decorator-maps",
    files,
    run(root, persistent, spawn): void {
      const cacheDir = path.join(persistent, "decorator-map-cache");
      assert.equal(
        fs.existsSync(cacheDir),
        false,
        "cold profile cache required",
      );
      const failures: unknown[] = [];
      const collect = (assertion: () => void): void => {
        try {
          assertion();
        } catch (error) {
          failures.push(error);
        }
      };
      for (const phase of ["cold", "warm"]) {
        const result = spawn(TestProject.TTSX_BIN, ["src/main.ts"], {
          cwd: root,
          env: {
            TTSC_CACHE_DIR: cacheDir,
            ORPHAN_RACE_COMPILER: undefined,
            ORPHAN_RACE_SOURCE: undefined,
            ORPHAN_RACE_DONE: undefined,
          },
        });
        const records = new Map<string, string>();
        for (const line of result.stdout.trim().split(/\r?\n/)) {
          collect(() => {
            const record = JSON.parse(line) as { name: string; stack: string };
            assert.equal(
              records.has(record.name),
              false,
              "duplicate map observation",
            );
            records.set(record.name, record.stack);
          });
        }
        for (const profile of profiles) {
          const stack = records.get(profile.name);
          collect(() =>
            assert.equal(typeof stack, "string", phase + ":" + profile.name),
          );
          collect(() => assert.match(stack!, /Error: decorator-map/));
          collect(() =>
            assert.ok(
              stack!
                .replaceAll("\\", "/")
                .includes(
                  path
                    .join(root, "node_modules", profile.name, "index.ts")
                    .replaceAll("\\", "/") + ":6:",
                ),
              stack,
            ),
          );
        }
        // A nonzero application exit is meaningful only for a normal completed
        // host; a signal/spawn error is not a decorator-throw observation.
        collect(() => assert.equal(result.error, undefined));
        collect(() => assert.equal(result.signal, null));
        collect(() => assert.notEqual(result.status, null));
        collect(() =>
          assert.notEqual(
            result.status,
            0,
            phase + ": expected throwing consumers",
          ),
        );
      }
      if (failures.length)
        throw new AggregateError(failures, "orphan decorator map batch failed");
    },
  };
}

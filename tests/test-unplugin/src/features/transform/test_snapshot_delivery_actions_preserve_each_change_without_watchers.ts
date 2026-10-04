import type { ITtscCompilerTransformation } from "ttsc";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/createTtscTransformCache";
import { resetTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/resetTtscTransformCache";
import { selectCachedGenerationAction } from "../../../../../packages/unplugin/src/core/transform/cache/selectCachedGenerationAction";
import { TestProject } from "../../../../utils/src/TestProject";
import { observeValidationUnitGeneration } from "../../internal/transform-project-cache/observeValidationUnitGeneration";

/**
 * Verifies snapshot delivery replaces every changed input without notifications.
 *
 * Watcher unavailability removes notification proof, never the generation's
 * recorded filesystem authority. Independent roots isolate source content,
 * membership appearance/removal and external graph edits so one stale input
 * cannot hide a broken decision for another class.
 *
 * 1. Observe literal protocol inputs over six modules and six external members.
 * 2. Assert each module serves the stable generation with no tracker handles.
 * 3. Change exactly one source, member or external input and require capture.
 * 4. Observe a fresh consumer input checkpoint and require steady serving again.
 *
 * @evidence contracts/testing.md#behavioral-verification The production cached-generation action uses actual complete-snapshot validators when trackers are absent, serves unchanged modules and requests capture independently for source edits, new members, deleted members and external graph edits.
 * @evidence contracts/testing.md#independent-expectations Literal serve/capture/serve actions follow the dependency contract; real filesystem mutations establish each distinction and SHA-256 independently records external/config bytes. Fixture observations supply inputs rather than compute expected decisions.
 * @evidence contracts/testing.md#distinguishing-cases Fourteen isolated variants contrast steady state, one changed input and a newly observed checkpoint. Own and sibling source edits, ordinary/build-directory appearance, removal, file-to-directory replacement, imported sources outside discovery, unrelated text/output churn and config/manifest/descriptor edits remain independent. Outside-project graph edges use both absolute and root-relative spellings of one native file. The descriptor variant leaves src/lazy.ts undelivered before the edit and requires its first action to reject the old owner; fresh observations then serve all six modules. This action test does not execute transformTtsc delivery callbacks.
 * @evidence contracts/testing.md#execution-ownership This named source unit calls the actual action and filesystem-proof owners without a compiler, Go build or host. Literal success envelopes are consumer data only; the shared native producer/consumer connection belongs to tests/test-e2e/src/features/test_e2e_metro_batch.ts#test_e2e_metro_batch. This unit does not certify native watcher refusal or execution of the requested capture.
 */
export function test_snapshot_delivery_actions_preserve_each_change_without_watchers(): void {
  const failures: Error[] = [];
  for (const variant of ["source", "own-source", "added", "added-build", "external", "external-outside", "removed", "kind", "ignored", "outputs", "outside-include", "config", "manifest", "descriptor"] as const) {
    const root = fs.realpathSync.native(TestProject.tmpdir("ttsc-snapshot-actions-unit-"));
    const cache = createTtscTransformCache();
    try {
      const files: Record<string, string> = {
        "tsconfig.json": '{"include":["src"]}',
        "package.json": '{"private":true}',
        "plugin.cjs": "module.exports = () => {};\n",
      };
      for (let index = 0; index < 6; index += 1) {
        files[variant === "descriptor" && index === 5 ? "src/lazy.ts" : "src/mod" + index + ".ts"] = "export const value" + index + " = 1;\n";
        files["node_modules/dep" + index + "/index.d.ts"] = "export declare const dep" + index + ": number;\n";
      }
      if (variant === "outside-include") files["tsconfig.json"] = '{"include":["src/mod0.ts"]}';
      if (variant === "ignored") files["src/notes.txt"] = "before\n";
      if (variant === "removed" || variant === "kind") files["src/added.d.ts"] = "declare const added: string;\n";
      TestProject.writeFiles(root, files);
      const modules = Array.from({ length: 6 }, (_, index) => variant === "descriptor" && index === 5 ? "src/lazy.ts" : "src/mod" + index + ".ts");
      const outside = variant === "external-outside"
        ? path.join(fs.realpathSync.native(TestProject.tmpdir("ttsc-outside-graph-unit-")), "types.d.ts")
        : undefined;
      if (outside !== undefined) {
        fs.writeFileSync(outside, "export declare const outside: number;\n");
        assert.equal(path.relative(root, outside).startsWith(".." + path.sep), true);
      }
      const envelope = (): ITtscCompilerTransformation.ISuccess => ({
        type: "success",
        typescript: Object.fromEntries(modules.map((file) => [file, "export const consumerInput = 1;\n"])),
        graph: {
          edges: Object.fromEntries(modules.map((file) => [file, [...modules.filter((other) => other !== file), ...Array.from({ length: 6 }, (_, index) => "node_modules/dep" + index + "/index.d.ts"), ...(outside === undefined ? [] : [outside, path.relative(root, outside)])]])),
          globals: [],
          configs: ["tsconfig.json"],
        },
        hostInputs: ["tsconfig.json", "package.json", "plugin.cjs"].map((name) => path.join(root, name)),
        hostInputHashes: Object.fromEntries(["tsconfig.json", "package.json", "plugin.cjs"].map((name) => { const file = path.join(root, name); return [file, createHash("sha256").update(fs.readFileSync(file)).digest("hex")]; })),
        hostInputRealpaths: Object.fromEntries(["tsconfig.json", "package.json", "plugin.cjs"].map((name) => { const file = path.join(root, name); return [file, fs.realpathSync.native(file)]; })),
      });
      let observed = observeValidationUnitGeneration(root, envelope());
      let generation = Promise.resolve(observed);
      cache.set("fixture", generation);
      if (outside !== undefined) {
        assert.equal(observed.externalInputPaths?.includes(outside), true);
        assert.equal(Object.values(observed.externalInputHashes ?? {}).includes(createHash("sha256").update("export declare const outside: number;\n").digest("hex")), true);
      }
      const act = (file: string): string => {
        return selectCachedGenerationAction({
          cache, cached: observed, epoch: undefined,
          file: path.join(root, file), generation, key: "fixture",
          source: fs.readFileSync(path.join(root, file), "utf8"),
        });
      };
      for (const file of variant === "descriptor" ? modules.slice(0, -1) : modules) assert.equal(act(file), "serve");
      assert.equal(cache.get("fixture"), generation);
      assert.equal(observed.projectMutationTracker, undefined);
      if (variant === "config") fs.writeFileSync(path.join(root, "tsconfig.json"), '{"include":["src"],"compilerOptions":{"target":"ES2021"}}');
      if (variant === "manifest") fs.writeFileSync(path.join(root, "package.json"), '{"private":true,"version":"9.9.9"}');
      if (variant === "descriptor") fs.appendFileSync(path.join(root, "plugin.cjs"), "// touched\n");
      if (variant === "own-source") fs.writeFileSync(path.join(root, modules[0]!), "export const editedOwn = 2;\n");
      if (variant === "added-build") TestProject.writeFiles(root, { "src/build/b.ts": "export const nested = 2;\n" });
      if (variant === "kind") {
        fs.rmSync(path.join(root, "src/added.d.ts"));
        TestProject.writeFiles(root, { "src/added.d.ts/inner.ts": "export const kind = 1;\n" });
      }
      if (variant === "ignored") {
        fs.writeFileSync(path.join(root, "src/notes.txt"), "after, with different bytes\n");
        TestProject.writeFiles(root, { "other/trash/artifact.ts": "export const outside = 1;\n" });
      }
      if (variant === "outputs") {
        for (const directory of ["dist", "out", "coverage", ".cache"])
          TestProject.writeFiles(root, { [directory + "/bundle.js"]: "// emitted\n" });
      }
      if (variant === "outside-include") fs.appendFileSync(path.join(root, modules[1]!), "// imported graph input changed\n");
      if (variant === "source") fs.writeFileSync(path.join(root, "src/mod4.ts"), "export const edited = 2;\n");
      if (variant === "added") fs.writeFileSync(path.join(root, "src/added.d.ts"), "declare const added: string;\n");
      if (variant === "external") fs.writeFileSync(path.join(root, "node_modules/dep2/index.d.ts"), "export declare const dep2: string;\n");
      if (outside !== undefined) fs.writeFileSync(outside, "export declare const outside: string;\n");
      if (variant === "removed") fs.rmSync(path.join(root, "src/added.d.ts"));
      assert.equal(act(modules[variant === "descriptor" ? 5 : 0]!), variant === "ignored" || variant === "outputs" ? "serve" : "capture", variant + " must distinguish actual program input movement");
      assert.equal(cache.get("fixture"), variant === "ignored" || variant === "outputs" ? generation : undefined);
      observed = observeValidationUnitGeneration(root, envelope());
      if (outside !== undefined) assert.equal(Object.values(observed.externalInputHashes ?? {}).includes(createHash("sha256").update("export declare const outside: string;\n").digest("hex")), true);
      generation = Promise.resolve(observed);
      cache.set("fixture", generation);
      for (const file of modules) assert.equal(act(file), "serve", variant + " must settle after new input observations");
    } catch (error) {
      failures.push(new Error(variant, { cause: error }));
    } finally {
      resetTtscTransformCache(cache);
    }
  }
  if (failures.length !== 0) throw new AggregateError(failures, "Snapshot action variants failed");
}

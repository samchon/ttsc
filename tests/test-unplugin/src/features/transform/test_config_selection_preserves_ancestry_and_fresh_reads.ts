import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { findDeclaredFileSpecs } from "../../../../../packages/unplugin/src/core/tsconfig/findDeclaredFileSpecs";
import { findDeclaredValue } from "../../../../../packages/unplugin/src/core/tsconfig/findDeclaredValue";
import { readEffectiveTsconfigPaths } from "../../../../../packages/unplugin/src/core/tsconfig/readEffectiveTsconfigPaths";
import { readEffectiveTsconfigTemplateFileSpecs } from "../../../../../packages/unplugin/src/core/tsconfig/readEffectiveTsconfigTemplateFileSpecs";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/readProjectMembershipPolicy";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies contextual reuse preserves cycle cuts, lexical origins and fresh reads.
 *
 * A shared list ancestor initially visited below its own cycle target cannot
 * lend that truncated answer to another branch. Two junctions reaching the same
 * physical config also retain different relative-parent resolution contexts.
 *
 * 1. Select arrays through a cycle under two ancestry contexts, plus direct and
 *    indirect cycles, own invalid lists, inherited null and empty arrays.
 * 2. Resolve one physical config through two lexical directory links and then
 *    prove a physical ancestor guard cuts an alias cycle before its other parent.
 * 3. Re-read after missing-candidate creation, resolution changes, malformed
 *    source repair and equal-size/mtime text edits; preserve best-effort absence.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual membership, list, generic-value, paths and file-template readers over real configs and links. Literal list/path/source assertions distinguish ancestry-dependent memo reuse, lexical alias merging, lost invalid raw entries and stale cross-call observations.
 * @evidence contracts/testing.md#independent-expectations Fixture graph order gives the selected base array and the independently named source order. Native junctions retain authored parent directories; literal expected lexical paths and candidate names determine results. Fixing and restoring mtime while changing equal-length text distinguishes current bytes from a size/mtime cache, and actual stat equality verifies that control.
 * @evidence contracts/testing.md#distinguishing-cases Shared cyclic lists require recomputation under a second ancestry; direct/indirect cycles terminate conservatively. Own null/invalid and inherited null/empty arrays distinguish merge rules. Independent aliases differ from an alias encountered within one physical branch. Missing, directory, malformed, primitive and array roots remain unproven, while subsequent creation/repair and resolution/text changes affect new reads.
 * @evidence contracts/testing.md#execution-ownership The source-unit runner invokes this exported entry on private filesystem inputs. Supported native directory symlink/junction operations exercise path ownership without a watcher or compiler. Each independent scenario is collected before AggregateError; no process, installation or native producer starts.
 */
export async function test_config_selection_preserves_ancestry_and_fresh_reads(): Promise<void> {
  const root = TestProject.physicalPath(TestProject.tmpdir("ttsc-policy-context-"));
  const failures: Error[] = [];
  const check = (name: string, operation: () => void): void => {
    try {
      operation();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  const at = (name: string): string => path.join(root, name);
  const pattern = (name: string): string => at(name).replaceAll("\\", "/");
  const write = (name: string, value: unknown): void => {
    fs.mkdirSync(path.dirname(at(name)), { recursive: true });
    fs.writeFileSync(at(name), JSON.stringify(value));
  };
  check("a cycle-truncated list cannot answer a different ancestry", () => {
    write("base.json", { include: ["selected"] });
    write("shared.json", { extends: "./a.json" });
    write("a.json", { extends: ["./shared.json", "./base.json"] });
    write("other.json", { include: ["other"] });
    write("b.json", { extends: ["./other.json", "./shared.json"] });
    write("entry.json", { extends: ["./a.json", "./b.json"] });
    const policy = readProjectMembershipPolicy(at("entry.json"));
    assert.deepEqual(policy.rootFileSpecs?.include, [pattern("selected")]);
    assert.deepEqual(policy.sources, [
      "entry.json", "a.json", "shared.json", "base.json", "b.json", "other.json",
    ].map(at));
  });
  check("direct and indirect cycles keep independent usable branches", () => {
    write("entry.json", { extends: "./entry.json" });
    assert.deepEqual(readProjectMembershipPolicy(at("entry.json")).rootFileSpecs?.include, [pattern("**/*")]);
    write("a.json", { extends: "./b.json" });
    write("b.json", { extends: "./a.json" });
    write("base.json", { compilerOptions: { allowJs: true } });
    write("entry.json", { extends: ["./a.json", "./base.json"] });
    assert.ok(readProjectMembershipPolicy(at("entry.json")).inputExtensions.includes(".js"));
    const seen = new Set([fs.realpathSync(at("base.json"))]);
    assert.equal(findDeclaredValue(at("base.json"), () => true, seen), null);
    assert.deepEqual([...seen], [fs.realpathSync(at("base.json"))]);
    assert.deepEqual(findDeclaredValue(at("base.json"), () => null, new Set()), {
      baseDir: root, value: null,
    });
  });
  check("own invalid lists mask while inherited arrays and raw entries survive", () => {
    write("base.json", { include: ["${configDir}/selected", 7] });
    write("other.json", { include: null });
    write("entry.json", { extends: ["./base.json", "./other.json"] });
    assert.deepEqual(findDeclaredFileSpecs(at("entry.json"), "include"), {
      baseDir: root, specs: ["${configDir}/selected"], rawSpecs: ["${configDir}/selected", 7],
    });
    assert.deepEqual(readEffectiveTsconfigTemplateFileSpecs(at("entry.json")), {
      include: [pattern("selected"), 7],
    });
    for (const value of [null, "invalid", false]) {
      write("entry.json", { extends: "./base.json", include: value });
      assert.equal(findDeclaredFileSpecs(at("entry.json"), "include"), undefined);
    }
    write("other.json", { include: [] });
    write("entry.json", { extends: ["./base.json", "./other.json"] });
    assert.deepEqual(findDeclaredFileSpecs(at("entry.json"), "include"), {
      baseDir: root, specs: [], rawSpecs: [],
    });
  });
  check("independent lexical aliases keep different relative parents", () => {
    write("physical/config/shared.json", { extends: "../parent.json" });
    write("left/parent.json", {
      include: ["src"], compilerOptions: { outDir: "dist", paths: { "@/*": ["src/*"] } },
    });
    write("right/parent.json", {
      include: ["src"], compilerOptions: { outDir: "dist", paths: { "@/*": ["src/*"] } },
    });
    for (const side of ["left", "right"])
      fs.symlinkSync(at("physical/config"), at(`${side}/config`), process.platform === "win32" ? "junction" : "dir");
    write("aliases.json", { extends: ["./left/config/shared.json", "./right/config/shared.json"] });
    const policy = readProjectMembershipPolicy(at("aliases.json"));
    assert.deepEqual(policy.rootFileSpecs?.include, [pattern("right/src")]);
    assert.deepEqual(policy.excludedDirectories, [at("right/dist")]);
    assert.deepEqual(policy.sources, [
      "aliases.json", "left/config/shared.json", "left/parent.json",
      "right/config/shared.json", "right/parent.json",
    ].map(at));
    assert.deepEqual(readEffectiveTsconfigPaths(at("aliases.json")), { "@/*": [pattern("right/src/*")] });

    write("left/parent.json", { extends: "./../right/config/shared.json" });
    write("right/parent.json", { compilerOptions: { allowJs: true, outDir: "unreachable" } });
    write("aliases.json", { extends: "./left/config/shared.json" });
    const cycle = readProjectMembershipPolicy(at("aliases.json"));
    assert.deepEqual(cycle.excludedDirectories, []);
    assert.equal(cycle.inputExtensions.includes(".js"), false);
    assert.ok(cycle.sources.includes(at("right/config/shared.json")));
    assert.equal(cycle.sources.includes(at("right/parent.json")), false);
  });
  check("fresh reads see missing creation, resolution replacement and text changes", () => {
    write("fresh.json", { extends: "./generated" });
    const before = readProjectMembershipPolicy(at("fresh.json"));
    assert.ok(before.sources.includes(at("generated")));
    assert.ok(before.sources.includes(at("generated.json")));
    write("generated.json", { compilerOptions: { allowJs: true, outDir: "first" } });
    assert.ok(readProjectMembershipPolicy(at("fresh.json")).inputExtensions.includes(".js"));
    write("generated", { compilerOptions: { allowJs: false, outDir: "first" } });
    const selected = readProjectMembershipPolicy(at("fresh.json"));
    assert.equal(selected.inputExtensions.includes(".js"), false);
    assert.ok(selected.sources.includes(at("generated")));
    assert.equal(selected.sources.includes(at("generated.json")), false);
    const fixedTime = new Date("2020-01-01T00:00:00.000Z");
    fs.utimesSync(at("generated"), fixedTime, fixedTime);
    const original = fs.statSync(at("generated"));
    const originalBytes = fs.readFileSync(at("generated"));
    write("generated", { compilerOptions: { allowJs: false, outDir: "other" } });
    fs.utimesSync(at("generated"), original.atime, original.mtime);
    const changed = fs.statSync(at("generated"));
    assert.equal(changed.mtimeMs, original.mtimeMs);
    assert.equal(changed.size, original.size);
    assert.equal(fs.readFileSync(at("generated")).length, originalBytes.length);
    assert.deepEqual(readProjectMembershipPolicy(at("fresh.json")).excludedDirectories, [at("other")]);
  });
  check("unavailable and invalid roots remain best effort, then repair freshly", () => {
    for (const [name, text] of [
      ["malformed.json", "{ broken"], ["primitive.json", "7"],
      ["null.json", "null"], ["array.json", "[]"],
    ]) {
      fs.writeFileSync(at(name!), text!);
      const policy = readProjectMembershipPolicy(at(name!));
      assert.equal(policy.rootFileSpecs, undefined, name);
      assert.deepEqual(policy.sources, [at(name!)]);
    }
    fs.mkdirSync(at("directory.json"));
    for (const name of ["directory.json", "missing.json"])
      assert.equal(readProjectMembershipPolicy(at(name)).rootFileSpecs, undefined, name);
    write("malformed.json", { include: ["repaired"] });
    assert.deepEqual(readProjectMembershipPolicy(at("malformed.json")).rootFileSpecs?.include, [pattern("repaired")]);
  });
  if (failures.length !== 0)
    throw new AggregateError(failures, "config ancestry/freshness failed");
}

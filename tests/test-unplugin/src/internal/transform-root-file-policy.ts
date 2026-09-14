import { TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies inherited root specs agree with snapshot and path classification.
 *
 * A directory must be eligible before it exists so watch registration and walk
 * pruning agree. Literal files, implicit globs and configDir have different
 * meanings, and a skipped source must move to external-input validation.
 *
 * 1. Materialize a tree and base/leaf configs with contrasting specifications.
 * 2. Collect built-API snapshots and compare exact keys for each configuration.
 * 3. Require out-of-walk classification and compiler-option overlays to agree.
 */
export async function assertRootFilePolicyResolvesDiscoverySpecs(): Promise<void> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestProject.tmpdir("ttsc-root-file-policy-");
  const files = ["src/main.ts", "src/other.ts", "src/nested/deep.ts", "src/.hidden.ts", "test/a.ts", "scratch/a.ts", "src/a[1].ts"];
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), "export const value = 1;\n");
  }
  const config = path.join(root, "tsconfig.json");
  const scenarios: [Record<string, unknown>, string[]][] = [
    [{ include: ["src/*.ts"] }, ["src/a[1].ts", "src/main.ts", "src/other.ts"]],
    [{ include: ["src"] }, files.filter((file) => file.startsWith("src/") && !file.includes("/."))],
    [{ files: ["src/main.ts"] }, ["src/main.ts"]],
    [{ files: ["src/.hidden.ts"], include: ["test/?.ts"] }, ["src/.hidden.ts", "test/a.ts"]],
    [{ include: [] }, []],
    [{ include: ["src/**"] }, []],
    [{ include: ["src/a[1].ts"] }, ["src/a[1].ts"]],
    [{ include: ["${configDir}\\src\\nested\\*.ts"] }, ["src/nested/deep.ts"]],
  ];
  for (const [specs, expected] of scenarios) {
    fs.writeFileSync(config, JSON.stringify(specs));
    const policy = api.mergeMembershipPolicyOverlay(api.readProjectMembershipPolicy(config), { allowJs: true }, root);
    const snapshot = api.collectProjectInputHashSnapshot(root, undefined, undefined, policy);
    assert.equal(snapshot.complete, true);
    assert.deepEqual(Object.keys(snapshot.hashes).sort(), [...expected].sort(), JSON.stringify(specs));
    for (const file of files) {
      assert.equal(api.isProjectWalkPath(root, path.join(root, file), undefined, undefined, policy), expected.includes(file), file);
    }
  }
  fs.mkdirSync(path.join(root, "config"));
  const base = path.join(root, "config", "base.json");
  fs.writeFileSync(base, JSON.stringify({ include: ["../src/*.ts"] }));
  fs.writeFileSync(config, JSON.stringify({ extends: "./config/base.json" }));
  const inherited = api.readProjectMembershipPolicy(config);
  assert.ok(inherited.sources.some((file: string) => path.resolve(file) === base));
  assert.deepEqual(Object.keys(api.collectProjectInputHashes(root, undefined, undefined, inherited)).sort(), ["src/a[1].ts", "src/main.ts", "src/other.ts"]);
  fs.writeFileSync(config, JSON.stringify({ extends: "./config/base.json", include: ["test/*.ts"] }));
  assert.deepEqual(Object.keys(api.collectProjectInputHashes(root, undefined, undefined, api.readProjectMembershipPolicy(config))), ["test/a.ts"]);
}

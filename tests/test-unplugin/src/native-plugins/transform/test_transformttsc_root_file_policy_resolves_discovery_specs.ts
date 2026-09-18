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
export async function test_transformttsc_root_file_policy_resolves_discovery_specs(): Promise<void> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestProject.tmpdir("ttsc-root-file-policy-");
  const physicalRoot = fs.realpathSync.native(root);
  const files = [
    "src/main.ts",
    "src/other.ts",
    "src/nested/deep.ts",
    "src/artifact.ts/nested.ts",
    "src/.hidden.ts",
    "test/a.ts",
    "scratch/a.ts",
    "src/a[1].ts",
  ];
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), "export const value = 1;\n");
  }
  const config = path.join(root, "tsconfig.json");
  const scenarios: [Record<string, unknown>, string[]][] = [
    [{ include: ["src/*.ts"] }, ["src/a[1].ts", "src/main.ts", "src/other.ts"]],
    [
      { include: ["../*/src/*.ts"] },
      ["src/a[1].ts", "src/main.ts", "src/other.ts"],
    ],
    [
      { include: ["src"] },
      files.filter((file) => file.startsWith("src/") && !file.includes("/.")),
    ],
    [{ files: ["src/main.ts"] }, ["src/main.ts"]],
    [
      { files: ["src/.hidden.ts"], include: ["test/?.ts"] },
      ["src/.hidden.ts", "test/a.ts"],
    ],
    [{ include: [] }, []],
    [{ include: ["src/**"] }, []],
    [{ include: ["src/a[1].ts"] }, ["src/a[1].ts"]],
    [{ include: ["${configDir}\\src\\nested\\*.ts"] }, ["src/nested/deep.ts"]],
  ];
  for (const [specs, expected] of scenarios) {
    fs.writeFileSync(config, JSON.stringify(specs));
    const policy = api.mergeMembershipPolicyOverlay(
      api.readProjectMembershipPolicy(config),
      { allowJs: true },
      root,
    );
    for (const walkRoot of new Set([root, physicalRoot])) {
      const snapshot = api.collectProjectInputHashSnapshot(
        walkRoot,
        undefined,
        undefined,
        policy,
      );
      assert.equal(snapshot.complete, true);
      assert.deepEqual(
        Object.keys(snapshot.hashes).sort(),
        [...expected].sort(),
        JSON.stringify(specs),
      );
      for (const file of files) {
        assert.equal(
          api.isProjectWalkPath(
            walkRoot,
            path.join(walkRoot, file),
            undefined,
            undefined,
            policy,
          ),
          expected.includes(file),
          file,
        );
      }
    }
  }
  fs.mkdirSync(path.join(root, "config"));
  const base = path.join(root, "config", "base.json");
  fs.writeFileSync(base, JSON.stringify({ include: ["../src/*.ts"] }));
  fs.writeFileSync(config, JSON.stringify({ extends: "./config/base.json" }));
  const inherited = api.readProjectMembershipPolicy(config);
  assert.ok(
    inherited.sources.some((file: string) => path.resolve(file) === base),
  );
  assert.deepEqual(
    Object.keys(
      api.collectProjectInputHashes(root, undefined, undefined, inherited),
    ).sort(),
    ["src/a[1].ts", "src/main.ts", "src/other.ts"],
  );
  fs.writeFileSync(
    config,
    JSON.stringify({ extends: "./config/base.json", include: ["test/*.ts"] }),
  );
  assert.deepEqual(
    Object.keys(
      api.collectProjectInputHashes(
        root,
        undefined,
        undefined,
        api.readProjectMembershipPolicy(config),
      ),
    ),
    ["test/a.ts"],
  );

  // The same configured project opened through a junction must discover the
  // same roots. The link lives in this test's tracked temporary directory.
  const aliasParent = TestProject.tmpdir("ttsc-root-file-alias-");
  const alias = path.join(aliasParent, "project");
  fs.symlinkSync(
    root,
    alias,
    process.platform === "win32" ? "junction" : "dir",
  );
  for (const include of [
    ["src/*.ts"],
    ["${configDir}/src/*.ts"],
    ["../*/src/*.ts"],
  ]) {
    fs.writeFileSync(config, JSON.stringify({ include }));
    const policy = api.readProjectMembershipPolicy(
      path.join(alias, "tsconfig.json"),
    );
    for (const walkRoot of new Set([alias, root, physicalRoot])) {
      assert.deepEqual(
        Object.keys(
          api.collectProjectInputHashes(walkRoot, undefined, undefined, policy),
        ).sort(),
        ["src/a[1].ts", "src/main.ts", "src/other.ts"],
      );
      assert.equal(
        api.isProjectWalkPath(
          walkRoot,
          path.join(walkRoot, "src", "main.ts"),
          undefined,
          undefined,
          policy,
        ),
        true,
      );
      fs.writeFileSync(
        path.join(root, "src", "added.ts"),
        "export const added = 1;\n",
      );
      assert.ok(
        Object.keys(
          api.collectProjectInputHashes(walkRoot, undefined, undefined, policy),
        ).includes("src/added.ts"),
      );
      fs.unlinkSync(path.join(root, "src", "added.ts"));
    }
  }

  // Windows rejects LF in file names, but Unicode line separators are valid
  // there too. TypeScript wildcards consume every character except '/'.
  const special = process.platform === "win32" ? "\u2028" : "\n";
  const specialDirectory = `line${special}break`;
  fs.mkdirSync(path.join(root, specialDirectory));
  fs.writeFileSync(
    path.join(root, specialDirectory, `${special}.ts`),
    "export const value = 1;\n",
  );
  fs.writeFileSync(config, JSON.stringify({ include: ["line*break/?.ts"] }));
  const specialPolicy = api.readProjectMembershipPolicy(config);
  assert.deepEqual(
    Object.keys(
      api.collectProjectInputHashes(root, undefined, undefined, specialPolicy),
    ),
    [`${specialDirectory}/${special}.ts`],
  );

  // Native case-insensitive glob matching uses Unicode simple folding, which
  // equates sigma/final sigma even though their lowercase forms differ.
  fs.mkdirSync(path.join(root, "unicode"));
  fs.writeFileSync(path.join(root, "unicode", "\u03c3.ts"), "export {};\n");
  fs.writeFileSync(path.join(root, "unicode", "\u03c4.ts"), "export {};\n");
  for (const include of [["unicode/\u03c2.ts"], ["unicode/\u03c2*.ts"]]) {
    fs.writeFileSync(config, JSON.stringify({ include }));
    const unicodePolicy = api.readProjectMembershipPolicy(config);
    assert.deepEqual(
      Object.keys(
        api.collectProjectInputHashes(
          root,
          undefined,
          undefined,
          unicodePolicy,
        ),
      ),
      process.platform === "linux" ? [] : ["unicode/\u03c3.ts"],
      JSON.stringify(include),
    );
  }
}

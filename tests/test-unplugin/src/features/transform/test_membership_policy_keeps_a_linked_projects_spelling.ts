import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { collectProjectInputHashes } from "../../../../../packages/unplugin/lib/core/transform/project/collectProjectInputHashes.mjs";
import { isProjectWalkPath } from "../../../../../packages/unplugin/lib/core/transform/project/isProjectWalkPath.mjs";
import { readEffectiveTsconfigPaths } from "../../../../../packages/unplugin/lib/core/tsconfig/readEffectiveTsconfigPaths.mjs";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/lib/core/tsconfig/readProjectMembershipPolicy.mjs";

/**
 * Verifies every path the config chain yields for a project reached through a
 * link keeps the project's own spelling, so the walk that spells the project
 * the same way applies them (samchon/ttsc#1455).
 *
 * The readers anchored every derived path physically, after every link, while
 * the walk keeps the spelling the project was named by. On macOS every
 * temporary directory is such a link, `/var/…` to `/private/var/…`, and a
 * linked workspace is one anywhere. A project's `outDir` was then never
 * excluded from its walk, so an emitted file counted as a program input and
 * every emit replaced the generation; the configs the chain read, its `paths`
 * targets, and its root file lists were spelled under a directory the host
 * never named. TypeScript anchors a config at the path it was named by, and a
 * relative `extends` against that directory, which is what the readers do now.
 * Measured on the first macOS run of the whole suite (run 35478519798).
 *
 * 1. Create a project whose base config declares `outDir` and `paths`, with a
 *    source and an emitted file, and link the project elsewhere.
 * 2. Read the policy through the link, and assert its configs, root, output
 *    exclusion, and `paths` targets are all spelled under the link.
 * 3. Assert the walk under the link admits the source and not the emitted file.
 */
export async function test_membership_policy_keeps_a_linked_projects_spelling(): Promise<void> {
  const physical = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-linked-policy-"),
  );
  fs.mkdirSync(path.join(physical, "config"));
  fs.writeFileSync(
    path.join(physical, "config", "base.json"),
    JSON.stringify({
      compilerOptions: { outDir: "../dist", paths: { "@/*": ["../src/*"] } },
    }),
  );
  fs.writeFileSync(
    path.join(physical, "tsconfig.json"),
    JSON.stringify({ extends: "./config/base.json" }),
  );
  for (const file of ["src/main.ts", "dist/main.ts"]) {
    fs.mkdirSync(path.join(physical, path.dirname(file)), { recursive: true });
    fs.writeFileSync(path.join(physical, file), "export {};\n");
  }
  const linked = path.join(TestProject.tmpdir("ttsc-link-"), "project");
  fs.symlinkSync(
    physical,
    linked,
    process.platform === "win32" ? "junction" : "dir",
  );
  const under = (root: string) => (file: string) =>
    file === root || file.startsWith(`${root}${path.sep}`);

  const tsconfig = path.join(linked, "tsconfig.json");
  const policy = readProjectMembershipPolicy(tsconfig);
  assert.deepEqual(
    [...policy.sources].sort(),
    [path.join(linked, "config", "base.json"), tsconfig],
    "the configs read are spelled under the link",
  );
  assert.equal(policy.rootFileSpecs?.root?.path, linked);
  assert.ok(
    policy.excludedDirectories.includes(path.join(linked, "dist")),
    `the inherited outDir is excluded under the link: ${JSON.stringify(policy.excludedDirectories)}`,
  );
  assert.equal(
    policy.excludedDirectories.some(under(physical)),
    false,
    "nothing is spelled under the physical directory",
  );
  // `paths` targets are spelled with TypeScript's separators.
  assert.deepEqual(readEffectiveTsconfigPaths(tsconfig), {
    "@/*": [path.join(linked, "src", "*").split(path.sep).join("/")],
  });

  const walkSees = (file: string): boolean =>
    isProjectWalkPath(
      linked,
      path.join(linked, ...file.split("/")),
      undefined,
      undefined,
      policy,
    );
  assert.equal(walkSees("src/main.ts"), true);
  assert.equal(walkSees("dist/main.ts"), false, "the outDir is excluded");
  assert.deepEqual(
    Object.keys(
      collectProjectInputHashes(linked, undefined, undefined, policy),
    ),
    ["src/main.ts"],
  );
}

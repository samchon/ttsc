import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";

/**
 * Verifies the membership policy reports every config it consulted, including
 * one that does not exist yet.
 *
 * A caller that memoizes a policy has to know when to stop trusting it, and the
 * leaf config alone cannot tell it: `allowJs`, `resolveJsonModule`, `outDir`,
 * `declarationDir`, and `exclude` all resolve through the whole `extends`
 * chain. `@ttsc/metro` stamps this list in a worker that outlives many runs, so
 * a missed config would hold a policy the next run's walk already disagrees
 * with. A base that does not exist yet counts too, since it can be generated
 * during install or arrive with a branch switch.
 *
 * 1. Extend a missing base, and assert the leaf and the unresolved target are both
 *    reported.
 * 2. Assert the resolver's `.json` candidates are reported for extensionless and
 *    differently cased specifiers.
 * 3. Create the base with an `exclude` and assert the policy applies it and still
 *    reports the base.
 */
export async function test_transformttsc_the_policy_reports_every_config_it_read(): Promise<void> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 1 });
  const leaf = path.join(project.root, "tsconfig.json");
  const base = path.join(project.root, "tsconfig.base.json");
  const declared = JSON.parse(fs.readFileSync(leaf, "utf8")) as {
    compilerOptions: Record<string, unknown>;
  };
  fs.writeFileSync(
    leaf,
    JSON.stringify({ ...declared, extends: "./tsconfig.base.json" }),
    "utf8",
  );

  // The base is absent, and its candidate path is still reported, because its
  // later creation changes the policy.
  const before = api.readProjectMembershipPolicy(leaf);
  assert.ok(
    before.sources.includes(leaf),
    `the leaf must be reported (got ${before.sources.join(", ")})`,
  );
  assert.ok(
    before.sources.some((source: string) => path.resolve(source) === base),
    `an unresolved extends target must be reported (got ${before.sources.join(", ")})`,
  );

  // The extension-less spelling records both candidates the resolver tries,
  // since `./tsconfig.base` resolves to `tsconfig.base.json` and recording only
  // the literal name would leave the stamp unmoved when the file appears.
  fs.writeFileSync(
    leaf,
    JSON.stringify({ ...declared, extends: "./tsconfig.base" }),
    "utf8",
  );
  const extensionless = api.readProjectMembershipPolicy(leaf);
  assert.ok(
    extensionless.sources.some(
      (source: string) => path.resolve(source) === base,
    ),
    `the resolver's .json candidate must be reported (got ${extensionless.sources.join(", ")})`,
  );
  // The resolver's `.json` test is case-sensitive, so `./base.JSON` really does
  // resolve to `base.JSON.json` on a case-sensitive filesystem, and the stamp
  // has to record that name. Asserted on what the policy reports rather than on
  // what resolves, so it holds on every platform.
  fs.writeFileSync(
    leaf,
    JSON.stringify({ ...declared, extends: "./tsconfig.base.JSON" }),
    "utf8",
  );
  const uppercase = api.readProjectMembershipPolicy(leaf);
  assert.ok(
    uppercase.sources.some(
      (source: string) =>
        path.resolve(source) ===
        path.join(project.root, "tsconfig.base.JSON.json"),
    ),
    `the resolver's case-sensitive .json candidate must be reported (got ${uppercase.sources.join(", ")})`,
  );

  fs.writeFileSync(
    leaf,
    JSON.stringify({ ...declared, extends: "./tsconfig.base.json" }),
    "utf8",
  );

  // And once it exists, it decides an answer the leaf never mentions.
  fs.writeFileSync(base, JSON.stringify({ exclude: ["generated"] }), "utf8");
  const after = api.readProjectMembershipPolicy(leaf);
  assert.ok(
    after.excludedDirectories.some(
      (directory: string) =>
        path.resolve(directory) === path.join(project.root, "generated"),
    ),
    `the base config's exclude must reach the policy (got ${after.excludedDirectories.join(", ")})`,
  );
  assert.ok(
    after.sources.some((source: string) => path.resolve(source) === base),
    "and the base must still be reported once it resolves",
  );
}

import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { TestMetroRuntime } from "../../internal/metro-runtime";

/**
 * Verifies Metro routes implicit files through the common reference policy.
 *
 * A static fingerprint that includes reference configs does not establish that
 * the worker actually selects their programs. This exercises the view frozen
 * into the transform and its retained routing evidence without native builds.
 *
 * 1. Select through nested and cyclic references, retaining earlier rejected configs.
 * 2. Change a rejected config's admission and reselect on the next delivery.
 * 3. Distinguish nearest admission, explicit selection and no-match fallback.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual Metro resolveProjectView operation and asserts its selected config, membership roots and current consulted-config evidence. These are the exact view consumed by the transformer and recorder; actual native worker assembly is a separate E2E responsibility.
 * @evidence contracts/testing.md#independent-expectations Literal authored reference order and include/files rules establish the expected owner independently of the selector; SHA256 of the authored rejected config establishes its content evidence.
 * @evidence contracts/testing.md#distinguishing-cases Covers nested/cyclic traversal, missing references, first admission, same-file config edits, nearest admission, explicit bypass and total no-match fallback; rejected configs must remain content inputs.
 * @evidence contracts/testing.md#execution-ownership This discovered unit calls the authored resolver over its isolated fixture filesystem through the existing source loader. It neither installs a consumer nor starts a compiler or host, and TestProject owns the temporary directory.
 */
export async function test_project_view_follows_solution_references(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-metro-solution-selection-");
  const src = path.join(root, "src");
  fs.mkdirSync(src);
  const file = path.join(src, "main.ts");
  fs.writeFileSync(file, "export const value = 1;\n");
  const nearest = path.join(root, "tsconfig.json");
  const first = path.join(root, "first.json");
  const nested = path.join(root, "nested.json");
  const app = path.join(root, "app.json");
  const missing = path.join(root, "missing.json");
  const write = (config: string, value: unknown): void => {
    fs.writeFileSync(config, JSON.stringify(value));
  };
  write(nearest, {
    files: [],
    references: [
      { path: "./missing.json" },
      { path: "./first.json" },
      { path: "./nested.json" },
    ],
  });
  write(first, { files: [], include: ["other/**/*.ts"] });
  write(nested, {
    files: [],
    references: [{ path: "./tsconfig.json" }, { path: "./app.json" }],
  });
  write(app, { include: ["src/**/*.ts"] });
  const fingerprint = await TestMetroRuntime.loadFingerprint();
  const resolve = (explicitProject?: string) =>
    fingerprint.resolveProjectView({
      explicitProject,
      filename: file,
      projectRoot: root,
    });

  const initial = resolve();
  assert.equal(initial.tsconfig, app);
  assert.ok(initial.roots.includes(root));
  for (const config of [nearest, first, nested, missing]) {
    assert.ok(
      initial.discoveryInputs.some(
        (input: { file: string }) => path.resolve(input.file) === config,
      ),
      "retain every consulted config, including a missing reference",
    );
  }
  const firstEvidence = initial.discoveryInputs.find(
    (input: { file: string }) => input.file === first,
  ).evidence;
  assert.equal(firstEvidence.state.codec, "host");
  assert.equal(
    firstEvidence.state.hash,
    createHash("sha256").update(fs.readFileSync(first)).digest("hex"),
  );

  write(first, { include: ["src/**/*.ts"] });
  assert.equal(resolve().tsconfig, first, "earlier newly admitted project wins");
  assert.equal(resolve(app).tsconfig, app, "explicit project bypasses routing");
  write(nearest, {
    include: ["src/**/*.ts"],
    references: [{ path: "./app.json" }],
  });
  assert.equal(resolve().tsconfig, nearest, "nearest admitted project wins");

  write(nearest, { files: [], references: [{ path: "./missing.json" }] });
  assert.equal(resolve().tsconfig, nearest, "no-match retains nearest config");
  write(missing, { include: ["src/**/*.ts"] });
  assert.equal(resolve().tsconfig, missing, "a missing reference can become owner");
}

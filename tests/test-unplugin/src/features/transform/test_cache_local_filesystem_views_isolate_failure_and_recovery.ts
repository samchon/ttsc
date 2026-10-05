import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/createTtscTransformCache";
import { resetTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/resetTtscTransformCache";
import { transformFilesystem } from "../../../../../packages/unplugin/src/core/transform/cache/transformFilesystem";
import { createHostPathIdentityContext } from "../../../../../packages/unplugin/src/core/transform/filesystem/createHostPathIdentityContext";
import { createGenerationProofFailures } from "../../../../../packages/unplugin/src/core/transform/generation/createGenerationProofFailures";
import { createUnstableGenerationError } from "../../../../../packages/unplugin/src/core/transform/generation/createUnstableGenerationError";
import { projectWalkFailureFingerprint } from "../../../../../packages/unplugin/src/core/transform/generation/projectWalkFailureFingerprint";
import { recordGenerationProofFailure } from "../../../../../packages/unplugin/src/core/transform/generation/recordGenerationProofFailure";
import { collectProjectInputSnapshot } from "../../../../../packages/unplugin/src/core/transform/project/collectProjectInputSnapshot";
import { walkSnapshotComplete } from "../../../../../packages/unplugin/src/core/transform/validation/walkSnapshotComplete";
import { mergeMembershipPolicyOverlay } from "../../../../../packages/unplugin/src/core/tsconfig/mergeMembershipPolicyOverlay";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/readProjectMembershipPolicy";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies cache-local observing failures never leak into a sibling view.
 *
 * Real snapshots expose the failure and recovery; no compiler request or
 * synthetic native envelope is needed to select the owning filesystem table.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual createTtscTransformCache/transformFilesystem/collectProjectInputSnapshot isolate two provider tables. One nested readdir EACCES yields incomplete directory authority while the sibling reads and independently hashes both files; recovering that provider yields a complete first snapshot without changing the sibling's observations.
 * @evidence contracts/testing.md#independent-expectations Native roots, literal directory-read-failed classification, true/false completeness and Node SHA-256 over authored main/hidden bytes are independent expectations. Provider traces must never enter the sibling root, detecting cross-cache observation or global mutation.
 * @evidence contracts/testing.md#distinguishing-cases Concurrently retained views contrast refused and healthy enumeration, omitted defaults preserve native reading, and a subsequent recovered first view contrasts with a still-healthy unchanged sibling. Both caches and all trace ledgers have distinct owners. A separate native inherited-src outDir is replaced by the actual generated overlay policy: forty output assets and forty non-admitted src assets add no byte reads, while src source appearance/edit/removal changes literal collected hashes. Independent native Node digests establish content expectations.
 * @evidence contracts/testing.md#execution-ownership This exported unit invokes source snapshot owners in process over two native temporary corpora and supported cache-local filesystem arguments. It starts no compiler, peer, process or host; actual capture-loop selection remains separate. Two refused native snapshots also feed the actual terminal diagnostic owner, preserving exact two-attempt text and project/directory-read-failed attribution without asserting compiler retry execution. Finally resets both caches.
 */
export function test_cache_local_filesystem_views_isolate_failure_and_recovery(): void {
  const roots = [0, 1].map(() => TestProject.tmpdir("ttsc-local-view-unit-"));
  const text = "export const main = 1;\n";
  const hidden = "export const hidden = 2;\n";
  for (const root of roots)
    TestProject.writeFiles(root, {
      "tsconfig.json": '{"include":["src"]}',
      "src/main.ts": text,
      "src/nested/hidden.ts": hidden,
    });
  let blocked = true;
  const reads = [0, 0];
  const traces = roots.map(() => [] as string[]);
  const failurePath = path.join(roots[0]!, "src", "nested");
  let faults = 0;
  const caches = roots.map((_root, index) =>
    createTtscTransformCache({
      readFile: (file) => {
        reads[index]! += 1;
        traces[index]!.push(path.resolve(file));
        return fs.readFileSync(file);
      },
      readdir: (directory) => {
        traces[index]!.push(path.resolve(directory));
        if (
          index === 0 &&
          blocked &&
          path.resolve(directory) === path.resolve(failurePath)
        ) {
          faults += 1;
          throw Object.assign(new Error("first view cannot enumerate"), {
            code: "EACCES",
          });
        }
        return fs.readdirSync(directory, { withFileTypes: true });
      },
    }),
  );
  const observe = (index: number) => {
    const root = roots[index]!;
    const filesystem = transformFilesystem(caches[index]);
    return collectProjectInputSnapshot(
      root,
      createHostPathIdentityContext(filesystem),
      filesystem,
      undefined,
      {
        policy: readProjectMembershipPolicy(path.join(root, "tsconfig.json")),
      },
    );
  };
  const digest = (source: string) =>
    createHash("sha256").update(source).digest("hex");
  try {
    assert.notEqual(
      transformFilesystem(caches[0]),
      transformFilesystem(caches[1]),
    );
    const failed = observe(0);
    const healthy = observe(1);
    assert.equal(walkSnapshotComplete(failed, undefined), false);
    assert.equal(failed.directoryComplete, false);
    assert.deepEqual(
      failed.walkFailures.map((failure) => ({
        kind: failure.kind,
        path: failure.path,
      })),
      [{ kind: "directory-read-failed", path: failurePath }],
    );
    assert.equal(walkSnapshotComplete(healthy, undefined), true);
    assert.equal(healthy.hashes["src/main.ts"], digest(text));
    assert.equal(healthy.hashes["src/nested/hidden.ts"], digest(hidden));
    assert.ok(reads[0]! > 0);
    assert.ok(reads[1]! > 0);
    assert.ok(faults > 0);
    for (const [index, locations] of traces.entries()) {
      for (const location of locations) {
        const relative = path.relative(roots[1 - index]!, location);
        assert.ok(
          relative === ".." ||
            relative.startsWith(".." + path.sep) ||
            path.isAbsolute(relative),
          "a cache must never observe its sibling project",
        );
      }
    }
    const failedAgain = observe(0);
    const attempts = [failed, failedAgain].map((snapshot) => {
      const failures = createGenerationProofFailures();
      for (const failure of snapshot.walkFailures)
        recordGenerationProofFailure(failures, {
          domain: "project",
          kind: failure.kind,
          path: failure.path,
        });
      return failures;
    });
    const filesystem = transformFilesystem(caches[0]);
    const identities = createHostPathIdentityContext(filesystem);
    const validation = {
      cached: {
        inputHashes: failedAgain.hashes,
        membershipPolicy: readProjectMembershipPolicy(
          path.join(roots[0]!, "tsconfig.json"),
        ),
        projectRoot: roots[0]!,
        result: { type: "success" as const, typescript: {} },
        tsconfig: path.join(roots[0]!, "tsconfig.json"),
      },
      declaredInputs: undefined,
      inputStates: new Map(),
      projectInputHashes: failedAgain.hashes,
      projectWalkComplete: false,
      projectWalkFailures: projectWalkFailureFingerprint(
        failedAgain,
        undefined,
        roots[0]!,
        identities,
      ),
    };
    const terminal = createUnstableGenerationError(
      roots[0]!,
      attempts,
      validation,
    );
    assert.equal(terminal.validation, validation);
    assert.equal(
      terminal.message,
      [
        "ttsc: could not capture a reusable transform generation after 2 attempts.",
        "  project: " + JSON.stringify(roots[0]!),
        "  attempt 1:",
        '    - project/directory-read-failed: "src/nested"',
        "  attempt 2:",
        '    - project/directory-read-failed: "src/nested"',
        "  Stop writes to the listed inputs before compilation, or fix the producer that omitted or contradicted the listed proof.",
      ].join("\n"),
    );
    // These are two actual observation inputs to the renderer. They do not
    // assert that transformProject executed or exhausted its capture loop.
    blocked = false;
    const recovered = observe(0);
    assert.equal(walkSnapshotComplete(recovered, undefined), true);
    assert.deepEqual(recovered.walkFailures, []);
    assert.equal(recovered.hashes["src/main.ts"], digest(text));
    assert.equal(recovered.hashes["src/nested/hidden.ts"], digest(hidden));
    assert.deepEqual(observe(1).hashes, healthy.hashes);
  } finally {
    for (const cache of caches) resetTtscTransformCache(cache);
  }
  const overlayRoot = fs.realpathSync.native(
    TestProject.createProject({
      "base.json": '{"compilerOptions":{"outDir":"src"}}',
      "tsconfig.json": '{"extends":"./base.json"}',
      "src/main.ts": "export const main = 1;\n",
    }),
  );
  const inherited = readProjectMembershipPolicy(
    path.join(overlayRoot, "tsconfig.json"),
  );
  const effective = mergeMembershipPolicyOverlay(
    inherited,
    { outDir: "${configDir}\\generated" },
    overlayRoot,
  );
  assert.ok(
    inherited.excludedDirectories.includes(path.join(overlayRoot, "src")),
  );
  assert.equal(
    effective.excludedDirectories.includes(path.join(overlayRoot, "src")),
    false,
  );
  assert.ok(
    effective.excludedDirectories.includes(path.join(overlayRoot, "generated")),
  );
  const selectedReads: string[] = [];
  const overlayCache = createTtscTransformCache({
    readFile: (input) => {
      selectedReads.push(input);
      return fs.readFileSync(input);
    },
  });
  const collect = () => {
    const filesystem = transformFilesystem(overlayCache);
    return collectProjectInputSnapshot(
      overlayRoot,
      createHostPathIdentityContext(filesystem),
      filesystem,
      undefined,
      {
        policy: effective,
        declaredKeys: new Set(["src/main.ts", "src/late.ts"]),
      },
    );
  };
  try {
    const initial = collect();
    assert.equal(initial.complete, true);
    assert.deepEqual(selectedReads, [path.join(overlayRoot, "src", "main.ts")]);
    const steadyReads = selectedReads.length;
    const assets: Record<string, string> = {
      "generated/emitted.ts": "export const generated = 1;\n",
    };
    for (let index = 0; index < 40; index += 1) {
      assets["generated/chunk-" + index + ".js"] = "// output\n";
      assets["src/asset-" + index + ".js"] = "// ignored\n";
    }
    TestProject.writeFiles(overlayRoot, assets);
    selectedReads.length = 0;
    const ignored = collect();
    assert.equal(ignored.complete, true);
    assert.deepEqual(ignored.hashes, initial.hashes);
    assert.ok(
      selectedReads.length <= steadyReads,
      "forty irrelevant assets in each tree add no byte comparisons",
    );
    assert.deepEqual(selectedReads, [path.join(overlayRoot, "src", "main.ts")]);
    const late = path.join(overlayRoot, "src", "late.ts");
    fs.writeFileSync(late, "export const late = 1;\n");
    const appeared = collect();
    assert.equal(appeared.complete, true);
    assert.deepEqual(Object.keys(appeared.hashes).sort(), [
      "src/late.ts",
      "src/main.ts",
    ]);
    assert.equal(
      appeared.hashes["src/late.ts"],
      digest("export const late = 1;\n"),
    );
    fs.writeFileSync(late, "export const late = 2;\n");
    assert.equal(
      collect().hashes["src/late.ts"],
      digest("export const late = 2;\n"),
    );
    fs.unlinkSync(late);
    assert.deepEqual(
      collect().hashes,
      initial.hashes,
      "removal remains visible under the replaced inherited outDir",
    );
  } finally {
    resetTtscTransformCache(overlayCache);
  }
}

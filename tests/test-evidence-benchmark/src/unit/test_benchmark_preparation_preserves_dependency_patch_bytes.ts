import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

import type { EvidenceBenchmarkWorkspace as Workspace } from "../../../../benchmarks/evidence/src/EvidenceBenchmarkWorkspace";

/**
 * Verifies neutral preparation retains exact dependency patch bytes and versions.
 *
 * The arms install outside the repository, so declaring a patch only at the
 * repository root loses its source correction. Both exact bindings and bytes
 * must travel with preparation; a collision or escaped patch must fail before
 * the delivered workspace configuration changes.
 *
 * 1. Supply distinct repository and consumer patch bindings with literal bytes.
 * 2. Apply actual preparation to two independent arm directories and compare them.
 * 3. Assert retained existing overrides, exact versions and copied patch bytes.
 * 4. Reject conflicting bindings, occupied/linked destinations, folded names and escaped sources.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls authored adoptRepositoryPatches against actual Node filesystem inputs, comparing both prepared mappings and patch bytes; selector/version conflicts, occupied or linked patch directories, folded basename collisions, malformed selectors and escaped source paths must reject before changing workspace YAML.
 * @evidence contracts/testing.md#independent-expectations Independently authored typia/core selectors, exact versions, binary patch buffers and an existing unrelated override supply literal expectations. Source and destination buffers are compared directly rather than trusting a reported copy hash.
 * @evidence contracts/testing.md#distinguishing-cases Repository and consumer mappings combine identically in two distinct arms; accepted exact bindings contrast existing-selector, conflicting-version, occupied directory, linked directory, case-folded name, malformed selector and outside-repository negatives. Neither an installation nor emitted provenance is claimed by this source operation case.
 * @evidence contracts/testing.md#execution-ownership The matching named src/unit function loads authored preparation through the source-unit CommonJS loader, uses only owned temporary filesystem/YAML inputs, and removes its exact root in finally; no benchmark cell, requirements, template, package installation or native producer is run.
 */
export function test_benchmark_preparation_preserves_dependency_patch_bytes(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-benchmark-patches-unit-"));
  try {
    const repository = path.join(root, "repository");
    const assets = path.join(repository, "benchmarks", "evidence");
    fs.mkdirSync(assets, { recursive: true });
    fs.mkdirSync(path.join(repository, "patches"));
    const typiaBytes = Buffer.from("typia source correction\r\n\0", "utf8");
    const coreBytes = Buffer.from("core committed-write correction\n", "utf8");
    fs.writeFileSync(path.join(repository, "patches", "typia.patch"), typiaBytes);
    fs.writeFileSync(path.join(repository, "patches", "core.patch"), coreBytes);
    fs.writeFileSync(path.join(repository, "pnpm-workspace.yaml"),
      "patchedDependencies:\n  typia@15.0.0: patches/typia.patch\n");
    const consumerManifest = path.join(assets, "dependency-patches.json");
    fs.writeFileSync(consumerManifest, JSON.stringify({
      patchedDependencies: { "@nestia/core@14.0.1": "patches/core.patch" },
    }));
    const owner = (createRequire(import.meta.url)(
      fileURLToPath(new URL("../../../../benchmarks/evidence/src/EvidenceBenchmarkWorkspace.ts", import.meta.url)),
    ) as { EvidenceBenchmarkWorkspace: typeof Workspace }).EvidenceBenchmarkWorkspace;
    const initial = "# retained comment\npackages: [packages/*]\noverrides:\n  retained: 1.2.3\n";
    const makeWorkspace = (name: string, source = initial): string => {
      const workspace = path.join(root, name);
      fs.mkdirSync(workspace);
      fs.writeFileSync(path.join(workspace, "pnpm-workspace.yaml"), source);
      return workspace;
    };
    const prepared = [];
    for (const name of ["plain", "evidence"]) {
      const workspace = makeWorkspace(name);
      owner.adoptRepositoryPatches(repository, workspace);
      const source = fs.readFileSync(path.join(workspace, "pnpm-workspace.yaml"), "utf8");
      assert.ok(source.startsWith("# retained comment\n"));
      assert.deepEqual(YAML.parse(source).patchedDependencies, {
        "typia@15.0.0": ".benchmark-patches/typia.patch",
        "@nestia/core@14.0.1": ".benchmark-patches/core.patch",
      });
      assert.deepEqual(YAML.parse(source).overrides, {
        typia: "15.0.0", "@nestia/core": "14.0.1", retained: "1.2.3",
      });
      assert.deepEqual(fs.readFileSync(path.join(workspace, ".benchmark-patches", "typia.patch")), typiaBytes);
      assert.deepEqual(fs.readFileSync(path.join(workspace, ".benchmark-patches", "core.patch")), coreBytes);
      prepared.push(source);
    }
    assert.equal(prepared[0], prepared[1]);
    const rejected = [
      { name: "existing-patch", source: "patchedDependencies:\n  typia@15.0.0: existing.patch\n", error: /already patches/ },
      { name: "conflicting-version", source: "overrides:\n  typia: 99.0.0\n", error: /version conflicts/ },
    ];
    for (const scenario of rejected) {
      const workspace = makeWorkspace(scenario.name, scenario.source);
      assert.throws(() => owner.adoptRepositoryPatches(repository, workspace), scenario.error);
      assert.equal(fs.readFileSync(path.join(workspace, "pnpm-workspace.yaml"), "utf8"), scenario.source);
      assert.equal(fs.existsSync(path.join(workspace, ".benchmark-patches")), false);
    }
    const occupied = makeWorkspace("occupied");
    fs.mkdirSync(path.join(occupied, ".benchmark-patches"));
    assert.throws(() => owner.adoptRepositoryPatches(repository, occupied), /directory is already occupied/);
    assert.equal(fs.readFileSync(path.join(occupied, "pnpm-workspace.yaml"), "utf8"), initial);
    assert.deepEqual(fs.readdirSync(path.join(occupied, ".benchmark-patches")), []);
    const foreign = path.join(root, "foreign");
    fs.mkdirSync(foreign);
    const linked = makeWorkspace("linked");
    fs.symlinkSync(foreign, path.join(linked, ".benchmark-patches"), process.platform === "win32" ? "junction" : "dir");
    assert.throws(() => owner.adoptRepositoryPatches(repository, linked), /directory is already occupied/);
    assert.deepEqual(fs.readdirSync(foreign), []);
    assert.equal(fs.readFileSync(path.join(linked, "pnpm-workspace.yaml"), "utf8"), initial);
    fs.mkdirSync(path.join(repository, "second"));
    fs.writeFileSync(path.join(repository, "second", "TYPIA.patch"), coreBytes);
    fs.writeFileSync(consumerManifest, JSON.stringify({
      patchedDependencies: { "@nestia/core@14.0.1": "second/TYPIA.patch" },
    }));
    const folded = makeWorkspace("folded-name");
    assert.throws(() => owner.adoptRepositoryPatches(repository, folded), /destination collides/);
    assert.equal(fs.existsSync(path.join(folded, ".benchmark-patches")), false);
    assert.equal(fs.readFileSync(path.join(folded, "pnpm-workspace.yaml"), "utf8"), initial);
    fs.writeFileSync(consumerManifest, '{"patchedDependencies":{"__proto__":"patches/core.patch"}}');
    const malformed = makeWorkspace("malformed-selector");
    assert.throws(() => owner.adoptRepositoryPatches(repository, malformed), /exact package version/);
    assert.equal(fs.existsSync(path.join(malformed, ".benchmark-patches")), false);
    assert.equal(fs.readFileSync(path.join(malformed, "pnpm-workspace.yaml"), "utf8"), initial);
    fs.writeFileSync(path.join(root, "outside.patch"), "outside bytes");
    fs.writeFileSync(consumerManifest, JSON.stringify({
      patchedDependencies: { "@nestia/core@14.0.1": "../outside.patch" },
    }));
    const escaped = makeWorkspace("escaped");
    assert.throws(() => owner.adoptRepositoryPatches(repository, escaped), /leaves its repository/);
    assert.equal(fs.readFileSync(path.join(escaped, "pnpm-workspace.yaml"), "utf8"), initial);
    assert.equal(fs.existsSync(path.join(escaped, ".benchmark-patches")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

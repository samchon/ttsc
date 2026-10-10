import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { pluginSourceDigest } from "../../../../../packages/ttsc/src/plugin/internal/source/pluginSourceDigest";
import { provenPluginSourceDigest } from "../../../../../packages/ttsc/src/plugin/internal/source/provenPluginSourceDigest";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies the `ttsc/plugin-source` entry proves a plugin source from the
 * records of the project its caller names, and reads it without one.
 *
 * WARNING (#1725): a bundler worker, a capability host and the language server
 * prove reported plugin-source states in processes of their own. Before this
 * entry each of them read every plugin source byte again on its first proof,
 * although the load that reported the state had recorded the digest in the
 * project's plugin cache. Corrupting only the recorded digest distinguishes a
 * reused record from a fresh reading.
 *
 * 1. Record a module's digest through a named project and corrupt it; the next
 *    proof through the same project returns the record.
 * 2. Without a project, the same module is read and gives its real digest.
 * 3. An edit reads the module again even through the project.
 *
 * @evidence contracts/testing.md#behavioral-verification The public entry runs against a real module directory and the cache root the named project's environment selects; the returned digest and the record file are the observed behavior.
 * @evidence contracts/testing.md#independent-expectations pluginSourceDigest called directly is the oracle for every reading; the corrupted literal is the oracle for a reused record.
 * @evidence contracts/testing.md#distinguishing-cases A named project with unchanged separable metadata reuses; no project reads; an edit through the project reads again.
 * @evidence contracts/testing.md#execution-ownership The named unit calls the entry directly over a copied package fixture and a private cache root; no Go process or native build runs.
 */
export function test_provenpluginsourcedigest_reuses_the_named_projects_record(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-proven-source-"),
  );
  TestProject.copyDirectory(
    path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "ttsc",
      "test",
      "fixtures",
      "unit",
      "plugincontentidentities_reuses_a_digest_only_while_its_metadata_holds",
      "inputs-1",
    ),
    root,
  );
  const module = path.join(root, "plugin");
  for (const parts of [["main.go"], ["internal", "mark", "mark.go"]]) {
    const file = path.join(module, ...parts);
    fs.renameSync(`${file}.txt`, file);
  }
  const cache = path.join(root, "cache");
  const env = { TTSC_CACHE_DIR: cache };
  const settle = (): void => {
    const past = new Date(Date.now() - 3_600_000);
    for (const file of listFiles(module)) fs.utimesSync(file, past, past);
  };
  const record = (): string => {
    const directory = path.join(cache, "identities");
    const entries = fs
      .readdirSync(directory)
      .filter((name) => name.endsWith(".json"));
    assert.equal(entries.length, 1, "one directory, one record");
    return path.join(directory, entries[0]!);
  };
  const corrupted = "0".repeat(64);
  const failures: unknown[] = [];
  const verify = (name: string, run: () => void): void => {
    try {
      run();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };

  settle();
  verify("a named project's record is reused", () => {
    assert.equal(
      provenPluginSourceDigest(module, root, env),
      pluginSourceDigest(module),
    );
    const file = record();
    const entry = JSON.parse(fs.readFileSync(file, "utf8")) as {
      digest: string;
    };
    entry.digest = corrupted;
    fs.writeFileSync(file, JSON.stringify(entry));
    assert.equal(provenPluginSourceDigest(module, root, env), corrupted);
  });
  verify("without a project the module is read", () => {
    assert.equal(
      provenPluginSourceDigest(module, undefined, env),
      pluginSourceDigest(module),
    );
  });
  verify("an edit reads the module again through the project", () => {
    fs.writeFileSync(
      path.join(module, "internal", "mark", "mark.go"),
      'package mark\n\nconst Marker = "edited"\n',
    );
    settle();
    assert.equal(
      provenPluginSourceDigest(module, root, env),
      pluginSourceDigest(module),
    );
  });

  if (failures.length !== 0)
    throw new AggregateError(failures, "proven plugin source matrix failed");
}

function listFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const location = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(location) : [location];
  });
}

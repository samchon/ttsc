import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestLintPlugin } from "../../internal/TestLintPlugin";
import { createLintProject } from "../../internal/config-file";

/**
 * Verifies a CJS lint config rejects distinct contributor namespaces that
 * normalize to the same Go subpackage name.
 *
 * The descriptor factory used to keep the first normalized name and silently
 * drop every later contributor. This config-evaluation boundary owns the
 * user-facing diagnostic, so it must name all colliding namespaces and the
 * shared Go name before a native host build can hide the cause.
 *
 * 1. Materialize CJS configs with collision permutations and an exact-repeat fold.
 * 2. Invoke the real built lint descriptor factory and assert its diagnostic.
 * 3. Prove non-colliding and single-hyphen namespaces still produce descriptors.
 */
export const test_descriptor_rejects_colliding_contributor_namespaces_from_cjs_config =
  () => {
    const colliding = ["a-b", "a_b"];
    const forward = assertCollision(colliding, "a_b");
    assert.equal(assertCollision([...colliding].reverse(), "a_b"), forward);
    assertCollision(["a-b-c", "a_b-c", "a-b_c"], "a_b_c");

    const repeated = createLintProject({
      name: "contributor-namespace-cjs-repeated",
      source: "export const value = 1;\n",
      pluginConfig: { configFile: "./lint.config.cjs" },
    });
    try {
      const first = createContributorSource(repeated.tmpdir, "first");
      const later = createContributorSource(repeated.tmpdir, "later");
      writeCjsConfigValue(repeated.tmpdir, [
        { plugins: { "react-hooks": { source: first } } },
        { plugins: { "react-hooks": { source: later } } },
      ]);
      assert.deepEqual(loadContributors(repeated.tmpdir), [
        { name: "react_hooks", source: first },
      ]);
    } finally {
      repeated.cleanup();
    }

    const project = createLintProject({
      name: "contributor-namespace-cjs-noncollision",
      source: "export const value = 1;\n",
      pluginConfig: { configFile: "./lint.config.cjs" },
    });
    try {
      const first = createContributorSource(project.tmpdir, "first");
      const second = createContributorSource(project.tmpdir, "second");
      writeCjsConfig(project.tmpdir, [
        ["a-b", first],
        ["c-d", second],
      ]);
      assert.deepEqual(
        loadContributors(project.tmpdir).map((contributor) => contributor.name),
        ["a_b", "c_d"],
      );
    } finally {
      project.cleanup();
    }

    const hyphenated = createLintProject({
      name: "contributor-namespace-cjs-hyphenated",
      source: "export const value = 1;\n",
      pluginConfig: { configFile: "./lint.config.cjs" },
    });
    try {
      writeCjsConfig(hyphenated.tmpdir, [
        [
          "react-hooks",
          createContributorSource(hyphenated.tmpdir, "contributor"),
        ],
      ]);
      assert.deepEqual(
        loadContributors(hyphenated.tmpdir).map(
          (contributor) => contributor.name,
        ),
        ["react_hooks"],
      );
    } finally {
      hyphenated.cleanup();
    }

    assertNoContributors("empty-plugins", { plugins: {} });
    assertNoContributors("no-plugins-key", { rules: {} });
  };

function assertCollision(namespaces: string[], goName: string): string {
  const project = createLintProject({
    name: `contributor-namespace-cjs-${goName}`,
    source: "export const value = 1;\n",
    pluginConfig: { configFile: "./lint.config.cjs" },
  });
  try {
    writeCjsConfig(
      project.tmpdir,
      namespaces.map((namespace, index) => [
        namespace,
        createContributorSource(project.tmpdir, `source-${index}`),
      ]),
    );
    let message = "";
    assert.throws(
      () => loadContributors(project.tmpdir),
      (error) => {
        assert.ok(error instanceof Error);
        message = error.message;
        assert.match(error.message, /lint\.config\.cjs/);
        assert.match(error.message, new RegExp(JSON.stringify(goName)));
        for (const namespace of namespaces) {
          assert.match(error.message, new RegExp(JSON.stringify(namespace)));
        }
        return true;
      },
    );
    const marker = " contributor namespaces collide";
    const markerIndex = message.indexOf(marker);
    assert.notEqual(markerIndex, -1);
    return message.slice(markerIndex);
  } finally {
    project.cleanup();
  }
}

function assertNoContributors(name: string, config: object): void {
  const project = createLintProject({
    name: `contributor-namespace-cjs-${name}`,
    source: "export const value = 1;\n",
    pluginConfig: { configFile: "./lint.config.cjs" },
  });
  try {
    fs.writeFileSync(
      path.join(project.tmpdir, "lint.config.cjs"),
      `module.exports = ${JSON.stringify(config)};\n`,
    );
    assert.deepEqual(loadContributors(project.tmpdir), []);
  } finally {
    project.cleanup();
  }
}

function createContributorSource(root: string, name: string): string {
  const directory = path.join(root, "contributors", name);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "rule.go"), "package contributor\n");
  return directory;
}

function writeCjsConfig(
  root: string,
  entries: Array<[namespace: string, source: string]>,
): void {
  const plugins = Object.fromEntries(
    entries.map(([namespace, source]) => [namespace, { source }]),
  );
  writeCjsConfigValue(root, { plugins });
}

function writeCjsConfigValue(root: string, value: unknown): void {
  fs.writeFileSync(
    path.join(root, "lint.config.cjs"),
    `module.exports = ${JSON.stringify(value, null, 2)};\n`,
  );
}

function loadContributors(
  projectRoot: string,
): Array<{ name: string; source: string }> {
  const factory = TestLintPlugin.loadFactory();
  const descriptor = factory({
    ...TestLintPlugin.factoryContext({ transform: "@ttsc/lint" }),
    cwd: projectRoot,
    pluginConfigDir: projectRoot,
    projectRoot,
    tsconfig: path.join(projectRoot, "tsconfig.json"),
  });
  return descriptor.contributors ?? [];
}

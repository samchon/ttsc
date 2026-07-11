import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { TestLintPlugin } from "../../internal/TestLintPlugin";
import { createLintProject } from "../../internal/config-file";

/**
 * Verifies the `@ttsc/lint` JS factory discovers contributor plugins via
 * `projectRoot` when the resolved tsconfig is a generated wrapper in a temp
 * directory.
 *
 * Pins the JS twin of the Go-side `TTSC_PLUGIN_CONFIG_DIR` anchor
 * (samchon/ttsc#358): the factory's contributor discovery used to walk upward
 * from the tsconfig directory, so a generated wrapper tsconfig (e.g.
 * `@ttsc/unplugin`'s alias overlay) re-anchored the walk at the OS temp tree. A
 * config planted there would be honored and the project's contributors silently
 * dropped. `projectRoot` is the host's explicit channel for the real project
 * and must be the single walk origin.
 *
 * 1. Materialize a project whose `lint.config.json` declares the
 *    `lint-contributor-demo` contributor, with the package linked into
 *    `node_modules`.
 * 2. Create a separate wrapper directory holding a `tsconfig.json` plus a decoy
 *    `lint.config.json` that declares no contributors.
 * 3. Call the factory with `tsconfig` pointing at the wrapper and `projectRoot` at
 *    the project; assert the demo contributor is forwarded (the decoy must
 *    never win).
 */
export const test_descriptor_discovers_contributors_via_project_root_for_wrapper_tsconfig =
  () => {
    const project = createLintProject({
      name: "wrapper-anchor",
      source: "export const value = 1;\n",
      extraSources: {
        "lint.config.json": JSON.stringify({
          plugins: { demo: "lint-contributor-demo" },
          rules: { "demo/no-todo-comment": "error" },
        }),
      },
      linkNodeModules: ["lint-contributor-demo"],
    });
    const wrapper = fs.mkdtempSync(
      path.join(os.tmpdir(), "ttsc-lint-wrapper-"),
    );
    try {
      fs.writeFileSync(path.join(wrapper, "tsconfig.json"), "{}", "utf8");
      // A decoy config next to the wrapper tsconfig: the walk must never
      // start at the wrapper's directory.
      fs.writeFileSync(
        path.join(wrapper, "lint.config.json"),
        JSON.stringify({ rules: {} }),
        "utf8",
      );
      const factory = TestLintPlugin.loadFactory();
      const descriptor = factory({
        ...TestLintPlugin.factoryContext({ transform: "@ttsc/lint" }),
        cwd: project.tmpdir,
        projectRoot: project.tmpdir,
        tsconfig: path.join(wrapper, "tsconfig.json"),
      });
      assert.ok(
        Array.isArray(descriptor.contributors),
        "contributors must be discovered via projectRoot, not the wrapper tsconfig dir",
      );
      assert.ok(
        descriptor.contributors.some(
          (contributor: { name: string }) => contributor.name === "demo",
        ),
        `expected demo contributor, got ${JSON.stringify(descriptor.contributors)}`,
      );
    } finally {
      fs.rmSync(wrapper, { recursive: true, force: true });
      project.cleanup();
    }
  };

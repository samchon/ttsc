import { LintWorkspace } from "../../../internal/lint/LintWorkspace";
import { FixtureFiles } from "../../../internal/FixtureFiles";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { TestLintPlugin } from "../../../internal/lint/internal/TestLintPlugin";
import { createLintProject } from "../../../internal/lint/internal/config-file";

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
 * dropped. `pluginConfigDir` is the embedder's explicit channel for the real
 * project and must be the single walk origin when present.
 *
 * 1. Materialize a project whose `lint.config.json` declares the
 *    `lint-contributor-demo` contributor, with the package linked into
 *    `node_modules`.
 * 2. Create a separate wrapper directory holding a `tsconfig.json` plus a decoy
 *    `lint.config.json` that declares no contributors.
 * 3. Call the factory with `tsconfig` pointing at the wrapper and
 *    `pluginConfigDir` at the project; assert the demo contributor is forwarded
 *    (the decoy must never win).
 *
 * @evidence contracts/testing.md#behavioral-verification The emitted descriptor resolves the linked demo package from the explicit pluginConfigDir while its tsconfig names a separate wrapper with a decoy lint config; the returned contributors must include demo.
 * @evidence contracts/testing.md#independent-expectations The project config independently declares demo and the wrapper decoy declares none, so presence of demo distinguishes the required project-origin discovery from accidental wrapper-origin discovery.
 * @evidence contracts/testing.md#distinguishing-cases The real and wrapper roots differ and both contain eligible configs; this competing-origin case cannot pass merely because the wrapper has no config.
 * @evidence contracts/testing.md#execution-ownership The named entry invokes the built factory with the actual linked package and wrapper/project context; native wrapper rule execution has a separate E2E owner.
 * @evidence contracts/e2e.md#necessary-boundary The emitted descriptor must discover and require the linked contributor package from the embedder's explicit project anchor; authored path calculation alone cannot establish this package-resolution connection.
 * @evidence contracts/e2e.md#shared-execution One descriptor resolution uses the same built factory and demo artifact as other descriptor cases; no Go compilation or native process lifetime occurs here.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A fresh project and separately owned wrapper carry competing immutable configs, and both are removed in finally. No result from a different project or wrapper is reused.
 * @evidence contracts/e2e.md#preserved-coverage The original separate wrapper tsconfig, active decoy config, explicit pluginConfigDir and discovered demo assertions remain executable.
 */
export function test_descriptor_discovers_contributors_via_plugin_config_dir_for_wrapper_tsconfig() {
    const project = createLintProject({
      name: "wrapper-anchor",
      source: "export const value = 1;\n",
      extraSources: FixtureFiles.read("lint/descriptor_discovers_contributors_via_plugin_config_dir_for_wrapper_tsconfig/inputs-1"),
      linkNodeModules: ["lint-contributor-demo"],
    });
    const wrapper = LintWorkspace.caseRoot("ttsc-lint-wrapper-", true);
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
        pluginConfigDir: project.tmpdir,
        projectRoot: project.tmpdir,
        tsconfig: path.join(wrapper, "tsconfig.json"),
      });
      assert.ok(
        Array.isArray(descriptor.contributors),
        "contributors must be discovered via pluginConfigDir, not the wrapper tsconfig dir",
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
  }

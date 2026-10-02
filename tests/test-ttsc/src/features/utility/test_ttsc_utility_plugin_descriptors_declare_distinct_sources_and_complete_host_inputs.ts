import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

/**
 * Verifies the utility plugin descriptors declare distinct native sources and
 * complete host-input records.
 *
 * The linked-plugin host combines the native sources of `lint`, `banner`,
 * `paths` and `strip`, so two descriptors naming the same source directory would
 * collide. A descriptor that reports host inputs must also give every input an
 * absolute path with a hash and a physical-path entry, or the host cannot
 * validate a persisted descriptor evaluation.
 *
 * 1. Write a project whose `lint`, `banner` and `strip` config is a `{}` JSON
 *    file, so discovery needs no evaluator.
 * 2. Call each of the four descriptor factories with that project as context.
 * 3. Assert every `source` is absolute and unique across the four descriptors.
 * 4. For the three descriptors with host inputs, assert the project's JSON
 *    config is among them and every input is absolute and keyed in both the hash
 *    and realpath records.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the four real descriptor factories (@ttsc/lint, banner, paths, strip) over a temporary project and asserts the returned source directories and the hostInputs, hostInputHashes and hostInputRealpaths records they build.
 * @evidence contracts/testing.md#independent-expectations The expectation is a relation, not a copied table: sources must be pairwise different and every reported host input must be an absolute path present in both companion records, and the authored project config file must be reported. None of these values are read from a fixed list of descriptor contents.
 * @evidence contracts/testing.md#distinguishing-cases Four descriptors with one shared uniqueness set distinguish a collision between any two sources; the paths descriptor, which reads no file, must not be required to report inputs while the other three must report the config they discover. Stage and capability contents are not asserted here.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/utility; it loads the TypeScript factories through createRequire and runs discovery over a TestProject.tmpdir containing only `{}` JSON config files, with no native build, installed artifact or product host.
 */
export function test_ttsc_utility_plugin_descriptors_declare_distinct_sources_and_complete_host_inputs() {
  const project = TestProject.tmpdir("ttsc-utility-descriptors-");
  const configs: Record<string, string> = {
    lint: path.join(project, "lint.config.json"),
    banner: path.join(project, "banner.config.json"),
    strip: path.join(project, "strip.config.json"),
  };
  for (const file of Object.values(configs)) fs.writeFileSync(file, "{}\n", "utf8");

  const sources = new Set<string>();
  for (const name of ["lint", "banner", "paths", "strip"]) {
    const filename = path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      name,
      "src",
      name === "lint" ? "createTtscPlugin.ts" : "index.ts",
    );
    const factory = createRequire(import.meta.url)(filename).default;
    const descriptor = factory({
      binary: "",
      cwd: project,
      dirname: path.dirname(filename),
      filename,
      plugin: { transform: `@ttsc/${name}` },
      projectRoot: project,
      tsconfig: path.join(project, "tsconfig.json"),
    });

    assert.ok(path.isAbsolute(descriptor.source), `${name}: source must be absolute`);
    assert.equal(sources.has(descriptor.source), false, `${name}: source collides with another descriptor`);
    sources.add(descriptor.source);

    if (name === "paths") {
      assert.equal(descriptor.hostInputs, undefined);
      continue;
    }
    assert.ok(Array.isArray(descriptor.hostInputs), `${name}: hostInputs`);
    assert.ok(descriptor.hostInputs.includes(configs[name]!), `${name}: discovered config`);
    for (const input of descriptor.hostInputs as string[]) {
      assert.ok(path.isAbsolute(input), `${name}: ${input} must be absolute`);
      assert.ok(
        Object.prototype.hasOwnProperty.call(descriptor.hostInputHashes, input),
        `${name}: ${input} needs a hash entry`,
      );
      assert.ok(
        Object.prototype.hasOwnProperty.call(descriptor.hostInputRealpaths, input),
        `${name}: ${input} needs a realpath entry`,
      );
    }
  }
  assert.equal(sources.size, 4);
}

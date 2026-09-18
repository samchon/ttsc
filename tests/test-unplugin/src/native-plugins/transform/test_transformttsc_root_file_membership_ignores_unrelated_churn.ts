import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies root-file discovery ignores test-directory churn without hiding
 * inputs.
 *
 * Both capture snapshots and persistent watcher events used to treat
 * directories outside include as membership (#1362). Imported inputs outside
 * discovery still need their compiler proofs, and newly matching roots must
 * replace a generation.
 *
 * 1. Compile one root while unrelated directories appear during capture.
 * 2. Deliver again with and without a build boundary and require one compile.
 * 3. Add a matching source and change an imported out-of-include source.
 */
export async function test_transformttsc_root_file_membership_ignores_unrelated_churn(): Promise<void> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 3, graphFanout: 1 });
  const configPath = path.join(project.root, "tsconfig.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const modules = projectModules(project.root);
  // Exact include keeps the other native graph members outside root discovery.
  config.include = [
    path.relative(project.root, modules[0]!).replace(/\\/g, "/"),
  ];
  fs.writeFileSync(configPath, JSON.stringify(config));
  let serial = 0;
  const churn = (): void => {
    const unrelated = path.join(
      project.root,
      serial % 2 === 0 ? ".test-dir" : "test-dir",
    );
    const directory = path.join(unrelated, `trash directory ${serial++}`);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(directory, "artifact.ts"),
      "export const artifact = 1;\n",
    );
  };
  const cache = api.createTtscTransformCache({
    readFile: (location: string) => {
      if (path.resolve(location) === path.resolve(modules[0]!)) churn();
      return fs.readFileSync(location);
    },
  });
  const options = api.resolveOptions({});
  const deliver = async (): Promise<void> => {
    assert.ok(
      await api.transformTtsc(
        modules[0]!,
        fs.readFileSync(modules[0]!, "utf8"),
        options,
        undefined,
        cache,
      ),
    );
  };
  const compiles = () => fs.readFileSync(project.runLog, "utf8").length;
  try {
    await deliver();
    assert.equal(
      compiles(),
      1,
      "out-of-include churn must not make capture retry",
    );
    churn();
    await deliver();
    api.beginTtscTransformBuild(cache);
    await deliver();
    assert.equal(
      compiles(),
      1,
      "out-of-include churn must preserve both delivery modes",
    );
    const outside = path.join(project.root, "outside.ts");
    fs.writeFileSync(outside, "export const outside = 1;\n");
    for (let pass = 0; pass < 2; pass++) {
      assert.equal(
        await api.transformTtsc(
          outside,
          fs.readFileSync(outside, "utf8"),
          options,
          undefined,
          cache,
        ),
        undefined,
      );
    }
    assert.equal(
      compiles(),
      1,
      "untransformed unrelated modules must preserve the generation",
    );
    fs.appendFileSync(
      modules[1]!,
      "\n// changed imported source outside include\n",
    );
    api.beginTtscTransformBuild(cache);
    await deliver();
    assert.equal(
      compiles(),
      2,
      "imported sources outside discovery must remain validated",
    );

    config.include = ["src/**/*.ts"];
    fs.writeFileSync(configPath, JSON.stringify(config));
    api.resetTtscTransformCache(cache);
    await deliver();
    const before = compiles();
    assert.equal(
      await api.transformTtsc(
        outside,
        fs.readFileSync(outside, "utf8"),
        options,
        undefined,
        cache,
      ),
      undefined,
    );
    assert.equal(
      compiles(),
      before,
      "persistent pass-through must keep the generation too",
    );
    fs.mkdirSync(path.join(project.root, "src", "new-directory"));
    fs.writeFileSync(
      path.join(project.root, "src", "new-directory", "new.ts"),
      "export const newRoot = 1;\n",
    );
    await deliver();
    assert.equal(
      compiles(),
      before + 1,
      "newly matching directory must invalidate a persistent generation",
    );
  } finally {
    api.resetTtscTransformCache(cache);
  }
}

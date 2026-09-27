import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  TtscCompiler,
  TtscService,
} from "../../../../../packages/ttsc/lib/index.js";
import { TestUtilityPlugins } from "../../internal/TestUtilityPlugins";
import { tsgo } from "../../internal/compiler";

/**
 * Relative runtime overrides belong to the project process that consumes them.
 * The API caller may live elsewhere, but both one-shot and resident native
 * hosts spawn with the project root as cwd and must resolve TTSC_NODE_BINARY
 * against that same directory.
 */
export const test_transform_apis_resolve_relative_node_binary_from_project_root =
  async () => {
    const root = TestProject.physicalPath(
      TestProject.copyProject("ttsc-utility-plugins"),
    );
    const caller = TestProject.tmpdir("ttsc-relative-node-caller-");
    TestUtilityPlugins.seedPackages(root, ["banner"]);

    const tsconfig = JSON.parse(
      fs.readFileSync(path.join(root, "tsconfig.json"), "utf8"),
    ) as { compilerOptions: { plugins: unknown[] } };
    tsconfig.compilerOptions.plugins = [{ transform: "@ttsc/banner" }];
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify(tsconfig, null, 2),
      "utf8",
    );
    fs.rmSync(path.join(root, "banner.config.json"));
    fs.writeFileSync(
      path.join(root, "banner.config.cjs"),
      `module.exports = { text: process.env.TTSC_NODE_BINARY };\n`,
      "utf8",
    );

    const runtimeName =
      process.platform === "win32" ? "project-node.exe" : "project-node";
    const runtime = path.join(root, runtimeName);
    fs.copyFileSync(process.execPath, runtime);
    if (process.platform !== "win32") fs.chmodSync(runtime, 0o755);

    const context = {
      binary: tsgo,
      cwd: caller,
      env: {
        PATH: TestUtilityPlugins.goPath(),
        TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-relative-node-cache-"),
        TTSC_NODE_BINARY: `.${path.sep}${runtimeName}`,
      },
      projectRoot: root,
      tsconfig: path.join(root, "tsconfig.json"),
    };

    const transformed = new TtscCompiler(context).transform();
    assert.equal(transformed.type, "success");
    const compilerOutput = transformed.typescript["src/main.ts"];
    assert.ok(compilerOutput, "one-shot transform returned no src/main.ts");
    TestUtilityPlugins.assertSingleBanner(compilerOutput, runtime);

    const service = new TtscService(context);
    try {
      const residentOutput = await service.transformFile("src/main.ts");
      assert.ok(residentOutput, "resident transform returned no src/main.ts");
      TestUtilityPlugins.assertSingleBanner(residentOutput, runtime);
    } finally {
      service.dispose();
    }
  };

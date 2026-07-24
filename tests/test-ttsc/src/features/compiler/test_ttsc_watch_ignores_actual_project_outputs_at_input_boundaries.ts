import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { WatchSession } from "../../internal/watch";

/**
 * Verifies project-mode output inference against files tsgo actually writes.
 *
 * Adjacent products matter most at input boundaries: a source outside the
 * project root and an `allowJs` `.jsx` source both live outside the ordinary
 * TypeScript source assumptions. The incremental bundle case pins tsgo's
 * config-based default build-info path.
 */
export const test_ttsc_watch_ignores_actual_project_outputs_at_input_boundaries =
  async (): Promise<void> => {
    const externalRoot = TestProject.tmpdir("ttsc-external-project-output-");
    const externalSource = path.join(externalRoot, "input.ts");
    fs.writeFileSync(externalSource, "export const external = 1;\n", "utf8");
    const externalProject = TestProject.createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          declaration: true,
          emitDeclarationOnly: true,
        },
        files: [externalSource],
      }),
    });
    const external = new WatchSession(externalProject);
    try {
      await external.waitForBuilds(1);
      assert.equal(
        fs.existsSync(path.join(externalRoot, "input.d.ts")),
        true,
        external.transcript(),
      );
      await external.waitForQuiet();
    } finally {
      await external.close();
    }

    const jsxProject = TestProject.createProject({
      "src/input.jsx": "export const input = 1;\n",
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          allowJs: true,
          checkJs: false,
          jsx: "react",
        },
        files: ["src/input.jsx"],
      }),
    });
    const jsx = new WatchSession(jsxProject);
    try {
      await jsx.waitForBuilds(1);
      assert.equal(
        fs.existsSync(path.join(jsxProject, "src", "input.js")),
        true,
        jsx.transcript(),
      );
      await jsx.waitForQuiet();
    } finally {
      await jsx.close();
    }

    const incrementalProject = TestProject.createProject({
      "src/input.ts": "export const input = 1;\n",
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          incremental: true,
          module: "amd",
          outFile: "dist/bundle.js",
        },
        files: ["src/input.ts"],
      }),
    });
    const incremental = new WatchSession(incrementalProject);
    try {
      await incremental.waitForBuilds(1);
      assert.equal(
        fs.existsSync(path.join(incrementalProject, "tsconfig.tsbuildinfo")),
        true,
        incremental.transcript(),
      );
      assert.equal(
        fs.existsSync(
          path.join(incrementalProject, "dist", "bundle.tsbuildinfo"),
        ),
        false,
        incremental.transcript(),
      );
      await incremental.waitForQuiet();
    } finally {
      await incremental.close();
    }
  };

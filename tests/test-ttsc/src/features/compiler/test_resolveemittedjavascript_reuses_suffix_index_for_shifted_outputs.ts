import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const requireFromWorkspace = createRequire(
  path.join(TestProject.WORKSPACE_ROOT, "package.json"),
);

type ResolverOptions = {
  emittedFiles?: readonly string[];
  outDir: string;
  projectRoot: string;
  scanOutDir?: boolean;
};

type ResolveEmittedJavaScriptModule = {
  createEmittedJavaScriptResolver: (options: ResolverOptions) => {
    resolve(sourceFile: string): string | null;
  };
  resolveEmittedJavaScript: (
    options: ResolverOptions & { sourceFile: string },
  ) => string | null;
};

const { createEmittedJavaScriptResolver, resolveEmittedJavaScript } =
  requireFromWorkspace(
    "./packages/ttsc/lib/compiler/internal/resolveEmittedJavaScript.js",
  ) as ResolveEmittedJavaScriptModule;

/**
 * Verifies the repeated resolver keeps the same trailing-stem contract as the
 * single-shot resolver while avoiding a full emitted-file scan per source.
 */
export const test_resolveemittedjavascript_reuses_suffix_index_for_shifted_outputs =
  () => {
    const root = TestProject.tmpdir("resolve-emitted-js-");
    const projectRoot = path.join(root, "project");
    const outDir = path.join(root, "dist");
    const shiftedOutput = path.join(outDir, "pkg", "model", "user.js");
    const exactOutput = path.join(outDir, "src", "exact.js");
    const source = path.join(projectRoot, "src", "pkg", "model", "user.ts");
    const exactSource = path.join(projectRoot, "src", "exact.ts");
    const absentSource = path.join(projectRoot, "src", "pkg", "missing.ts");

    fs.mkdirSync(path.dirname(shiftedOutput), { recursive: true });
    fs.writeFileSync(shiftedOutput, "export const user = true;\n", "utf8");
    fs.mkdirSync(path.dirname(exactOutput), { recursive: true });
    fs.writeFileSync(exactOutput, "export const exact = true;\n", "utf8");

    const resolver = createEmittedJavaScriptResolver({
      emittedFiles: [shiftedOutput],
      outDir,
      projectRoot,
      scanOutDir: false,
    });

    assert.equal(
      resolver.resolve(source),
      shiftedOutput,
      "repeated resolver should match shifted emitted output by trailing stem",
    );
    assert.equal(
      resolveEmittedJavaScript({
        emittedFiles: [shiftedOutput],
        outDir,
        projectRoot,
        scanOutDir: false,
        sourceFile: source,
      }),
      shiftedOutput,
      "single-shot resolver should keep the same shifted-output behavior",
    );
    assert.equal(
      resolver.resolve(absentSource),
      null,
      "unrelated source should not borrow another emitted JavaScript file",
    );
    assert.equal(
      resolver.resolve(exactSource),
      exactOutput,
      "an exact mirrored output should win even when it is absent from the list",
    );
  };

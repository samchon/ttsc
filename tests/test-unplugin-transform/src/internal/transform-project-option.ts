import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  createProject,
  mainFile,
  mainSource,
} from "@ttsc/testing/unplugin/project";
import { loadUnpluginApi } from "@ttsc/testing/unplugin/unplugin";

async function assertTransformUsesProjectOption() {
  const { resolveOptions, transformTtsc } = await loadUnpluginApi();
  const root = createProject({ plugins: [] });
  writeUnpluginProject(root);

  const result = await transformTtsc(
    mainFile(root),
    mainSource(root),
    resolveOptions({
      project: path.join(root, "tsconfig.unplugin.json"),
    }),
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
}

async function assertTransformUsesRelativeProjectOption() {
  const { resolveOptions, transformTtsc } = await loadUnpluginApi();
  const root = createProject({ plugins: [] });
  writeUnpluginProject(root);

  const cwd = process.cwd();
  process.chdir(root);
  try {
    const result = await transformTtsc(
      mainFile(root),
      mainSource(root),
      resolveOptions({
        project: "tsconfig.unplugin.json",
      }),
    );

    assert.ok(result);
    assert.match(result.code, /"PLUGIN"/);
  } finally {
    process.chdir(cwd);
  }
}

function writeUnpluginProject(root) {
  fs.writeFileSync(
    path.join(root, "tsconfig.unplugin.json"),
    JSON.stringify(
      {
        extends: "./tsconfig.json",
        compilerOptions: {
          plugins: [{ transform: "./plugin.cjs", name: "fixture" }],
        },
      },
      null,
      2,
    ),
    "utf8",
  );
}

export {
  assert,
  assertTransformUsesProjectOption,
  assertTransformUsesRelativeProjectOption,
  createProject,
  fs,
  loadUnpluginApi,
  mainFile,
  mainSource,
  path,
  writeUnpluginProject,
};

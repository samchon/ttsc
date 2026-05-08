import assert from "node:assert/strict";
import path from "node:path";
import {
  createProject,
  mainFile,
  mainSource,
} from "@ttsc/testing/unplugin/project";
import { loadUnpluginApi } from "@ttsc/testing/unplugin/unplugin";

async function assertTransformPassesBundlerAliases() {
  const { resolveOptions, transformTtsc } = await loadUnpluginApi();
  const root = createProject({ plugins: [] });
  const result = await transformTtsc(
    mainFile(root),
    mainSource(root),
    resolveOptions({
      plugins: [
        {
          transform: "./plugin.cjs",
          config: {
            operation: "assert-paths",
            key: "@lib",
            target: "src/modules",
          },
          name: "fixture",
        },
      ],
    }),
    { "@lib": path.join(root, "src", "modules") },
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
}

export {
  assert,
  assertTransformPassesBundlerAliases,
  createProject,
  loadUnpluginApi,
  mainFile,
  mainSource,
  path,
};

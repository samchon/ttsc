const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  createProject,
  mainFile,
  mainSource,
} = require("./helpers/project.cjs");
const { loadUnpluginApi } = require("./helpers/unplugin.cjs");

test("transformTtsc uses the project option for an alternate tsconfig", async () => {
  await assertTransformUsesProjectOption();
});

test("transformTtsc resolves a relative project option from cwd", async () => {
  await assertTransformUsesRelativeProjectOption();
});

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

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const {
  assertProjectLayout,
  listPublishedPackages,
} = require("./assert-project-layout.cjs");

const root = path.resolve(__dirname, "..");
const skill = path.join(root, ".agents", "skills", "project", "SKILL.md");

test("project Layout accounts for published packages and rejects omissions", () => {
  const document = fs.readFileSync(skill, "utf8");
  const packages = listPublishedPackages(path.join(root, "packages"));

  assert.doesNotThrow(() => assertProjectLayout({ document, packages }));
  assert.throws(
    () => assertProjectLayout({ document, packages: [...packages, "example"] }),
    /example/,
  );
  assert.throws(
    () =>
      assertProjectLayout({
        document: document.replace("packages/metro", "packages/mobile"),
        packages,
      }),
    /metro/,
  );
  assert.throws(
    () => assertProjectLayout({ document, packages: [] }),
    /no published packages/,
  );
});

// Run the Go rule tests for `@ttsc/evidence`.
//
// This runner is deliberately thinner than `test-go-lint.cjs`. That one has to
// materialize a scratch module because the lint tests reach unexported
// `linthost` internals and must sit beside the library sources. The evidence
// rules are an ordinary Go package with its own tests, and the package already
// carries a `go.mod` whose `replace` directives point at the sibling packages
// in this workspace, so `go test ./native/` compiles them against the `ttsc`
// and `@ttsc/lint` sources in this tree rather than a published release.
//
// That `go.mod` sits one level above `native/` on purpose: ttsc copies the
// directory a contributor's `source` names into `@ttsc/lint`'s own module and
// rejects a `go.mod` inside it. The file exists for tooling like this runner
// and `gopls`, never for the build.

const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { walkForGoFiles } = require("./ci/go-test-overlay.cjs");

const root = path.resolve(__dirname, "..");
const packageDir = path.join(root, "packages", "evidence");

function main() {
  const layer = process.env.TTSC_TEST_LAYER;
  if (layer && layer !== "unit" && layer !== "e2e")
    throw new Error(`unknown TTSC_TEST_LAYER: ${layer}`);
  // These migrated rule fixtures use the parser and actual rule functions in
  // process. Loader, watch, filesystem and runtime bridges stay in e2e.
  const selection =
    layer === "unit"
      ? ["-run=^TestEvidenceSemantic"]
      : layer === "e2e"
        ? ["-skip=^TestEvidenceSemantic"]
        : [];
  if (!fs.existsSync(path.join(packageDir, "native"))) {
    console.error(
      "test-go-evidence: packages/evidence/native is missing; nothing to run.",
    );
    process.exit(1);
  }
  // Repository-only tests join the same Go process through a virtual overlay.
  // No test or source file is written into the protected product package.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-evidence-go-test-"));
  try {
    const replace = {};
    for (const file of walkForGoFiles(
      path.join(root, "tests", "test-evidence", "go"),
    )) {
      const target = path.join(packageDir, "native", path.basename(file));
      if (fs.existsSync(target) || Object.hasOwn(replace, target))
        throw new Error(`evidence Go overlay collision: ${target}`);
      replace[target] = file;
    }
    const overlay = path.join(scratch, "overlay.json");
    fs.writeFileSync(overlay, JSON.stringify({ Replace: replace }));
    const result = cp.spawnSync(
      "go",
      [
        "test",
        "-count=1",
        "-overlay",
        overlay,
        ...selection,
        ...process.argv.slice(2),
        "./native/",
      ],
      { cwd: packageDir, stdio: "inherit", windowsHide: true },
    );
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

main();

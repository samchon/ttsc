const fs = require("node:fs");
const path = require("node:path");

const { walkForGoFiles } = require("./go-test-overlay.cjs");

// These directories exercise rule, formatter, contributor, parser and shim
// behavior through Go functions. Command and loader boundaries stay in e2e.
const UNIT_DIRECTORIES = new Set([
  "engine",
  "plugin",
  "format",
  "printer",
  "registry",
  "rules",
  "shared",
  "shim",
]);

// These cases execute Node or validate command behavior through linked files,
// so they retain their process or filesystem boundary.
const PROCESS_TESTS = new Set([
  "format_prettier_conformance_test.go",
  "format_sort_imports_preserves_binding_import_evaluation_order_test.go",
  "await_thenable_suggestion_preserves_microtask_boundary_test.go",
  "command_fix_owns_its_source_reached_through_a_link_test.go",
  "command_fix_reports_but_never_rewrites_imported_sibling_source_test.go",
]);

const CONFIG_UNIT_PREFIXES = [
  "as_",
  "file_url_",
  "format_block_",
  "project_rule_config_",
];

function isUnitTest(relative) {
  const normalized = relative.split(path.sep).join("/");
  const directory = normalized.split("/")[0];
  const basename = path.basename(relative);
  if (PROCESS_TESTS.has(basename)) return false;
  if (UNIT_DIRECTORIES.has(directory) || directory === "fix") return true;
  if (directory !== "config") return false;
  return (
    normalized.startsWith("config/external/") ||
    CONFIG_UNIT_PREFIXES.some((prefix) => basename.startsWith(prefix))
  );
}

/** Discover the original Go test functions and assign one owning layer each. */
function selectLintGoTests(packageTestDir, repositoryTestDir) {
  const unit = [];
  const e2e = [];
  const seen = new Set();
  const sources = {};
  const collect = (file, owner) => {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(/^func (Test[A-Za-z0-9_]+)\s*\(/gm)) {
      const name = match[1];
      if (name === "TestMain") continue;
      if (seen.has(name)) throw new Error(`duplicate lint Go test: ${name}`);
      seen.add(name);
      sources[name] = path.basename(file);
      owner.push(name);
    }
  };
  for (const file of walkForGoFiles(packageTestDir)) {
    const relative = path.relative(packageTestDir, file);
    collect(file, isUnitTest(relative) ? unit : e2e);
  }
  for (const file of walkForGoFiles(repositoryTestDir)) collect(file, unit);
  if (!unit.length || !e2e.length)
    throw new Error("lint Go test selection needs both unit and e2e cases");
  return { unit, e2e, sources };
}

/** Call each existing test function once under a selected parent subtest. */
function writeLintGoSelection(location, names, layer, sources) {
  const wrapper =
    layer === "unit" ? "TestSelectedLintUnits" : "TestSelectedLintBoundaries";
  fs.writeFileSync(
    location,
    [
      "package linthost",
      "",
      'import "testing"',
      "",
      `func ${wrapper}(t *testing.T) {`,
      ...names.flatMap((name) => [
        `//line ${sources[name]}:1`,
        `  t.Run(${JSON.stringify(name)}, ${name})`,
      ]),
      "//line lint_layer_selection_test.go:1",
      ...(layer === "unit"
        ? [
            "  if err := verifyRecordedBehavioralWitnessCoverage(); err != nil {",
            "    t.Error(err)",
            "  }",
          ]
        : []),
      "}",
      "",
    ].join("\n"),
  );
  return wrapper;
}

module.exports = { selectLintGoTests, writeLintGoSelection };

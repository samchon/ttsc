const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  selectLintGoTests,
  writeLintGoSelection,
} = require("./lint-go-test-selection.cjs");

test("lint Go ownership retains every original assertion in exactly one layer", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-lint-selection-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const packageDir = path.join(root, "package");
  const repositoryDir = path.join(root, "repository");
  const write = (relative, name) => {
    const location = path.join(root, relative);
    fs.mkdirSync(path.dirname(location), { recursive: true });
    fs.writeFileSync(
      location,
      `package linthost\nfunc ${name}(t *testing.T) {}\n`,
    );
  };
  write("package/rules/rule_test.go", "TestRule");
  write("package/plugin/contributor_test.go", "TestContributor");
  write("package/fix/direct_test.go", "TestDirectFix");
  write(
    "package/fix/command_fix_owns_its_source_reached_through_a_link_test.go",
    "TestLinkedCommandFix",
  );
  write("package/config/external/parse_test.go", "TestParseConfig");
  write("package/config/cache_test.go", "TestConfigCache");
  write("package/format/direct_test.go", "TestDirectFormat");
  write(
    "package/format/format_prettier_conformance_test.go",
    "TestFormatPrettierConformance",
  );
  write("package/command/command_test.go", "TestCommand");
  write("repository/engine/corpus_test.go", "TestCorpus");
  fs.appendFileSync(
    path.join(repositoryDir, "engine", "corpus_test.go"),
    "func TestCorpusStatus(t *testing.T) {}\nfunc TestMain(m *testing.M) {}\n",
  );

  const selection = selectLintGoTests(packageDir, repositoryDir);
  assert.deepEqual(selection.unit, [
    "TestParseConfig",
    "TestDirectFix",
    "TestDirectFormat",
    "TestContributor",
    "TestRule",
    "TestCorpus",
    "TestCorpusStatus",
  ]);
  assert.deepEqual(selection.e2e, [
    "TestCommand",
    "TestConfigCache",
    "TestLinkedCommandFix",
    "TestFormatPrettierConformance",
  ]);
  assert.equal(
    new Set([...selection.unit, ...selection.e2e]).size,
    selection.unit.length + selection.e2e.length,
  );
  const generated = path.join(root, "selected_test.go");
  assert.equal(
    writeLintGoSelection(generated, selection.unit, "unit", selection.sources),
    "TestSelectedLintUnits",
  );
  const wrapper = fs.readFileSync(generated, "utf8");
  for (const name of selection.unit)
    assert.match(wrapper, new RegExp(`t\\.Run\\("${name}", ${name}\\)`));
  assert.match(wrapper, /\/\/line rule_test\.go:1\n\s*t\.Run\("TestRule"/);
  assert.doesNotMatch(wrapper, /TestCommand/);
  assert.match(wrapper, /verifyRecordedBehavioralWitnessCoverage/);
});

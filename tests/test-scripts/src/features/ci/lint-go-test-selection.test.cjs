const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  selectLintGoTests,
  writeLintGoSelection,
} = require("../../../../../scripts/ci/lint-go-test-selection.cjs");

/**
 * Verify discoverable Go functions have one execution owner and a generated invocation.
 *
 * @evidence contracts/testing.md#behavioral-verification selectLintGoTests reads authored Go test declarations and partitions direct operations from genuine process boundaries; writeLintGoSelection emits each selected invocation with its original failure identity.
 * @evidence contracts/testing.md#independent-expectations The literal fixture function names and chosen direct/process files independently define the two expected populations; neither expected list is derived from the selector result.
 * @evidence contracts/testing.md#distinguishing-cases Rule, contributor, direct command, linked command, external config and repository corpus entries stay unit; Prettier and native transport stay E2E. TestMain is excluded from duplicate invocation because Go already owns its bootstrap.
 * @evidence contracts/testing.md#execution-ownership test_lint_go_selection_preserves_unique_execution_ownership is the static CommonJS export registered once with node:test; its disposable Go files are selector inputs and it starts no compiler or product host. Real generated-wrapper execution is owned by the lint Go runner.
 */
const test_lint_go_selection_preserves_unique_execution_ownership = (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-lint-selection-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const packageDir = path.join(root, "package");
  
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
  write(
    "package/command/lsp_format_buffer_real_binary_e2e_test.go",
    "TestNativeTransport",
  );
  write("package/engine/corpus_test.go", "TestCorpus");
  write("package/os-boundaries/windows/kernel_test.go", "TestWindowsKernel");
  fs.appendFileSync(
    path.join(packageDir, "engine", "corpus_test.go"),
    "func TestCorpusStatus(t *testing.T) {}\nfunc TestMain(m *testing.M) {}\n",
  );

  const selection = selectLintGoTests(packageDir);
  assert.deepEqual(selection.unit, [
    "TestCommand",
    "TestParseConfig",
    "TestCorpus",
    "TestCorpusStatus",
    "TestLinkedCommandFix",
    "TestDirectFix",
    "TestDirectFormat",
    "TestContributor",
    "TestRule",
  ]);
  assert.deepEqual(selection.e2e, [
    "TestNativeTransport",
    "TestConfigCache",
    "TestFormatPrettierConformance",
  ]);
  assert.deepEqual(selection.windows, ["TestWindowsKernel"]);
  assert.equal(
    new Set([...selection.unit, ...selection.e2e, ...selection.windows]).size,
    selection.unit.length + selection.e2e.length + selection.windows.length,
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
  assert.doesNotMatch(wrapper, /TestNativeTransport/);
  assert.match(wrapper, /verifyRecordedBehavioralWitnessCoverage/);
  assert.equal(
    writeLintGoSelection(generated, selection.windows, "windows", selection.sources),
    "TestSelectedLintWindowsBoundaries",
  );
  const windowsWrapper = fs.readFileSync(generated, "utf8");
  assert.match(windowsWrapper, /t\.Run\("TestWindowsKernel", TestWindowsKernel\)/);
  assert.doesNotMatch(windowsWrapper, /TestNativeTransport|TestRule|verifyRecordedBehavioralWitnessCoverage/);
};

test("lint Go ownership retains every original assertion in exactly one layer", test_lint_go_selection_preserves_unique_execution_ownership);

module.exports = { test_lint_go_selection_preserves_unique_execution_ownership };

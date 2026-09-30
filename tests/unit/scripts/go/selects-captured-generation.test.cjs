const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { copyGoTestsFlat } = require("../../../../scripts/ci/go-test-overlay.cjs");
const { selectLintGoTests, writeLintGoSelection } = require("../../../../scripts/ci/lint-go-test-selection.cjs");

/**
 * Verifies Go invocation ownership comes from the bytes actually copied.
 *
 * A checkout writer can add, rename or delete declarations after materialization.
 * The wrapper must not reference that later generation of the source tree.
 *
 * 1. Copy direct, process, Windows and repository declarations to one overlay.
 * 2. Replace, remove and add live inputs, then select the captured generation.
 * 3. Assert exact owners, original failure addresses and partial-batch rejection.
 *
 * @evidence contracts/testing.md#behavioral-verification copyGoTestsFlat captures the actual written bytes and selectLintGoTests generates invocations from them after the authored tree changes; the selected names match only the compiled overlay.
 * @evidence contracts/testing.md#independent-expectations Literal authored TestOriginal, TestBoundary, TestKernel and TestCorpus fixtures define the expected names and owners independently; later TestReplacement and TestAdded must not appear.
 * @evidence contracts/testing.md#distinguishing-cases Replacement, deletion and addition after copying leave selection unchanged, a Windows-only capture needs no portable population, and an empty requested layer rejects rather than silently succeeding.
 * @evidence contracts/testing.md#execution-ownership test_go_runner_selects_captured_generation is the named CommonJS unit entry registered once with node:test; disposable Go text is input to the owning copy and selector operations and no native host or build starts.
 */
const test_go_runner_selects_captured_generation = (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-copy-generation-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const packageDir = path.join(root, "package");
  const repositoryDir = path.join(root, "repository");
  const target = path.join(root, "overlay");
  const write = (directory, relative, name) => {
    const file = path.join(directory, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `package linthost\nfunc ${name}(t *testing.T) {}\n`);
    return file;
  };
  const original = write(packageDir, "rules/original_test.go", "TestOriginal");
  const boundary = write(packageDir, "config/boundary_test.go", "TestBoundary");
  write(packageDir, "os-boundaries/windows/kernel_test.go", "TestKernel");
  write(repositoryDir, "corpus_test.go", "TestCorpus");
  const packageFiles = copyGoTestsFlat(packageDir, target);
  const repositoryFiles = copyGoTestsFlat(repositoryDir, target);
  fs.writeFileSync(original, "package linthost\nfunc TestReplacement(t *testing.T) {}\n");
  fs.unlinkSync(boundary);
  write(packageDir, "rules/added_test.go", "TestAdded");
  const captured = { packageFiles, repositoryFiles, layer: "unit" };
  const selected = selectLintGoTests(packageDir, repositoryDir, captured);
  assert.deepEqual(selected.unit, ["TestOriginal", "TestCorpus"]);
  assert.deepEqual(selected.e2e, ["TestBoundary"]);
  assert.deepEqual(selected.windows, ["TestKernel"]);
  assert.equal(selected.sources.TestOriginal, "original_test.go");
  for (const input of [...packageFiles, ...repositoryFiles])
    assert.equal(fs.readFileSync(input.copiedFile, "utf8"), input.source);
  const wrapper = path.join(root, "wrapper_test.go");
  writeLintGoSelection(wrapper, selected.unit, "unit", selected.sources);
  assert.match(fs.readFileSync(wrapper, "utf8"), /t\.Run\("TestOriginal", TestOriginal\)/);
  assert.doesNotMatch(fs.readFileSync(wrapper, "utf8"), /TestReplacement|TestAdded/);
  const windows = {
    packageFiles: packageFiles.filter((input) => input.file.includes(`${path.sep}os-boundaries${path.sep}`)),
    repositoryFiles: [],
    layer: "windows",
  };
  assert.deepEqual(selectLintGoTests(packageDir, repositoryDir, windows).windows, ["TestKernel"]);
  assert.throws(() => selectLintGoTests(packageDir, repositoryDir, { ...windows, layer: "unit" }), /nonempty unit/);
};

test("Go selection uses the copied generation despite concurrent checkout edits", test_go_runner_selects_captured_generation);
module.exports = { test_go_runner_selects_captured_generation };

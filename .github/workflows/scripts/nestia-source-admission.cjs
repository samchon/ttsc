// Admits the actual installed nestia fixture's native source before its build.
// This is a CI compatibility precondition, not an upstream arrangement test.
const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createRequire } = require("node:module");

const producer = path.resolve(__dirname, "../../..");
const binding = require("../patches/nestia-published-typia.json");
const modules = ["packages/core/native", "packages/core/test", "packages/sdk/native", "packages/sdk/test"];
const [mode, argument] = process.argv.slice(2);
if (!["bind", "admit"].includes(mode) || !argument || process.argv.length !== 4)
  throw new Error("Expected nestia-source-admission.cjs <bind|admit> <consumer>");
const consumer = path.resolve(argument);
if (mode === "bind") bind();
else admit();

/**
 * Aligns only the fixture's four existing typia requirements and checksum rows.
 * All source contexts are admitted before writing; upstream drift fails closed.
 *
 * @evidence contracts/common.md#principled-implementation The manifest pins the npm release's attested Git source and Go proxy/checksum records; every old requirement and both checksum rows must match exactly before any edit.
 * @evidence contracts/common.md#clear-and-simple-design One staged edit list preserves direct/indirect requirement annotations and every unrelated module byte.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The fixture's source input is corrected; no source mismatch exception, replaced module or false reported version is introduced.
 * @evidence contracts/common.md#meaningful-documentation The comment states the four-module boundary and failure before writes for changed upstream contexts.
 * @evidence contracts/portability.md#os-neutral-implementation Node native paths locate the explicit fixture modules; text replacement accepts CRLF and retains each file's line endings.
 * @evidence contracts/performance.md#efficient-algorithms Eight module files are read and replaced once with bounded literal matching; no repository scan is performed.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work These fixture writes change source inputs and cannot be reused as computation results.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Only eight file buffers are retained until publication; Node synchronous file operations own and close their descriptors. An IO failure after publication starts may leave a partial fixture and fails the CI step.
 */
function bind() {
  const edits = [];
  for (const module of modules) {
    const modFile = path.join(consumer, module, "go.mod");
    const source = fs.readFileSync(modFile, "utf8");
    const old = `${binding.module} ${binding.previousVersion}`;
    if (source.split(old).length !== 2) throw new Error(`${module}: expected one original typia requirement`);
    edits.push([modFile, source.replace(old, `${binding.module} ${binding.version}`)]);
    const sumFile = path.join(consumer, module, "go.sum");
    let sums = fs.readFileSync(sumFile, "utf8");
    for (const [suffix, oldSum, newSum] of [["", binding.previousSum, binding.sum], ["/go.mod", binding.goModSum, binding.goModSum]]) {
      const before = `${binding.module} ${binding.previousVersion}${suffix} ${oldSum}`;
      const rows = sums.split(/\r?\n/).filter((row) => row === before);
      if (rows.length !== 1) throw new Error(`${module}: missing or repeated original typia checksum ${suffix}`);
      sums = sums.replace(before, `${binding.module} ${binding.version}${suffix} ${newSum}`);
    }
    edits.push([sumFile, sums]);
  }
  for (const [file, text] of edits) fs.writeFileSync(file, text, "utf8");
}

/**
 * Admits four declared/resolved Go inputs and both installed npm native trees.
 * Only the exact candidate provenance patch may differ from published source.
 * Abrupt process termination can leave private scratch in the runner's temp directory.
 *
 * @evidence contracts/common.md#principled-implementation Actual Go JSON resolves the build input and rejects replacements; checksum-admitted downloaded source supplies the byte oracle, modified only by the maintained provenance patch in a private copy. Both npm trees and the exact catalog release must match.
 * @evidence contracts/common.md#clear-and-simple-design Version/resolution checks precede one private oracle preparation and two complete source comparisons.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No filename mismatch is forgiven except the original LICENSE and Go-test population exclusions; the headers source difference is corrected through the bound release pin rather than allowed here.
 * @evidence contracts/common.md#meaningful-documentation The comment states execution after installation and the sole source delta admitted.
 * @evidence contracts/portability.md#os-neutral-implementation Native fs/path and execFile argument arrays preserve path identity; git receives core.autocrlf=false and no shell parses filenames.
 * @evidence contracts/performance.md#efficient-algorithms Each source tree is traversed once, and every selected source byte is compared once for each installed consumer; the one patched build oracle is shared.
 * @evidence contracts/performance.md#reuse-equivalent-work All four modules resolve one admitted source version, and both installed trees use the same private provenance-adjusted byte oracle.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One private mkdtemp contains the build oracle and patch and is removed in finally, including failures. Inventory holds selected paths; one pair of file buffers is retained per comparison. Subprocesses finish synchronously and their output is bounded by execFileSync's buffer.
 */
function admit() {
  const env = { ...process.env, GOWORK: path.join(consumer, "go.work") };
  const go = (cwd, args) => JSON.parse(cp.execFileSync("go", args, { cwd, env, encoding: "utf8" }));
  for (const module of modules) {
    const cwd = path.join(consumer, module);
    const requirements = go(cwd, ["mod", "edit", "-json"]).Require.filter((entry) => entry.Path === binding.module);
    if (requirements.length !== 1 || requirements[0].Version !== binding.version)
      throw new Error(`${module}: declared typia source differs from the published release binding`);
    const resolved = go(cwd, ["list", "-m", "-json", binding.module]);
    if (resolved.Path !== binding.module || resolved.Version !== binding.version || resolved.Replace)
      throw new Error(`${module}: actual typia MVS resolution or replacement differs from its declared binding`);
  }
  const downloaded = go(path.join(consumer, modules[0]), ["mod", "download", "-json", `${binding.module}@${binding.version}`]);
  if (downloaded.Error || downloaded.Path !== binding.module || downloaded.Version !== binding.version ||
      downloaded.Sum !== binding.sum || downloaded.GoModSum !== binding.goModSum || !downloaded.Dir)
    throw new Error("The downloaded typia source does not match the admitted release checksums");
  const YAML = createRequire(path.join(producer, "packages/evidence/package.json"))("yaml");
  const catalog = YAML.parse(fs.readFileSync(path.join(consumer, "pnpm-workspace.yaml"), "utf8")).catalogs?.samchon?.typia;
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-nestia-source-"));
  try {
    const build = "cmd/ttsc-typia/build.go";
    const copy = path.join(scratch, "native", ...build.split("/"));
    fs.mkdirSync(path.dirname(copy), { recursive: true });
    fs.copyFileSync(path.join(downloaded.Dir, ...build.split("/")), copy);
    const patch = fs.readFileSync(path.join(__dirname, "../patches/typia-15.0.0-emit-provenance.patch"), "utf8");
    const marker = "--- a/lib/transform.js";
    if (patch.split(marker).length !== 2 || !patch.startsWith("--- a/native/cmd/ttsc-typia/build.go"))
      throw new Error("Unexpected provenance patch source population");
    const nativePatch = path.join(scratch, "provenance.patch");
    fs.writeFileSync(nativePatch, patch.slice(0, patch.indexOf(marker)), "utf8");
    for (const args of [["apply", "--check", nativePatch], ["apply", nativePatch]])
      cp.execFileSync("git", ["-c", "core.autocrlf=false", ...args], { cwd: scratch, stdio: "inherit" });
    const expectedBuild = fs.readFileSync(copy);
    const expected = files(downloaded.Dir);
    const differences = [];
    for (const pkg of ["core", "sdk"]) {
      const installed = path.join(consumer, "packages", pkg, "node_modules", "typia");
      const version = JSON.parse(fs.readFileSync(path.join(installed, "package.json"), "utf8")).version;
      if (version !== binding.npmVersion || catalog !== version)
        differences.push(`${pkg}: installed typia ${version} and exact catalog ${catalog} must equal ${binding.npmVersion}`);
      const native = path.join(installed, "native");
      const actual = files(native);
      for (const name of new Set([...expected, ...actual])) {
        if (!expected.has(name) || !actual.has(name)) {
          differences.push(`${pkg}: source exists on only one side: ${name}`);
          continue;
        }
        const left = name === build ? expectedBuild : fs.readFileSync(path.join(downloaded.Dir, ...name.split("/")));
        if (!left.equals(fs.readFileSync(path.join(native, ...name.split("/")))))
          differences.push(`${pkg}: native source differs: ${name}`);
      }
    }
    if (differences.length) throw new Error(`Nestia source admission failed:\n${differences.sort().join("\n")}`);
    console.log(`Admitted four Go inputs and core/sdk npm native source at ${binding.sourceCommit}`);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

/**
 * Lists native source paths using the original LICENSE and Go-test exclusions.
 * Linked directories are not traversed; an unreadable selected entry fails admission.
 *
 * @evidence contracts/common.md#principled-implementation Recursive directory entries define the complete native population, and only root LICENSE and filenames ending in _test.go are omitted as in the original guard.
 * @evidence contracts/common.md#clear-and-simple-design One directory visitor returns a path Set shared by missing-file and byte comparisons.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No mismatched source name, generated helper or headers file is selectively omitted.
 * @evidence contracts/common.md#meaningful-documentation The comment identifies the exclusions and linked-directory/read-failure behavior.
 * @evidence contracts/portability.md#os-neutral-implementation Native fs/path handles disk traversal while slash-separated relative keys identify counterpart files independently of host path separators.
 * @evidence contracts/performance.md#efficient-algorithms Every native entry is visited once; the Set retains selected path bytes and recursion retains directory depth.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This traversal coordinates no repeated requests or cross-tree cached results; both source populations need their own actual inventory.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The returned Set lives through its owner's source comparisons; local traversal state ends at return and synchronous filesystem operations close their handles.
 */
function files(root) {
  const selected = new Set();
  const visit = (directory, prefix) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) visit(path.join(directory, entry.name), relative);
      else if (relative !== "LICENSE" && !relative.endsWith("_test.go")) selected.add(relative);
    }
  };
  visit(root, "");
  return selected;
}

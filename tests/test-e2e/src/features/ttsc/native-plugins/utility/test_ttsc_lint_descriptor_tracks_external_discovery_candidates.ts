import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies the lint descriptor retains every higher-priority discovery probe.
 *
 * Executable config evaluation must retain missing extension and package
 * candidates, and equal config bytes at a new physical directory must not reuse
 * a prior __dirname or contributor source. Plain JSON discovery is exercised
 * directly by its authored source unit.
 *
 * 1. Evaluate a TypeScript config with local and hoisted package imports.
 * 2. Check missing higher-priority inputs and their null fingerprints.
 * 3. Retarget an equal-byte CJS config directory and check contributor identity.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual built lint descriptor evaluation records missing higher-priority local/package resolution inputs and re-evaluates equal-byte CJS config after its directory link retargets.
 * @evidence contracts/testing.md#independent-expectations Explicit selected JavaScript and hoisted package inputs establish the missing .ts/nearer manifest candidates; distinct old/new physical directories independently establish expected contributor source and native realpath.
 * @evidence contracts/testing.md#distinguishing-cases Owns executable TypeScript local/bare imports, null fingerprints for missing candidates and identical-byte CJS retarget identity; ordinary JSON discovery and conflicting files moved to the authored source unit.
 * @evidence contracts/testing.md#execution-ownership The matching named utility export calls the installed descriptor and its real isolated ttsx evaluator in the Linux boundary population; unit JSON discovery executes separately.
 * @evidence contracts/e2e.md#necessary-boundary The descriptor-to-ttsx subprocess must preserve resolution observations and real __dirname after physical target changes; direct JSON discovery cannot prove executable-config transport or child isolation.
 * @evidence contracts/e2e.md#shared-execution Local and hoisted resolution inputs share one executable config evaluation; the old/new CJS evaluations intentionally use two child lifetimes because a retargeted physical owner must not reuse stale evaluation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each resolution/config identity workspace is isolated; only the directory link changes between old/new calls, the config bytes remain equal, and TestProject owns all fixtures and child lifetime is synchronous.
 * @evidence contracts/e2e.md#preserved-coverage The original missing-input memberships/null hashes, old/new contributor paths and native realpaths remain here. Selected JSON ancestor, candidate directories, conflicting JSON refusal and Windows spelling assertions execute in test_lint_descriptor_discovers_json_candidates_without_an_evaluator.
 */
export function test_ttsc_lint_descriptor_tracks_external_discovery_candidates(): void {
  const mod = TestProject.REQUIRE_FROM_TEST(
    path.join(TestProject.WORKSPACE_ROOT, "packages", "lint"),
  );
  const factory = mod.createTtscPlugin ?? mod.default ?? mod;
  const filename = TestProject.REQUIRE_FROM_TEST.resolve(
    path.join(TestProject.WORKSPACE_ROOT, "packages", "lint"),
  );
  const resolutionWorkspace = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-lint-resolution-inputs-"),
  );
  const resolutionProject = path.join(resolutionWorkspace, "apps", "app");
  const outerPackage = path.join(
    resolutionWorkspace,
    "node_modules",
    "hoisted-selection",
  );
  fs.mkdirSync(resolutionProject, { recursive: true });
  fs.mkdirSync(outerPackage, { recursive: true });
  fs.writeFileSync(
    path.join(outerPackage, "package.json"),
    JSON.stringify({ main: "index.cjs" }),
    "utf8",
  );
  fs.writeFileSync(
    path.join(outerPackage, "index.cjs"),
    'module.exports = "warning";\n',
    "utf8",
  );
  const resolutionConfig = path.join(resolutionProject, "lint.config.ts");
  const selectedModule = path.join(resolutionProject, "selection.js");
  fs.writeFileSync(selectedModule, 'module.exports = "warning";\n', "utf8");
  fs.writeFileSync(
    resolutionConfig,
    [
      'import local from "./selection";',
      'import hoisted from "hoisted-selection";',
      'export default { rules: { "no-var": local === hoisted ? local : "error" } };',
      "",
    ].join("\n"),
    "utf8",
  );
  const context = {
    binary: "",
    cwd: resolutionProject,
    dirname: path.dirname(filename),
    filename,
    plugin: { transform: "@ttsc/lint" },
    pluginConfigDir: resolutionProject,
    projectRoot: resolutionProject,
    tsconfig: path.join(resolutionProject, "tsconfig.json"),
  };

  const resolutionDescriptor = factory({
    ...context,
    cwd: resolutionProject,
    plugin: {
      configFile: resolutionConfig,
      transform: "@ttsc/lint",
    },
    pluginConfigDir: resolutionProject,
    projectRoot: resolutionProject,
    tsconfig: path.join(resolutionProject, "tsconfig.json"),
  });
  const missingLocalCandidate = path.join(resolutionProject, "selection.ts");
  const missingNearerPackageManifest = path.join(
    resolutionWorkspace,
    "apps",
    "node_modules",
    "hoisted-selection",
    "package.json",
  );
  assert.ok(
    resolutionDescriptor.hostInputs.includes(missingLocalCandidate),
    "extensionless local resolution omitted a higher-priority file candidate",
  );
  assert.equal(
    resolutionDescriptor.hostInputHashes[missingLocalCandidate],
    null,
  );
  assert.ok(
    resolutionDescriptor.hostInputs.includes(missingNearerPackageManifest),
    "bare resolution omitted a nearer package manifest below a missing node_modules level",
  );
  assert.equal(
    resolutionDescriptor.hostInputHashes[missingNearerPackageManifest],
    null,
  );

  const identityWorkspace = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-lint-config-identity-"),
  );
  const oldIdentity = path.join(identityWorkspace, "old");
  const newIdentity = path.join(identityWorkspace, "new");
  const identityLink = path.join(identityWorkspace, "linked");
  const configSource = [
    'const path = require("node:path");',
    "module.exports = {",
    "  plugins: {",
    '    physical: { source: path.join(__dirname, "plugin") },',
    "  },",
    "};",
    "",
  ].join("\n");
  for (const target of [oldIdentity, newIdentity]) {
    fs.mkdirSync(path.join(target, "plugin"), { recursive: true });
    fs.writeFileSync(
      path.join(target, "lint.config.cjs"),
      configSource,
      "utf8",
    );
  }
  fs.symlinkSync(
    oldIdentity,
    identityLink,
    process.platform === "win32" ? "junction" : "dir",
  );
  const identityConfig = path.join(identityLink, "lint.config.cjs");
  const identityContext = {
    ...context,
    cwd: identityWorkspace,
    plugin: {
      configFile: identityConfig,
      transform: "@ttsc/lint",
    },
    pluginConfigDir: identityWorkspace,
    projectRoot: identityWorkspace,
    tsconfig: path.join(identityWorkspace, "tsconfig.json"),
  };
  const oldDescriptor = factory(identityContext);
  assert.equal(
    oldDescriptor.contributors?.[0]?.source,
    path.join(oldIdentity, "plugin"),
  );
  assert.equal(
    oldDescriptor.hostInputRealpaths[identityConfig],
    fs.realpathSync.native(identityConfig),
  );

  fs.rmSync(identityLink, { force: true, recursive: true });
  fs.symlinkSync(
    newIdentity,
    identityLink,
    process.platform === "win32" ? "junction" : "dir",
  );
  const newDescriptor = factory(identityContext);
  assert.equal(
    newDescriptor.contributors?.[0]?.source,
    path.join(newIdentity, "plugin"),
    "equal config bytes at a new physical target must not reuse stale evaluation",
  );
  assert.equal(
    newDescriptor.hostInputRealpaths[identityConfig],
    fs.realpathSync.native(identityConfig),
  );
}

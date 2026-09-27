import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies the lint descriptor retains every higher-priority discovery probe.
 *
 * A monorepo package can inherit `lint.config.*` from an ancestor outside its
 * project walk. Creating a nearer config later must invalidate a persistent
 * bundler generation even though the previously selected ancestor file did not
 * change. A directory or directory link carrying a candidate filename is not a
 * config and must not stop the input walk before that selected ancestor.
 */
export const test_ttsc_lint_descriptor_tracks_external_discovery_candidates =
  () => {
    const workspace = TestProject.tmpdir("ttsc-lint-host-inputs-");
    const project = path.join(workspace, "packages", "app");
    fs.mkdirSync(project, { recursive: true });
    fs.mkdirSync(path.join(project, "lint.config.ts"));
    const linkedDirectory = path.join(workspace, "linked-config-directory");
    fs.mkdirSync(linkedDirectory);
    fs.symlinkSync(
      linkedDirectory,
      path.join(project, "lint.config.mts"),
      process.platform === "win32" ? "junction" : "dir",
    );
    const selected = path.join(workspace, "lint.config.json");
    fs.writeFileSync(selected, "{}\n", "utf8");

    const mod = TestProject.REQUIRE_FROM_TEST(
      path.join(TestProject.WORKSPACE_ROOT, "packages", "lint"),
    );
    const factory = mod.createTtscPlugin ?? mod.default ?? mod;
    const filename = TestProject.REQUIRE_FROM_TEST.resolve(
      path.join(TestProject.WORKSPACE_ROOT, "packages", "lint"),
    );
    const context = {
      binary: "",
      cwd: project,
      dirname: path.dirname(filename),
      filename,
      plugin: { transform: "@ttsc/lint" },
      pluginConfigDir: project,
      projectRoot: project,
      tsconfig: path.join(project, "tsconfig.json"),
    };
    const descriptor = factory(context);

    assert.ok(descriptor.hostInputs.includes(selected));
    assert.ok(
      descriptor.hostInputs.includes(path.join(project, "lint.config.ts")),
    );
    assert.ok(
      descriptor.hostInputs.includes(path.join(project, "lint.config.mts")),
    );
    assert.ok(
      descriptor.hostInputs.includes(
        path.join(workspace, "packages", "ttsc-lint.config.cjs"),
      ),
    );
    assert.equal(
      descriptor.hostInputs.includes(
        path.join(path.dirname(workspace), "lint.config.json"),
      ),
      false,
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

    fs.writeFileSync(path.join(project, "lint.config.json"), "{}\n", "utf8");
    fs.writeFileSync(
      path.join(project, "ttsc-lint.config.json"),
      "{}\n",
      "utf8",
    );
    assert.throws(
      () => factory(context),
      /multiple lint config files found.*lint\.config\.json, ttsc-lint\.config\.json/,
    );

    if (process.platform === "win32") {
      const caseWorkspace = TestProject.tmpdir("ttsc-lint-host-input-case-");
      const caseProject = path.join(caseWorkspace, "packages", "app");
      fs.mkdirSync(caseProject, { recursive: true });
      fs.writeFileSync(
        path.join(caseProject, "Lint.Config.Json"),
        "{}\n",
        "utf8",
      );
      const caseDescriptor = factory({
        ...context,
        cwd: caseProject,
        pluginConfigDir: caseProject,
        projectRoot: caseProject,
        tsconfig: path.join(caseProject, "tsconfig.json"),
      });
      const nativeSpelling = path.join(caseProject, "lint.config.json");
      assert.match(
        caseDescriptor.hostInputHashes[nativeSpelling],
        /^[0-9a-f]{64}$/,
      );
      assert.equal(
        caseDescriptor.hostInputs.includes(
          path.join(caseWorkspace, "lint.config.ts"),
        ),
        false,
      );
    }

    const identityWorkspace = TestProject.tmpdir("ttsc-lint-config-identity-");
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
  };

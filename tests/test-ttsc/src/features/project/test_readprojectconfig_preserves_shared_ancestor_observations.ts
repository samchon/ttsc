import { TestProject } from "../../../../utils/src/TestProject";
import { assert, fs, path, readProjectConfig } from "../../internal/project-unit";

/**
 * Verifies shared config reuse preserves selection premises and merge owners.
 *
 * Two native directory aliases reach one preset. Incoming lexical candidates
 * remain observable even when its physical result is shared, while outgoing
 * paths and plugin owners retain the canonical declaring directory.
 *
 * 1. Read a shared preset through two aliases and contrast array order.
 * 2. Read from another consumer and through package/import-map inheritance.
 * 3. Change ancestor bytes and retarget an alias before fresh invocations.
 *
 * @evidence contracts/testing.md#behavioral-verification Direct reads assert exact lexical/missing configInputs, canonical postorder configPaths, completeness, inherited options, plugin origins, empty replacement and null reset. Further reads observe changed ancestor content, a different final configDir and a retargeted native alias.
 * @evidence contracts/testing.md#independent-expectations Authored alias targets, missing extensionless candidates, preset declarations and explicit array order determine literal path/value expectations. Native realpath supplies fixture identity; package.json mappings independently specify package and import-map targets.
 * @evidence contracts/testing.md#distinguishing-cases Contrasts shared physical presets reached under distinct spellings, reversed branches, an omitted plugins declaration, two consumers, package/import-map incomplete authority, changed bytes, newly created higher-priority candidates and redirected aliases. Ordinary chains and malformed presets remain owned by the existing reader family and the separate cycle/error test.
 * @evidence contracts/testing.md#execution-ownership One source unit authors private files and native directory links (junctions on Windows), then calls readProjectConfig in process. No compiler, installed consumer or native producer is involved; the shared fixture helper owns exit cleanup.
 */
export function test_readprojectconfig_preserves_shared_ancestor_observations(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-config-observations-"),
  );
  const shared = path.join(root, "config");
  const project = path.join(root, "project");
  const other = path.join(root, "other");
  const consumer = path.join(root, "consumer");
  const preset = path.join(root, "node_modules", "example-preset");
  for (const directory of [shared, project, other, consumer, preset])
    fs.mkdirSync(directory, { recursive: true });
  const write = (directory: string, name: string, value: unknown): void => {
    fs.writeFileSync(path.join(directory, name), JSON.stringify(value));
  };
  const aliasA = path.join(root, "alias-a");
  const aliasB = path.join(root, "alias-b");
  const link = (target: string, location: string): void => {
    fs.symlinkSync(
      target,
      location,
      process.platform === "win32" ? "junction" : "dir",
    );
  };
  link(shared, aliasA);
  link(shared, aliasB);
  write(shared, "foundation.json", { compilerOptions: { strict: true } });
  write(shared, "base.json", {
    extends: "./foundation",
    compilerOptions: {
      baseUrl: ".\\sources",
      rootDir: "./sources",
      outDir: "${configDir}/out",
      plugins: [{ transform: "./plugin.cjs" }],
    },
  });
  write(project, "left.json", {
    extends: "../alias-a/base",
    compilerOptions: { outDir: null, plugins: [] },
  });
  write(project, "right.json", { extends: "../alias-b/base" });
  write(project, "empty.json", {});
  write(project, "entry.json", { extends: ["./left.json", "./right.json"] });
  const failures: Error[] = [];
  const check = (name: string, operation: () => void): void => {
    try {
      operation();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  const read = (name = "entry.json") =>
    readProjectConfig({ tsconfig: path.join(project, name) });
  check("shared aliases retain selection observations and declaring owners", () => {
    const result = read();
    assert.deepEqual(result.configPaths, [
      path.join(shared, "foundation.json"),
      path.join(shared, "base.json"),
      path.join(project, "left.json"),
      path.join(project, "right.json"),
      path.join(project, "entry.json"),
    ]);
    assert.deepEqual(
      result.configInputs,
      [
        path.join(aliasA, "base"),
        path.join(aliasA, "base.json"),
        path.join(aliasB, "base"),
        path.join(aliasB, "base.json"),
        path.join(shared, "foundation"),
        path.join(shared, "foundation.json"),
        path.join(project, "entry.json"),
        path.join(project, "left.json"),
        path.join(project, "right.json"),
      ].sort(),
    );
    assert.equal(result.configInputsComplete, true);
    assert.equal(result.compilerOptions.strict, true);
    assert.equal(result.compilerOptions.baseUrl, path.join(shared, "sources"));
    assert.equal(result.compilerOptions.rootDir, path.join(shared, "sources"));
    assert.equal(result.compilerOptions.outDir, path.join(project, "out"));
    assert.deepEqual(result.compilerOptions.plugins, [
      { transform: "./plugin.cjs" },
    ]);
    assert.deepEqual(result.pluginBaseDirs, [shared]);
  });
  check("later cached branch preserves empty plugins and null output reset", () => {
    write(project, "entry.json", {
      extends: ["./right.json", "./left.json", "./empty.json"],
    });
    const result = read();
    assert.equal(result.compilerOptions.outDir, undefined);
    assert.deepEqual(result.compilerOptions.plugins, []);
    assert.deepEqual(result.pluginBaseDirs, []);
    assert.equal(result.compilerOptions.rootDir, path.join(shared, "sources"));
  });
  check("fresh consumer anchors configDir independently", () => {
    write(consumer, "entry.json", {
      extends: ["../alias-a/base", "../alias-b/base"],
    });
    const result = readProjectConfig({
      tsconfig: path.join(consumer, "entry.json"),
    });
    assert.equal(result.compilerOptions.outDir, path.join(consumer, "out"));
    assert.deepEqual(result.pluginBaseDirs, [shared]);
  });
  write(root, "package.json", {
    name: "config-owner",
    imports: { "#preset": "./config/base.json" },
  });
  write(preset, "package.json", {
    name: "example-preset",
    tsconfig: "../../config/base.json",
  });
  for (const specifier of ["example-preset", "#preset"]) {
    check(`${specifier} keeps incomplete authority after an equivalent file branch`, () => {
      write(project, "module.json", {
        extends: ["../config/base.json", specifier],
      });
      const result = read("module.json");
      assert.equal(result.configInputsComplete, false);
      assert.equal(result.compilerOptions.outDir, path.join(project, "out"));
      assert.deepEqual(result.configPaths, [
        path.join(shared, "foundation.json"),
        path.join(shared, "base.json"),
        path.join(project, "module.json"),
      ]);
      assert.ok(result.configInputs);
      assert.ok(result.configInputs.includes(path.join(shared, "base.json")));
      if (specifier === "example-preset")
        assert.ok(result.configInputs.includes(path.join(preset, "package.json")));
    });
  }
  check("next invocation observes changed ancestor bytes", () => {
    write(shared, "foundation.json", { compilerOptions: { strict: false } });
    assert.equal(read().compilerOptions.strict, false);
  });
  check("next invocation observes creation of a previously missing candidate", () => {
    write(shared, "foundation", {
      compilerOptions: { strict: true, target: "ES2022" },
    });
    const result = read();
    assert.equal(result.compilerOptions.strict, true);
    assert.equal(result.compilerOptions.target, "ES2022");
    assert.ok(result.configPaths.includes(path.join(shared, "foundation")));
    assert.ok(result.configInputs);
    assert.ok(!result.configInputs.includes(path.join(shared, "foundation.json")));
  });
  check("next invocation observes a retargeted alias", () => {
    write(other, "base.json", {
      compilerOptions: {
        rootDir: "./new-source",
        plugins: [{ transform: "./other.cjs" }],
      },
    });
    fs.unlinkSync(aliasB);
    link(other, aliasB);
    write(project, "entry.json", { extends: ["./left.json", "./right.json"] });
    const result = read();
    assert.equal(
      result.compilerOptions.rootDir,
      path.join(other, "new-source"),
    );
    assert.equal(result.compilerOptions.outDir, undefined);
    assert.deepEqual(result.compilerOptions.plugins, [
      { transform: "./other.cjs" },
    ]);
    assert.deepEqual(result.pluginBaseDirs, [other]);
    assert.ok(result.configPaths.includes(path.join(shared, "base.json")));
    assert.ok(result.configPaths.includes(path.join(other, "base.json")));
    assert.ok(result.configInputs);
    assert.ok(result.configInputs.includes(path.join(aliasB, "base")));
    assert.ok(result.configInputs.includes(path.join(aliasB, "base.json")));
  });
  if (failures.length !== 0)
    throw new AggregateError(failures, "shared config observations failed");
}

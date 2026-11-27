import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { buildSingleRootProject } from "../../../../../packages/ttsc/src/launcher/internal/buildSingleRootProject";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a checked compiler still resolves project types when ttsx must place
 * its single-root config in private storage.
 *
 * 1. Check an excluded entry using automatic and explicitly selected types.
 * 2. Replace the ordinary cache with a linked directory and repeat.
 * 3. Check a workspace member whose types live at an intermediate ancestor. Repeat
 *    with its installed compiler and verify a rejected emit leaves no output.
 * 4. Verify cleanup empties the private system-temp parent and preserves the cache
 *    link and its target.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the maintained single-root build with real TypeScript-Go, original ambient declaration packages and a native cache link. The installed compiler route must report the incompatible assignment and leave the private output tree empty.
 * @evidence contracts/testing.md#independent-expectations The authored globals are available only through the original dependency search population.
 * @evidence contracts/testing.md#distinguishing-cases Automatic @types, an ordinary explicitly named package and an explicitly configured type root run with both cache layouts. A workspace member has an intermediate dependency installation that the workspace cache would skip. With an installed compiler, that member distinguishes a failed type check from an emit with errors.
 * @evidence contracts/testing.md#execution-ownership The unit owns its source, dependency link, output and temporary configuration roots and executes the real native compiler through buildSingleRootProject.
 */
export function test_single_root_build_recovers_type_search_from_refused_cache(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsx-private-config-"),
  );
  const project = path.join(root, "project");
  const installation = path.join(project, "node_modules");
  const cache = path.join(installation, ".cache");
  const target = path.join(root, "foreign-cache");
  const privateDirectory = path.join(root, "run");
  const systemTemporary = path.join(root, "system-temporary");
  fs.mkdirSync(systemTemporary);
  const source = path.join(project, "entry.ts");
  const config = path.join(project, "project.json");
  const write = (filename: string, bytes: string): void => {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, bytes);
  };
  write(path.join(project, "included.ts"), "export {};");
  write(
    path.join(installation, "@types", "auto", "index.d.ts"),
    "declare const marker: 1;",
  );
  write(
    path.join(installation, "named", "package.json"),
    '{"types":"types.d.ts"}',
  );
  write(
    path.join(installation, "named", "types.d.ts"),
    "declare const marker: 1;",
  );
  write(
    path.join(project, "custom-types", "custom", "index.d.ts"),
    "declare const marker: 1;",
  );
  write(
    path.join(privateDirectory, "node_modules", "foreign", "index.d.ts"),
    "declare const marker: 1;",
  );
  write(source, "export const seen: 1 = marker;");
  write(path.join(target, "sentinel"), "untouched");
  const tempVariables = ["TEMP", "TMP", "TMPDIR"];
  const saved = tempVariables.map((name) => process.env[name]);
  let usesLink = false;
  try {
    for (const name of tempVariables) process.env[name] = systemTemporary;
    for (const linked of [false, true]) {
      if (linked) {
        fs.rmSync(cache, { recursive: true });
        fs.symlinkSync(
          target,
          cache,
          process.platform === "win32" ? "junction" : "dir",
        );
        usesLink = true;
      }
      for (const [name, options] of [
        ["automatic", { types: ["*"] }],
        ["named", { types: ["named"] }],
        ["explicit", { types: ["custom"], typeRoots: ["./custom-types"] }],
      ] as const) {
        write(
          config,
          JSON.stringify({
            compilerOptions: { module: "commonjs", strict: true, ...options },
            files: ["included.ts"],
          }),
        );
        const emitDir = path.join(privateDirectory, String(linked), name);
        buildSingleRootProject({
          source,
          tsconfig: config,
          projectRoot: project,
          key: name,
          emitDir,
          role: "entry",
          checked: true,
          options: { binary: TestProject.TSGO_BINARY },
        });
        assert.match(
          fs.readFileSync(
            path.join(
              emitDir,
              path
                .relative(path.parse(source).root, source)
                .replace(/\.ts$/, ".js"),
            ),
            "utf8",
          ),
          /seen\s*=\s*marker/,
          `${name} should emit the checked entry`,
        );
        assert.deepEqual(fs.readdirSync(systemTemporary), []);
      }
      write(
        config,
        JSON.stringify({
          compilerOptions: {
            module: "commonjs",
            strict: true,
            types: ["foreign"],
          },
          files: ["included.ts"],
        }),
      );
      if (!linked)
        write(
          path.join(
            cache,
            "ttsc",
            "node_modules",
            "@types",
            "foreign",
            "index.d.ts",
          ),
          "declare const marker: 1;",
        );
      assert.throws(
        () =>
          buildSingleRootProject({
            source,
            tsconfig: config,
            projectRoot: project,
            key: "foreign",
            emitDir: path.join(privateDirectory, String(linked), "foreign"),
            role: "entry",
            checked: true,
            options: { binary: TestProject.TSGO_BINARY },
          }),
        /TS2688/,
      );
      assert.deepEqual(fs.readdirSync(systemTemporary), []);
    }
    assert.equal(fs.lstatSync(cache).isSymbolicLink(), true);
    assert.deepEqual(fs.readdirSync(target), ["sentinel"]);
    const workspace = path.join(root, "workspace");
    const apps = path.join(workspace, "apps");
    const member = path.join(apps, "member");
    const memberConfig = path.join(member, "tsconfig.json");
    const memberSource = path.join(member, "entry.ts");
    write(path.join(workspace, "pnpm-workspace.yaml"), 'packages: ["apps/*"]');
    write(
      path.join(apps, "node_modules", "named", "package.json"),
      '{"types":"types.d.ts"}',
    );
    write(
      path.join(apps, "node_modules", "named", "types.d.ts"),
      "declare const marker: 1;",
    );
    write(path.join(member, "included.ts"), "export {};");
    write(memberSource, "export const seen: 1 = marker;");
    write(
      memberConfig,
      JSON.stringify({
        compilerOptions: { module: "commonjs", strict: true, types: ["named"] },
        files: ["included.ts"],
      }),
    );
    const memberEmit = path.join(privateDirectory, "workspace-member");
    buildSingleRootProject({
      source: memberSource,
      tsconfig: memberConfig,
      projectRoot: member,
      key: "workspace-member",
      emitDir: memberEmit,
      role: "entry",
      checked: true,
      options: {
        binary: TestProject.TSGO_BINARY,
        // A request environment uses the command-line overlay path.
        env: { TTSC_TEST_PRIVATE_OVERLAY: "1" },
      },
    });
    const memberJs = path
      .relative(path.parse(memberSource).root, memberSource)
      .replace(/\.ts$/, ".js");
    assert.match(
      fs.readFileSync(path.join(memberEmit, memberJs), "utf8"),
      /seen\s*=\s*marker/,
    );
    const workspaceModules = path.join(workspace, "node_modules");
    const installedCompiler = path.join(workspaceModules, "typescript");
    fs.mkdirSync(workspaceModules, { recursive: true });
    fs.symlinkSync(
      fs.realpathSync.native(
        path.join(TestProject.WORKSPACE_ROOT, "node_modules", "typescript"),
      ),
      installedCompiler,
      process.platform === "win32" ? "junction" : "dir",
    );
    try {
      write(memberSource, "export const seen: 2 = marker;");
      const rejectedEmit = path.join(privateDirectory, "rejected-native");
      assert.throws(
        () =>
          buildSingleRootProject({
            source: memberSource,
            tsconfig: memberConfig,
            projectRoot: member,
            key: "rejected-native",
            emitDir: rejectedEmit,
            role: "entry",
            checked: true,
            options: {
              env: { TTSC_TEST_PRIVATE_OVERLAY: "1" },
              plugins: [],
            },
          }),
        /TS2322/,
      );
      assert.deepEqual(fs.readdirSync(rejectedEmit), []);
    } finally {
      fs.unlinkSync(installedCompiler);
    }
    assert.deepEqual(fs.readdirSync(systemTemporary), []);
  } finally {
    tempVariables.forEach((name, index) => {
      const value = saved[index];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    });
    if (usesLink) fs.unlinkSync(cache);
  }
}

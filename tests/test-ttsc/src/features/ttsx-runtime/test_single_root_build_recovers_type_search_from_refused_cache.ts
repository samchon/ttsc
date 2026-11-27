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
 * 3. Verify both builds emit and private overlay cleanup leaves the link alone.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the maintained single-root build with real TypeScript-Go, original ambient declaration packages and a native cache link.
 * @evidence contracts/testing.md#independent-expectations The authored globals are available only through the original dependency search population.
 * @evidence contracts/testing.md#distinguishing-cases Automatic @types, an ordinary explicitly named package and an explicitly configured type root run with both cache layouts.
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
  let usesLink = false;
  try {
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
        const result = buildSingleRootProject({
          source,
          tsconfig: config,
          projectRoot: project,
          key: name,
          emitDir: path.join(privateDirectory, String(linked), name),
          role: "entry",
          checked: true,
          options: { binary: TestProject.TSGO_BINARY },
        });
        assert.ok(result, `${name} should emit`);
        assert.ok(
          !fs
            .readdirSync(path.join(privateDirectory, String(linked)))
            .some((file) => file.startsWith(".ttsx-config-")),
        );
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
    }
    assert.equal(fs.lstatSync(cache).isSymbolicLink(), true);
    assert.deepEqual(fs.readdirSync(target), ["sentinel"]);
  } finally {
    if (usesLink) fs.unlinkSync(cache);
  }
}

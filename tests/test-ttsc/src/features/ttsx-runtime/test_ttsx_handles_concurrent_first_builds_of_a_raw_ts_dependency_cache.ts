import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import child_process from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies `ttsx` handles concurrent first builds of one raw-`.ts` dependency.
 *
 * The dependency cache is shared by every `ttsx` process running the same
 * project. A cold cache therefore has a real promotion race: several processes
 * can compile into private staging directories before any complete cache
 * exists. The winner must publish a complete cache, the losers must keep using
 * a valid cache without disturbing it, and no staging/retired directories may
 * be left behind.
 *
 * 1. Create an ESM project whose raw dependency imports many TypeScript files and
 *    uses a non-erasable enum, forcing a real dependency build.
 * 2. Launch four `ttsx` processes against the same cold project at once.
 * 3. Assert every process exits zero, the dependency cache is complete, and no
 *    promotion scratch directories remain beside it.
 */
export const test_ttsx_handles_concurrent_first_builds_of_a_raw_ts_dependency_cache =
  async () => {
    const files: Record<string, string> = {
      "package.json": JSON.stringify({ type: "module", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ES2022",
          moduleResolution: "bundler",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "node_modules/race-dep/package.json": JSON.stringify({
        name: "race-dep",
        version: "1.0.0",
        type: "module",
        exports: { ".": "./src/index.ts" },
      }),
      "node_modules/race-dep/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ES2022",
          moduleResolution: "bundler",
          strict: true,
          outDir: "lib",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "src/main.ts":
        `declare const process: { argv: string[] };\n` +
        `import { value } from "race-dep";\n` +
        `console.log(\`\${process.argv[2]}:\${value()}\`);\n`,
    };
    const leafCount = 64;
    const leafImports: string[] = [];
    const leafNames: string[] = [];
    for (let i = 0; i < leafCount; i += 1) {
      const name = `leaf${i}`;
      leafNames.push(name);
      leafImports.push(`import { ${name} } from "./leaf-${i}";`);
      files[`node_modules/race-dep/src/leaf-${i}.ts`] =
        `export const ${name} = ${i};\n`;
    }
    files["node_modules/race-dep/src/index.ts"] =
      `${leafImports.join("\n")}\n` +
      `export enum RaceKind {\n` +
      `  Ok = "race-ok",\n` +
      `}\n` +
      `export const value = (): string => ` +
      `\`\${RaceKind.Ok}:\${[${leafNames.join(", ")}].reduce(` +
      `(sum, value) => sum + value, 0)}\`;\n`;

    const root = TestProject.createProject(files);
    const labels = ["run-0", "run-1", "run-2", "run-3"];
    const results = await Promise.all(
      labels.map((label) => launchTtsx(root, label)),
    );

    for (const result of results) {
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), `${result.label}:race-ok:2016`);
    }

    const depRoot = path.join(root, "node_modules", "race-dep");
    const cacheDir = path.join(
      depRoot,
      "node_modules",
      ".cache",
      "ttsc",
      "ttsx-deps",
    );
    assert.ok(
      fs.existsSync(path.join(cacheDir, ".ttsx-stamp.json")),
      "the promoted dependency cache is stamped as complete",
    );
    assert.notEqual(
      findEmittedEntry(depRoot),
      null,
      "the dependency entry was emitted into the completed cache",
    );
    assert.deepEqual(
      cacheScratchEntries(cacheDir),
      [],
      "promotion scratch directories are cleaned after the race",
    );
  };

function launchTtsx(
  root: string,
  label: string,
): Promise<{
  label: string;
  status: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve, reject) => {
    const child = child_process.spawn(
      process.execPath,
      [TestProject.TTSX_BIN, "--cwd", root, "src/main.ts", label],
      {
        cwd: root,
        env: {
          ...process.env,
          TTSC_BINARY: TestProject.NATIVE_BINARY,
          TTSC_TSGO_BINARY: TestProject.TSGO_BINARY,
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (status) => resolve({ label, status, stdout, stderr }));
  });
}

function findEmittedEntry(packageRoot: string): string | null {
  const stack = [
    path.join(packageRoot, "node_modules", ".cache", "ttsc", "ttsx-deps"),
  ];
  while (stack.length !== 0) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(next);
      } else if (entry.isFile() && entry.name === "index.js") {
        return next;
      }
    }
  }
  return null;
}

function cacheScratchEntries(cacheDir: string): string[] {
  const parent = path.dirname(cacheDir);
  try {
    return fs
      .readdirSync(parent)
      .filter(
        (entry) =>
          entry.startsWith("ttsx-deps.") &&
          (entry.endsWith(".staging") || entry.endsWith(".retired")),
      )
      .sort();
  } catch {
    return [];
  }
}

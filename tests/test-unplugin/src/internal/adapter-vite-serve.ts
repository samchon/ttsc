import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const {
  build: viteBuild,
  createServer: viteCreateServer,
}: {
  build: (config: object) => Promise<unknown>;
  createServer: (config: object) => Promise<any>;
} = TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("vite");

/** URL of the fixture's entry module inside the Vite dev server. */
export const MAIN_URL = "/src/main.ts";

/**
 * A pnpm-shaped fixture for Vite serve resolution-candidate scenarios.
 *
 * The consumer app depends on a workspace package linked into `node_modules` (a
 * junction on Windows, a directory symlink on POSIX, exactly how pnpm links
 * workspace members). The package's `main` is `index.js` under `allowJs`, so
 * the compiler's candidate search records missing higher-priority probes —
 * `node_modules/linked-pkg/index.ts` above all — in the transform envelope's
 * `graph.candidates` for the requesting module.
 */
export interface IViteServeCandidateFixture {
  /** Consumer application root served by Vite. */
  app: string;
  /** Real directory of the linked workspace package (the link target). */
  linkedPackage: string;
  /** Absolute path of the app's entry module (`src/main.ts`). */
  mainFile: string;
  /**
   * The missing higher-priority candidate as the compiler spells it: the
   * `node_modules` view of the superseding TypeScript source.
   */
  missingCandidate: string;
  /**
   * Where a test writes the superseding source: inside the link target, so the
   * file appears at {@link missingCandidate} through the link like a real
   * workspace edit.
   */
  supersedingSource: string;
}

/** Materialize the linked-workspace fixture in a temporary directory. */
export function createLinkedWorkspaceFixture(): IViteServeCandidateFixture {
  TestUnpluginProject.ensureSharedCacheDir();
  const workspace = TestProject.tmpdir("ttsc-unplugin-vite-serve-");
  const linkedPackage = path.join(workspace, "packages", "linked-pkg");
  fs.mkdirSync(linkedPackage, { recursive: true });
  fs.writeFileSync(
    path.join(linkedPackage, "package.json"),
    JSON.stringify(
      { main: "index.js", name: "linked-pkg", version: "0.0.0" },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(linkedPackage, "index.js"),
    'export const linked = "js";\n',
    "utf8",
  );

  const app = path.join(workspace, "app");
  fs.mkdirSync(path.join(app, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(app, "package.json"),
    JSON.stringify(
      { dependencies: { "linked-pkg": "0.0.0" }, private: true },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(app, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          allowJs: true,
          module: "commonjs",
          outDir: "dist",
          rootDir: "src",
          strict: true,
          target: "ES2022",
        },
        include: ["src"],
      },
      null,
      2,
    ),
    "utf8",
  );
  const mainFile = path.join(app, "src", "main.ts");
  // The global assignment is a side effect so a production build cannot
  // tree-shake the import away; the build scenario asserts on the bundled
  // package binding.
  fs.writeFileSync(
    mainFile,
    'import { linked } from "linked-pkg";\n\nexport const value: string = linked;\n(globalThis as Record<string, unknown>).ttscLinkedValue = value;\n',
    "utf8",
  );
  fs.mkdirSync(path.join(app, "node_modules"), { recursive: true });
  // pnpm links workspace packages into node_modules as directory links; the
  // "junction" type keeps the link creatable without elevation on Windows and
  // degrades to an ordinary directory symlink on POSIX.
  fs.symlinkSync(
    linkedPackage,
    path.join(app, "node_modules", "linked-pkg"),
    "junction",
  );
  return {
    app,
    linkedPackage,
    mainFile,
    missingCandidate: path.join(app, "node_modules", "linked-pkg", "index.ts"),
    supersedingSource: path.join(linkedPackage, "index.ts"),
  };
}

/**
 * Prove the fixture manufactures the missing `node_modules` candidate before
 * any server-level assertion, so a serve scenario cannot pass vacuously when
 * candidate emission changes shape upstream.
 */
export async function assertFixtureDerivesMissingCandidate(
  fixture: IViteServeCandidateFixture,
): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const watched: string[] = [];
  await transformTtsc(
    fixture.mainFile,
    fs.readFileSync(fixture.mainFile, "utf8"),
    resolveOptions({ project: path.join(fixture.app, "tsconfig.json") }),
    undefined,
    createTtscTransformCache(),
    { addWatchFile: (input: string) => watched.push(input) },
  );
  assert.ok(
    watched.some(
      (input) => path.resolve(input) === path.resolve(fixture.missingCandidate),
    ),
    `fixture must derive the missing node_modules candidate as a watch input; watched: ${watched.join(", ")}`,
  );
}

/** Start a real Vite dev server over the fixture with the ttsc adapter. */
export async function startViteServer(
  fixture: IViteServeCandidateFixture,
): Promise<any> {
  const unpluginVite = await TestUnpluginRuntime.loadUnpluginAdapter("vite");
  return viteCreateServer({
    appType: "custom",
    configFile: false,
    logLevel: "silent",
    // Dependency discovery would race the scenario with esbuild prebundling
    // restarts; the linked package resolves as source without it.
    optimizeDeps: { include: [], noDiscovery: true },
    plugins: [unpluginVite()],
    root: fixture.app,
    // `watch: null` disables the server's own chokidar watcher: these
    // scenarios assert the adapter's filesystem poll (which must work exactly
    // where chokidar does not look), and on Windows a chokidar instance can
    // outlive `server.close()` and keep the test runner process alive.
    server: { hmr: false, middlewareMode: true, watch: null },
  });
}

/** Transform the entry module through the dev server and return its code. */
export async function requestMainModule(server: any): Promise<string> {
  const result = await server.transformRequest(MAIN_URL);
  assert.ok(
    result !== null &&
      result !== undefined &&
      typeof result.code === "string" &&
      result.code.length !== 0,
    `vite serve must answer the entry module request with transformed code; received: ${JSON.stringify(result)}`,
  );
  return result.code;
}

/** Look up the entry module's node in the server's client module graph. */
export async function mainModuleNode(server: any): Promise<any> {
  const graph = server.environments?.client?.moduleGraph ?? server.moduleGraph;
  const node = await graph.getModuleByUrl(MAIN_URL);
  assert.ok(
    node !== null && node !== undefined,
    "vite module graph must know the entry module after a request",
  );
  return node;
}

/**
 * Replace every reload channel's `send` with a recorder so a scenario can
 * assert the adapter announced a full reload without a connected client.
 */
export function spyReloadEvents(server: any): Array<{ type?: string }> {
  const events: Array<{ type?: string }> = [];
  const seen = new Set<object>();
  for (const channel of [
    server.ws,
    server.hot,
    server.environments?.client?.hot,
  ]) {
    if (
      channel === null ||
      channel === undefined ||
      typeof channel.send !== "function" ||
      seen.has(channel)
    ) {
      continue;
    }
    seen.add(channel);
    channel.send = (payload: { type?: string }) => {
      events.push(payload);
    };
  }
  return events;
}

/** Poll a condition until it holds or the deadline passes. */
export async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  what: string,
  timeout = 20_000,
): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail(`timed out waiting for ${what}`);
}

/** Run a production Vite build over the fixture and return its chunk code. */
export async function buildFixture(
  fixture: IViteServeCandidateFixture,
): Promise<string> {
  const unpluginVite = await TestUnpluginRuntime.loadUnpluginAdapter("vite");
  const output: any = await viteBuild({
    build: {
      minify: false,
      rollupOptions: { input: fixture.mainFile },
      write: false,
    },
    configFile: false,
    logLevel: "silent",
    plugins: [unpluginVite()],
    root: fixture.app,
  });
  const chunks = Array.isArray(output)
    ? output.flatMap((entry: any) => entry.output)
    : output.output;
  return TestUnpluginProject.collectRollupOutputCode(chunks);
}

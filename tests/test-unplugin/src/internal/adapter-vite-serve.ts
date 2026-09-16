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
  /** Existing empty automatic type root whose membership is compiler input. */
  typeRoot: string;
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
          typeRoots: ["./node_modules/@types"],
          types: ["*"],
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
  const typeRoot = path.join(app, "node_modules", "@types");
  fs.mkdirSync(typeRoot, { recursive: true });
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
    typeRoot,
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
  interface IWatchRegistration {
    evidence?: {
      state?: {
        codec: string;
        observation?: {
          accessibleEntries?: { directories: string[]; files: string[] };
          directoryExists?: boolean;
        };
      };
    };
    input: string;
  }
  const watched: IWatchRegistration[] = [];
  await transformTtsc(
    fixture.mainFile,
    fs.readFileSync(fixture.mainFile, "utf8"),
    resolveOptions({ project: path.join(fixture.app, "tsconfig.json") }),
    undefined,
    createTtscTransformCache(),
    {
      addWatchFile: (
        input: string,
        evidence?: IWatchRegistration["evidence"],
      ) => watched.push({ evidence, input }),
    },
  );
  assert.ok(
    watched.some(
      ({ input }) =>
        path.resolve(input) === path.resolve(fixture.missingCandidate),
    ),
    `fixture must derive the missing node_modules candidate as a watch input; watched: ${watched.map(({ input }) => input).join(", ")}`,
  );
  const typeRoot = watched.find(
    ({ input }) => path.resolve(input) === path.resolve(fixture.typeRoot),
  );
  const typeRootObservation =
    typeRoot?.evidence?.state?.codec === "predicates"
      ? typeRoot.evidence.state.observation
      : undefined;
  assert.ok(
    typeRootObservation !== undefined,
    `fixture must preserve the automatic type-root predicates; watched: ${watched.map(({ input }) => input).join(", ")}`,
  );
  assert.equal(
    typeRootObservation.directoryExists,
    true,
    "the automatic type root must preserve its successful directory predicate",
  );
  assert.deepEqual(
    typeRootObservation.accessibleEntries,
    { directories: [], files: [] },
    "the empty automatic type root must preserve its accessible-entry listing",
  );
}

/** Start a real Vite dev server over the fixture with the ttsc adapter. */
export async function startViteServer(
  fixture: IViteServeCandidateFixture,
): Promise<any> {
  const unpluginVite = await TestUnpluginRuntime.loadUnpluginAdapter("vite");
  // Vite 7 cannot load a URL beneath the 8.3 spelling Windows may return from
  // os.tmpdir(), even though Node can stat that alias. Give Vite the same long
  // physical root its resolver will put into the resolved module id.
  const viteRoot = fs.realpathSync.native(fixture.app);
  const server = await viteCreateServer({
    appType: "custom",
    configFile: false,
    logLevel: "silent",
    // Dependency discovery would race the scenario with esbuild prebundling
    // restarts; the linked package resolves as source without it.
    optimizeDeps: { include: [], noDiscovery: true },
    plugins: [unpluginVite()],
    root: viteRoot,
    // These scenarios exercise the real watching serve lifecycle. The private
    // compiler watcher owns node_modules and missing-resolution predicates.
    server: { host: "127.0.0.1", port: 0, watch: { persistent: false } },
  });
  await server.listen();
  return server;
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

/** Observe reload messages through a real HMR WebSocket client. */
export async function observeReloadEvents(server: any): Promise<Array<{ type?: string }>> {
  const events: Array<{ type?: string }> = [];
  const address = server.httpServer.address();
  const socket = new WebSocket(`ws://127.0.0.1:${address.port}/`, "vite-hmr");
  socket.addEventListener("message", (message) => {
    const payload = JSON.parse(String(message.data));
    if (payload.type === "full-reload") events.push(payload);
  });
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
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

/** Check the watcherless registration branch through the adapter's public hooks. */
export async function collectServeWatchRegistrations(
  fixture: IViteServeCandidateFixture,
  options: { watching: boolean },
): Promise<string[]> {
  const plugin = await loadViteAdapterPlugin();
  const invoke = invokeVitePluginHook;
  const lifecycle = {};
  invoke(
    plugin.configResolved,
    {},
    {
      command: "serve",
      resolve: { alias: [] },
      server: options.watching ? { watch: {} } : { watch: null },
    },
  );
  await invoke(plugin.buildStart, lifecycle);
  const watched: string[] = [];
  try {
    await invoke(
      plugin.transform,
      { addWatchFile: (file: string) => watched.push(file) },
      fs.readFileSync(fixture.mainFile, "utf8"),
      fixture.mainFile,
    );
    return watched;
  } finally {
    await invoke(plugin.buildEnd, lifecycle);
  }
}

/** Resolve the ttsc plugin object out of the Vite adapter's factory result. */
export async function loadViteAdapterPlugin(): Promise<any> {
  const unpluginVite = await TestUnpluginRuntime.loadUnpluginAdapter("vite");
  const plugin: any = [unpluginVite()]
    .flat()
    .find((entry: any) => entry?.name === "ttsc-unplugin");
  assert.ok(plugin, "the vite adapter must expose the ttsc plugin object");
  return plugin;
}

/** Apply one unplugin hook, tolerating both the bare and object hook forms. */
export function invokeVitePluginHook(
  hook: any,
  context: object,
  ...args: unknown[]
): unknown {
  return typeof hook === "function"
    ? hook.apply(context, args)
    : hook?.handler?.apply(context, args);
}

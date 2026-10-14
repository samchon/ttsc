import {
  TestFailureLedger,
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { waitFor } from "../../../../../utils/src/internal/waitFor";
import { observeReloadEvents } from "../../../internal/unplugin/internal/adapter-vite-serve/observeReloadEvents";

/**
 * Verifies a cold Vite optimizer finds plugin imports before serving source.
 *
 * A source-preamble contributor adds dependencies absent from authored imports.
 * The linked package can resolve its dependency only from its own node_modules,
 * and a transform-added local helper has another dependency. Vite's original
 * scanner must still expand globs, inject JSX imports and accept default
 * exports.
 *
 * 1. Start one server with cold dependency storage and automatic discovery.
 * 2. Require plugin, linked, glob, JSX and explicitly included dependencies in the
 *    initial optimizer publication, with the excluded package absent.
 * 3. Serve the app and linked module through an HMR connection and require the
 *    optimizer publication to stay unchanged without a reload.
 * 4. Restart in noDiscovery mode and require only the explicit dependency.
 *
 * @evidence contracts/testing.md#behavioral-verification Initial on-disk optimizer metadata must contain six independently named dependencies before any HTTP request; app, local helper and linked default/named module requests must succeed, preserve the publication's browser hash and send no full-reload. A second server's explicit-only metadata must contain just manual-dep.
 * @evidence contracts/testing.md#independent-expectations Authored imports, configured preamble specifiers, JSX injection and the public include/exclude/noDiscovery contracts determine exact dependency sets. Metadata comes from Vite's output rather than the adapter's cache or scanner implementation.
 * @evidence contracts/testing.md#distinguishing-cases Root and linked-only plugin dependencies and a transformed local-helper edge contrast with raw glob, JSX injection, default/named exports, explicit include and explicit exclusion. Automatic discovery and noDiscovery require separate server modes and independent cold cache directories.
 * @evidence contracts/testing.md#execution-ownership The Vite batch entry calls this scene. Real Vite, esbuild or Rolldown and the linked Go contributor own scanning and transformation; direct scanner units own option-shape branches and failure forwarding.
 * @evidence contracts/e2e.md#necessary-boundary Actual scanner registration, importer-relative package resolution, native source injection, dependency publication and served module analysis must agree; captured hook calls cannot establish that connection.
 * @evidence contracts/e2e.md#shared-execution One fixture and immutable native contributor serve both optimizer modes. Automatic mode owns one initial scan and one HTTP lifetime; noDiscovery requires its own mode and cold dependency directory but reuses native artifacts.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Both servers use separate empty cache directories, and the first closes before the second starts. HMR client closure precedes server closure; both failures are retained. The caller's tracked root owns fixture release, while this scene removes its allocated child only after every server and client has closed; failed closure retains that child for diagnosis. One shared failure owner preserves setup, scenario, client/server closure and final removal or retention refusals in order; a final cleanup refusal cannot replace an earlier cause.
 * @evidence contracts/e2e.md#preserved-coverage This new scene adds cold optimizer and unchanged-publication checks without replacing existing Vite watcher, alias, compiler-input or source-map histories.
 */
export async function case_vite_optimizer_discovers_transform_imports(
  parent?: string,
  host: "vite" | "vite8" = "vite",
): Promise<void> {
  TestUnpluginProject.ensureSharedCacheDir();
  const allocation = TestProject.tmpdir("ttsc-vite-optimizer-", parent);
  const failures = new TestFailureLedger();
  let allClosed = true;
  let releaseRoot: (() => void) | undefined;
  await failures.run(
    async () => {
      const root = fs.realpathSync.native(allocation);
      releaseRoot = () => fs.rmSync(root, { recursive: true });
      const fixture = path.join(
        TestProject.WORKSPACE_ROOT,
        "tests/test-e2e/fixtures/unplugin/vite_optimizer_discovers_transform_imports",
      );
      for (const directory of ["app", "linked"])
        TestProject.copyDirectory(
          path.join(fixture, directory),
          path.join(root, directory),
        );
      const app = path.join(root, "app");
      const linked = path.join(root, "linked");
      TestProject.copyDirectory(
        path.join(fixture, "dependency"),
        path.join(root, "node_modules/root-hidden"),
      );
      for (const [owner, dependencies] of [
        [
          app,
          [
            "relative-hidden",
            "manual-dep",
            "excluded-dep",
            "glob-dep",
            "jsx-helper",
          ],
        ],
        [linked, ["nested-hidden"]],
      ] as const) {
        fs.mkdirSync(path.join(owner, "node_modules"), { recursive: true });
        for (const dependency of dependencies)
          TestProject.copyDirectory(
            path.join(
              fixture,
              dependency === "excluded-dep" ? "excluded" : "dependency",
            ),
            path.join(owner, "node_modules", dependency),
          );
        TestProject.writeFiles(owner, {
          "plugin.cjs": [
            "module.exports = context => ({",
            "  name: context.plugin.name,",
            `  source: ${JSON.stringify(path.join(fixture, "native/optimizer-probe"))},`,
            "});",
          ].join("\n"),
          "tsconfig.json": JSON.stringify({
            compilerOptions: {
              target: "ES2022",
              module: "ESNext",
              moduleResolution: "bundler",
              jsx: "preserve",
              strict: true,
              skipLibCheck: true,
              rootDir: owner === app ? ".." : "src",
              outDir: "dist",
              plugins: [
                {
                  name: "optimizer-imports",
                  transform: "./plugin.cjs",
                  imports: [owner === app ? "root-hidden" : "nested-hidden"],
                  ...(owner === app
                    ? { sourceImports: { "src/main.ts": "./helper.ts" } }
                    : {}),
                },
              ],
            },
            include: ["src"],
          }),
        });
      }
      fs.symlinkSync(
        linked,
        path.join(app, "node_modules/linked-pkg"),
        "junction",
      );
      const { createServer } = TestUnpluginProject.REQUIRE_FROM_UNPLUGIN(host);
      const adapter = await TestUnpluginRuntime.loadUnpluginAdapter("vite");
      for (const noDiscovery of [false, true]) {
        const errors: string[] = [];
        let existingPluginLoads = 0;
        const server = await createServer({
          root: app,
          configFile: false,
          appType: "custom",
          logLevel: "silent",
          cacheDir: path.join(
            root,
            noDiscovery ? "explicit-cache" : "automatic-cache",
          ),
          customLogger: {
            hasWarned: false,
            info() {},
            warn() {},
            warnOnce() {},
            clearScreen() {},
            error(message: string) {
              errors.push(message);
            },
            hasErrorLogged() {
              return errors.length !== 0;
            },
          },
          esbuild: { jsxInject: 'import "jsx-helper";' },
          optimizeDeps: {
            entries: ["src/main.ts"],
            include: ["manual-dep"],
            exclude: ["excluded-dep"],
            noDiscovery,
            holdUntilCrawlEnd: false,
            ...(host === "vite8"
              ? {
                  rolldownOptions: {
                    plugins: [
                      {
                        name: "existing-optimizer-observer",
                        load(file: string) {
                          if (file.endsWith("/main.ts"))
                            existingPluginLoads += 1;
                        },
                      },
                    ],
                  },
                }
              : {
                  esbuildOptions: {
                    plugins: [
                      {
                        name: "existing-optimizer-observer",
                        setup(build: any) {
                          build.onLoad({ filter: /main\.ts$/ }, () => {
                            existingPluginLoads += 1;
                          });
                        },
                      },
                    ],
                  },
                }),
          },
          plugins: [adapter()],
          server: { host: "127.0.0.1", port: 0 },
        });
        let client: Awaited<ReturnType<typeof observeReloadEvents>> | undefined;
        try {
          await server.listen();
          const metadataFile = path.join(
            server.config.cacheDir,
            "deps/_metadata.json",
          );
          await waitFor(
            () => fs.existsSync(metadataFile),
            "initial optimizer publication",
            {
              check() {
                if (errors.length)
                  throw new AggregateError(errors, "Vite optimizer errors");
              },
            },
          );
          const initial = JSON.parse(fs.readFileSync(metadataFile, "utf8"));
          assert.deepEqual(
            Object.keys(initial.optimized).sort(),
            noDiscovery
              ? ["manual-dep"]
              : [
                  "glob-dep",
                  "jsx-helper",
                  "manual-dep",
                  "nested-hidden",
                  "relative-hidden",
                  "root-hidden",
                ],
          );
          if (noDiscovery) continue;
          assert.ok(
            existingPluginLoads > 0,
            "an existing optimizer plugin must still receive scanner loads",
          );
          assert.ok(
            !fs.existsSync(path.join(app, "node_modules/nested-hidden")),
            "the nested dependency must resolve only from the linked package",
          );
          client = await observeReloadEvents(server);
          const address = server.httpServer.address();
          const response = await fetch(
            `http://127.0.0.1:${address.port}/src/main.ts`,
          );
          const mainCode = await response.text();
          assert.equal(response.status, 200, mainCode);
          assert.ok(
            mainCode.includes("root-hidden"),
            "the served entry must retain its injected bare dependency",
          );
          assert.ok(
            mainCode.includes("/helper.ts"),
            "the served entry must retain its injected local-helper edge",
          );
          const linkedUrl = `/@fs/${path.join(linked, "src/index.ts").replace(/\\/g, "/")}`;
          for (const url of [
            linkedUrl,
            "/src/helper.ts",
            "/src/view.tsx",
            "/src/lazy/entry.ts",
          ]) {
            const delivery = await fetch(
              `http://127.0.0.1:${address.port}${url}`,
            );
            const code = await delivery.text();
            assert.equal(delivery.status, 200, code);
            if (url === linkedUrl)
              assert.ok(
                code.includes("nested-hidden"),
                "the linked delivery must retain its injected runtime dependency",
              );
          }
          await server.waitForRequestsIdle();
          client.check();
          const served = JSON.parse(fs.readFileSync(metadataFile, "utf8"));
          assert.equal(
            served.browserHash,
            initial.browserHash,
            "serving transformed imports must not replace the optimized dependency publication",
          );
          assert.equal(
            client.length,
            0,
            "serving transform-added imports must not reload the page",
          );
        } catch (error) {
          failures.add(
            new Error(
              `${host} ${noDiscovery ? "explicit-only" : "automatic"} optimizer`,
              { cause: error },
            ),
          );
        } finally {
          for (const [owner, close] of [
            ["HMR client", () => client?.close()],
            ["server", () => server.close()],
          ] as const) {
            try {
              await close();
            } catch (error) {
              allClosed = false;
              failures.add(
                new Error(`${host} ${owner} closure`, { cause: error }),
              );
            }
          }
        }
        if (!allClosed) break;
      }
    },
    [
      () => {
        // Final retention or removal refusal joins the verdict with the body and original client/server close errors.
        if (allClosed) releaseRoot?.();
        else
          TestProject.retainTemporaryDirectory(
            allocation,
            "Vite optimizer ownership did not close",
          );
      },
    ],
    "Vite optimizer integration failures",
  );
}

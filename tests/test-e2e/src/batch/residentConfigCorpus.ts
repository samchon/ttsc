import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

import { TtscCompiler } from "../../../../packages/ttsc/lib/index";
import { SidecarEnvironment } from "../../../../packages/ttsc/lib/compiler/internal/sharedHost/SidecarEnvironment";
import { E2eProcessTrace } from "../../../utils/src/E2eProcessTrace";
import { PLUGIN_BUILD_TIMEOUT } from "../internal/ttsc/internal/ttscserver";
import { BatchWorkspace } from "./BatchWorkspace";
import { scriptConfigGraphResident, scriptConfigGraphTraceRoot } from "./scriptConfigGraphCorpus";

/**
 * Verifies real and linked executable-config dependencies through raw inputs.
 *
 * The caller joins and restores its existing watcher first. This body borrows
 * that installed project and producer, then owns two public lsp-serve children.
 *
 * 1. Prepare the existing CJS contributor before connecting typed helpers.
 * 2. Query unchanged three times, change real only and settle, then change
 *    linked only and settle; observe both memberships and evaluation logs.
 * 3. Join the normal child, restore the helper, and start cache opt-out before
 *    two unchanged requests; join before restoring the borrowed project.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual public lsp-serve frames return code0 and exact old/new file membership while imported real/link modules append evaluation records. Independent helper edits must preserve the opposite value and counter; startup opt-out evaluates twice.
 * @evidence contracts/testing.md#independent-expectations Authored before/after/input paths and literal LF counter totals prescribe the result independently of resolver cache bookkeeping. Physical expected paths use the existing TestProject filesystem identity helper.
 * @evidence contracts/testing.md#distinguishing-cases Real package versus directory link, unchanged versus content-only real edit versus linked edit, settling and normal versus startup-disabled evaluation are distinct epochs. No membership change or simultaneous edit can mask the opposite helper.
 * @evidence contracts/testing.md#execution-ownership The existing selected esbuild nativeWatchCorpus calls this body after actual watcher join and original restoration. The same two OS children also serve the shared ScriptGraph failure/recovery pair before the original normal baseline; no new child is added for that graph. Two OS children replace no original OS daemon: the retained donors used three in-process io.Pipe lifetimes and remain selected until actual acceptance.
 * @evidence contracts/e2e.md#necessary-boundary Real TypeScript loader to Node package evaluation, recorded dependency validity and raw project-input publication must agree. The maintained Go resident unit owns private loads, memo invalidation, project separation and opt-out policies, not this external transport.
 * @evidence contracts/e2e.md#shared-execution Same root, installation, producer and object cache serve one public prepare and both raw children. Normal nine (including the shared ScriptGraph failure/recovery pair) and opt-out two requests retain the original real/link seven and opt-out two assertions; expected helper evaluations remain four plus two. Public prepare adds real descriptor/admission work and possible builds; project-inputs loads configuration without a Program, while nested typed evaluators have real compiler work whose total remains unmeasured.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Static inputs are copied into exclusively absent owned names; the linked physical package lives in a unique owned cache namespace outside the shared input root, matching the original external target. Its resolved cleanup path is checked against only that namespace, after removing the project link. Normal child EOF/close/code0 precedes opt-out changes; both joins precede restoration. Startup environment is child-local. Failed or unknown closure retains inputs and prevents cleanup rather than mutating an active reader.
 * @evidence contracts/e2e.md#preserved-coverage The two retained resident donors map their three unchanged queries, real/link helper-only refresh, old removal/new membership, one settled query and actual counters to this body; opted-out unchanged queries and counters map to its second child. TestResidentRulesAreReusedOnlyWhileTheirConfigIsUnchanged retains private loads and direct policy distinctions. Original topology/project-input docs/api behavior is unchanged. Donor deletion and total independent E2E acceptance remain pending.
 */
export async function residentConfigCorpus(
  workspace: BatchWorkspace.Workspace,
): Promise<void> {
  const root = path.join(workspace.root, "tools/native-watch");
  const owned = path.join(root, "tools/resident-config");
  const realPackage = path.join(root, "node_modules/resident-config-real");
  const linkedPackage = path.join(root, "node_modules/resident-config-linked");
  const physicalCache = TestProject.physicalPath(workspace.cache);
  const targetNamespace =
    "resident-config-linked-" + path.basename(workspace.root);
  const linkedTarget = path.resolve(physicalCache, targetNamespace);
  assert.equal(path.dirname(linkedTarget), physicalCache);
  const outside = path.relative(
    TestProject.physicalPath(workspace.root),
    linkedTarget,
  );
  assert.ok(
    outside === ".." ||
      outside.startsWith(".." + path.sep) ||
      path.isAbsolute(outside),
    "the linked helper's physical package remains outside the shared input root",
  );
  const lintConfig = path.join(root, "lint.config.cjs");
  const contributor = path.join(
    TestProject.WORKSPACE_ROOT,
    "packages/lint/test/watch-project-input",
  );
  for (const location of [
    owned,
    realPackage,
    linkedPackage,
    linkedTarget,
    lintConfig,
  ])
    assert.equal(fs.existsSync(location), false, location);
  // Discovery must select the same original root CJS, not an ambient parent.
  for (const name of [
    "lint.config.ts",
    "lint.config.cts",
    "lint.config.mts",
    "lint.config.js",
    "lint.config.mjs",
    "lint.config.json",
    "ttsc-lint.config.ts",
    "ttsc-lint.config.cts",
    "ttsc-lint.config.mts",
    "ttsc-lint.config.js",
    "ttsc-lint.config.cjs",
    "ttsc-lint.config.mjs",
    "ttsc-lint.config.json",
  ])
    assert.equal(fs.existsSync(path.join(root, name)), false, name);
  const fixture = path.resolve(
    import.meta.dirname,
    "../../fixtures/lint/workspace/resident-config",
  );
  let joined = true;
  let linkedTargetOwned = false;
  const failures: unknown[] = [];
  try {
    fs.writeFileSync(
      lintConfig,
      `module.exports={plugins:{topology:{source:${JSON.stringify(contributor)}}},rules:{"topology/project-input":"error","no-var":"warning"}};\n`,
    );
    const env = SidecarEnvironment.merge(process.env, {
      TTSC_CACHE_DIR: workspace.cache,
      TTSC_GO_CACHE_DIR: TestProject.sharedGoBuildCache(),
      TTSC_TSGO_BINARY: TestProject.TSGO_BINARY,
      TTSC_TTSX_BINARY: TestProject.TTSX_BIN,
      TTSC_NODE_BINARY: process.execPath,
      TTSC_RESIDENT_CONTRIBUTOR: contributor,
      TTSC_E2E_TRACE: scriptConfigGraphTraceRoot(workspace),
    });
    const binaries = new TtscCompiler({
      cwd: root,
      projectRoot: root,
      pluginConfigDir: root,
      tsconfig: path.join(root, "tsconfig.json"),
      cacheDir: workspace.cache,
      env,
    }).prepare();
    assert.equal(binaries.length, 1);
    const binary = binaries[0];
    assert.ok(typeof binary === "string" && binary.length > 0);
    fs.cpSync(fixture, owned, { recursive: true });
    fs.cpSync(path.join(owned, "real-package"), realPackage, {
      recursive: true,
    });
    fs.mkdirSync(linkedTarget);
    linkedTargetOwned = true;
    fs.cpSync(path.join(owned, "linked-package"), linkedTarget, {
      recursive: true,
    });
    fs.symlinkSync(
      linkedTarget,
      linkedPackage,
      process.platform === "win32" ? "junction" : "dir",
    );
    const realIndex = path.join(realPackage, "index.js");
    const linkedIndex = path.join(linkedTarget, "index.js");
    const originalReal = fs.readFileSync(realIndex, "utf8");
    const originalLinked = fs.readFileSync(linkedIndex, "utf8");
    const realCounter = path.join(owned, "real-evaluations.log");
    const linkedCounter = path.join(owned, "linked-evaluations.log");
    const optoutCounter = path.join(owned, "optout-evaluations.log");
    for (const counter of [realCounter, linkedCounter, optoutCounter])
      fs.writeFileSync(counter, "");
    const counter = (location: string, expected: number) =>
      assert.equal(
        fs.readFileSync(location, "utf8"),
        "evaluation\n".repeat(expected),
      );
    const membership = (reply: unknown, before: string, present: boolean) => {
      assert.ok(
        reply !== null && typeof reply === "object" && "files" in reply,
      );
      const files: unknown = reply.files;
      assert.ok(
        Array.isArray(files) && files.every((file) => typeof file === "string"),
      );
      const target = path.join(root, before);
      const expected = path
        .join(
          TestProject.physicalPath(path.dirname(target)),
          path.basename(target),
        )
        .split(path.sep)
        .join("/");
      assert.equal(files.includes(expected), present, JSON.stringify(reply));
    };
    const start = (disabled: boolean) => {
      const child = E2eProcessTrace.spawn(
        binary,
        [
          "lsp-serve",
          `--cwd=${root}`,
          `--tsconfig=${path.join(root, "tsconfig.json")}`,
          `--plugins-json=${JSON.stringify([{ name: "@ttsc/lint", stage: "check", config: {} }])}`,
        ],
        {
          cwd: root,
          windowsHide: true,
          stdio: ["pipe", "pipe", "pipe"],
          env: SidecarEnvironment.merge(env, {
            TTSC_LINT_DISABLE_CONFIG_CACHE: disabled ? "1" : "",
            TTSC_RESIDENT_REAL_EVALUATIONS: disabled
              ? optoutCounter
              : realCounter,
            TTSC_RESIDENT_LINKED_EVALUATIONS: linkedCounter,
          }),
        },
      );
      joined = false;
      let lines: ReturnType<typeof readline.createInterface> | undefined;
      let stderr = "";
      let fatal: unknown;
      let pending:
        | { resolve(value: unknown): void; reject(error: unknown): void; expectedCode: number }
        | undefined;
      const closed = new Promise<void>((resolve, reject) => {
        child.once("error", (error) => {
          fatal = error;
          pending?.reject(error);
        });
        child.once("close", (code, signal) => {
          lines?.close();
          if (pending)
            pending.reject(
              new Error(
                `resident closed before reply: ${code}/${signal}: ${stderr}`,
              ),
            );
          if (fatal || code !== 0 || signal !== null)
            reject(
              new Error(`resident close ${code}/${signal}: ${stderr}`, {
                cause: fatal,
              }),
            );
          else resolve();
        });
      });
      void closed.catch(() => {});
      assert.ok(child.stdin && child.stdout && child.stderr);
      const input = child.stdin;
      lines = readline.createInterface({ input: child.stdout });
      child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
        stderr = (stderr + chunk).slice(-65_536);
      });
      lines.on("error", (error) => {
        fatal = error;
        pending?.reject(error);
      });
      input.on("error", (error) => {
        fatal = error;
        pending?.reject(error);
      });
      lines.on("line", (line) => {
        const current = pending;
        pending = undefined;
        try {
          assert.ok(
            current,
            "a resident frame must answer an actual pending request",
          );
          assert.ok(
            Buffer.byteLength(line) <= 1_048_576,
            "resident reply is bounded",
          );
          const frame: unknown = JSON.parse(line);
          assert.ok(
            frame !== null &&
              typeof frame === "object" &&
              "code" in frame &&
              "result" in frame,
          );
          assert.equal(frame.code, current.expectedCode, line);
          current.resolve(frame.result);
        } catch (error) {
          fatal = error;
          current?.reject(error);
        }
      });
      const bounded = async <T>(operation: Promise<T>): Promise<T> => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          return await Promise.race([
            operation,
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () =>
                  reject(new Error("resident protocol/close did not settle")),
                PLUGIN_BUILD_TIMEOUT,
              );
            }),
          ]);
        } finally {
          if (timer) clearTimeout(timer);
        }
      };
      return {
        ask: async (expectedCode = 0) => {
          if (fatal) throw fatal;
          assert.equal(pending, undefined);
          const response = new Promise<unknown>((resolve, reject) => {
            pending = { resolve, reject, expectedCode };
          });
          input.write('{"verb":"project-inputs"}\n', (error) => {
            if (error) {
              fatal = error;
              pending?.reject(error);
            }
          });
          return bounded(response);
        },
        close: async () => {
          input.end();
          await bounded(closed);
          joined = true;
        },
      };
    };
    fs.copyFileSync(path.join(owned, "normal.config.cjs"), lintConfig);
    const heldEntries = new Map(
      [
        lintConfig,
        path.join(owned, "real.config.ts"),
        path.join(owned, "linked.config.ts"),
      ].map((location): [string, string] => [
        location,
        fs.readFileSync(location, "utf8"),
      ]),
    );
    const held = () => {
      for (const [location, bytes] of heldEntries)
        assert.equal(fs.readFileSync(location, "utf8"), bytes);
    };
    const normal = start(false);
    try {
      try {
        counter(realCounter,0);
        counter(linkedCounter,0);
        counter(optoutCounter,0);
        await scriptConfigGraphResident(workspace,lintConfig,normal.ask);
        held();
        counter(realCounter,0);
        counter(linkedCounter,0);
        counter(optoutCounter,0);
      } catch(error) { failures.push(error); }
      for (let request = 0; request < 3; request++) {
        const reply = await normal.ask();
        held();
        membership(reply, "docs/real-before.md", true);
        membership(reply, "docs/linked-before.md", true);
        membership(reply, "docs/real-after.md", false);
        membership(reply, "docs/linked-after.md", false);
        counter(realCounter, 1);
        counter(linkedCounter, 1);
      }
      fs.writeFileSync(
        realIndex,
        originalReal.replace("docs/real-before.md", "docs/real-after.md"),
      );
      for (let request = 0; request < 2; request++) {
        const reply = await normal.ask();
        held();
        membership(reply, "docs/real-before.md", false);
        membership(reply, "docs/real-after.md", true);
        membership(reply, "docs/linked-before.md", true);
        membership(reply, "docs/linked-after.md", false);
        counter(realCounter, 2);
        counter(linkedCounter, 1);
      }
      fs.writeFileSync(
        linkedIndex,
        originalLinked.replace("docs/linked-before.md", "docs/linked-after.md"),
      );
      for (let request = 0; request < 2; request++) {
        const reply = await normal.ask();
        held();
        membership(reply, "docs/real-before.md", false);
        membership(reply, "docs/real-after.md", true);
        membership(reply, "docs/linked-before.md", false);
        membership(reply, "docs/linked-after.md", true);
        counter(realCounter, 2);
        counter(linkedCounter, 2);
      }
    } catch (error) {
      failures.push(error);
    } finally {
      try {
        await normal.close();
      } catch (error) {
        failures.push(error);
      }
    }
    if (joined) {
      fs.writeFileSync(
        realIndex,
        originalReal.replace("docs/real-before.md", "docs/input.md"),
      );
      fs.copyFileSync(path.join(owned, "optout.config.cjs"), lintConfig);
      const optout = start(true);
      try {
        for (let request = 1; request <= 2; request++) {
          const reply = await optout.ask();
          membership(reply, "docs/input.md", true);
          membership(reply, "docs/real-after.md", false);
          membership(reply, "docs/linked-after.md", false);
          counter(optoutCounter, request);
          counter(realCounter, 2);
          counter(linkedCounter, 2);
        }
      } catch (error) {
        failures.push(error);
      } finally {
        try {
          await optout.close();
        } catch (error) {
          failures.push(error);
        }
      }
    }
  } catch (error) {
    failures.push(error);
  } finally {
    if (!joined)
      BatchWorkspace.retain(
        "resident config child did not acknowledge closure",
      );
    else
      for (const restore of [
        () => {
          if (fs.existsSync(linkedPackage)) fs.unlinkSync(linkedPackage);
        },
        () => {
          if (linkedTargetOwned) {
            assert.equal(
              path.resolve(linkedTarget),
              path.join(physicalCache, targetNamespace),
            );
            assert.equal(
              path.dirname(path.resolve(linkedTarget)),
              physicalCache,
            );
            fs.rmSync(linkedTarget, { recursive: true });
          }
        },
        () => {
          if (fs.existsSync(realPackage))
            fs.rmSync(realPackage, { recursive: true });
        },
        () => {
          if (fs.existsSync(owned)) fs.rmSync(owned, { recursive: true });
        },
        () => {
          if (fs.existsSync(lintConfig)) fs.unlinkSync(lintConfig);
        },
      ])
        try {
          restore();
        } catch (error) {
          BatchWorkspace.retain(
            "resident config authored restoration failed after closure",
          );
          failures.push(error);
        }
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "real/linked executable resident config transport",
    );
}

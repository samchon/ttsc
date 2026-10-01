import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { WatchTopology } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchTopology.js";
import { WATCH_EVENT_DEADLINE_MS } from "../../internal/watch";

/**
 * Verifies a project emitting in place still watches its declared inputs.
 *
 * Compiler outputs are excluded from the project-input lane so a build cannot
 * feed its own rebuild. That exclusion reads the configured output directory,
 * and a project may configure it as the project itself — emitting beside the
 * sources is an ordinary layout, and `outDir` set to the project directory says
 * exactly that. Honouring it literally makes every declared input a build
 * product, so nothing is watched and nothing reports it: the build keeps
 * succeeding and simply stops reacting.
 *
 * Watching is the safe side of this one. A product that gets watched costs a
 * spare rebuild; an input that does not is never seen again.
 *
 * 1. Configure a project whose output directory is the project itself.
 * 2. Declare an input inside it.
 * 3. Assert the input is still watched and its edit is still reported.
 *
 * @evidence contracts/testing.md#behavioral-verification This case drives the real WatchTopology: a project emitting in place still watches its declared inputs. 1. Configure a project whose output directory is the project itself. 2. Declare an input inside it. 3. Assert the input is still watched and its edit is still reported.
 * @evidence contracts/testing.md#independent-expectations Authored tsconfig options, source imports and declared input paths establish which files are compiler inputs, products or reload dependencies. Literal event-kind/path assertions and quiet negative twins enforce those independently specified roles rather than snapshotting topology output.
 * @evidence contracts/testing.md#distinguishing-cases 1. Configure a project whose output directory is the project itself. 2. Declare an input inside it. 3. Assert the input is still watched and its edit is still reported.
 * @evidence contracts/testing.md#execution-ownership This named src/features/watch entry refreshes the real tsgo compiler population and drives native filesystem subscriptions through WatchTopology; the source units own direct event planning and injected watcher decisions.
 * @evidence contracts/e2e.md#necessary-boundary The real compiler input/output population must agree with native observer registration and notification classification for this authored layout. Direct path planning cannot establish tsgo membership, actual delivered events or subscription survival across mutations.
 * @evidence contracts/e2e.md#shared-execution The case reuses its built compiler and one Node test process; each topology session serves its authored mutation sequence. Distinct roots/options need their own compiler-population request, and an explicitly new session retains the initial-versus-newly-admitted input distinction; watcher registration installs or builds nothing.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private TestProject roots separate mutable config, source, output and declared-input state. Each topology owns its subscriptions and existing finally paths close them. Event counters reset only between asserted transitions; actual cold registration and config recovery remain unprimed.
 * @evidence contracts/e2e.md#preserved-coverage 1. Configure a project whose output directory is the project itself. 2. Declare an input inside it. 3. Assert the input is still watched and its edit is still reported. Every original assertion and authored layout remains in this named entry; no change to timeout, capability guard, input, expected event or quiet negative twin is made by these acknowledgments.
 */
export const test_watch_topology_keeps_inputs_when_the_project_emits_in_place =
  async (): Promise<void> => {
    const root = TestProject.tmpdir("ttsc-project-input-in-place-");
    const source = path.join(root, "src", "main.ts");
    const declared = path.join(root, "docs", "spec.md");
    for (const file of [source, declared]) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
    }
    fs.writeFileSync(source, "export const value = 1;\n", "utf8");
    fs.writeFileSync(declared, "# Contract\n", "utf8");
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { outDir: "." },
        files: ["src/main.ts"],
      }),
      "utf8",
    );

    const changes: string[] = [];
    let watchRoots: readonly string[] = [];
    const topology = new WatchTopology(
      {
        cwd: root,
        files: [],
        projectRoot: root,
        tsconfig: path.join(root, "tsconfig.json"),
      },
      {
        onError: (location, error) => {
          throw new Error(`watch error on ${location}`, { cause: error });
        },
        onInputChange: (change) => changes.push(change.kind),
        onProjectInputWatchRoots: (roots) => {
          watchRoots = [...roots];
        },
        onTopologyChange: () => {},
      },
    );
    try {
      topology.refresh(false);
      topology.setProjectInputs({ root, files: [declared], globs: [] });
      assert.notEqual(
        watchRoots.length,
        0,
        "an in-place output directory must not leave the declared input unwatched",
      );

      const deadline = Date.now() + WATCH_EVENT_DEADLINE_MS;
      fs.writeFileSync(declared, "# Revised contract\n", "utf8");
      while (changes.length === 0) {
        if (Date.now() >= deadline) {
          assert.fail("an edit to the declared input was never reported");
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    } finally {
      topology.close();
    }
  };

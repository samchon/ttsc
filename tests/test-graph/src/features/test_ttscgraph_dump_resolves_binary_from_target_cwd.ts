import {
  TtscGraphSession,
  loadGraph,
  resolveGraphBinary,
} from "@ttsc/graph";
import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { assert, resolveGraphLauncher } from "../internal/ttsgraph";

// The launcher's own actionable failure when no binary can be resolved. Every
// lane shares this exact string, so it is the discriminator between "resolution
// reached a binary" and "resolution never found one" on platforms where the
// fake binary cannot actually be executed.
const RESOLVE_FAIL = /could not resolve the ttscgraph binary/;

// Only a POSIX host can execute the node-shebang stand-in the fixture installs
// as `ttscgraph`; on Windows the resolver looks for `ttscgraph.exe` and a fake
// PE will not spawn, so there the marker is unobservable and the absence of the
// resolve-failure message carries the assertion instead.
const CAN_EXECUTE = process.platform !== "win32";

const DUMP_MARKER = "TTSCGRAPH-FAKE-DUMP-OK";

/**
 * Install a fake target project whose local `node_modules` carries a resolvable
 * `ttsc` and its per-platform package, the layout `resolveGraphBinary` walks:
 * `ttsc/package.json` anchors a require that finds
 * `@ttsc/<platform>-<arch>/bin/ttscgraph[.exe]`. The binary is a stand-in that
 * prints a marker for `dump`, so resolution can be observed without a real
 * native build. Returns the project root and the absolute binary path.
 */
function installFakeTtsc(): { root: string; binary: string } {
  const root = TestProject.tmpdir("ttscgraph-target-");
  const platform = `${process.platform}-${process.arch}`;
  const exe = process.platform === "win32" ? "ttscgraph.exe" : "ttscgraph";
  const platformDir = path.join(root, "node_modules", "@ttsc", platform);
  const binDir = path.join(platformDir, "bin");
  fs.mkdirSync(binDir, { recursive: true });

  const binary = path.join(binDir, exe);
  fs.writeFileSync(
    binary,
    [
      "#!/usr/bin/env node",
      `if (process.argv[2] === "dump") {`,
      `  process.stdout.write("${DUMP_MARKER}\\n");`,
      "  process.exit(0);",
      "}",
      "process.exit(3);",
      "",
    ].join("\n"),
    "utf8",
  );
  fs.chmodSync(binary, 0o755);
  fs.writeFileSync(
    path.join(platformDir, "package.json"),
    JSON.stringify({ name: `@ttsc/${platform}`, version: "0.0.0" }),
    "utf8",
  );

  const ttscDir = path.join(root, "node_modules", "ttsc");
  fs.mkdirSync(ttscDir, { recursive: true });
  fs.writeFileSync(
    path.join(ttscDir, "package.json"),
    JSON.stringify({ name: "ttsc", version: "0.0.0" }),
    "utf8",
  );
  return { root, binary };
}

/** Run the built launcher as a child, controlling both its process cwd and env. */
function runLauncher(
  args: string[],
  options: { cwd: string; graphBinary: string },
) {
  return TestProject.spawn(process.execPath, [resolveGraphLauncher(), ...args], {
    cwd: options.cwd,
    // Neutralize any ambient override so `--cwd` anchoring is what resolves the
    // binary; a non-empty value here would short-circuit resolution.
    env: { TTSC_GRAPH_BINARY: options.graphBinary },
    timeout: 60_000,
  });
}

/**
 * Verifies every `@ttsc/graph` lane resolves its native `ttscgraph` binary from
 * the project named by `--cwd` / the API `cwd`, not from the launcher's process
 * directory.
 *
 * The lanes retained the target cwd only in the arguments forwarded to the
 * native process, and each called `resolveGraphBinary()` with no cwd first, so a
 * server, viewer, dump, or API call started from a directory without `ttsc`
 * reported the binary missing even though the target project installed it. The
 * resolver already accepted a cwd anchor; the callers discarded it. This case
 * pins every lane to the anchored resolution and keeps the override precedence
 * and the actionable failure intact.
 *
 * 1. Install a fake target project whose local `node_modules` carries a
 *    resolvable `ttsc` and platform binary, and a separate empty directory with
 *    neither.
 * 2. For the resolver owner and the `dump`, `view`, `loadGraph`, and
 *    `TtscGraphSession` lanes, drive resolution anchored at the fake target from
 *    an unrelated process cwd and assert it succeeds; drive the empty directory
 *    as the negative twin and assert the actionable failure survives.
 * 3. Assert `TTSC_GRAPH_BINARY` (absolute) still overrides, a relative override
 *    is ignored, and the default (no cwd) anchor stays `process.cwd()`.
 */
export const test_ttscgraph_dump_resolves_binary_from_target_cwd =
  async (): Promise<void> => {
    const { root: target, binary } = installFakeTtsc();
    const elsewhere = TestProject.tmpdir("ttscgraph-launcher-");
    const empty = TestProject.tmpdir("ttscgraph-empty-");

    // --- resolver owner: the single anchor every lane forwards its cwd to. ---
    const resolved = resolveGraphBinary({}, target);
    assert.ok(
      resolved !== null &&
        fs.realpathSync(resolved) === fs.realpathSync(binary),
      `resolveGraphBinary must resolve the target project's binary: ${String(resolved)}`,
    );
    assert.equal(
      resolveGraphBinary({}, empty),
      null,
      "an unrelated cwd without ttsc resolves nothing (negative twin)",
    );
    assert.equal(
      resolveGraphBinary({ TTSC_GRAPH_BINARY: binary }, empty),
      binary,
      "an absolute TTSC_GRAPH_BINARY overrides cwd resolution",
    );
    assert.equal(
      resolveGraphBinary({ TTSC_GRAPH_BINARY: "ttscgraph" }, empty),
      null,
      "a relative TTSC_GRAPH_BINARY is ignored, not trusted as an override",
    );
    assert.equal(
      resolveGraphBinary({}),
      resolveGraphBinary({}, process.cwd()),
      "the default anchor stays process.cwd() when no project is named",
    );

    // --- dump lane: the canonical repro, launched from a dir without ttsc. ---
    const dumpFromTarget = runLauncher(["dump", "--cwd", target], {
      cwd: elsewhere,
      graphBinary: "",
    });
    assert.doesNotMatch(
      dumpFromTarget.stderr ?? "",
      RESOLVE_FAIL,
      `dump must resolve the binary from --cwd target, not the launch dir\nstderr: ${dumpFromTarget.stderr}`,
    );
    if (CAN_EXECUTE) {
      assert.equal(
        dumpFromTarget.status,
        0,
        `dump against the target binary exits clean\nstderr: ${dumpFromTarget.stderr}`,
      );
      assert.match(dumpFromTarget.stdout ?? "", new RegExp(DUMP_MARKER));
    }

    const dumpNoBinary = runLauncher(["dump", "--cwd", empty], {
      cwd: empty,
      graphBinary: "",
    });
    assert.equal(
      dumpNoBinary.status,
      1,
      `dump with no resolvable binary fails\nstderr: ${dumpNoBinary.stderr}`,
    );
    assert.match(
      dumpNoBinary.stderr ?? "",
      RESOLVE_FAIL,
      "the actionable resolution failure survives when nothing resolves",
    );

    const dumpOverride = runLauncher(["dump", "--cwd", empty], {
      cwd: empty,
      graphBinary: binary,
    });
    assert.doesNotMatch(
      dumpOverride.stderr ?? "",
      RESOLVE_FAIL,
      `an absolute TTSC_GRAPH_BINARY still wins even when --cwd has no ttsc\nstderr: ${dumpOverride.stderr}`,
    );
    if (CAN_EXECUTE) {
      assert.equal(dumpOverride.status, 0);
      assert.match(dumpOverride.stdout ?? "", new RegExp(DUMP_MARKER));
    }

    // --- view lane: resolves before the dump it drives; the fake's non-JSON
    // output makes view fail at parse (after resolution) so it never serves. ---
    const viewFromTarget = runLauncher(
      ["view", "--cwd", target, "--no-open", "--port", "0"],
      { cwd: elsewhere, graphBinary: "" },
    );
    assert.doesNotMatch(
      viewFromTarget.stderr ?? "",
      RESOLVE_FAIL,
      `view must resolve the binary from --cwd target\nstderr: ${viewFromTarget.stderr}`,
    );
    const viewNoBinary = runLauncher(
      ["view", "--cwd", empty, "--no-open", "--port", "0"],
      { cwd: empty, graphBinary: "" },
    );
    assert.match(
      viewNoBinary.stderr ?? "",
      RESOLVE_FAIL,
      "view surfaces the same actionable failure when nothing resolves",
    );

    // --- in-process programmatic lanes: loadGraph and the MCP session. ---
    // Neutralize an ambient override so process.env anchoring is what these
    // lanes exercise, then restore it.
    const savedOverride = process.env.TTSC_GRAPH_BINARY;
    delete process.env.TTSC_GRAPH_BINARY;
    try {
      // loadGraph resolves from its cwd, then spawns the fake dump; the fake's
      // non-JSON output (or a Windows spawn failure) makes it throw *after*
      // resolution, so a throw that is not the resolve failure proves the
      // binary was found under the target.
      let loadMessage = "";
      try {
        loadGraph({ cwd: target, tsconfig: "tsconfig.json" });
      } catch (error) {
        loadMessage = error instanceof Error ? error.message : String(error);
      }
      assert.notEqual(
        loadMessage,
        "",
        "loadGraph against the fake binary must throw after it runs",
      );
      assert.doesNotMatch(
        loadMessage,
        RESOLVE_FAIL,
        `loadGraph resolves the binary from its cwd, not the process dir: ${loadMessage}`,
      );
      assert.throws(
        () => loadGraph({ cwd: empty, tsconfig: "tsconfig.json" }),
        RESOLVE_FAIL,
        "loadGraph keeps the actionable failure for an unresolved cwd",
      );

      // The MCP server construction path: the session constructor resolves and
      // repairs the binary but spawns nothing until the first graph request, so
      // it is the cleanest cross-platform proof of anchored resolution.
      const session = new TtscGraphSession({
        cwd: target,
        tsconfig: "tsconfig.json",
      });
      session.close();
      assert.throws(
        () => new TtscGraphSession({ cwd: empty, tsconfig: "tsconfig.json" }),
        RESOLVE_FAIL,
        "the session construction path keeps the actionable failure",
      );
    } finally {
      if (savedOverride === undefined) delete process.env.TTSC_GRAPH_BINARY;
      else process.env.TTSC_GRAPH_BINARY = savedOverride;
    }
  };

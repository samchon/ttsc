import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import nodeChildProcessForTrace from "node:child_process";
import { E2eProcessTrace } from "../../../../../../utils/src/E2eProcessTrace";
const cp = { ...nodeChildProcessForTrace, ...E2eProcessTrace };
import fs from "node:fs";
import path from "node:path";

import { buildSourcePlugin } from "../../../../../../../packages/ttsc/lib/plugin/internal/source/buildSourcePlugin.js";

/**
 * Verifies cold plugin binaries reuse equivalent Go objects across snapshots.
 *
 * Random scratch paths must not turn unchanged dependency sources into new Go
 * compilation actions. One real toolchain records compiler commands while the
 * same project is rebuilt, edited and rejected, preserving native boundaries.
 *
 * 1. Build and execute a source plugin with an embedded file and a helper.
 * 2. Remove only its binary and rebuild through another materialization.
 * 3. Change its helper and assert new output, then reject malformed source.
 *
 * @evidence contracts/testing.md#behavioral-verification Four actual Go build attempts distinguish first helper compilation, object reuse after binary-only deletion, changed helper recompilation/output and malformed-source rejection; executed binaries retain embedded bytes and logical runtime/panic source paths.
 * @evidence contracts/testing.md#independent-expectations Go -x compiler command lines independently expose helper compilation, and literal ORIGINAL/CHANGED, embedded bytes, module source names and panic exit/status messages define expected runtime behavior without using ttsc's computed cache key.
 * @evidence contracts/testing.md#distinguishing-cases A unique helper starts cold, the second cold plugin binary uses a different snapshot cwd without compiling that helper, changed bytes compile again and select another binary, and malformed bytes fail. runtime.Caller and panic stacks must exclude physical scratch identity despite supplied GOFLAGS=-trimpath=false.
 * @evidence contracts/testing.md#execution-ownership The named native-plugin entry invokes the real Go tool via a recording wrapper and executes produced native binaries synchronously; its trace parser only observes actual compile commands, not a fake compiler response.
 * @evidence contracts/e2e.md#necessary-boundary Go's object action keys and runtime/stack source naming must remain valid across actual materialized filesystem roots; a source-key unit or stub artifact cannot establish compiler object reuse, embedding and path provenance.
 * @evidence contracts/e2e.md#shared-execution One module, source tree, recording wrapper and shared Go object cache serve four phases. Only the plugin binary is deleted before phase two; changed and malformed inputs require their respective new attempts while equivalent helper objects remain reusable.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A unique module keeps the first helper cold, private source/trace/binary state isolates mutation phases and the input-keyed shared Go cache remains reusable. Wrapper and artifact children terminate synchronously, and TestProject owns the fixture tree; no global toolchain variable is changed.
 * @evidence contracts/e2e.md#preserved-coverage All four-trace/cwd/compile-count, output, panic/status/source-path, changed-binary and syntax-failure assertions remain here. Binary-only deletion continues to prevent a warm executable from impersonating Go object reuse.
 */
export function test_buildsourceplugin_reuses_go_objects_across_materializations(): void {
  const root = TestProject.tmpdir("ttsc-go-object-reuse-");
  const source = path.join(root, "source");
  const moduleName = `example.com/${path.basename(root).toLowerCase()}`;
  const trace = path.join(root, "builds.jsonl");
  const goRoot = cp
    .execFileSync("go", ["env", "GOROOT"], {
      encoding: "utf8",
      windowsHide: true,
    })
    .trim();
  const realGo = path.join(
    goRoot,
    "bin",
    process.platform === "win32" ? "go.exe" : "go",
  );
  const wrapper = createRecordingGo(root, realGo, trace);
  TestProject.writeFiles(source, {
    "go.mod": `module ${moduleName}\n\ngo 1.26\n`,
    "main.go": `package main\nimport ("fmt"; "os"; "runtime"; _ "embed"; "${moduleName}/helper")\n//go:embed payload.txt\nvar payload string\nfunc main() { if len(os.Args) > 1 { panic("source-build-panic") }; _, file, _, _ := runtime.Caller(0); fmt.Printf("%s|%s|%s", helper.Value, payload, file) }\n`,
    "helper/value.go": 'package helper\nconst Value = "ORIGINAL"\n',
    "payload.txt": "embedded bytes",
  });
  const options = {
    baseDir: root,
    cacheDir: path.join(root, "cache"),
    env: {
      ...process.env,
      GOROOT: goRoot,
      TTSC_GO_BINARY: wrapper,
      TTSC_GO_CACHE_DIR: TestProject.sharedGoBuildCache(),
      GOFLAGS: "-trimpath=false",
    },
    overlayDirs: [],
    pluginName: "go-object-reuse",
    quiet: true,
    source,
    ttscVersion: "1.0.0",
    tsgoVersion: "7.0.0-dev",
  };
  const first = buildSourcePlugin(options);
  const output = (binary: string) =>
    cp.execFileSync(binary, [], { encoding: "utf8", windowsHide: true });
  const originalOutput = output(first);
  const panic = cp.spawnSync(first, ["panic"], {
    encoding: "utf8",
    windowsHide: true,
  });
  fs.unlinkSync(first);
  const second = buildSourcePlugin(options);
  const repeatedOutput = output(second);
  fs.writeFileSync(
    path.join(source, "helper/value.go"),
    'package helper\nconst Value = "CHANGED"\n',
  );
  const changed = buildSourcePlugin(options);
  const changedOutput = output(changed);
  fs.writeFileSync(
    path.join(source, "helper/value.go"),
    "package helper\nconst Value =\n",
  );
  let failure: unknown;
  try {
    buildSourcePlugin(options);
  } catch (error) {
    failure = error;
  }
  const builds = fs
    .readFileSync(trace, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { cwd: string; stderr: string });
  const compiledHelper = (build: { stderr: string }) =>
    build.stderr
      .split("\n")
      .some(
        (line) =>
          /[\\/]compile(?:\.exe)?\b/.test(line) &&
          line.includes(`-p ${moduleName}/helper `),
      );
  assert.equal(builds.length, 4);
  assert.notEqual(
    builds[0]!.cwd,
    builds[1]!.cwd,
    "the cold builds must use separate snapshots",
  );
  assert.equal(compiledHelper(builds[0]!), true, "the unique helper starts cold");
  assert.equal(
    compiledHelper(builds[1]!),
    false,
    "unchanged helper objects must survive snapshot relocation",
  );
  assert.equal(
    compiledHelper(builds[2]!),
    true,
    "changed helper bytes must invalidate the object",
  );
  assert.equal(originalOutput, `ORIGINAL|embedded bytes|${moduleName}/main.go`);
  assert.equal(repeatedOutput, originalOutput);
  assert.equal(changedOutput, `CHANGED|embedded bytes|${moduleName}/main.go`);
  assert.equal(panic.status, 2);
  assert.match(panic.stderr, /panic: source-build-panic/);
  assert.ok(panic.stderr.includes(`${moduleName}/main.go:`));
  assert.equal(panic.stderr.includes(builds[0]!.cwd), false);
  assert.notEqual(changed, second, "source edits must select another plugin binary");
  assert.match(String(failure), /syntax error/);
}

/** Record actual Go compiler commands through its supported executable boundary. */
function createRecordingGo(root: string, go: string, trace: string): string {
  const script = path.join(root, "record-go.cjs");
  fs.writeFileSync(script, `const cp=require("node:child_process"),fs=require("node:fs");\nconst args=process.argv.slice(2);\nconst result=cp.spawnSync(${JSON.stringify(go)},args[0]==="build"?["build","-x",...args.slice(1)]:args,{encoding:"utf8",env:process.env,windowsHide:true,maxBuffer:64*1024*1024});\nif(args[0]==="build")fs.appendFileSync(${JSON.stringify(trace)},JSON.stringify({cwd:process.cwd(),stderr:result.stderr??""})+"\\n");\nif(result.stdout)process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);if(result.error)throw result.error;process.exitCode=result.status??1;\n`);
  const executable = path.join(root, process.platform === "win32" ? "go.cmd" : "go");
  fs.writeFileSync(executable, process.platform === "win32" ? `@echo off\r\n"${process.execPath}" "${script}" %*\r\n` : `#!/bin/sh\nexec '${process.execPath.replaceAll("'", "'\\''")}' '${script.replaceAll("'", "'\\''")}' "$@"\n`, { mode: 0o755 });
  return executable;
}

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const { createGoBuildCache } = require("./go-build-cache.cjs");

test("Go build cache keys every effective input and rejects corrupt state", () => {
  const fixture = createFixture();
  try {
    const current = (overrides = {}) =>
      createGoBuildCache({ ...fixture.options, ...overrides });
    const record = () => {
      const cache = current();
      cache.write();
      assert.equal(current().isCurrent(), true);
    };
    const invalidates = (file, contents) => {
      record();
      const original = fs.readFileSync(file, "utf8");
      fs.writeFileSync(file, contents);
      assert.equal(current().isCurrent(), false);
      fs.writeFileSync(file, original);
    };

    record();
    fs.writeFileSync(path.join(fixture.root, "README.md"), "unrelated docs\n");
    assert.equal(current().isCurrent(), true);

    invalidates(fixture.goSource, "package main\nfunc main() { println(2) }\n");
    invalidates(fixture.embed, '{"schema":2}\n');
    invalidates(
      fixture.goMod,
      "module example.test/cache\n\ngo 1.26\n\nrequire example.test/dependency v1.0.1\n",
    );
    invalidates(fixture.goSum, "example.test/dependency v1.0.1 h1:changed\n");
    invalidates(fixture.goWork, "go 1.26\n\nuse ./other-module\n");
    invalidates(fixture.goWorkSum, "example.test/dependency v1.0.1 h1:changed\n");
    invalidates(
      fixture.dependencySource,
      "package dependency\nfunc Version() int { return 2 }\n",
    );
    invalidates(fixture.bridge, "new wasm bridge\n");
    invalidates(fixture.shimSource, "package shim\nconst Version = 2\n");
    record();
    fs.writeFileSync(
      fixture.shimOutput,
      "package shim\nconst Version = stale\n",
    );
    assert.equal(current().isCurrent(), false);
    fs.writeFileSync(
      fixture.shimOutput,
      "package shim\nconst Version = 1\n",
    );
    invalidates(fixture.goBinary, "go compiler v2\n");

    record();
    assert.equal(
      current({
        buildArguments: [...fixture.options.buildArguments, "-tags=extra"],
      }).isCurrent(),
      false,
    );
    assert.equal(
      current({ environment: { GOOS: "js", GOARCH: "wasm64" } }).isCurrent(),
      false,
    );
    assert.equal(
      current({
        execFileSync: fakeGo({
          command: fixture.command,
          dependency: fixture.dependency,
          goMod: fixture.goMod,
          goWasm: "satconv",
          goWork: fixture.goWork,
          goroot: fixture.goroot,
        }),
      }).isCurrent(),
      false,
    );
    assert.equal(
      current({
        execFileSync: fakeGo({
          command: fixture.command,
          dependency: fixture.dependency,
          goMod: fixture.goMod,
          goVersion: "go1.26.5",
          goWork: fixture.goWork,
          goroot: fixture.goroot,
        }),
      }).isCurrent(),
      false,
    );
    assert.equal(current({ force: true }).isCurrent(), false);

    record();
    fs.writeFileSync(fixture.wasm, "corrupt wasm\n");
    assert.equal(current().isCurrent(), false);

    fs.writeFileSync(fixture.wasm, "wasm artifact\n");
    record();
    fs.writeFileSync(fixture.options.cachePath, "not json\n");
    assert.equal(current().isCurrent(), false);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-go-build-cache-"));
  const module = path.join(root, "module");
  const command = path.join(module, "cmd", "example");
  const dependency = path.join(module, "dependency");
  const output = path.join(root, "out");
  const shimSourceRoot = path.join(root, "shim-source");
  const shimOutputRoot = path.join(output, "shim");
  const goroot = path.join(root, "go");
  fs.mkdirSync(command, { recursive: true });
  fs.mkdirSync(dependency, { recursive: true });
  fs.mkdirSync(shimSourceRoot, { recursive: true });
  fs.mkdirSync(shimOutputRoot, { recursive: true });
  fs.mkdirSync(path.join(goroot, "bin"), { recursive: true });

  const goMod = path.join(module, "go.mod");
  const goSum = path.join(module, "go.sum");
  const goWork = path.join(root, "go.work");
  const goWorkSum = path.join(root, "go.work.sum");
  const goSource = path.join(command, "main.go");
  const dependencySource = path.join(dependency, "dependency.go");
  const embed = path.join(command, "schema.json");
  const bridge = path.join(root, "wasm_exec.js");
  const wasm = path.join(output, "example.wasm");
  const shimSource = path.join(shimSourceRoot, "shim.go");
  const shimOutput = path.join(shimOutputRoot, "shim.go");
  const goBinary = path.join(
    goroot,
    "bin",
    process.platform === "win32" ? "go.exe" : "go",
  );
  fs.writeFileSync(goMod, "module example.test/cache\ngo 1.26\n");
  fs.writeFileSync(goSum, "example.test/dependency v1.0.0 h1:original\n");
  fs.writeFileSync(goWork, "go 1.26\n\nuse ./module\n");
  fs.writeFileSync(goWorkSum, "example.test/dependency v1.0.0 h1:original\n");
  fs.writeFileSync(goSource, "package main\nfunc main() { println(1) }\n");
  fs.writeFileSync(
    dependencySource,
    "package dependency\nfunc Version() int { return 1 }\n",
  );
  fs.writeFileSync(embed, '{"schema":1}\n');
  fs.writeFileSync(bridge, "wasm bridge\n");
  fs.writeFileSync(wasm, "wasm artifact\n");
  fs.writeFileSync(shimSource, "package shim\nconst Version = 1\n");
  fs.writeFileSync(shimOutput, "package shim\nconst Version = 1\n");
  fs.writeFileSync(goBinary, "go compiler v1\n");

  const options = {
    artifactPaths: [wasm, bridge, shimOutputRoot],
    buildArguments: ["go", "build", "-trimpath", "./cmd/example"],
    cachePath: path.join(output, ".cache.json"),
    cwd: module,
    dependencyPackages: ["./cmd/example"],
    environment: { GOOS: "js", GOARCH: "wasm" },
    extraFiles: [bridge],
    inputDirectories: [shimSourceRoot],
    execFileSync: fakeGo({ command, dependency, goMod, goWork, goroot }),
  };
  return {
    root,
    options,
    bridge,
    command,
    dependency,
    dependencySource,
    embed,
    goBinary,
    goMod,
    goSource,
    goSum,
    goWork,
    goWorkSum,
    goroot,
    shimSource,
    shimOutput,
    wasm,
  };
}

function fakeGo({
  command,
  dependency,
  goMod,
  goWasm = "",
  goVersion = "go1.26.4",
  goWork,
  goroot,
}) {
  return (_command, args) => {
    if (args[0] === "list" && args[1] === "-deps") {
      return `${JSON.stringify({
        Dir: command,
        GoFiles: ["main.go"],
        EmbedFiles: ["schema.json"],
        Module: { GoMod: goMod },
      })}\n${JSON.stringify({
        Dir: dependency,
        GoFiles: ["dependency.go"],
        Module: { GoMod: goMod },
      })}\n`;
    }
    if (args[0] === "list" && args[1] === "-m") {
      return `${JSON.stringify({ Path: "example.test/cache", GoMod: goMod })}\n`;
    }
    if (args[0] === "env") {
      return JSON.stringify({
        GOVERSION: goVersion,
        GOROOT: goroot,
        GOOS: "js",
        GOARCH: "wasm",
        GOFLAGS: "",
        GOEXPERIMENT: "",
        GOTOOLCHAIN: "auto",
        GOWASM: goWasm,
        CGO_ENABLED: "0",
        GOWORK: goWork,
      });
    }
    throw new Error(`unexpected go command: ${args.join(" ")}`);
  };
}

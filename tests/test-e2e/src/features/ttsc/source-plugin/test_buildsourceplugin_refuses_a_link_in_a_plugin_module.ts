import { TestProject } from "@ttsc/testing";

import {
  assert,
  buildSourcePlugin,
  createFakeGoBinary,
  fs,
  path,
} from "../../../internal/ttsc/internal/source-build";

/**
 * Verifies a plugin module holding a link is refused with the reason, before
 * any build.
 *
 * The file list a build keys on skipped every link, while the build's copy of
 * the module recreated it: on POSIX, `go build` then compiled the linked
 * sources and an edit to them kept serving the first binary; on Windows, the
 * copy threw `EPERM` recreating a junction as a symlink (samchon/ttsc#1506). A
 * plugin's Go sources are its own files, as a Go module zip holds them, so a
 * link the build would read is refused by name. One below a directory the build
 * passes over, such as `node_modules`, still changes nothing.
 *
 * 1. Write a plugin module whose package directory `shared` is a link to a sibling
 *    directory, and a link inside its `node_modules`.
 * 2. Build it.
 * 3. Assert the build fails naming the link, and never runs `go build`.
 * 4. Replace the link with the files and build again: it succeeds, and the link in
 *    `node_modules` is ignored.
 *
 * @evidence contracts/testing.md#behavioral-verification buildSourcePlugin names an included source link and invokes no build, then succeeds after replacing it with files while an excluded node_modules link remains.
 * @evidence contracts/testing.md#independent-expectations Keyed module contents must consist of owned files; independent invocation logging proves the refused module did not compile.
 * @evidence contracts/testing.md#distinguishing-cases Included directory symlink/junction is refused, copied real files are accepted, and a link below excluded node_modules is ignored.
 * @evidence contracts/testing.md#execution-ownership The exported test_buildsourceplugin_refuses_a_link_in_a_plugin_module entry is discovered by TestExecutor from features/source-plugin in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary buildSourcePlugin passes actual executable arguments, cwd, environment and copied workspace inputs through a child process before publication. The fake Go script can fail or record those inputs independently; it proves build orchestration at this process boundary and does not certify native Go compilation.
 * @evidence contracts/e2e.md#shared-execution One module/root/responder implementation feeds included-link refusal then copied-file admission; original build closure recreates the fake tool each request. Logged build-prefixed rows are independently asserted empty after refusal, not total child count: key metadata queries may still occur. Recovery changes keyed topology and cannot claim same-key warm reuse/native Go compilation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Tracked root is retained before native link preparation. Actual Windows junction/POSIX directory symlink and excluded node_modules alias remain until their observations; only included alias is removed before copying sibling files. Environments are call-local, no ambient mutation/restoration is claimed. Direct synchronous result does not join arbitrary descendants; unexpected failure remains aggregated, not hidden by wholesale reset.
 * @evidence contracts/e2e.md#preserved-coverage Original six files/sibling shared file/two native aliases, contains-link plus exact included path, independently filtered build[] and copied-file binary-exists control remain; refusal/log/recovery failures are independently collected. Existing direct owner tests/test-ttsc/src/features/source-plugin/test_source_collection_refuses_contributing_links_and_admits_owned_files.ts owns collector/digest native-link refusal and exact copied paths/bytes, not builder invocation ordering/publication or runtime certification. Prior mapped body reused without reread; new callable0, runtime/selection/survival unverified and donor retained.
 */
export const test_buildsourceplugin_refuses_a_link_in_a_plugin_module = () => {
  const root = TestProject.tmpdir("ttsc-plugin-module-link-");
  TestProject.retainTemporaryDirectory(root, "Source link admission tool descendants are not joined");
  const plugin = path.join(root, "plugin");
  const shared = path.join(root, "shared");
  write(path.join(plugin, "go.mod"), "module example.com/plugin\n\ngo 1.26\n");
  write(path.join(plugin, "main.go"), "package main\n");
  // The files the fake Go build requires of the module it compiles.
  for (const relative of [
    "vendor/local/value.go",
    "lib/helper.go",
    "dist/generated.go",
    "build/generated.go",
  ])
    write(path.join(plugin, relative), "package generated\n");
  write(path.join(shared, "shared.go"), "package shared\n");
  const link = path.join(plugin, "shared");
  const kind = process.platform === "win32" ? "junction" : "dir";
  fs.symlinkSync(shared, link, kind);
  fs.mkdirSync(path.join(plugin, "node_modules"), { recursive: true });
  fs.symlinkSync(shared, path.join(plugin, "node_modules", "shared"), kind);
  const fakeGo = path.join(root, "fake-go");
  fs.mkdirSync(fakeGo, { recursive: true });
  const invocations = path.join(root, "go-invocations.log");
  const build = (): string =>
    buildSourcePlugin({
      baseDir: root,
      cacheDir: path.join(root, "cache"),
      env: {
        ...process.env,
        FAKE_GO_INVOCATION_LOG: invocations,
        TTSC_GO_BINARY: createFakeGoBinary(fakeGo),
      },
      overlayDirs: [],
      pluginName: "linked-module",
      quiet: true,
      source: plugin,
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });

  const failures: unknown[] = [];
  try {
    assert.throws(build, (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      return message.includes("contains a link at") && message.includes(link);
    });
  } catch (error) {
    failures.push(new Error("Included link refusal", { cause: error }));
  }
  try {
    const built = fs.existsSync(invocations)
      ? fs
          .readFileSync(invocations, "utf8")
          .split("\n")
          .filter((line) => line.startsWith("build"))
      : [];
    assert.deepEqual(built, [], "no build ran for a refused module");
  } catch (error) {
    failures.push(new Error("Refused module build invocation population", { cause: error }));
  }

  try {
    fs.rmSync(link, { force: true, recursive: false });
    fs.cpSync(shared, link, { recursive: true });
    assert.ok(fs.existsSync(build()), "the module with its own files builds");
  } catch (error) {
    failures.push(new Error("Owned-file recovery with excluded link retained", { cause: error }));
  }
  if (failures.length) throw new AggregateError(failures, "Source link admission outcomes");
};

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

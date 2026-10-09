import { TestProject } from "../../../../utils/src/TestProject";
import { assert, fs, path, readProjectConfig } from "../../internal/project-unit";

/**
 * Verifies completed config reuse retains cycle and native failure boundaries.
 *
 * A successful sibling is never evidence that the still-active branch can be
 * reused. Failed reads also leave no completed state for another invocation.
 *
 * 1. Read self and indirect cycles after completing an acyclic sibling.
 * 2. Contrast malformed, invalid-root, missing and native unreadable configs.
 * 3. Repair a failed ancestor and require a fresh successful result.
 *
 * @evidence contracts/testing.md#behavioral-verification Direct production reads require circular-extends errors for self, indirect and native-alias cycles after completed siblings, retain selected malformed filenames and native directory-read failures, and successfully reread a repaired ancestor.
 * @evidence contracts/testing.md#independent-expectations Explicit authored graph edges independently establish each cycle. Invalid JSON, an array root, an absent file and a selected tsconfig.json directory establish distinct error classes; repaired strict:false bytes supply the recovery oracle.
 * @evidence contracts/testing.md#distinguishing-cases Acyclic duplicated sibling completion precedes cycles and parse failures. Direct and indirect cycles contrast with all acyclic DAG tests; native aliases contrast lexical spellings. Missing selection and selected-directory read errors remain distinct from malformed/root-shape errors, and failure-to-success transition rules out cross-call failed-state retention.
 * @evidence contracts/testing.md#execution-ownership The named unit calls the source reader on real private files/directories and a native directory link, without compiler processes, artifact preparation or installed consumers. Independent scenarios collect failures before throwing and fixture exit cleanup belongs to TestProject.
 */
export function test_readprojectconfig_rejects_cycles_after_completed_siblings(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-config-failures-"),
  );
  const failures: Error[] = [];
  const check = (name: string, operation: () => void): void => {
    try {
      operation();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  const write = (name: string, value: unknown): void => {
    fs.writeFileSync(path.join(root, name), JSON.stringify(value));
  };
  const read = (name: string) =>
    readProjectConfig({ tsconfig: path.join(root, name) });
  write("base.json", { compilerOptions: { strict: true } });
  check("self cycle after a completed sibling", () => {
    write("self.json", {
      extends: ["./base.json", "./base.json", "./self.json"],
    });
    assert.throws(() => read("self.json"), /circular tsconfig extends detected/);
  });
  check("indirect cycle after completed siblings", () => {
    write("entry.json", { extends: ["./base.json", "./branch.json"] });
    write("branch.json", { extends: ["./base.json", "./nested.json"] });
    write("nested.json", { extends: "./entry.json" });
    assert.throws(() => read("entry.json"), /circular tsconfig extends detected/);
  });
  check("canonical alias cycle after a completed sibling", () => {
    const directory = path.join(root, "cycle");
    const alias = path.join(root, "cycle-alias");
    fs.mkdirSync(directory);
    fs.symlinkSync(
      directory,
      alias,
      process.platform === "win32" ? "junction" : "dir",
    );
    fs.writeFileSync(
      path.join(directory, "entry.json"),
      JSON.stringify({ extends: ["../base.json", "../cycle-alias/entry.json"] }),
    );
    assert.throws(
      () => read("cycle/entry.json"),
      /circular tsconfig extends detected/,
    );
  });
  check("malformed selected ancestor is named after sibling completion", () => {
    write("entry.json", { extends: ["./base.json", "./broken.json"] });
    fs.writeFileSync(path.join(root, "broken.json"), "{ invalid");
    assert.throws(() => read("entry.json"), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.ok(
        error.message.includes(
          `failed to parse ${path.join(root, "broken.json")}`,
        ),
      );
      return true;
    });
  });
  check("invalid ancestor root remains an error", () => {
    write("broken.json", []);
    assert.throws(() => read("entry.json"), /root value.*must be an object/);
  });
  check("missing ancestor remains a selection error", () => {
    write("entry.json", { extends: ["./base.json", "./absent"] });
    assert.throws(() => read("entry.json"), /extended tsconfig not found/);
  });
  check("selected directory preserves its native read failure", () => {
    const directory = path.join(root, "unreadable");
    fs.mkdirSync(path.join(directory, "tsconfig.json"), { recursive: true });
    assert.throws(
      () => read("unreadable"),
      (error: unknown) => (error as NodeJS.ErrnoException).code === "EISDIR",
    );
  });
  check("a failed ancestor is freshly read after repair", () => {
    write("broken.json", { compilerOptions: { strict: false } });
    write("entry.json", { extends: ["./base.json", "./broken.json"] });
    const result = read("entry.json");
    assert.equal(result.compilerOptions.strict, false);
    assert.deepEqual(result.configPaths, [
      path.join(root, "base.json"),
      path.join(root, "broken.json"),
      path.join(root, "entry.json"),
    ]);
  });
  if (failures.length !== 0)
    throw new AggregateError(
      failures,
      "config cycle and failure boundaries failed",
    );
}

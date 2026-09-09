import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies standard decorator fields and accessors preserve initialization.
 *
 * Decorator lowering shares the class-field transform. Private fields,
 * auto-accessors and addInitializer must retain TC39 value and ordering rules.
 *
 * 1. Decorate a private field, an auto-accessor, and a static method.
 * 2. Instantiate the class after its class initializer has run.
 * 3. Assert transformed values and static/class/instance initializer order.
 */
export const test_ttsx_standard_decorators_preserve_member_initialization =
  () => {
    for (const module of ["commonjs", "esnext"]) {
      const root = TestProject.createProject({
        "package.json": JSON.stringify({
          type: module === "commonjs" ? "commonjs" : "module",
        }),
        "tsconfig.json": TestProject.tsconfig({
          target: "ESNext",
          module,
          strict: true,
          rootDir: "src",
          outDir: "dist",
        }),
        "src/main.ts": `
const events: string[] = [];
function tagged(value: Function, context: ClassDecoratorContext) {
  context.addInitializer(function() { events.push("class:" + this.name); });
}
function field(value: undefined, context: ClassFieldDecoratorContext) {
  context.addInitializer(function() { events.push("field:" + String(context.name)); });
  return function(initial: number) { return initial + 1; };
}
function accessor(value: ClassAccessorDecoratorTarget<Foo, number>, context: ClassAccessorDecoratorContext<Foo, number>) {
  context.addInitializer(function() { events.push("accessor:" + String(context.name)); });
  return { init(initial: number) { return initial * 2; } };
}
function method(value: Function, context: ClassMethodDecoratorContext) {
  context.addInitializer(function() { events.push("static:" + String(context.name)); });
}
@tagged
class Foo {
  @field #value = 2;
  @accessor accessor count = 4;
  @method static run() { return "method"; }
  read() { return this.#value + this.count; }
}
const foo = new Foo();
console.log(foo.read(), Foo.run());
console.log(events.join(","));
`,
      });
      const result = TestProject.spawn(TestProject.TTSX_BIN, ["src/main.ts"], {
        cwd: root,
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(
        result.stdout.trim(),
        "11 method\nstatic:run,class:Foo,field:#value,accessor:count",
      );
    }
  };

const effects: unknown[][] = [];
const effectConsole = { log(...values: unknown[]): void { effects.push(values); } };

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
effectConsole.log(foo.read(), Foo.run());
effectConsole.log(events.join(","));

export const observed = effects.map((values) => values.join(" ")).join("\n");


/** Standard decorator witness from #1359, with observable replacement behavior. */
export const STANDARD_DECORATOR_SOURCE = `
function sayHelloClass<T extends { new (...args: any[]): {} }>(ClassType: T, context: ClassDecoratorContext) {
  return class extends ClassType {
    constructor(...args: any[]) {
      super(...args);
      console.log("Hello Class " + context.name);
    }
  };
}
function sayHelloMethod<T>(target: (this: T, ...args: any[]) => any, context: ClassMethodDecoratorContext) {
  return function(this: T, ...args: any[]): any {
    console.log("Hello Function " + context.name.toString());
    return target.apply(this, args);
  };
}
@sayHelloClass
class Foo {
  constructor(public bar: string) {}
  @sayHelloMethod
  getBar() { return this.bar; }
}
console.log(new Foo("abc").getBar());
`;

export const STANDARD_DECORATOR_OUTPUT =
  "Hello Class Foo\nHello Function getBar\nabc";

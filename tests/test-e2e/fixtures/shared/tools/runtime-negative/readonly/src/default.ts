declare const console: { log(value: unknown): void };
import { view } from "./view.js";

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

function optional(value?: { answer: number }) { return value?.answer; }
console.log("TTSC_RESPONSE_OPTIONAL:" + optional.toString().includes("?."));
console.log("TTSC_RESPONSE_JSX:" + view);
console.log("read-only-ran" );
export {};

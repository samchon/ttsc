import * as tslib from "tslib";
declare function require(name: string): any;
declare const exports: any;
const effects: unknown[][] = [];
const effectConsole = { log(...values: unknown[]): void { effects.push(values); } };

function sayHelloClass<T extends { new (...args: any[]): {} }>(ClassType: T, context: ClassDecoratorContext) {
  return class extends ClassType {
    constructor(...args: any[]) {
      super(...args);
      effectConsole.log("Hello Class " + context.name);
    }
  };
}
function sayHelloMethod<T>(target: (this: T, ...args: any[]) => any, context: ClassMethodDecoratorContext) {
  return function(this: T, ...args: any[]): any {
    effectConsole.log("Hello Function " + context.name.toString());
    return target.apply(this, args);
  };
}
@sayHelloClass
class Foo {
  constructor(public bar: string) {}
  @sayHelloMethod
  getBar() { return this.bar; }
}
effectConsole.log(new Foo("abc").getBar());

export const observed = effects.map((values) => values.join(" ")).join("\n");
export const answer = 42;



const marker = /`/;
const ratio = 8 / 2 / 2;
(function () { tslib.__exportStar(require("./entry"), exports); })();
if (false) tslib.__exportStar(require("./hidden"), exports);
export const inertArithmetic = marker.test("`") && ratio === 2;

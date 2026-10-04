let firstCount = 0;
function firstProbe(...args: any[]): void { firstCount = args.length; }
class A { @firstProbe method(): void {} }
let secondCount = 0;
function secondProbe(...args: any[]): void { secondCount = args.length; }
class B { @secondProbe method(): void {} }
const first = new A();
const second = new B();
export const values = ["arguments=" + firstCount, "dep-a:" + firstCount, "dep-b:" + secondCount];
export const instances = [first, second];
export const extra = "extra";

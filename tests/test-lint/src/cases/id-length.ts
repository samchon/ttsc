// expect: id-length error
const a: number = 1;
const ab: number = 2;
const longer: number = 3;
// expect: id-length error
function f(): void {}
function go(): void {}
// expect: id-length error
class C {}
class Foo {}
function take(
  // expect: id-length error
  x: number,
  yy: number,
  longParam: number,
): void {
  void x;
  void yy;
  void longParam;
}
JSON.stringify({ a, ab, longer, f, go, C, Foo, take });

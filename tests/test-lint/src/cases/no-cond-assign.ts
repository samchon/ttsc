let a = 0;
let b = 1;
// expect: noCondAssign error
if (a = b) {
  console.log(a);
}

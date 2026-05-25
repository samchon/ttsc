function f() {
  console.log("hi");
  // expect: varsOnTop error
  var a = 1;
  JSON.stringify(a);
}
f();

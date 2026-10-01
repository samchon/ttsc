function f() {
  console.log("hi");
  // expect: vars-on-top error
  var a = 1;
  JSON.stringify(a);
}
f();

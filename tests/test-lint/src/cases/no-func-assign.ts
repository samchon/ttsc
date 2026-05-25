function g() {
  return 1;
}
// expect: noFuncAssign error
g = function () {
  return 2;
};

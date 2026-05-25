function f(): void {
  // expect: noDebugger error
  debugger;
}
f();

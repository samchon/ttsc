// expect: functional/no-return-void error
function log(): void {
  // expect: functional/no-return-void error
  return;
}

JSON.stringify(log);

declare const describe: any;
declare const test: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const beforeAll: any;
declare const afterAll: any;
declare const vi: any;
declare const process: any;
declare const buildValue: any;
test("returns", () => {
// expect: vitest/no-test-return-statement error
  return buildValue();
});

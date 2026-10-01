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
// expect: vitest/no-disabled-tests error
test.skip("temporarily ignored", () => {
  expect(value).toBe(1);
});

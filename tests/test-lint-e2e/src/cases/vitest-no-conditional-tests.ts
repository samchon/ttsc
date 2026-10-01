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
if (process.env.CI) {
// expect: vitest/no-conditional-tests error
  test("ci only", () => expect(true).toBe(true));
}

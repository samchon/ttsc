declare const describe: any;
declare const test: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const beforeAll: any;
declare const afterAll: any;
import { test, expect } from "@jest/globals";

// expect: jest/no-done-callback error
test("finishes later", done => {
  expect(1).toBe(1);
  done();
});

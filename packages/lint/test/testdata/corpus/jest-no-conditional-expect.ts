declare const describe: any;
declare const test: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const beforeAll: any;
declare const afterAll: any;
import { test, expect } from "@jest/globals";

test("checks conditionally", () => {
  if (Math.random() > 0.5) {
    // expect: jest/no-conditional-expect error
    expect(true).toBe(true);
  }
});

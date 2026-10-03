declare const test: any;
declare const expect: any;
declare const page: any;
import { test, expect } from "@playwright/test";

// expect: playwright/max-expects error
test("has many assertions", async () => {
  expect(1).toBe(1);
  expect(2).toBe(2);
  expect(3).toBe(3);
  expect(4).toBe(4);
  expect(5).toBe(5);
  expect(6).toBe(6);
});

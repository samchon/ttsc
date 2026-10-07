declare const describe: any;
declare const test: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const beforeAll: any;
declare const afterAll: any;
import { describe, it, expect } from "@jest/globals";

describe("math", () => {
  it("adds", () => {
    expect(1 + 1).toBe(2);
  });

  // expect: jest/no-identical-title error
  it("adds", () => {
    expect(2 + 2).toBe(4);
  });
});

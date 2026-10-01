// @ttsc-corpus-clean: jest/no-standalone-expect
import { describe, test, expect } from "@jest/globals"; describe("suite", () => { test("owned", () => { expect(1).toBe(1); }); });

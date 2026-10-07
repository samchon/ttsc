// @ttsc-corpus-clean: playwright/no-standalone-expect
import { test, expect } from "@playwright/test"; test("owned", () => { expect(1).toBe(1); });

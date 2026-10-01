// @ttsc-corpus-clean: playwright/no-conditional-expect
import { test, expect } from "@playwright/test"; test("always", () => { expect(1).toBe(1); });

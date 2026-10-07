// @ttsc-corpus-clean: playwright/require-to-pass-timeout
import { test, expect } from "@playwright/test"; test("bounded", async () => { await expect(async () => {}).toPass({ timeout: 1000 }); });

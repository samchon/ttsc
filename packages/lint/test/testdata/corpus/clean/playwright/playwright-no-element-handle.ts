// @ttsc-corpus-clean: playwright/no-element-handle
import { test } from "@playwright/test"; test("locator", ({ page }) => { page.getByRole("button"); });

// @ttsc-corpus-clean: playwright/no-get-by-title
import { test } from "@playwright/test"; test("role", ({ page }) => { page.getByRole("button"); });

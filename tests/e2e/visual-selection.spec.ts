import { expect, test } from "@playwright/test";

test.describe("E17 controlled visual selection flow", () => {
  test("selects a header, copies selector context, and validates origin-bound messages", async ({ page }) => {
    await page.setContent(`
      <main>
        <button aria-pressed="true">Inspect</button>
        <div role="status">Target: .page-header</div>
        <button data-testid="copy-selector">Copy .page-header</button>
        <iframe title="Generated preview" srcdoc="<header class='page-header' data-builder-id='home-header'>Hero</header>"></iframe>
      </main>
    `);

    await page.getByTestId("copy-selector").click();
    await expect(page.getByRole("status")).toContainText(".page-header");
    await expect(page.frameLocator('iframe[title="Generated preview"]').locator(".page-header")).toHaveAttribute("data-builder-id", "home-header");
  });
});
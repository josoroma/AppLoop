import { expect, test } from "@playwright/test";

test.describe("E17 controlled chat-to-preview flow", () => {
  test("streams activity, changes source, validates, and renders generated output", async ({ page }) => {
    await page.setContent(`
      <main>
        <form aria-label="Hermes chat"><textarea aria-label="Prompt Hermes">Build a landing page</textarea><button>Send prompt</button></form>
        <section aria-label="Hermes activity summary"><details open><summary>Editing files · 1 action succeeded</summary><p>app/page.tsx</p></details><details open><summary>Running checks · 1 action succeeded</summary><p>npm run typecheck</p></details></section>
        <pre data-testid="source">export default function Page(){return &lt;main&gt;Generated Landing&lt;/main&gt;}</pre>
        <iframe title="Generated preview" srcdoc="<main data-builder-id='home-page'><h1>Generated Landing</h1></main>"></iframe>
      </main>
    `);

    await expect(page.getByLabel("Hermes activity summary")).toContainText("Editing files");
    await expect(page.getByTestId("source")).toContainText("Generated Landing");
    await expect(page.frameLocator('iframe[title="Generated preview"]').getByRole("heading", { name: "Generated Landing" })).toBeVisible();
  });
});
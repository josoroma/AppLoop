import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("builder app Luma style", () => {
  it("uses the canonical Luma tokens for light and dark builder modes", async () => {
    const css = await fs.readFile(path.join(process.cwd(), "app", "globals.css"), "utf8");

    expect(css).toContain("--background: oklch(1 0 0);");
    expect(css).toContain("--primary: oklch(0.488 0.243 264.376);");
    expect(css).toContain("--chart-1: oklch(0.845 0.143 164.978);");
    expect(css).toContain("--sidebar-primary: oklch(0.546 0.245 262.881);");
    expect(css).toContain("--radius: 0.625rem;");
    expect(css).toContain("--background: oklch(0.145 0 0);");
    expect(css).toContain("--primary: oklch(0.424 0.199 265.638);");
    expect(css).toContain("--sidebar-primary: oklch(0.623 0.214 259.815);");
    expect(css).toContain("background: var(--background);");
    expect(css).not.toContain("#f8f7f2");
    expect(css).not.toContain("#11130f");
  });
});
import { expect, test } from "@playwright/test";

test("GM recupera automaticamente su sala despues de una recarga", async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    window.WebSocket = class extends NativeWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        window.addEventListener("test-disconnect-gm", () => this.close(), { once: true });
      }
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Crear sala", exact: true }).click();
  await expect(page).toHaveURL(/\/combat\/[A-Z0-9]+$/);
  await page.getByRole("button", { name: "Agregar heroe" }).click();
  const combatant = page.locator(".combatant-list button");
  await expect(combatant).toHaveCount(1);
  const roomUrl = page.url();
  await page.evaluate(() => window.dispatchEvent(new Event("test-disconnect-gm")));
  await expect(page.getByRole("status")).toHaveText("Reconectando…");
  await expect(page.getByRole("button", { name: "Agregar heroe" })).toHaveCount(0);
  await expect(combatant).toHaveCount(1);
  await page.reload();
  await expect(page).toHaveURL(roomUrl);
  await expect(combatant).toHaveCount(1);
  await page.getByRole("button", { name: "Agregar heroe" }).click();
  await expect(combatant).toHaveCount(2);
});

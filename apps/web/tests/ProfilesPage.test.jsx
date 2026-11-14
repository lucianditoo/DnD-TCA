import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it } from "vitest";
import { PROFILE_STORAGE_KEY } from "@dnd-tactical/shared";
import { ProfilesPage } from "../src/pages/ProfilesPage";

const button = (name) => screen.getByRole("button", { name });
const nameField = () => screen.getByRole("textbox", { name: "Nombre" });
const stored = () => JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY)).profiles;

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

async function create(user, kind, name) {
  await user.click(button(kind));
  await user.clear(nameField());
  await user.type(nameField(), name);
  await user.click(button("Guardar perfil"));
}

it("crea un héroe y lo carga desde almacenamiento al volver a abrir la página", async () => {
  const user = userEvent.setup();
  const page = render(<ProfilesPage />);
  expect(screen.getByText(/todavia no hay perfiles/i)).toBeTruthy();
  await create(user, "Heroe", "Lira");
  expect(stored()).toMatchObject([{ name: "Lira", type: "player" }]);
  expect(stored()).toHaveLength(1);
  page.unmount();

  render(<ProfilesPage />);
  expect(nameField().value).toBe("Lira");
  expect(button(/Lira/)).toBeTruthy();
});

it("edita el perfil elegido sin duplicarlo ni modificar el otro", async () => {
  const user = userEvent.setup();
  render(<ProfilesPage />);
  await create(user, "Heroe", "Lira");
  await create(user, "Enemigo", "Orco");
  const [enemy, hero] = stored();

  await user.click(button(/Lira/));
  expect(nameField().value).toBe("Lira");
  await user.clear(nameField());
  await user.type(nameField(), "Lira veterana");
  expect(stored()[1]).toEqual(hero);
  await user.click(button("Guardar perfil"));
  expect(stored()).toHaveLength(2);
  expect(stored()[0]).toEqual(enemy);
  expect(stored()[1]).toMatchObject({ id: hero.id, name: "Lira veterana" });
  expect(button(/Lira veterana/)).toBeTruthy();
});

it("persiste el mínimo de 1 HP al guardar un valor de cero", async () => {
  const user = userEvent.setup();
  const page = render(<ProfilesPage />);
  await create(user, "Heroe", "Lira");
  const hp = screen.getByRole("spinbutton", { name: "HP max" });
  await user.clear(hp);
  await user.type(hp, "0");
  await user.click(button("Guardar perfil"));
  expect(stored()[0].hpMax).toBe(1);
  page.unmount();

  render(<ProfilesPage />);
  expect(screen.getByRole("spinbutton", { name: "HP max" }).value).toBe("1");
});

it("avisa cuando un registro incompatible no se puede cargar", () => {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({
    version: 6, profiles: [{ id: "invalid", name: "Ficha incompatible" }],
  }));
  render(<ProfilesPage />);
  expect(screen.getByText("Perfiles legacy bloqueados")).toBeTruthy();
  expect(screen.getByText(/Ficha incompatible:/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^Ficha incompatible/ })).toBeNull();
});

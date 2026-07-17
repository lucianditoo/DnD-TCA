import { test, expect } from '@playwright/test';

test.describe('Smoke Test Táctico Visual', () => {

  test.beforeEach(async ({ request }) => {
    // Resetear el estado del servidor
    const res = await request.post('http://localhost:3333/api/test/reset');
    expect(res.ok()).toBeTruthy();
  });

  test('Combate, movimiento y AdO (Critical User Journey)', async ({ page }) => {
    // 1. Abrir app y crear sala
    await page.goto('/');
    
    // Debería estar en la pantalla de conexión
    await expect(page.getByRole('heading', { name: 'Sala local de combate' })).toBeVisible();
    await page.locator('input[type="text"], input:not([type])').first().fill('TestGM'); // "Nombre"
    await page.getByRole('button', { name: 'Crear sala' }).click();

    // 2. Preparación (Panel GM de añadir combatientes)
    // Deberíamos estar en preparación
    await expect(page.getByText('Carga combatientes e iniciativas')).toBeVisible();

    // Agregamos Héroe (usamos catálogo de héroes)
    // El primer combo es perfiles guardados, el segundo es héroes del catálogo, el tercero es enemigos.
    // Usaremos locator para encontrar los selects correctos.
    await page.locator('label').filter({ hasText: 'Heroes' }).locator('select').selectOption({ index: 0 }); // El primer héroe
    await page.getByRole('button', { name: 'Agregar heroe' }).click();

    // Agregamos Enemigo (catálogo)
    await page.locator('label').filter({ hasText: 'Enemigos' }).locator('select').selectOption({ index: 0 }); // El primer enemigo
    await page.getByRole('button', { name: 'Agregar enemigo' }).click();

    // Mover los combatientes a posiciones conocidas (para testear salir de rango)
    // Bane a (2, 4), Lobo a (3, 4). (Así el lobo amenaza a Bane, alcance 1)
    // Hacemos click en Bane, luego click en (2, 4)
    await page.locator('.combatant-list button').nth(0).click();
    await page.getByRole('button', { name: 'Mover' }).click();
    await page.locator('[data-testid="cell-2-4"]').click();

    await page.locator('.combatant-list button').nth(1).click();
    await page.getByRole('button', { name: 'Mover' }).click();
    await page.locator('[data-testid="cell-3-4"]').click();

    // 3. Iniciar combate
    // Abrir collapsible de iniciativa
    await page.getByText('Iniciativa manual').click();
    
    // El enemigo actúa primero para perder Flat-Footed; luego podrá hacer AdO en el turno de Bane.
    await page.locator('.initiative-list input').nth(0).fill('20');
    await page.locator('.initiative-list input').nth(1).fill('30');
    // Para que se dispare el onBlur, presionamos Tab o clickeamos en el título
    await page.locator('.initiative-list input').nth(1).press('Tab');
    
    await page.getByRole('button', { name: 'Iniciar combate' }).click();

    // Deberíamos estar en combate, "Ronda 1"
    await expect(page.getByRole('heading', { name: 'Ronda 1' })).toBeVisible();
    await expect(page.locator('.turn-pill')).toContainText('Turno: Canocrock');
    await page.getByRole('button', { name: 'Terminar turno' }).click();
    await expect(page.locator('.turn-pill')).toContainText('Turno: Bane');

    // Seleccionamos a Bane (que asumo que ganó iniciativa o simplemente es el primero, sino seleccionamos directo)
    // El combate inicia con el primer combatiente en iniciativa, que es Bane probablemente o Canocrock.
    // Como somos GM, podemos seleccionar a Bane para moverlo en su turno (o forzar su turno).
    // Esperamos a ver a quién le toca. El log debería decirlo.
    // Hacemos click en Bane para seleccionarlo
    await page.locator('[data-testid="cell-2-4"]').click();

    // Presionamos 'Mover' en panel de acciones (si está disponible, sino la acción por defecto es moverse si tocamos una celda)
    // En UI, si clickeamos una celda vacía con Bane activo, traza ruta.
    // Click en la celda adyacente (2,3) o más lejos para salir de amenaza.
    // Ojo que salir de amenaza genera AdO. Bane está en (2,4), Lobo en (3,4).
    // Nos movemos a (1,4) y luego a (0,4)
    await page.getByRole('button', { name: 'Mover' }).click();
    await page.locator('[data-testid="cell-1-4"]').click();
    await page.locator('[data-testid="cell-0-4"]').click();
    
    // Verificamos ruta. Luego confirmar "Confirmar movimiento"
    await page.getByRole('button', { name: 'Confirmar movimiento' }).click();

    // 4. Interacción de reglas (AdO)
    // Debería aparecer la alerta de AdO
    await expect(page.getByText('Hay ataques de oportunidad pendientes')).toBeVisible();

    // 5. Validar que no se puede terminar el turno porque no está en fase active
    const endTurnButton = page.getByRole('button', { name: 'Terminar turno' });
    await expect(endTurnButton).not.toBeVisible();
    
    // Toast de error o log de error (el backend rechaza con "Hay ataques de oportunidad pendientes.")
    await expect(page.getByText('Hay ataques de oportunidad pendientes. Resolvelos o limpialos como GM antes de continuar con otras acciones.')).toBeVisible();

    // 6. Resolución: GM limpia AdO
    // Tenemos que abrir el panel GM porque está en un collapsible
    await page.getByText('Panel GM').click();
    await page.getByRole('button', { name: 'Limpiar AdO' }).click();

    // Esperar que desaparezca el cartel
    await expect(page.getByText('Hay ataques de oportunidad pendientes')).not.toBeVisible();
    await expect(endTurnButton).toBeEnabled();

    // 7. Continuación
    await endTurnButton.click();
    // Validar que se terminó el turno
    await expect(page.locator('.turn-pill')).not.toContainText('Turno: Bane');

  });

  test('Preview de flanqueo distingue ataques melee y ranged', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="text"], input:not([type])').first().fill('FlankingGM');
    await page.getByRole('button', { name: 'Crear sala' }).click();

    const heroCatalog = page.locator('label').filter({ hasText: 'Heroes' }).locator('select');
    await heroCatalog.selectOption({ label: 'Bane' });
    await page.getByRole('button', { name: 'Agregar heroe' }).click();
    await heroCatalog.selectOption({ label: 'Cedrick' });
    await page.getByRole('button', { name: 'Agregar heroe' }).click();
    await page.locator('label').filter({ hasText: 'Enemigos' }).locator('select').selectOption({ label: 'Canocrock' });
    await page.getByRole('button', { name: 'Agregar enemigo' }).click();

    for (const [index, cell] of [[0, 'cell-4-3'], [1, 'cell-4-5'], [2, 'cell-4-4']] as const) {
      await page.locator('.combatant-list button').nth(index).click();
      await page.getByRole('button', { name: 'Mover' }).click();
      await page.locator(`[data-testid="${cell}"]`).click();
    }

    await page.getByText('Iniciativa manual').click();
    await page.locator('.initiative-list input').nth(0).fill('20');
    await page.locator('.initiative-list input').nth(1).fill('15');
    await page.locator('.initiative-list input').nth(2).fill('5');
    await page.locator('.initiative-list input').nth(2).press('Tab');
    await page.getByRole('button', { name: 'Iniciar combate' }).click();

    await page.locator('[data-testid="cell-4-3"]').click();
    await page.getByRole('button', { name: 'Atacar' }).click();
    await page.getByRole('button', { name: 'Preparar Ataque Estandar' }).click();
    await page.locator('.attack-panel label').filter({ hasText: 'Objetivo' }).locator('select').selectOption({ label: 'Canocrock' });
    await expect(page.getByText('Modificadores de posicion: flanqueo +2')).toBeVisible();

    await page.getByRole('button', { name: 'Habilidad', exact: true }).click();
    const abilitySelect = page.locator('.ability-panel label').filter({ hasText: 'Habilidad' }).locator('select');
    const abilityTarget = page.locator('.ability-panel label').filter({ hasText: 'Objetivo' }).locator('select');
    await abilitySelect.selectOption({ label: 'Shocking Grasp' });
    await abilityTarget.selectOption({ label: 'Canocrock' });
    await expect(page.getByText('Modificadores de posición: flanqueo +2')).toBeVisible();

    await abilitySelect.selectOption({ label: 'Ray of Frost' });
    await expect(page.getByText('Modificadores de posición: flanqueo +2')).not.toBeVisible();
  });

  test('Prone Eschewal muestra 0 pies y SEGURO sin AdO', async ({ page }) => {
    const agileProfile = {
      id: 'profile-ui-prone-eschewal', name: 'Agile Stand Tester', type: 'player', controller: 'player', icon: 'A',
      hpMax: 24, baseAttackBonus: 3, baseFortitude: 1, baseReflex: 3, baseWill: 0, baseSpeedFeet: 30,
      abilityScores: { strength: 12, dexterity: 16, constitution: 12, intelligence: 10, wisdom: 10, charisma: 10 },
      sizeCategory: 'medium', creatureTypeId: 'humanoid', featureIds: [], skillRanks: { escape_artist: 0 },
      inventory: [
        { itemId: 'ui-agile-dagger', catalogId: 'dagger' },
        { itemId: 'ui-agile-leather', catalogId: 'leather' }
      ],
      equipmentSlots: { mainHandItemId: 'ui-agile-dagger', offHandItemId: null, armorItemId: 'ui-agile-leather' },
      featIds: ['srd_prone_eschewal'],
      intrinsicDefense: { naturalArmorBonus: 0, dodgeBonus: 0, deflectionBonus: 0, miscArmorClassBonus: 0 },
      abilities: [], buffs: [], position: { x: 2, y: 2, zFeet: 0 }, updatedAt: new Date(0).toISOString()
    };

    await page.goto('/');
    await page.evaluate((profile) => localStorage.setItem('dnd-tactical.profiles.v6', JSON.stringify({ version: 6, profiles: [profile] })), agileProfile);
    await page.reload();
    await page.locator('input[type="text"], input:not([type])').first().fill('AgileGM');
    await page.getByRole('button', { name: 'Crear sala' }).click();

    await page.locator('label').filter({ hasText: 'Perfiles guardados' }).locator('select').selectOption({ label: 'Agile Stand Tester' });
    await page.getByRole('button', { name: 'Agregar perfil' }).click();
    await page.locator('label').filter({ hasText: 'Enemigos' }).locator('select').selectOption({ label: 'Canocrock' });
    await page.getByRole('button', { name: 'Agregar enemigo' }).click();

    for (const [index, cell] of [[0, 'cell-2-2'], [1, 'cell-3-2']] as const) {
      await page.locator('.combatant-list button').nth(index).click();
      await page.getByRole('button', { name: 'Mover' }).click();
      await page.locator(`[data-testid="${cell}"]`).click();
    }

    await page.getByText('Iniciativa manual').click();
    await page.locator('.initiative-list input').nth(0).fill('10');
    await page.locator('.initiative-list input').nth(1).fill('20');
    await page.locator('.initiative-list input').nth(1).press('Tab');
    await page.getByRole('button', { name: 'Iniciar combate' }).click();
    await page.getByRole('button', { name: 'Terminar turno' }).click();

    const roomLabel = await page.locator('.eyebrow').textContent();
    const roomCode = /Sala\s+([A-Z0-9]+)/.exec(roomLabel ?? '')?.[1];
    expect(roomCode).toBeTruthy();
    await page.evaluate(async (code) => {
      await new Promise<void>((resolve, reject) => {
        const socket = new WebSocket(`ws://localhost:3333`);
        const timer = window.setTimeout(() => reject(new Error('Timeout aplicando PRONE')), 5000);
        let actorId = '';
        let targetId = '';
        socket.onopen = () => socket.send(JSON.stringify({ type: 'join-room', roomCode: code, name: 'RulesGM', role: 'gm' }));
        socket.onerror = () => reject(new Error('Fallo WebSocket de prueba'));
        socket.onmessage = (event) => {
          const message = JSON.parse(String(event.data));
          if (message.type === 'hello') {
            actorId = message.participant.id;
            targetId = message.room.combatants.find((combatant: { name: string; id: string }) => combatant.name === 'Agile Stand Tester')?.id ?? '';
            socket.send(JSON.stringify({ type: 'gm-apply-effect', roomCode: code, actorId, targetId, effectId: 'srd_prone' }));
          } else if (message.type === 'room-update' && message.room.effectInstances.some((effect: { effectId: string; targets?: string[] }) => effect.effectId === 'srd_prone' && effect.targets?.includes(targetId))) {
            window.clearTimeout(timer);
            socket.close();
            resolve();
          }
        };
      });
    }, roomCode!);

    await page.locator('[data-testid="cell-2-2"]').click();
    await page.getByRole('button', { name: 'Tacticas' }).click();
    await page.locator('label').filter({ hasText: 'Tactica' }).locator('select').selectOption('stand-up');
    await expect(page.getByText('Levantarse: 0 pies. SEGURO (Sin AdO)')).toBeVisible();
    await page.getByRole('button', { name: 'Levantarse', exact: true }).click();
    await expect(page.getByText('Hay ataques de oportunidad pendientes')).not.toBeVisible();
  });

  test('Preview de Presa comparte Touch AC y fórmula BAB/FUE/tamaño', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="text"], input:not([type])').first().fill('GrappleGM');
    await page.getByRole('button', { name: 'Crear sala' }).click();

    await page.locator('label').filter({ hasText: 'Heroes' }).locator('select').selectOption({ label: 'Cedrick' });
    await page.getByRole('button', { name: 'Agregar heroe' }).click();
    await page.locator('label').filter({ hasText: 'Enemigos' }).locator('select').selectOption({ label: 'Canocrock' });
    await page.getByRole('button', { name: 'Agregar enemigo' }).click();

    for (const [index, cell] of [[0, 'cell-2-2'], [1, 'cell-3-2']] as const) {
      await page.locator('.combatant-list button').nth(index).click();
      await page.getByRole('button', { name: 'Mover' }).click();
      await page.locator(`[data-testid="${cell}"]`).click();
    }

    await page.getByText('Iniciativa manual').click();
    await page.locator('.initiative-list input').nth(0).fill('20');
    await page.locator('.initiative-list input').nth(1).fill('10');
    await page.locator('.initiative-list input').nth(1).press('Tab');
    await page.getByRole('button', { name: 'Iniciar combate' }).click();

    await page.locator('[data-testid="cell-2-2"]').click();
    await page.getByRole('button', { name: 'Tacticas' }).click();
    await page.locator('label').filter({ hasText: 'Tactica' }).locator('select').selectOption('grapple');
    await page.locator('.tactic-card label').filter({ hasText: 'Objetivo enemigo' }).locator('select').selectOption({ label: 'Canocrock' });

    await expect(page.getByText(/Touch AC \d+/)).toBeVisible();
    await expect(page.getByText(/Atacante: BAB \+6, FUE \+4, tamaño \+0 = \+10/)).toBeVisible();
    await expect(page.getByText(/Defensor: BAB \+8, FUE \+3, tamaño \+0 = \+11/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Maniobra: Presa' })).toBeEnabled();
  });

  test('Grapple V2 bloquea arma pesada y ofrece Escape AUTO isomorfo', async ({ page }) => {
    const profile = {
      id: 'profile-ui-grapple-v2', name: 'Grapple V2 Hero', type: 'player', controller: 'player', icon: 'G',
      hpMax: 50, baseAttackBonus: 20, baseFortitude: 5, baseReflex: 5, baseWill: 5, baseSpeedFeet: 30,
      abilityScores: { strength: 30, dexterity: 18, constitution: 16, intelligence: 10, wisdom: 10, charisma: 10 },
      sizeCategory: 'medium', creatureTypeId: 'humanoid', featureIds: [], skillRanks: { escape_artist: 8 },
      inventory: [{ itemId: 'ui-grapple-greatsword', catalogId: 'greatsword' }],
      equipmentSlots: { mainHandItemId: 'ui-grapple-greatsword', offHandItemId: null, armorItemId: null },
      featIds: [], intrinsicDefense: { naturalArmorBonus: 0, dodgeBonus: 0, deflectionBonus: 0, miscArmorClassBonus: 0 },
      abilities: [], buffs: [], position: { x: 2, y: 2, zFeet: 0 }, updatedAt: new Date(0).toISOString()
    };

    await page.goto('/');
    await page.evaluate((stored) => localStorage.setItem('dnd-tactical.profiles.v6', JSON.stringify({ version: 6, profiles: [stored] })), profile);
    await page.reload();
    await page.locator('input[type="text"], input:not([type])').first().fill('GrappleV2GM');
    await page.getByRole('button', { name: 'Crear sala' }).click();
    await page.locator('label').filter({ hasText: 'Perfiles guardados' }).locator('select').selectOption({ label: 'Grapple V2 Hero' });
    await page.getByRole('button', { name: 'Agregar perfil' }).click();
    await page.locator('label').filter({ hasText: 'Enemigos' }).locator('select').selectOption({ label: 'Canocrock' });
    await page.getByRole('button', { name: 'Agregar enemigo' }).click();

    for (const [index, cell] of [[0, 'cell-2-2'], [1, 'cell-3-2']] as const) {
      await page.locator('.combatant-list button').nth(index).click();
      await page.getByRole('button', { name: 'Mover' }).click();
      await page.locator(`[data-testid="${cell}"]`).click();
    }
    await page.getByText('Iniciativa manual').click();
    await page.locator('.initiative-list input').nth(0).fill('20');
    await page.locator('.initiative-list input').nth(1).fill('10');
    await page.locator('.initiative-list input').nth(1).press('Tab');
    await page.getByRole('button', { name: 'Iniciar combate' }).click();

    await page.locator('[data-testid="cell-2-2"]').click();
    await page.getByRole('button', { name: 'Tacticas' }).click();
    await page.locator('label').filter({ hasText: 'Tactica' }).locator('select').selectOption('grapple');
    await page.locator('.tactic-card input[type="number"]').fill('20');
    await page.locator('.tactic-card label').filter({ hasText: 'Objetivo enemigo' }).locator('select').selectOption({ label: 'Canocrock' });
    await page.getByRole('button', { name: 'Maniobra: Presa' }).click();

    await expect(page.getByRole('button', { name: 'Atacar', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Atacar', exact: true })).toHaveAttribute('title', /solo se permiten armas ligeras/i);

    await page.getByRole('button', { name: 'Terminar turno' }).click();
    await page.getByRole('button', { name: 'Terminar turno' }).click();
    await page.locator('[data-testid="cell-2-2"]').click();
    await page.getByRole('button', { name: 'Tacticas' }).click();
    await page.locator('label').filter({ hasText: 'Tactica' }).locator('select').selectOption('grapple-escape');
    await expect(page.getByText(/Retenedor Canocrock:/)).toBeVisible();
    const auto = page.locator('.tactic-card label').filter({ hasText: 'Auto' }).locator('input[type="checkbox"]');
    await auto.check();
    await page.getByRole('button', { name: 'Maniobra: Escapar de Presa' }).click();
    await expect(page.locator('.log-panel')).toContainText('Escape de Presa');
  });
});

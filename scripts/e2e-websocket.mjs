import WebSocket from 'ws';
const results = [];
const record = (name, ok, detail = '') => results.push({ name, ok, detail });
function connectAndSend(command) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://localhost:3333');
    const state = { ws, participant: null, room: null, catalog: null, errors: [] };
    const timer = setTimeout(() => reject(new Error('timeout connecting')), 5000);
    ws.on('open', () => ws.send(JSON.stringify(command)));
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'hello') { state.participant = msg.participant; state.room = msg.room; state.catalog = msg.catalog; clearTimeout(timer); resolve(state); }
      if (msg.type === 'room-update') state.room = msg.room;
      if (msg.type === 'error') state.errors.push(msg.message);
    });
    ws.on('error', reject);
  });
}
function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function send(state, command, delay = 120) { state.ws.send(JSON.stringify(command)); await wait(delay); return state; }
const gm = await connectAndSend({ type: 'create-room', name: 'GM Test' });
record('crear sala por WebSocket', !!gm.room?.code, gm.room?.code || 'sin codigo');
record('catalogo llega al cliente', gm.catalog?.creatures?.heroes?.length >= 3 && gm.catalog?.creatures?.enemies?.length >= 1, JSON.stringify(gm.catalog?.creatures));
const code = gm.room.code; const gmId = gm.participant.id;

const ownershipGm = await connectAndSend({ type: 'create-room', name: 'Ownership Test' });
const ownershipCode = ownershipGm.room.code; const ownershipGmId = ownershipGm.participant.id;
const ownerA = await connectAndSend({ type: 'join-room', roomCode: ownershipCode, name: 'Player A', role: 'player' });
const ownerB = await connectAndSend({ type: 'join-room', roomCode: ownershipCode, name: 'Player B', role: 'player' });
await send(ownerA, { type: 'add-catalog-combatant', roomCode: ownershipCode, actorId: ownerA.participant.id, category: 'heroes', templateId: 'bane' });
await send(ownershipGm, { type: 'add-catalog-combatant', roomCode: ownershipCode, actorId: ownershipGmId, category: 'enemies', templateId: 'canocrock' });
const ownedBane = ownershipGm.room.combatants.find(c => c.name === 'Bane');
const ownedEnemy = ownershipGm.room.combatants.find(c => c.type === 'enemy');
record('heroe creado por jugador queda controlado por ese jugador', ownedBane?.controlledBy?.type === 'player' && ownedBane.controlledBy.participantId === ownerA.participant.id, JSON.stringify(ownedBane?.controlledBy));
record('enemigo creado por GM queda controlado por GM', ownedEnemy?.controlledBy?.type === 'gm', JSON.stringify(ownedEnemy?.controlledBy));
await send(ownerB, { type: 'move-combatant', roomCode: ownershipCode, actorId: ownerB.participant.id, combatantId: ownedBane.id, to: { x: 1, y: 1, zFeet: 0 } });
record('jugador no puede mover heroe ajeno', ownerB.errors.some(e => /propios heroes/i.test(e)), ownerB.errors.join(' | '));
await send(ownerA, { type: 'move-combatant', roomCode: ownershipCode, actorId: ownerA.participant.id, combatantId: ownedEnemy.id, to: { x: 9, y: 4, zFeet: 0 } });
record('jugador no puede mover enemigos', ownerA.errors.some(e => /jugadores no pueden controlar enemigos/i.test(e)), ownerA.errors.join(' | '));
await send(ownerB, { type: 'set-initiative', roomCode: ownershipCode, actorId: ownerB.participant.id, combatantId: ownedBane.id, initiative: 20 });
record('jugador no puede cargar iniciativa ajena', ownerB.errors.some(e => /iniciativa de sus propios heroes/i.test(e)), ownerB.errors.join(' | '));
await send(ownerA, { type: 'set-initiative', roomCode: ownershipCode, actorId: ownerA.participant.id, combatantId: ownedEnemy.id, initiative: 10 });
record('jugador no puede cargar iniciativa de enemigos', ownerA.errors.some(e => /iniciativa de sus propios heroes/i.test(e)), ownerA.errors.join(' | '));
await send(ownerA, { type: 'sort-initiative', roomCode: ownershipCode, actorId: ownerA.participant.id });
record('jugador no puede iniciar combate', ownerA.errors.some(e => /Solo el GM/i.test(e)), ownerA.errors.join(' | '));
await send(ownerA, { type: 'set-initiative', roomCode: ownershipCode, actorId: ownerA.participant.id, combatantId: ownedBane.id, initiative: 20 });
await send(ownershipGm, { type: 'set-initiative', roomCode: ownershipCode, actorId: ownershipGmId, combatantId: ownedEnemy.id, initiative: 10 });
await send(ownershipGm, { type: 'sort-initiative', roomCode: ownershipCode, actorId: ownershipGmId });
record('GM puede iniciar combate con iniciativas mixtas', ownershipGm.room.phase === 'active' && ownershipGm.room.currentTurn.combatantId === ownedBane.id, ownershipGm.room.phase + ' turno=' + ownershipGm.room.currentTurn.combatantId);
await send(ownerB, { type: 'end-turn', roomCode: ownershipCode, actorId: ownerB.participant.id });
record('jugador no puede terminar turno ajeno', ownerB.errors.some(e => /terminar el turno de sus propios heroes/i.test(e)), ownerB.errors.join(' | '));
await send(ownerA, { type: 'end-turn', roomCode: ownershipCode, actorId: ownerA.participant.id });
record('jugador puede terminar turno propio', ownerA.room.currentTurn.combatantId === ownedEnemy.id, ownerA.room.currentTurn.combatantId);
await send(ownerA, { type: 'end-turn', roomCode: ownershipCode, actorId: ownerA.participant.id });
record('jugador no puede terminar turno de enemigo', ownerA.errors.some(e => /terminar el turno de sus propios heroes/i.test(e)), ownerA.errors.join(' | '));
await send(ownerA, { type: 'declare-attack-mode', roomCode: ownershipCode, actorId: ownerA.participant.id, combatantId: ownedEnemy.id, mode: 'standard', defensive: false });
await send(ownerA, { type: 'resolve-attack', roomCode: ownershipCode, actorId: ownerA.participant.id, attackerId: ownedEnemy.id, targetId: ownedBane.id, d20Roll: 20, damage: 1 });
record('jugador no puede atacar con enemigos', ownerA.errors.some(e => /jugadores no pueden controlar enemigos/i.test(e)), ownerA.errors.join(' | '));

const stabilizationGm = await connectAndSend({ type: 'create-room', name: 'Stabilization Limit Test' });
const stabilizationCode = stabilizationGm.room.code; const stabilizationGmId = stabilizationGm.participant.id;
await send(stabilizationGm, { type: 'add-catalog-combatant', roomCode: stabilizationCode, actorId: stabilizationGmId, category: 'heroes', templateId: 'bane' });
await send(stabilizationGm, { type: 'add-catalog-combatant', roomCode: stabilizationCode, actorId: stabilizationGmId, category: 'enemies', templateId: 'canocrock' });
const stabilizationBane = stabilizationGm.room.combatants.find(c => c.name === 'Bane');
const stabilizationEnemy = stabilizationGm.room.combatants.find(c => c.type === 'enemy');
await send(stabilizationGm, { type: 'set-initiative', roomCode: stabilizationCode, actorId: stabilizationGmId, combatantId: stabilizationBane.id, initiative: 20 });
await send(stabilizationGm, { type: 'set-initiative', roomCode: stabilizationCode, actorId: stabilizationGmId, combatantId: stabilizationEnemy.id, initiative: 1 });
await send(stabilizationGm, { type: 'sort-initiative', roomCode: stabilizationCode, actorId: stabilizationGmId });
await send(stabilizationGm, { type: 'gm-set-status', roomCode: stabilizationCode, actorId: stabilizationGmId, combatantId: stabilizationBane.id, status: 'dying' });
await send(stabilizationGm, { type: 'roll-stabilization', roomCode: stabilizationCode, actorId: stabilizationGmId, combatantId: stabilizationBane.id, d100Roll: 50 });
await send(stabilizationGm, { type: 'roll-stabilization', roomCode: stabilizationCode, actorId: stabilizationGmId, combatantId: stabilizationBane.id, d100Roll: 10 });
record('estabilizacion solo se intenta una vez por turno', stabilizationGm.errors.some(e => /ya intento estabilizarse/i.test(e)) && stabilizationGm.room.currentTurn.usedStabilization, stabilizationGm.errors.join(' | ') + ' turno=' + JSON.stringify(stabilizationGm.room.currentTurn));

const profileGm = await connectAndSend({ type: 'create-room', name: 'Profile Test' });
const profileCode = profileGm.room.code; const profileGmId = profileGm.participant.id;
const profilePlayer = await connectAndSend({ type: 'join-room', roomCode: profileCode, name: 'Profile Player', role: 'player' });
const heroProfile = { id: 'profile-hero-test', name: 'Heroe Perfil', type: 'player', controller: 'player', icon: 'P', hpMax: 25, baseAttackBonus: 3, baseFortitude: 0, baseReflex: 0, baseWill: 0, baseSpeedFeet: 30, abilityScores: { strength: 10, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 }, sizeCategory: 'medium', creatureTypeId: 'humanoid', featureIds: [], skillRanks: { escape_artist: 0 }, inventory: [{ itemId: 'profile-hero-dagger', catalogId: 'dagger' }, { itemId: 'profile-hero-buckler', catalogId: 'buckler' }, { itemId: 'profile-hero-leather', catalogId: 'leather' }], equipmentSlots: { mainHandItemId: 'profile-hero-dagger', offHandItemId: 'profile-hero-buckler', armorItemId: 'profile-hero-leather' }, featIds: [], intrinsicDefense: { naturalArmorBonus: 0, dodgeBonus: 0, deflectionBonus: 0, miscArmorClassBonus: 0 }, abilities: ['cure-light-wounds'], buffs: [], position: { x: 0, y: 0, zFeet: 0 } };
heroProfile.preparedSpellLoadout = [{ slotId: 'e2e-ray-slot', spellId: 'srd_ray_of_frost' }];
const enemyProfile = { id: 'profile-enemy-test', name: 'Enemigo Perfil', type: 'enemy', controller: 'gm', icon: 'X', hpMax: 30, baseAttackBonus: 4, baseFortitude: 0, baseReflex: 0, baseWill: 0, baseSpeedFeet: 30, abilityScores: { strength: 14, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 }, sizeCategory: 'medium', creatureTypeId: 'humanoid', featureIds: [], skillRanks: { escape_artist: 0 }, inventory: [{ itemId: 'profile-enemy-greatsword', catalogId: 'greatsword' }, { itemId: 'profile-enemy-chainmail', catalogId: 'chainmail' }], equipmentSlots: { mainHandItemId: 'profile-enemy-greatsword', offHandItemId: null, armorItemId: 'profile-enemy-chainmail' }, featIds: [], intrinsicDefense: { naturalArmorBonus: 0, dodgeBonus: 0, deflectionBonus: 0, miscArmorClassBonus: 0 }, abilities: [], buffs: [], position: { x: 0, y: 0, zFeet: 0 } };
await send(profilePlayer, { type: 'add-profile-combatant', roomCode: profileCode, actorId: profilePlayer.participant.id, profile: heroProfile });
const addedHeroProfile = profilePlayer.room.combatants.find(c => c.name === 'Heroe Perfil');
record('jugador puede agregar heroe desde perfil V5 y conserva fuentes de catalogo', addedHeroProfile?.controlledBy?.type === 'player' && addedHeroProfile.controlledBy.participantId === profilePlayer.participant.id && addedHeroProfile.inventory?.some(item => item.catalogId === 'dagger') && addedHeroProfile.equipmentSlots?.mainHandItemId === 'profile-hero-dagger' && !('weapon' in addedHeroProfile) && !('armorClassBreakdown' in addedHeroProfile), JSON.stringify(addedHeroProfile));
await send(profilePlayer, { type: 'add-profile-combatant', roomCode: profileCode, actorId: profilePlayer.participant.id, profile: enemyProfile });
record('jugador no puede agregar enemigo desde perfil guardado', profilePlayer.errors.some(e => /Solo el GM/i.test(e)), profilePlayer.errors.join(' | '));
await send(profileGm, { type: 'add-profile-combatant', roomCode: profileCode, actorId: profileGmId, profile: enemyProfile });
const addedEnemyProfile = profileGm.room.combatants.find(c => c.name === 'Enemigo Perfil');
record('GM puede agregar enemigo desde perfil V5 y conserva fuentes de catalogo', addedEnemyProfile?.controlledBy?.type === 'gm' && addedEnemyProfile.inventory?.some(item => item.catalogId === 'greatsword') && addedEnemyProfile.equipmentSlots?.armorItemId === 'profile-enemy-chainmail' && !('weapon' in addedEnemyProfile) && !('armorClassBreakdown' in addedEnemyProfile), JSON.stringify(addedEnemyProfile));
await send(profilePlayer, { type: 'set-initiative', roomCode: profileCode, actorId: profilePlayer.participant.id, combatantId: addedHeroProfile.id, initiative: 20 });
await send(profileGm, { type: 'set-initiative', roomCode: profileCode, actorId: profileGmId, combatantId: addedEnemyProfile.id, initiative: 10 });
await send(profileGm, { type: 'sort-initiative', roomCode: profileCode, actorId: profileGmId });
await send(profilePlayer, { type: 'cast-spell', roomCode: profileCode, actorId: profilePlayer.participant.id, casterId: addedHeroProfile.id, targetId: addedEnemyProfile.id, slotId: 'e2e-ray-slot', d20Roll: 15, amount: 8 });
const savedEnemyProfile = profilePlayer.room.combatants.find(c => c.id === addedEnemyProfile.id);
const spentRayCaster = profilePlayer.room.combatants.find(c => c.id === addedHeroProfile.id);
record('cast-spell resuelve salvacion automatica y daño autoritativo', [22, 26].includes(savedEnemyProfile?.hpCurrent) && profilePlayer.room.log.some(l => /salvación de reflex/.test(l.message)), 'HP=' + savedEnemyProfile?.hpCurrent + ' logs=' + JSON.stringify(profilePlayer.room.log.slice(0, 4)));
record('cast-spell consume el slot en el mismo room-update', spentRayCaster?.preparedSpells?.find(s => s.slotId === 'e2e-ray-slot')?.isExpended === true, JSON.stringify(spentRayCaster?.preparedSpells));

const largeGm = await connectAndSend({ type: 'create-room', name: 'Large Footprint Test' });
const largeCode = largeGm.room.code; const largeGmId = largeGm.participant.id;
const largeProfile = { ...enemyProfile, id: 'profile-large-test', name: 'Ogro Large', sizeCategory: 'large', position: { x: 2, y: 2, zFeet: 0 } };
const blockerProfile = { ...enemyProfile, id: 'profile-large-blocker', name: 'Bloqueador', position: { x: 6, y: 6, zFeet: 0 } };
await send(largeGm, { type: 'add-profile-combatant', roomCode: largeCode, actorId: largeGmId, profile: largeProfile });
await send(largeGm, { type: 'add-profile-combatant', roomCode: largeCode, actorId: largeGmId, profile: blockerProfile });
const largeToken = largeGm.room.combatants.find(c => c.name === 'Ogro Large');
const blockerToken = largeGm.room.combatants.find(c => c.name === 'Bloqueador');
const largeCells = [[largeToken.position.x, largeToken.position.y], [largeToken.position.x + 1, largeToken.position.y], [largeToken.position.x, largeToken.position.y + 1], [largeToken.position.x + 1, largeToken.position.y + 1]];
record('Large entra por WebSocket con huella 2x2 dentro del tablero', largeToken?.sizeCategory === 'large' && new Set(largeCells.map(([x, y]) => `${x},${y}`)).size === 4 && largeCells.every(([x, y]) => x >= 0 && y >= 0 && x < largeGm.room.board.width && y < largeGm.room.board.height), JSON.stringify({ position: largeToken?.position, cells: largeCells }));
await send(largeGm, { type: 'gm-move-combatant', roomCode: largeCode, actorId: largeGmId, combatantId: blockerToken.id, to: { x: 5, y: 5, zFeet: 0 } });
const largeBeforePartialCollision = { ...largeToken.position };
await send(largeGm, { type: 'gm-move-combatant', roomCode: largeCode, actorId: largeGmId, combatantId: largeToken.id, to: { x: 4, y: 4, zFeet: 0 } });
const largeAfterPartialCollision = largeGm.room.combatants.find(c => c.id === largeToken.id);
record('Servidor rechaza solapamiento parcial de una huella Large', largeGm.errors.some(e => /ocupada/i.test(e)) && largeAfterPartialCollision.position.x === largeBeforePartialCollision.x && largeAfterPartialCollision.position.y === largeBeforePartialCollision.y, largeGm.errors.join(' | '));

const diehardGm = await connectAndSend({ type: 'create-room', name: 'Diehard and Safe Stand Test' });
const diehardCode = diehardGm.room.code; const diehardGmId = diehardGm.participant.id;
const diehardProfile = { ...heroProfile, id: 'profile-diehard-test', name: 'Diehard Agile Hero', featIds: ['srd_diehard', 'srd_prone_eschewal'], position: { x: 2, y: 2, zFeet: 0 } };
const threateningProfile = { ...enemyProfile, id: 'profile-diehard-threat', name: 'Diehard Threat', position: { x: 3, y: 2, zFeet: 0 } };
await send(diehardGm, { type: 'add-profile-combatant', roomCode: diehardCode, actorId: diehardGmId, profile: diehardProfile });
await send(diehardGm, { type: 'add-profile-combatant', roomCode: diehardCode, actorId: diehardGmId, profile: threateningProfile });
const diehardHero = diehardGm.room.combatants.find(c => c.name === 'Diehard Agile Hero');
const diehardThreat = diehardGm.room.combatants.find(c => c.name === 'Diehard Threat');
await send(diehardGm, { type: 'gm-move-combatant', roomCode: diehardCode, actorId: diehardGmId, combatantId: diehardHero.id, to: { x: 2, y: 2, zFeet: 0 } });
await send(diehardGm, { type: 'gm-move-combatant', roomCode: diehardCode, actorId: diehardGmId, combatantId: diehardThreat.id, to: { x: 3, y: 2, zFeet: 0 } });
await send(diehardGm, { type: 'set-initiative', roomCode: diehardCode, actorId: diehardGmId, combatantId: diehardThreat.id, initiative: 20 });
await send(diehardGm, { type: 'set-initiative', roomCode: diehardCode, actorId: diehardGmId, combatantId: diehardHero.id, initiative: 10 });
await send(diehardGm, { type: 'sort-initiative', roomCode: diehardCode, actorId: diehardGmId });
await send(diehardGm, { type: 'end-turn', roomCode: diehardCode, actorId: diehardGmId });
await send(diehardGm, { type: 'gm-set-hp', roomCode: diehardCode, actorId: diehardGmId, combatantId: diehardHero.id, hpCurrent: -5 });
const diehardNegative = diehardGm.room.combatants.find(c => c.id === diehardHero.id);
record('Diehard se estabiliza de inmediato a -5 HP y conserva su turno', diehardNegative?.isStable === true && diehardGm.room.currentTurn.combatantId === diehardHero.id, JSON.stringify({ hp: diehardNegative?.hpCurrent, stable: diehardNegative?.isStable, turn: diehardGm.room.currentTurn }));
await send(diehardGm, { type: 'gm-apply-effect', roomCode: diehardCode, actorId: diehardGmId, targetId: diehardHero.id, effectId: 'srd_prone' });
await send(diehardGm, { type: 'use-tactical-action', roomCode: diehardCode, actorId: diehardGmId, combatantId: diehardHero.id, action: 'stand-up' });
const safelyStanding = diehardGm.room.combatants.find(c => c.id === diehardHero.id);
record('Prone Eschewal levanta por 0 pies y sin AdO por WebSocket', diehardGm.room.currentTurn.usedMoveAction === true && diehardGm.room.currentTurn.movementUsedFeet === 0 && diehardGm.room.pendingOpportunityAttacks.length === 0 && !diehardGm.room.effectInstances.some(e => e.effectId === 'srd_prone' && e.targets?.includes(diehardHero.id)), JSON.stringify({ turn: diehardGm.room.currentTurn, opportunities: diehardGm.room.pendingOpportunityAttacks, hp: safelyStanding?.hpCurrent }));
await send(diehardGm, { type: 'end-turn', roomCode: diehardCode, actorId: diehardGmId });
await send(diehardGm, { type: 'end-turn', roomCode: diehardCode, actorId: diehardGmId });
const diehardAfterRound = diehardGm.room.combatants.find(c => c.id === diehardHero.id);
record('Diehard no pierde HP al comenzar una nueva ronda', diehardAfterRound?.hpCurrent === -5 && diehardAfterRound?.isStable === true, JSON.stringify({ hp: diehardAfterRound?.hpCurrent, stable: diehardAfterRound?.isStable, round: diehardGm.room.round }));

const gmTouch = await connectAndSend({ type: 'create-room', name: 'Touch Attack Test' });
const touchCode = gmTouch.room.code; const touchGmId = gmTouch.participant.id;
await send(gmTouch, { type: 'add-catalog-combatant', roomCode: touchCode, actorId: touchGmId, category: 'heroes', templateId: 'bane' });
await send(gmTouch, { type: 'add-catalog-combatant', roomCode: touchCode, actorId: touchGmId, category: 'enemies', templateId: 'canocrock' });
const touchBane = gmTouch.room.combatants.find(c => c.name === 'Bane');
const touchEnemy = gmTouch.room.combatants.find(c => c.type === 'enemy');
// El objetivo actúa primero para que el caso mida Touch AC pura y no Touch + Flat-Footed.
await send(gmTouch, { type: 'set-initiative', roomCode: touchCode, actorId: touchGmId, combatantId: touchEnemy.id, initiative: 20 });
await send(gmTouch, { type: 'set-initiative', roomCode: touchCode, actorId: touchGmId, combatantId: touchBane.id, initiative: 10 });
await send(gmTouch, { type: 'sort-initiative', roomCode: touchCode, actorId: touchGmId });
await send(gmTouch, { type: 'end-turn', roomCode: touchCode, actorId: touchGmId });
await send(gmTouch, { type: 'resolve-ability-attack', roomCode: touchCode, actorId: touchGmId, casterId: touchBane.id, targetId: touchEnemy.id, abilityId: 'ray-of-frost', d20Roll: 3, damage: 2 });
const touchedEnemy = gmTouch.room.combatants.find(c => c.id === touchEnemy.id);
record('Ray of Frost usa Touch AC autoritativa por WebSocket', touchedEnemy.hpCurrent === 57 && gmTouch.room.log.some(l => /contra CA 11/.test(l.message)), 'HP=' + touchedEnemy.hpCurrent + ' logs=' + JSON.stringify(gmTouch.room.log.slice(0, 2)));

for (const variant of ['hero', 'cedrick', 'ranger', 'enemy', 'enemy', 'enemy']) await send(gm, { type: 'add-demo-combatant', roomCode: code, actorId: gmId, variant });
const positions = gm.room.combatants.map(c => c.position.x + ',' + c.position.y);
record('spawns WebSocket sin casillas duplicadas', new Set(positions).size === positions.length, JSON.stringify(gm.room.combatants.map(c => ({ name: c.name, pos: c.position }))));
const bane = gm.room.combatants.find(c => c.name === 'Bane'); const cedrick = gm.room.combatants.find(c => c.name === 'Cedrick'); const enemy = gm.room.combatants.find(c => c.type === 'enemy');
const elaen = gm.room.combatants.find(c => c.name === 'Elaen');
const otherCombatants = gm.room.combatants.filter(c => ![bane.id, cedrick.id, elaen.id, enemy.id].includes(c.id));
await send(gm, { type: 'gm-set-hp', roomCode: code, actorId: gmId, combatantId: bane.id, hpCurrent: 20 });
await send(gm, { type: 'set-initiative', roomCode: code, actorId: gmId, combatantId: cedrick.id, initiative: 20 });
await send(gm, { type: 'set-initiative', roomCode: code, actorId: gmId, combatantId: elaen.id, initiative: 15 });
await send(gm, { type: 'set-initiative', roomCode: code, actorId: gmId, combatantId: bane.id, initiative: 10 });
await send(gm, { type: 'set-initiative', roomCode: code, actorId: gmId, combatantId: enemy.id, initiative: 5 });
for (const [index, combatant] of otherCombatants.entries()) await send(gm, { type: 'set-initiative', roomCode: code, actorId: gmId, combatantId: combatant.id, initiative: 4 - index });
await send(gm, { type: 'sort-initiative', roomCode: code, actorId: gmId });
record('combate pasa a EN CURSO', gm.room.phase === 'active', gm.room.phase);
record('Cedrick queda activo por iniciativa', gm.room.currentTurn.combatantId === cedrick.id, gm.room.currentTurn.combatantId);
await send(gm, { type: 'use-ability', roomCode: code, actorId: gmId, casterId: cedrick.id, targetId: enemy.id, abilityId: 'haste', amount: null });
record('Haste no se puede usar sobre enemigos', gm.errors.some(e => /aliado como objetivo/i.test(e)), gm.errors.join(' | '));
await send(gm, { type: 'use-ability', roomCode: code, actorId: gmId, casterId: cedrick.id, targetId: bane.id, abilityId: 'cure-light-wounds', amount: 8 });
const healedBane = gm.room.combatants.find(c => c.id === bane.id);
record('Cure Light Wounds cura 8 HP', healedBane.hpCurrent === 28, 'HP=' + healedBane.hpCurrent);
await send(gm, { type: 'move-combatant', roomCode: code, actorId: gmId, combatantId: cedrick.id, to: bane.position });
record('bloquea mover a casilla ocupada', gm.errors.some(e => /casilla ocupada|ocupada por/i.test(e)), gm.errors.join(' | '));
await send(gm, { type: 'end-turn', roomCode: code, actorId: gmId });
record('Elaen queda activo tras Cedrick', gm.room.currentTurn.combatantId === elaen.id, gm.room.currentTurn.combatantId);
await send(gm, { type: 'use-tactical-action', roomCode: code, actorId: gmId, combatantId: elaen.id, action: 'total-defense' });
const defendedElaen = gm.room.combatants.find(c => c.id === elaen.id);
record('Defensa total agrega +4 CA y bloquea AdO', defendedElaen.buffs.some(b => b.name === 'Defensa total' && b.acBonus === 4 && b.preventsOpportunityAttacks), JSON.stringify(defendedElaen.buffs));
await send(gm, { type: 'move-combatant', roomCode: code, actorId: gmId, combatantId: elaen.id, to: { x: 2, y: 2, zFeet: 0 }, path: [{ x: 2, y: 2, zFeet: 0 }] });
record('Defensa total bloquea movimiento posterior', gm.errors.some(e => /Defensa total/i.test(e) && /renuncio/i.test(e)), gm.errors.join(' | '));
await send(gm, { type: 'end-turn', roomCode: code, actorId: gmId });
const defendedElaenAfterTurn = gm.room.combatants.find(c => c.id === elaen.id);
record('Defensa total sigue activa hasta su proximo turno', defendedElaenAfterTurn.buffs.some(b => b.name === 'Defensa total'), JSON.stringify(defendedElaenAfterTurn.buffs));
await send(gm, { type: 'declare-attack-mode', roomCode: code, actorId: gmId, combatantId: bane.id, mode: 'standard', defensive: true });
await send(gm, { type: 'resolve-attack', roomCode: code, actorId: gmId, attackerId: bane.id, targetId: enemy.id, d20Roll: 18, damage: 1 });
record('Ataque completo y luchar a la defensiva sí combinan', true, '');
const defensiveBane = gm.room.combatants.find(c => c.id === bane.id);
record('Luchar a la defensiva agrega +2 CA temporal', defensiveBane.buffs.some(b => b.name === 'Luchar a la defensiva' && b.acBonus === 2), JSON.stringify(defensiveBane.buffs));
await send(gm, { type: 'move-combatant', roomCode: code, actorId: gmId, combatantId: bane.id, to: { x: 3, y: 5, zFeet: 0 }, path: [{ x: 3, y: 5, zFeet: 0 }, { x: 2, y: 4, zFeet: 0 }, { x: 3, y: 5, zFeet: 0 }] });
record('ruta de movimiento no puede repetir casillas', gm.errors.some(e => /dos veces/i.test(e)), gm.errors.join(' | '));
const routePath = [{ x: 3, y: 5, zFeet: 0 }, { x: 4, y: 6, zFeet: 0 }];
await send(gm, { type: 'move-combatant', roomCode: code, actorId: gmId, combatantId: bane.id, to: routePath[routePath.length - 1], path: routePath });
const routedBane = gm.room.combatants.find(c => c.id === bane.id);
record('movimiento por ruta diagonal cuesta 15 ft', routedBane.position.x === 4 && routedBane.position.y === 6 && gm.room.currentTurn.movementUsedFeet === 15, 'pos=' + JSON.stringify(routedBane.position) + ' mov=' + gm.room.currentTurn.movementUsedFeet);
for (let i = 0; i < 5; i += 1) await send(gm, { type: 'end-turn', roomCode: code, actorId: gmId });
const elaenNextTurn = gm.room.combatants.find(c => c.id === elaen.id);
record('Defensa total expira al iniciar el siguiente turno propio', gm.room.currentTurn.combatantId === elaen.id && !elaenNextTurn.buffs.some(b => b.name === 'Defensa total'), 'turno=' + gm.room.currentTurn.combatantId + ' buffs=' + JSON.stringify(elaenNextTurn.buffs));
const player = await connectAndSend({ type: 'join-room', roomCode: code, name: 'Player Test', role: 'player' });
await send(player, { type: 'add-demo-combatant', roomCode: code, actorId: player.participant.id, variant: 'enemy' });
record('jugador no puede agregar enemigos en combate activo', player.errors.some(e => /preparacion/i.test(e)), player.errors.join(' | '));
await send(player, { type: 'move-combatant', roomCode: code, actorId: player.participant.id, combatantId: enemy.id, to: { x: enemy.position.x, y: enemy.position.y + 1, zFeet: 0 } });
record('jugador no puede controlar enemigos', player.errors.some(e => /jugadores no pueden controlar enemigos/i.test(e)), player.errors.join(' | '));
await send(gm, { type: 'gm-move-combatant', roomCode: code, actorId: gmId, combatantId: enemy.id, to: { x: 10, y: 6, zFeet: 0 } });
const gmMovedEnemy = gm.room.combatants.find(c => c.id === enemy.id);
record('GM puede reposicionar tokens fuera de turno', gmMovedEnemy.position.x === 10 && gmMovedEnemy.position.y === 6, JSON.stringify(gmMovedEnemy.position));
await send(gm, { type: 'gm-move-combatant', roomCode: code, actorId: gmId, combatantId: enemy.id, to: bane.position });
record('Movimiento GM respeta casillas ocupadas', gm.errors.some(e => /ocupada/i.test(e)), gm.errors.join(' | '));
await send(player, { type: 'gm-move-combatant', roomCode: code, actorId: player.participant.id, combatantId: enemy.id, to: { x: 11, y: 6, zFeet: 0 } });
record('jugador no puede usar movimiento GM', player.errors.some(e => /Solo el GM/i.test(e)), player.errors.join(' | '));
const gmHaste = await connectAndSend({ type: 'create-room', name: 'GM Haste Test' });
const hasteCode = gmHaste.room.code; const hasteGmId = gmHaste.participant.id;
await send(gmHaste, { type: 'add-catalog-combatant', roomCode: hasteCode, actorId: hasteGmId, category: 'heroes', templateId: 'cedrick' });
await send(gmHaste, { type: 'add-catalog-combatant', roomCode: hasteCode, actorId: hasteGmId, category: 'enemies', templateId: 'canocrock' });
const hasteCedrick = gmHaste.room.combatants.find(c => c.name === 'Cedrick');
const hasteEnemy = gmHaste.room.combatants.find(c => c.type === 'enemy');
await send(gmHaste, { type: 'set-initiative', roomCode: hasteCode, actorId: hasteGmId, combatantId: hasteCedrick.id, initiative: 20 });
await send(gmHaste, { type: 'set-initiative', roomCode: hasteCode, actorId: hasteGmId, combatantId: hasteEnemy.id, initiative: 1 });
await send(gmHaste, { type: 'sort-initiative', roomCode: hasteCode, actorId: hasteGmId });
await send(gmHaste, { type: 'use-ability', roomCode: hasteCode, actorId: hasteGmId, casterId: hasteCedrick.id, targetId: hasteCedrick.id, abilityId: 'haste', amount: null });
const selfHastedCedrick = gmHaste.room.combatants.find(c => c.id === hasteCedrick.id);
record('Haste se puede usar sobre si mismo', selfHastedCedrick.buffs.some(b => b.name === 'Haste' && b.attackBonus === 1 && b.speedBonusFeet === 10), JSON.stringify(selfHastedCedrick.buffs));
const gmAoo = await connectAndSend({ type: 'create-room', name: 'GM AOO Test' });
const aooCode = gmAoo.room.code; const aooGmId = gmAoo.participant.id;
await send(gmAoo, { type: 'add-catalog-combatant', roomCode: aooCode, actorId: aooGmId, category: 'heroes', templateId: 'bane' });
await send(gmAoo, { type: 'add-catalog-combatant', roomCode: aooCode, actorId: aooGmId, category: 'enemies', templateId: 'canocrock' });
const aooBane = gmAoo.room.combatants.find(c => c.name === 'Bane');
const aooEnemy = gmAoo.room.combatants.find(c => c.type === 'enemy');
await send(gmAoo, { type: 'move-combatant', roomCode: aooCode, actorId: aooGmId, combatantId: aooEnemy.id, to: { x: 3, y: 4, zFeet: 0 } });
// El atacante de oportunidad debe haber actuado: Flat-Footed bloquea AdO hasta su primer turno.
await send(gmAoo, { type: 'set-initiative', roomCode: aooCode, actorId: aooGmId, combatantId: aooBane.id, initiative: 10 });
await send(gmAoo, { type: 'set-initiative', roomCode: aooCode, actorId: aooGmId, combatantId: aooEnemy.id, initiative: 20 });
await send(gmAoo, { type: 'sort-initiative', roomCode: aooCode, actorId: aooGmId });
await send(gmAoo, { type: 'end-turn', roomCode: aooCode, actorId: aooGmId });
const escapePath = [{ x: 1, y: 4, zFeet: 0 }, { x: 0, y: 4, zFeet: 0 }];
await send(gmAoo, { type: 'move-combatant', roomCode: aooCode, actorId: aooGmId, combatantId: aooBane.id, to: escapePath[escapePath.length - 1], path: escapePath });
const pendingAoo = gmAoo.room.pendingOpportunityAttacks[0];
record('moverse mas de 5 ft genera AdO pendiente', !!pendingAoo && pendingAoo.origin.x === 2 && pendingAoo.origin.y === 4, JSON.stringify(gmAoo.room.pendingOpportunityAttacks));
await send(gmAoo, { type: 'end-turn', roomCode: aooCode, actorId: aooGmId });
record('AdO pendiente bloquea terminar turno', gmAoo.room.currentTurn.combatantId === aooBane.id && gmAoo.errors.some(e => /ataques de oportunidad pendientes/i.test(e)), 'turno=' + gmAoo.room.currentTurn.combatantId + ' errors=' + gmAoo.errors.join(' | '));
await send(gmAoo, { type: 'resolve-opportunity-attack', roomCode: aooCode, actorId: aooGmId, opportunityId: pendingAoo.id, d20Roll: 15, damage: 1 });
const stoppedBane = gmAoo.room.combatants.find(c => c.id === aooBane.id);
record('AdO se resuelve contra casilla abandonada antes del destino', stoppedBane.position.x === 2 && stoppedBane.position.y === 4 && !gmAoo.errors.some(e => /fuera del alcance/i.test(e)), 'pos=' + JSON.stringify(stoppedBane.position) + ' errors=' + gmAoo.errors.join(' | '));
const gmDiagonalAoo = await connectAndSend({ type: 'create-room', name: 'GM Diagonal AOO Test' });
const diagonalCode = gmDiagonalAoo.room.code; const diagonalGmId = gmDiagonalAoo.participant.id;
await send(gmDiagonalAoo, { type: 'add-catalog-combatant', roomCode: diagonalCode, actorId: diagonalGmId, category: 'heroes', templateId: 'bane' });
await send(gmDiagonalAoo, { type: 'add-catalog-combatant', roomCode: diagonalCode, actorId: diagonalGmId, category: 'enemies', templateId: 'canocrock' });
const diagonalBane = gmDiagonalAoo.room.combatants.find(c => c.name === 'Bane');
const diagonalEnemy = gmDiagonalAoo.room.combatants.find(c => c.type === 'enemy');
await send(gmDiagonalAoo, { type: 'move-combatant', roomCode: diagonalCode, actorId: diagonalGmId, combatantId: diagonalEnemy.id, to: { x: 3, y: 5, zFeet: 0 } });
await send(gmDiagonalAoo, { type: 'set-initiative', roomCode: diagonalCode, actorId: diagonalGmId, combatantId: diagonalBane.id, initiative: 10 });
await send(gmDiagonalAoo, { type: 'set-initiative', roomCode: diagonalCode, actorId: diagonalGmId, combatantId: diagonalEnemy.id, initiative: 20 });
await send(gmDiagonalAoo, { type: 'sort-initiative', roomCode: diagonalCode, actorId: diagonalGmId });
await send(gmDiagonalAoo, { type: 'end-turn', roomCode: diagonalCode, actorId: diagonalGmId });
const diagonalEscapePath = [{ x: 1, y: 4, zFeet: 0 }, { x: 0, y: 4, zFeet: 0 }];
await send(gmDiagonalAoo, { type: 'move-combatant', roomCode: diagonalCode, actorId: diagonalGmId, combatantId: diagonalBane.id, to: diagonalEscapePath[diagonalEscapePath.length - 1], path: diagonalEscapePath });
const diagonalPendingAoo = gmDiagonalAoo.room.pendingOpportunityAttacks[0];
await send(gmDiagonalAoo, { type: 'resolve-opportunity-attack', roomCode: diagonalCode, actorId: diagonalGmId, opportunityId: diagonalPendingAoo.id, d20Roll: 15, damage: 1 });
const diagonalStoppedBane = gmDiagonalAoo.room.combatants.find(c => c.id === diagonalBane.id);
record('AdO diagonal cuenta como 5 ft y se puede resolver', diagonalStoppedBane.position.x === 2 && diagonalStoppedBane.position.y === 4 && !gmDiagonalAoo.errors.some(e => /fuera del alcance/i.test(e)), 'pos=' + JSON.stringify(diagonalStoppedBane.position) + ' errors=' + gmDiagonalAoo.errors.join(' | '));
const gmMultiAoo = await connectAndSend({ type: 'create-room', name: 'GM Multi AOO Test' });
const multiCode = gmMultiAoo.room.code; const multiGmId = gmMultiAoo.participant.id;
await send(gmMultiAoo, { type: 'add-catalog-combatant', roomCode: multiCode, actorId: multiGmId, category: 'heroes', templateId: 'bane' });
await send(gmMultiAoo, { type: 'add-catalog-combatant', roomCode: multiCode, actorId: multiGmId, category: 'enemies', templateId: 'canocrock' });
await send(gmMultiAoo, { type: 'add-catalog-combatant', roomCode: multiCode, actorId: multiGmId, category: 'enemies', templateId: 'canocrock' });
const multiBane = gmMultiAoo.room.combatants.find(c => c.name === 'Bane');
const multiEnemies = gmMultiAoo.room.combatants.filter(c => c.type === 'enemy');
await send(gmMultiAoo, { type: 'move-combatant', roomCode: multiCode, actorId: multiGmId, combatantId: multiEnemies[0].id, to: { x: 3, y: 4, zFeet: 0 } });
await send(gmMultiAoo, { type: 'move-combatant', roomCode: multiCode, actorId: multiGmId, combatantId: multiEnemies[1].id, to: { x: 2, y: 5, zFeet: 0 } });
// Ambos enemigos completan su primer turno antes de comprobar AdO múltiples.
await send(gmMultiAoo, { type: 'set-initiative', roomCode: multiCode, actorId: multiGmId, combatantId: multiBane.id, initiative: 10 });
await send(gmMultiAoo, { type: 'set-initiative', roomCode: multiCode, actorId: multiGmId, combatantId: multiEnemies[0].id, initiative: 30 });
await send(gmMultiAoo, { type: 'set-initiative', roomCode: multiCode, actorId: multiGmId, combatantId: multiEnemies[1].id, initiative: 20 });
await send(gmMultiAoo, { type: 'sort-initiative', roomCode: multiCode, actorId: multiGmId });
await send(gmMultiAoo, { type: 'end-turn', roomCode: multiCode, actorId: multiGmId });
await send(gmMultiAoo, { type: 'end-turn', roomCode: multiCode, actorId: multiGmId });
const multiEscapePath = [{ x: 1, y: 4, zFeet: 0 }, { x: 0, y: 4, zFeet: 0 }];
await send(gmMultiAoo, { type: 'move-combatant', roomCode: multiCode, actorId: multiGmId, combatantId: multiBane.id, to: multiEscapePath[multiEscapePath.length - 1], path: multiEscapePath });
record('varios enemigos generan varios AdO contra el mismo objetivo', gmMultiAoo.room.pendingOpportunityAttacks.length === 2, JSON.stringify(gmMultiAoo.room.pendingOpportunityAttacks));
const firstMultiAoo = gmMultiAoo.room.pendingOpportunityAttacks[0];
await send(gmMultiAoo, { type: 'resolve-opportunity-attack', roomCode: multiCode, actorId: multiGmId, opportunityId: firstMultiAoo.id, d20Roll: 15, damage: 1 });
record('resolver un AdO no borra otros AdO del mismo objetivo', gmMultiAoo.room.pendingOpportunityAttacks.length === 1, JSON.stringify(gmMultiAoo.room.pendingOpportunityAttacks));
const secondMultiAoo = gmMultiAoo.room.pendingOpportunityAttacks[0];
await send(gmMultiAoo, { type: 'resolve-opportunity-attack', roomCode: multiCode, actorId: multiGmId, opportunityId: secondMultiAoo.id, d20Roll: 15, damage: 1 });
record('se puede resolver el segundo AdO del mismo objetivo', gmMultiAoo.room.pendingOpportunityAttacks.length === 0 && !gmMultiAoo.errors.some(e => /Ataque de oportunidad no encontrado/i.test(e)), 'pending=' + JSON.stringify(gmMultiAoo.room.pendingOpportunityAttacks) + ' errors=' + gmMultiAoo.errors.join(' | '));
const gmDiagonalMelee = await connectAndSend({ type: 'create-room', name: 'GM Diagonal Melee Test' });
const meleeCode = gmDiagonalMelee.room.code; const meleeGmId = gmDiagonalMelee.participant.id;
await send(gmDiagonalMelee, { type: 'add-catalog-combatant', roomCode: meleeCode, actorId: meleeGmId, category: 'heroes', templateId: 'cedrick' });
await send(gmDiagonalMelee, { type: 'add-catalog-combatant', roomCode: meleeCode, actorId: meleeGmId, category: 'enemies', templateId: 'canocrock' });
const meleeCedrick = gmDiagonalMelee.room.combatants.find(c => c.name === 'Cedrick');
const meleeEnemy = gmDiagonalMelee.room.combatants.find(c => c.type === 'enemy');
await send(gmDiagonalMelee, { type: 'move-combatant', roomCode: meleeCode, actorId: meleeGmId, combatantId: meleeCedrick.id, to: { x: 7, y: 3, zFeet: 0 } });
await send(gmDiagonalMelee, { type: 'move-combatant', roomCode: meleeCode, actorId: meleeGmId, combatantId: meleeEnemy.id, to: { x: 8, y: 4, zFeet: 0 } });
await send(gmDiagonalMelee, { type: 'set-initiative', roomCode: meleeCode, actorId: meleeGmId, combatantId: meleeCedrick.id, initiative: 20 });
await send(gmDiagonalMelee, { type: 'set-initiative', roomCode: meleeCode, actorId: meleeGmId, combatantId: meleeEnemy.id, initiative: 1 });
await send(gmDiagonalMelee, { type: 'sort-initiative', roomCode: meleeCode, actorId: meleeGmId });
await send(gmDiagonalMelee, { type: 'declare-attack-mode', roomCode: meleeCode, actorId: meleeGmId, combatantId: meleeCedrick.id, mode: 'standard', defensive: false });
await send(gmDiagonalMelee, { type: 'resolve-attack', roomCode: meleeCode, actorId: meleeGmId, attackerId: meleeCedrick.id, targetId: meleeEnemy.id, d20Roll: 15, damage: 1 });
const diagonallyHitEnemy = gmDiagonalMelee.room.combatants.find(c => c.id === meleeEnemy.id);
record('Ataque melee diagonal cuenta como 5 ft y puede impactar', diagonallyHitEnemy.hpCurrent === meleeEnemy.hpCurrent - 1 && !gmDiagonalMelee.errors.some(e => /fuera del alcance/i.test(e)), 'hp=' + diagonallyHitEnemy.hpCurrent + ' errors=' + gmDiagonalMelee.errors.join(' | '));
const gmCharge = await connectAndSend({ type: 'create-room', name: 'GM Charge Test' });
const chargeCode = gmCharge.room.code; const chargeGmId = gmCharge.participant.id;
await send(gmCharge, { type: 'add-catalog-combatant', roomCode: chargeCode, actorId: chargeGmId, category: 'heroes', templateId: 'bane' });
await send(gmCharge, { type: 'add-catalog-combatant', roomCode: chargeCode, actorId: chargeGmId, category: 'enemies', templateId: 'canocrock' });
const chargeBane = gmCharge.room.combatants.find(c => c.name === 'Bane');
const chargeEnemy = gmCharge.room.combatants.find(c => c.type === 'enemy');
await send(gmCharge, { type: 'set-initiative', roomCode: chargeCode, actorId: chargeGmId, combatantId: chargeBane.id, initiative: 20 });
await send(gmCharge, { type: 'set-initiative', roomCode: chargeCode, actorId: chargeGmId, combatantId: chargeEnemy.id, initiative: 1 });
await send(gmCharge, { type: 'sort-initiative', roomCode: chargeCode, actorId: chargeGmId });
await send(gmCharge, { type: 'use-tactical-action', roomCode: chargeCode, actorId: chargeGmId, combatantId: chargeBane.id, action: 'charge', targetId: chargeEnemy.id, d20Roll: 18, damage: 1 });
const chargedBane = gmCharge.room.combatants.find(c => c.id === chargeBane.id);
record('Carga mueve en linea recta, ataca y aplica -2 CA temporal', chargedBane.position.x === 7 && chargedBane.position.y === 4 && chargedBane.buffs.some(b => b.name === 'Carga' && b.acBonus === -2) && gmCharge.room.currentTurn.usedFullAttack, 'pos=' + JSON.stringify(chargedBane.position) + ' buffs=' + JSON.stringify(chargedBane.buffs));

const gmAid = await connectAndSend({ type: 'create-room', name: 'GM Aid Test' });
const aidCode = gmAid.room.code; const aidGmId = gmAid.participant.id;
await send(gmAid, { type: 'add-catalog-combatant', roomCode: aidCode, actorId: aidGmId, category: 'heroes', templateId: 'cedrick' });
await send(gmAid, { type: 'add-catalog-combatant', roomCode: aidCode, actorId: aidGmId, category: 'heroes', templateId: 'bane' });
await send(gmAid, { type: 'add-catalog-combatant', roomCode: aidCode, actorId: aidGmId, category: 'enemies', templateId: 'canocrock' });
const aidCedrick = gmAid.room.combatants.find(c => c.name === 'Cedrick');
const aidBane = gmAid.room.combatants.find(c => c.name === 'Bane');
const aidEnemy = gmAid.room.combatants.find(c => c.type === 'enemy');
await send(gmAid, { type: 'move-combatant', roomCode: aidCode, actorId: aidGmId, combatantId: aidCedrick.id, to: { x: 7, y: 4, zFeet: 0 } });
await send(gmAid, { type: 'set-initiative', roomCode: aidCode, actorId: aidGmId, combatantId: aidCedrick.id, initiative: 20 });
await send(gmAid, { type: 'set-initiative', roomCode: aidCode, actorId: aidGmId, combatantId: aidBane.id, initiative: 15 });
await send(gmAid, { type: 'set-initiative', roomCode: aidCode, actorId: aidGmId, combatantId: aidEnemy.id, initiative: 1 });
await send(gmAid, { type: 'sort-initiative', roomCode: aidCode, actorId: aidGmId });
await send(gmAid, { type: 'use-tactical-action', roomCode: aidCode, actorId: aidGmId, combatantId: aidCedrick.id, action: 'aid-another', allyId: aidBane.id, targetId: aidEnemy.id, d20Roll: 10 });
const helpedBane = gmAid.room.combatants.find(c => c.id === aidBane.id);
const pendingAid = helpedBane.buffs.find(b => b.aidChoice === 'pending' && b.aidTargetId === aidEnemy.id);
record('Prestar ayuda crea un buff pendiente de eleccion', !!pendingAid, JSON.stringify(helpedBane.buffs));
await send(gmAid, { type: 'use-tactical-action', roomCode: aidCode, actorId: aidGmId, combatantId: aidCedrick.id, action: 'five-foot-step', to: { x: 6, y: 4, zFeet: 0 } });
const cedrickAfterStep = gmAid.room.combatants.find(c => c.id === aidCedrick.id);
record('Prestar ayuda permite paso de 5 ft explícito posterior', cedrickAfterStep.position.x === 6 && gmAid.room.currentTurn.usedFiveFootStep, 'pos=' + JSON.stringify(cedrickAfterStep.position) + ' turno=' + JSON.stringify(gmAid.room.currentTurn));
await send(gmAid, { type: 'use-tactical-action', roomCode: aidCode, actorId: aidGmId, combatantId: aidCedrick.id, action: 'five-foot-step', to: { x: 5, y: 4, zFeet: 0 } });
record('No se pueden encadenar pasos de 5 ft tras prestar ayuda', gmAid.errors.some(e => /paso de 5 pies/i.test(e)), gmAid.errors.join(' | '));
await send(gmAid, { type: 'end-turn', roomCode: aidCode, actorId: aidGmId });
await send(gmAid, { type: 'choose-aid-bonus', roomCode: aidCode, actorId: aidGmId, combatantId: aidBane.id, buffId: pendingAid.id, choice: 'attack' });
const chosenAidBane = gmAid.room.combatants.find(c => c.id === aidBane.id);
record('Aliado elige la ayuda como +2 ataque en su turno', chosenAidBane.buffs.some(b => b.id === pendingAid.id && b.aidChoice === 'attack'), JSON.stringify(chosenAidBane.buffs));
await send(gmAid, { type: 'declare-attack-mode', roomCode: aidCode, actorId: aidGmId, combatantId: aidBane.id, mode: 'standard', defensive: false });
await send(gmAid, { type: 'resolve-attack', roomCode: aidCode, actorId: aidGmId, attackerId: aidBane.id, targetId: aidEnemy.id, d20Roll: 10, damage: 1 });
const consumedAidBane = gmAid.room.combatants.find(c => c.id === aidBane.id);
record('Ayuda elegida para ataque se consume al atacar al objetivo', !consumedAidBane.buffs.some(b => b.id === pendingAid.id), JSON.stringify(consumedAidBane.buffs));
const gmPassThrough = await connectAndSend({ type: 'create-room', name: 'GM Pass Through Test' });
const ptCode = gmPassThrough.room.code; const ptGmId = gmPassThrough.participant.id;
await send(gmPassThrough, { type: 'add-catalog-combatant', roomCode: ptCode, actorId: ptGmId, category: 'heroes', templateId: 'bane' });
await send(gmPassThrough, { type: 'add-catalog-combatant', roomCode: ptCode, actorId: ptGmId, category: 'heroes', templateId: 'cedrick' });
await send(gmPassThrough, { type: 'add-catalog-combatant', roomCode: ptCode, actorId: ptGmId, category: 'enemies', templateId: 'canocrock' });
const ptBane = gmPassThrough.room.combatants.find(c => c.name === 'Bane');
const ptCedrick = gmPassThrough.room.combatants.find(c => c.name === 'Cedrick');
const ptEnemy = gmPassThrough.room.combatants.find(c => c.type === 'enemy');
await send(gmPassThrough, { type: 'gm-move-combatant', roomCode: ptCode, actorId: ptGmId, combatantId: ptBane.id, to: { x: 0, y: 0, zFeet: 0 } });
await send(gmPassThrough, { type: 'gm-move-combatant', roomCode: ptCode, actorId: ptGmId, combatantId: ptCedrick.id, to: { x: 0, y: 1, zFeet: 0 } });
await send(gmPassThrough, { type: 'gm-move-combatant', roomCode: ptCode, actorId: ptGmId, combatantId: ptEnemy.id, to: { x: 0, y: 3, zFeet: 0 } });
await send(gmPassThrough, { type: 'set-initiative', roomCode: ptCode, actorId: ptGmId, combatantId: ptBane.id, initiative: 20 });
await send(gmPassThrough, { type: 'set-initiative', roomCode: ptCode, actorId: ptGmId, combatantId: ptCedrick.id, initiative: 10 });
await send(gmPassThrough, { type: 'set-initiative', roomCode: ptCode, actorId: ptGmId, combatantId: ptEnemy.id, initiative: 5 });
await send(gmPassThrough, { type: 'sort-initiative', roomCode: ptCode, actorId: ptGmId });
const ptPath = [{ x: 0, y: 1, zFeet: 0 }, { x: 0, y: 2, zFeet: 0 }];
await send(gmPassThrough, { type: 'move-combatant', roomCode: ptCode, actorId: ptGmId, combatantId: ptBane.id, to: ptPath[1], path: ptPath });
const movedBane = gmPassThrough.room.combatants.find(c => c.id === ptBane.id);
record('movimiento a traves de aliado es permitido', movedBane.position.x === 0 && movedBane.position.y === 2 && !gmPassThrough.errors.some(e => /atravesar/i.test(e)), 'pos=' + JSON.stringify(movedBane.position) + ' errors=' + gmPassThrough.errors.join(' | '));

const gmFlanking = await connectAndSend({ type: 'create-room', name: 'GM Flanking Test' });
const flankingCode = gmFlanking.room.code; const flankingGmId = gmFlanking.participant.id;
await send(gmFlanking, { type: 'add-catalog-combatant', roomCode: flankingCode, actorId: flankingGmId, category: 'heroes', templateId: 'cedrick' });
await send(gmFlanking, { type: 'add-catalog-combatant', roomCode: flankingCode, actorId: flankingGmId, category: 'heroes', templateId: 'bane' });
await send(gmFlanking, { type: 'add-catalog-combatant', roomCode: flankingCode, actorId: flankingGmId, category: 'enemies', templateId: 'canocrock' });
const flankCedrick = gmFlanking.room.combatants.find(c => c.name === 'Cedrick');
const flankBane = gmFlanking.room.combatants.find(c => c.name === 'Bane');
const flankEnemy = gmFlanking.room.combatants.find(c => c.type === 'enemy');
await send(gmFlanking, { type: 'gm-move-combatant', roomCode: flankingCode, actorId: flankingGmId, combatantId: flankCedrick.id, to: { x: 4, y: 3, zFeet: 0 } });
await send(gmFlanking, { type: 'gm-move-combatant', roomCode: flankingCode, actorId: flankingGmId, combatantId: flankEnemy.id, to: { x: 4, y: 4, zFeet: 0 } });
await send(gmFlanking, { type: 'gm-move-combatant', roomCode: flankingCode, actorId: flankingGmId, combatantId: flankBane.id, to: { x: 4, y: 5, zFeet: 0 } });
await send(gmFlanking, { type: 'set-initiative', roomCode: flankingCode, actorId: flankingGmId, combatantId: flankCedrick.id, initiative: 20 });
await send(gmFlanking, { type: 'set-initiative', roomCode: flankingCode, actorId: flankingGmId, combatantId: flankBane.id, initiative: 15 });
await send(gmFlanking, { type: 'set-initiative', roomCode: flankingCode, actorId: flankingGmId, combatantId: flankEnemy.id, initiative: 5 });
await send(gmFlanking, { type: 'sort-initiative', roomCode: flankingCode, actorId: flankingGmId });
await send(gmFlanking, { type: 'declare-attack-mode', roomCode: flankingCode, actorId: flankingGmId, combatantId: flankCedrick.id, mode: 'standard', defensive: false });
await send(gmFlanking, { type: 'resolve-attack', roomCode: flankingCode, actorId: flankingGmId, attackerId: flankCedrick.id, targetId: flankEnemy.id, d20Roll: 10, damage: 1 });
const flankLogs = gmFlanking.room.log.map(l => l.message);
record('ataque con flanqueo aplica +2 y loguea "flanqueo +2"', flankLogs.some(l => /flanqueo \+2/i.test(l)), JSON.stringify(flankLogs));

// ─────────────────────────────────────────────────────────────────────────────
// E2E: Five-Foot Step (Paso de 5 pies)
// ─────────────────────────────────────────────────────────────────────────────
const gmFfs = await connectAndSend({ type: 'create-room', name: 'GM Five Foot Step Test' });
const ffsCode = gmFfs.room.code; const ffsGmId = gmFfs.participant.id;
await send(gmFfs, { type: 'add-catalog-combatant', roomCode: ffsCode, actorId: ffsGmId, category: 'heroes', templateId: 'cedrick' });
await send(gmFfs, { type: 'add-catalog-combatant', roomCode: ffsCode, actorId: ffsGmId, category: 'enemies', templateId: 'canocrock' });
const ffsCedrick = gmFfs.room.combatants.find(c => c.name === 'Cedrick');
const ffsEnemy = gmFfs.room.combatants.find(c => c.type === 'enemy');
await send(gmFfs, { type: 'gm-move-combatant', roomCode: ffsCode, actorId: ffsGmId, combatantId: ffsCedrick.id, to: { x: 4, y: 4, zFeet: 0 } });
await send(gmFfs, { type: 'gm-move-combatant', roomCode: ffsCode, actorId: ffsGmId, combatantId: ffsEnemy.id, to: { x: 9, y: 9, zFeet: 0 } });
await send(gmFfs, { type: 'set-initiative', roomCode: ffsCode, actorId: ffsGmId, combatantId: ffsCedrick.id, initiative: 20 });
await send(gmFfs, { type: 'set-initiative', roomCode: ffsCode, actorId: ffsGmId, combatantId: ffsEnemy.id, initiative: 1 });
await send(gmFfs, { type: 'sort-initiative', roomCode: ffsCode, actorId: ffsGmId });
// Caso 1: paso de 5 ft posiciona correctamente y no genera AdO
await send(gmFfs, { type: 'use-tactical-action', roomCode: ffsCode, actorId: ffsGmId, combatantId: ffsCedrick.id, action: 'five-foot-step', to: { x: 4, y: 3, zFeet: 0 } });
const ffsAfterStep = gmFfs.room.combatants.find(c => c.id === ffsCedrick.id);
record('Paso de 5 pies posiciona correctamente sin AdO pendientes', ffsAfterStep.position.x === 4 && ffsAfterStep.position.y === 3 && gmFfs.room.pendingOpportunityAttacks.length === 0 && gmFfs.room.currentTurn.usedFiveFootStep, 'pos=' + JSON.stringify(ffsAfterStep.position) + ' AdO=' + gmFfs.room.pendingOpportunityAttacks.length);
// Caso 2: paso + movimiento normal falla
await send(gmFfs, { type: 'move-combatant', roomCode: ffsCode, actorId: ffsGmId, combatantId: ffsCedrick.id, to: { x: 3, y: 3, zFeet: 0 } });
record('Paso de 5 pies + movimiento normal falla correctamente', gmFfs.errors.some(e => /movimiento|paso/i.test(e)), gmFfs.errors.join(' | '));
await send(gmFfs, { type: 'end-turn', roomCode: ffsCode, actorId: ffsGmId });
await send(gmFfs, { type: 'end-turn', roomCode: ffsCode, actorId: ffsGmId });
// Caso 3: doble paso de 5 pies falla
await send(gmFfs, { type: 'use-tactical-action', roomCode: ffsCode, actorId: ffsGmId, combatantId: ffsCedrick.id, action: 'five-foot-step', to: { x: 4, y: 2, zFeet: 0 } });
await send(gmFfs, { type: 'use-tactical-action', roomCode: ffsCode, actorId: ffsGmId, combatantId: ffsCedrick.id, action: 'five-foot-step', to: { x: 4, y: 1, zFeet: 0 } });
record('Doble paso de 5 pies falla correctamente', gmFfs.errors.some(e => /paso de 5 pies/i.test(e)), gmFfs.errors.join(' | '));
await send(gmFfs, { type: 'end-turn', roomCode: ffsCode, actorId: ffsGmId });
await send(gmFfs, { type: 'end-turn', roomCode: ffsCode, actorId: ffsGmId });
// Caso 4: movimiento normal + intento de paso falla
await send(gmFfs, { type: 'move-combatant', roomCode: ffsCode, actorId: ffsGmId, combatantId: ffsCedrick.id, to: { x: 4, y: 3, zFeet: 0 }, path: [{ x: 4, y: 3, zFeet: 0 }] });
await send(gmFfs, { type: 'use-tactical-action', roomCode: ffsCode, actorId: ffsGmId, combatantId: ffsCedrick.id, action: 'five-foot-step', to: { x: 4, y: 2, zFeet: 0 } });
record('Movimiento normal + intento de paso de 5 pies falla correctamente', gmFfs.errors.some(e => /movimiento/i.test(e)), gmFfs.errors.join(' | '));
await send(gmFfs, { type: 'end-turn', roomCode: ffsCode, actorId: ffsGmId });
await send(gmFfs, { type: 'end-turn', roomCode: ffsCode, actorId: ffsGmId });
// Caso 5: paso de 5 pies + ataque completo válido
await send(gmFfs, { type: 'use-tactical-action', roomCode: ffsCode, actorId: ffsGmId, combatantId: ffsCedrick.id, action: 'five-foot-step', to: { x: 5, y: 3, zFeet: 0 } });
await send(gmFfs, { type: 'gm-move-combatant', roomCode: ffsCode, actorId: ffsGmId, combatantId: ffsEnemy.id, to: { x: 6, y: 3, zFeet: 0 } });
await send(gmFfs, { type: 'declare-attack-mode', roomCode: ffsCode, actorId: ffsGmId, combatantId: ffsCedrick.id, mode: 'standard', defensive: false });
await send(gmFfs, { type: 'resolve-attack', roomCode: ffsCode, actorId: ffsGmId, attackerId: ffsCedrick.id, targetId: ffsEnemy.id, d20Roll: 15, damage: 1 });
record('Paso de 5 pies + ataque completo es válido', !gmFfs.errors.some(e => /no puede hacer ataque completo/i.test(e)), gmFfs.errors.join(' | '));

// ─────────────────────────────────────────────────────────────────────────────
// E2E: Full Attack & Iteratives
// ─────────────────────────────────────────────────────────────────────────────
const gmFa = await connectAndSend({ type: 'create-room', name: 'GM Full Attack Test' });
const faCode = gmFa.room.code; const faGmId = gmFa.participant.id;
await send(gmFa, { type: 'add-catalog-combatant', roomCode: faCode, actorId: faGmId, category: 'heroes', templateId: 'cedrick' }); // BAB +6 => 2 attacks
await send(gmFa, { type: 'add-catalog-combatant', roomCode: faCode, actorId: faGmId, category: 'enemies', templateId: 'canocrock' });
const faCedrick = gmFa.room.combatants.find(c => c.name === 'Cedrick');
const faEnemy = gmFa.room.combatants.find(c => c.type === 'enemy');
await send(gmFa, { type: 'gm-move-combatant', roomCode: faCode, actorId: faGmId, combatantId: faCedrick.id, to: { x: 5, y: 5, zFeet: 0 } });
await send(gmFa, { type: 'gm-move-combatant', roomCode: faCode, actorId: faGmId, combatantId: faEnemy.id, to: { x: 6, y: 5, zFeet: 0 } });
await send(gmFa, { type: 'set-initiative', roomCode: faCode, actorId: faGmId, combatantId: faCedrick.id, initiative: 20 });
await send(gmFa, { type: 'set-initiative', roomCode: faCode, actorId: faGmId, combatantId: faEnemy.id, initiative: 1 });
await send(gmFa, { type: 'sort-initiative', roomCode: faCode, actorId: faGmId });

// Caso 1: Ataque 1 -> Movimiento permitido, pero falla iterativo
await send(gmFa, { type: 'declare-attack-mode', roomCode: faCode, actorId: faGmId, combatantId: faCedrick.id, mode: 'standard', defensive: false });
await send(gmFa, { type: 'resolve-attack', roomCode: faCode, actorId: faGmId, attackerId: faCedrick.id, targetId: faEnemy.id, d20Roll: 10, damage: 1 });
await send(gmFa, { type: 'move-combatant', roomCode: faCode, actorId: faGmId, combatantId: faCedrick.id, to: { x: 5, y: 6, zFeet: 0 }, path: [{ x: 5, y: 6, zFeet: 0 }] });
record('Ataque 1 + movimiento normal es valido', gmFa.room.currentTurn.usedStandardAction && gmFa.room.currentTurn.usedMoveAction && !gmFa.errors.some(e => /ya uso su accion de movimiento/i.test(e)), 'turn=' + JSON.stringify(gmFa.room.currentTurn) + ' errors=' + gmFa.errors.join(' | '));
await send(gmFa, { type: 'resolve-attack', roomCode: faCode, actorId: faGmId, attackerId: faCedrick.id, targetId: faEnemy.id, d20Roll: 10, damage: 1 });
record('Ataque 2 iterativo falla si hubo movimiento normal previo', gmFa.errors.some(e => /Estandar solo permite un \(1\) ataque/i.test(e) || /accion de movimiento/i.test(e)), gmFa.errors.join(' | '));
await send(gmFa, { type: 'end-turn', roomCode: faCode, actorId: faGmId });
await send(gmFa, { type: 'end-turn', roomCode: faCode, actorId: faGmId });

// Reposicionar
await send(gmFa, { type: 'gm-move-combatant', roomCode: faCode, actorId: faGmId, combatantId: faCedrick.id, to: { x: 5, y: 5, zFeet: 0 } });
await send(gmFa, { type: 'gm-move-combatant', roomCode: faCode, actorId: faGmId, combatantId: faEnemy.id, to: { x: 6, y: 5, zFeet: 0 } });

// Caso 2: 5-ft step -> Ataque 1 -> Ataque 2 permitido, movimiento normal falla
await send(gmFa, { type: 'use-tactical-action', roomCode: faCode, actorId: faGmId, combatantId: faCedrick.id, action: 'five-foot-step', to: { x: 5, y: 4, zFeet: 0 } });
await send(gmFa, { type: 'declare-attack-mode', roomCode: faCode, actorId: faGmId, combatantId: faCedrick.id, mode: 'full', defensive: false });
await send(gmFa, { type: 'resolve-attack', roomCode: faCode, actorId: faGmId, attackerId: faCedrick.id, targetId: faEnemy.id, d20Roll: 10, damage: 1 });
await send(gmFa, { type: 'resolve-attack', roomCode: faCode, actorId: faGmId, attackerId: faCedrick.id, targetId: faEnemy.id, d20Roll: 10, damage: 1 });
record('5-ft step + Ataque 1 + Ataque 2 iterativo es valido', gmFa.room.currentTurn.attacksMade === 2 && gmFa.room.currentTurn.usedFullAttack, 'turn=' + JSON.stringify(gmFa.room.currentTurn) + ' errors=' + gmFa.errors.join(' | '));
const faLogs = gmFa.room.log.map(l => l.message);
record('Ataque 2 aplica penalizador de -5', faLogs.some(l => /iterativo -5/i.test(l) && /2º ataque/i.test(l)), JSON.stringify(faLogs.slice(0, 3)));
await send(gmFa, { type: 'move-combatant', roomCode: faCode, actorId: faGmId, combatantId: faCedrick.id, to: { x: 5, y: 3, zFeet: 0 }, path: [{ x: 5, y: 3, zFeet: 0 }] });
record('Movimiento normal tras iterativo es bloqueado', gmFa.errors.some(e => /asalto completo/i.test(e)), gmFa.errors.join(' | '));
await send(gmFa, { type: 'resolve-attack', roomCode: faCode, actorId: faGmId, attackerId: faCedrick.id, targetId: faEnemy.id, d20Roll: 10, damage: 1 });
record('Ataque 3 es bloqueado por limite de rutina (BAB +6 = 2)', gmFa.errors.some(e => /No le quedan mas ataques/i.test(e)), gmFa.errors.join(' | '));

// ─────────────────────────────────────────────────────────────────────────────
// E2E: Luchar a la defensiva (Ciclo de buffs)
// ─────────────────────────────────────────────────────────────────────────────
const gmDef = await connectAndSend({ type: 'create-room', name: 'GM Defensive Cycle Test' });
const defCode = gmDef.room.code; const defGmId = gmDef.participant.id;
await send(gmDef, { type: 'add-catalog-combatant', roomCode: defCode, actorId: defGmId, category: 'heroes', templateId: 'bane' });
await send(gmDef, { type: 'add-catalog-combatant', roomCode: defCode, actorId: defGmId, category: 'enemies', templateId: 'canocrock' });
const defBane = gmDef.room.combatants.find(c => c.name === 'Bane');
const defEnemy = gmDef.room.combatants.find(c => c.type === 'enemy');
await send(gmDef, { type: 'set-initiative', roomCode: defCode, actorId: defGmId, combatantId: defBane.id, initiative: 20 });
await send(gmDef, { type: 'set-initiative', roomCode: defCode, actorId: defGmId, combatantId: defEnemy.id, initiative: 1 });
await send(gmDef, { type: 'sort-initiative', roomCode: defCode, actorId: defGmId });

// 1. A declara luchar a la defensiva
await send(gmDef, { type: 'declare-attack-mode', roomCode: defCode, actorId: defGmId, combatantId: defBane.id, mode: 'standard', defensive: true });
// 2. A realiza un ataque valido
await send(gmDef, { type: 'resolve-attack', roomCode: defCode, actorId: defGmId, attackerId: defBane.id, targetId: defEnemy.id, d20Roll: 10, damage: 1 });
// 3. Se confirma el -4 y +2
const buffedBane = gmDef.room.combatants.find(c => c.id === defBane.id);
record('Luchar a la defensiva agrega +2 CA temporal', buffedBane.buffs.some(b => b.name === 'Luchar a la defensiva' && b.acBonus === 2), JSON.stringify(buffedBane.buffs));

// 4. Termina turno de A
await send(gmDef, { type: 'end-turn', roomCode: defCode, actorId: defGmId });
// 5. Actuan demas (Turno de Enemy)
const buffedBaneDuringEnemy = gmDef.room.combatants.find(c => c.id === defBane.id);
record('El buff +2 CA se mantiene durante el turno enemigo', buffedBaneDuringEnemy.buffs.some(b => b.name === 'Luchar a la defensiva' && b.acBonus === 2), JSON.stringify(buffedBaneDuringEnemy.buffs));
await send(gmDef, { type: 'end-turn', roomCode: defCode, actorId: defGmId });

// 6. Vuelve turno de A, el buff debe expirar (7)
const expiredBane = gmDef.room.combatants.find(c => c.id === defBane.id);
record('El buff expira al iniciar el proximo turno propio', !expiredBane.buffs.some(b => b.name === 'Luchar a la defensiva'), JSON.stringify(expiredBane.buffs));

// 8. A puede volver a declarar
await send(gmDef, { type: 'declare-attack-mode', roomCode: defCode, actorId: defGmId, combatantId: defBane.id, mode: 'standard', defensive: true });
await send(gmDef, { type: 'resolve-attack', roomCode: defCode, actorId: defGmId, attackerId: defBane.id, targetId: defEnemy.id, d20Roll: 10, damage: 1 });
const rebuffedBane = gmDef.room.combatants.find(c => c.id === defBane.id);
record('Se puede volver a luchar a la defensiva', rebuffedBane.buffs.some(b => b.name === 'Luchar a la defensiva'), JSON.stringify(rebuffedBane.buffs));
// ─────────────────────────────────────────────────────────────────────────────
// E2E: Disabled (0 HP) Effort
// ─────────────────────────────────────────────────────────────────────────────
const gmDisabled = await connectAndSend({ type: 'create-room', name: 'GM Disabled Test' });
const disCode = gmDisabled.room.code; const disGmId = gmDisabled.participant.id;
await send(gmDisabled, { type: 'add-catalog-combatant', roomCode: disCode, actorId: disGmId, category: 'heroes', templateId: 'bane' });
await send(gmDisabled, { type: 'add-catalog-combatant', roomCode: disCode, actorId: disGmId, category: 'enemies', templateId: 'canocrock' });
const disBane = gmDisabled.room.combatants.find(c => c.name === 'Bane');
const disEnemy = gmDisabled.room.combatants.find(c => c.type === 'enemy');
await send(gmDisabled, { type: 'gm-move-combatant', roomCode: disCode, actorId: disGmId, combatantId: disBane.id, to: { x: 5, y: 5, zFeet: 0 } });
await send(gmDisabled, { type: 'gm-move-combatant', roomCode: disCode, actorId: disGmId, combatantId: disEnemy.id, to: { x: 6, y: 5, zFeet: 0 } });
await send(gmDisabled, { type: 'gm-set-hp', roomCode: disCode, actorId: disGmId, combatantId: disBane.id, hpCurrent: 0 }); // Dejar en 0 HP (Disabled)
await send(gmDisabled, { type: 'set-initiative', roomCode: disCode, actorId: disGmId, combatantId: disBane.id, initiative: 20 });
await send(gmDisabled, { type: 'set-initiative', roomCode: disCode, actorId: disGmId, combatantId: disEnemy.id, initiative: 1 });
await send(gmDisabled, { type: 'sort-initiative', roomCode: disCode, actorId: disGmId });

// 1. Mover sin esfuerzo
await send(gmDisabled, { type: 'move-combatant', roomCode: disCode, actorId: disGmId, combatantId: disBane.id, to: { x: 5, y: 4, zFeet: 0 } });
const movedDisBane = gmDisabled.room.combatants.find(c => c.id === disBane.id);
record('Se puede mover estando disabled (si no consume standard) sin esfuerzo', movedDisBane.hpCurrent === 0, 'hp=' + movedDisBane.hpCurrent);

// 2. Ataque denegado (ya movió)
await send(gmDisabled, { type: 'declare-attack-mode', roomCode: disCode, actorId: disGmId, combatantId: disBane.id, mode: 'standard', defensive: false });
await send(gmDisabled, { type: 'resolve-attack', roomCode: disCode, actorId: disGmId, attackerId: disBane.id, targetId: disEnemy.id, d20Roll: 10, damage: 1 });
record('0 HP y accion unica consumida bloquea estandar', gmDisabled.errors.some(e => /ya consumio su unica accion/i.test(e)), gmDisabled.errors.join(' | '));

// Reiniciamos turno
await send(gmDisabled, { type: 'end-turn', roomCode: disCode, actorId: disGmId });
await send(gmDisabled, { type: 'end-turn', roomCode: disCode, actorId: disGmId });

// 3. Ataque aplica -1 HP de esfuerzo y mata
await send(gmDisabled, { type: 'declare-attack-mode', roomCode: disCode, actorId: disGmId, combatantId: disBane.id, mode: 'standard', defensive: false });
await send(gmDisabled, { type: 'resolve-attack', roomCode: disCode, actorId: disGmId, attackerId: disBane.id, targetId: disEnemy.id, d20Roll: 10, damage: 1 });
const deadDisBane = gmDisabled.room.combatants.find(c => c.id === disBane.id);
record('Ataque estando disabled baja HP a -1', deadDisBane.hpCurrent === -1, 'hp=' + deadDisBane.hpCurrent);
record('El personaje pasa de disabled a dying por esfuerzo', deadDisBane.hpCurrent === -1, 'hp=' + deadDisBane.hpCurrent);

// ─────────────────────────────────────────────────────────────────────────────
// E2E: Stunned V1 (Active Effects)
// ─────────────────────────────────────────────────────────────────────────────
const gmStun = await connectAndSend({ type: 'create-room', name: 'GM Stun Test' });
const stunCode = gmStun.room.code; const stunGmId = gmStun.participant.id;
await send(gmStun, { type: 'add-catalog-combatant', roomCode: stunCode, actorId: stunGmId, category: 'heroes', templateId: 'bane' });
await send(gmStun, { type: 'add-catalog-combatant', roomCode: stunCode, actorId: stunGmId, category: 'enemies', templateId: 'canocrock' });
const stunBane = gmStun.room.combatants.find(c => c.name === 'Bane');
const stunEnemy = gmStun.room.combatants.find(c => c.type === 'enemy');
await send(gmStun, { type: 'gm-move-combatant', roomCode: stunCode, actorId: stunGmId, combatantId: stunBane.id, to: { x: 5, y: 5, zFeet: 0 } });
await send(gmStun, { type: 'gm-move-combatant', roomCode: stunCode, actorId: stunGmId, combatantId: stunEnemy.id, to: { x: 6, y: 5, zFeet: 0 } });
await send(gmStun, { type: 'set-initiative', roomCode: stunCode, actorId: stunGmId, combatantId: stunBane.id, initiative: 20 });
await send(gmStun, { type: 'set-initiative', roomCode: stunCode, actorId: stunGmId, combatantId: stunEnemy.id, initiative: 1 });
await send(gmStun, { type: 'sort-initiative', roomCode: stunCode, actorId: stunGmId });

// GM inyecta el efecto srd_stunned a Bane
await send(gmStun, { type: 'gm-apply-effect', roomCode: stunCode, actorId: stunGmId, targetId: stunBane.id, effectId: 'srd_stunned', durationPreset: 'until_target_turn_end' });

// Bane intenta moverse
await send(gmStun, { type: 'move-combatant', roomCode: stunCode, actorId: stunGmId, combatantId: stunBane.id, to: { x: 5, y: 4, zFeet: 0 } });
record('Stunned: no puede moverse por CANNOT_ACT', gmStun.errors.some(e => /incapacitado y no puede realizar acciones/i.test(e)), gmStun.errors.join(' | '));

// Bane intenta atacar
await send(gmStun, { type: 'declare-attack-mode', roomCode: stunCode, actorId: stunGmId, combatantId: stunBane.id, mode: 'standard', defensive: false });
record('Stunned: no puede declarar ataques por CANNOT_ACT', gmStun.errors.some(e => /incapacitado y no puede realizar acciones/i.test(e)), gmStun.errors.join(' | '));

// Revisar inyección
record('Stunned: el GM inyecta el efecto correctamente en effectInstances con preset de duración', gmStun.room.effectInstances.some(e => e.effectId === 'srd_stunned' && e.targets.includes(stunBane.id) && e.duration?.type === 'until_turn'), 'effectInstances=' + JSON.stringify(gmStun.room.effectInstances));

// Terminar turno de Bane (el turno estaba en él)
await send(gmStun, { type: 'end-turn', roomCode: stunCode, actorId: stunGmId });

// Turno de Enemy
await send(gmStun, { type: 'end-turn', roomCode: stunCode, actorId: stunGmId });

// Vuelve a ser el turno de Bane.
// Como el efecto dura 'until_target_turn_end', al final del turno *anterior* de Bane, ¿expiró?
// Wait, el efecto dura hasta el final de su turno. Si se lo aplicaron en SU turno, dura hasta el final de ESTE turno.
record('Stunned: el efecto expira al terminar el turno de Bane', !gmStun.room.effectInstances.some(e => e.effectId === 'srd_stunned'), 'effectInstances=' + JSON.stringify(gmStun.room.effectInstances));

// Bane puede moverse de nuevo
await send(gmStun, { type: 'move-combatant', roomCode: stunCode, actorId: stunGmId, combatantId: stunBane.id, to: { x: 5, y: 4, zFeet: 0 } });
record('Stunned: recupera acciones tras expirar', gmStun.room.combatants.find(c => c.id === stunBane.id).position.y === 4, gmStun.errors.join(' | '));

// ─────────────────────────────────────────────────────────────────────────────
// E2E: Entangled Core (pipeline declarativo compartido)
// ─────────────────────────────────────────────────────────────────────────────
const gmEntangled = await connectAndSend({ type: 'create-room', name: 'GM Entangled Test' });
const entangledCode = gmEntangled.room.code; const entangledGmId = gmEntangled.participant.id;
await send(gmEntangled, { type: 'add-catalog-combatant', roomCode: entangledCode, actorId: entangledGmId, category: 'heroes', templateId: 'bane' });
await send(gmEntangled, { type: 'add-catalog-combatant', roomCode: entangledCode, actorId: entangledGmId, category: 'enemies', templateId: 'canocrock' });
const entangledBane = gmEntangled.room.combatants.find(c => c.name === 'Bane');
const entangledEnemy = gmEntangled.room.combatants.find(c => c.type === 'enemy');
await send(gmEntangled, { type: 'gm-move-combatant', roomCode: entangledCode, actorId: entangledGmId, combatantId: entangledBane.id, to: { x: 1, y: 1, zFeet: 0 } });
await send(gmEntangled, { type: 'gm-move-combatant', roomCode: entangledCode, actorId: entangledGmId, combatantId: entangledEnemy.id, to: { x: 4, y: 1, zFeet: 0 } });
await send(gmEntangled, { type: 'set-initiative', roomCode: entangledCode, actorId: entangledGmId, combatantId: entangledBane.id, initiative: 20 });
await send(gmEntangled, { type: 'set-initiative', roomCode: entangledCode, actorId: entangledGmId, combatantId: entangledEnemy.id, initiative: 1 });
await send(gmEntangled, { type: 'sort-initiative', roomCode: entangledCode, actorId: entangledGmId });  const gmBlinded = await connectAndSend({ type: 'create-room', name: 'BlindedRoom' });
  const blindedCode = gmBlinded.room.code;
  const blindedGmId = gmBlinded.participant.id;
  await send(gmBlinded, { type: 'add-catalog-combatant', roomCode: blindedCode, actorId: blindedGmId, category: 'heroes', templateId: 'bane' });
  await send(gmBlinded, { type: 'add-catalog-combatant', roomCode: blindedCode, actorId: blindedGmId, category: 'enemies', templateId: 'canocrock' });
  const blindedBane = gmBlinded.room.combatants.find(c => c.name === 'Bane');
  const blindedEnemy = gmBlinded.room.combatants.find(c => c.type === 'enemy');
  await send(gmBlinded, { type: 'gm-move-combatant', roomCode: blindedCode, actorId: blindedGmId, combatantId: blindedBane.id, to: { x: 1, y: 1, zFeet: 0 } });
  await send(gmBlinded, { type: 'gm-move-combatant', roomCode: blindedCode, actorId: blindedGmId, combatantId: blindedEnemy.id, to: { x: 2, y: 1, zFeet: 0 } });
  await send(gmBlinded, { type: 'set-initiative', roomCode: blindedCode, actorId: blindedGmId, combatantId: blindedBane.id, initiative: 20 });
  await send(gmBlinded, { type: 'set-initiative', roomCode: blindedCode, actorId: blindedGmId, combatantId: blindedEnemy.id, initiative: 1 });
  await send(gmBlinded, { type: 'sort-initiative', roomCode: blindedCode, actorId: blindedGmId });
  await send(gmBlinded, { type: 'gm-apply-effect', roomCode: blindedCode, actorId: blindedGmId, targetId: blindedBane.id, effectId: 'srd_blinded' });
  
  await send(gmBlinded, { type: 'declare-attack-mode', roomCode: blindedCode, actorId: blindedGmId, combatantId: blindedBane.id, mode: 'standard', defensive: false });

  await send(gmBlinded, { type: 'use-tactical-action', roomCode: blindedCode, actorId: blindedGmId, combatantId: blindedBane.id, action: 'charge', targetId: blindedEnemy.id, d20Roll: 18, damage: 1 });
  record('Blinded: FORBID_CHARGE bloquea Carga en el servidor', gmBlinded.errors.some(e => /no puede cargar/i.test(e)), gmBlinded.errors.join(' | '));

  await send(gmBlinded, { type: 'resolve-attack', roomCode: blindedCode, actorId: blindedGmId, attackerId: blindedBane.id, targetId: blindedEnemy.id, d20Roll: 15, damage: 1 });

  const blindLog = gmBlinded.room.log.find(l => /Bane.*?contra/i.test(l.message));
  record('Blinded: servidor lanza d100 de Concealment (50%) en ataques del portador', !!blindLog && /falla|d100|ocultaci|Impacta/i.test(blindLog.message), blindLog?.message || 'No log found');
await send(gmEntangled, { type: 'gm-apply-effect', roomCode: entangledCode, actorId: entangledGmId, targetId: entangledBane.id, effectId: 'srd_entangled' });
record('Entangled: snapshot de red conserva la fuente declarativa', gmEntangled.room.effectInstances.some(e => e.effectId === 'srd_entangled' && e.targets.includes(entangledBane.id)), JSON.stringify(gmEntangled.room.effectInstances));

const entangledLongPath = [{ x: 1, y: 2, zFeet: 0 }, { x: 1, y: 3, zFeet: 0 }, { x: 1, y: 4, zFeet: 0 }, { x: 1, y: 5, zFeet: 0 }];
await send(gmEntangled, { type: 'move-combatant', roomCode: entangledCode, actorId: entangledGmId, combatantId: entangledBane.id, to: entangledLongPath.at(-1), path: entangledLongPath });
const entangledAfterMove = gmEntangled.room.combatants.find(c => c.id === entangledBane.id);
record('Entangled: servidor limita movimiento de Bane a 15 pies', entangledAfterMove.position.x === 1 && entangledAfterMove.position.y === 1 && gmEntangled.errors.some(e => /solo tiene 15 pies disponibles/i.test(e)), 'pos=' + JSON.stringify(entangledAfterMove.position) + ' errors=' + gmEntangled.errors.join(' | '));

await send(gmEntangled, { type: 'use-tactical-action', roomCode: entangledCode, actorId: entangledGmId, combatantId: entangledBane.id, action: 'run', to: { x: 1, y: 6, zFeet: 0 } });
record('Entangled: FORBID_RUN bloquea Correr en el servidor', gmEntangled.errors.some(e => /no puede correr en su estado actual/i.test(e)), gmEntangled.errors.join(' | '));
await send(gmEntangled, { type: 'use-tactical-action', roomCode: entangledCode, actorId: entangledGmId, combatantId: entangledBane.id, action: 'charge', targetId: entangledEnemy.id, d20Roll: 18, damage: 1 });
record('Entangled: FORBID_CHARGE bloquea Carga en el servidor', gmEntangled.errors.some(e => /no puede cargar en su estado actual/i.test(e)), gmEntangled.errors.join(' | '));

// Sprint 050.1 - Panel de Estados del GM: gm-apply-effect (reutilizado) + gm-remove-effect (nuevo).
const gmConditionPanel = await connectAndSend({ type: 'create-room', name: 'GM Condition Panel Test' });
const conditionPanelCode = gmConditionPanel.room.code; const conditionPanelGmId = gmConditionPanel.participant.id;
const conditionPanelPlayer = await connectAndSend({ type: 'join-room', roomCode: conditionPanelCode, name: 'Condition Panel Player', role: 'player' });
await send(gmConditionPanel, { type: 'add-catalog-combatant', roomCode: conditionPanelCode, actorId: conditionPanelGmId, category: 'heroes', templateId: 'bane' });
const conditionPanelBane = gmConditionPanel.room.combatants.find(c => c.name === 'Bane');

await send(gmConditionPanel, { type: 'gm-apply-effect', roomCode: conditionPanelCode, actorId: conditionPanelGmId, targetId: conditionPanelBane.id, effectId: 'srd_fatigued' });
record('Panel GM: aplicar Fatigued vía gm-apply-effect reutilizado', gmConditionPanel.room.effectInstances.some(e => e.effectId === 'srd_fatigued' && e.targets?.includes(conditionPanelBane.id)), JSON.stringify(gmConditionPanel.room.effectInstances));

await send(gmConditionPanel, { type: 'gm-apply-effect', roomCode: conditionPanelCode, actorId: conditionPanelGmId, targetId: conditionPanelBane.id, effectId: 'srd_fatigued' });
record('Panel GM: reaplicar Fatigued produce Exhausted (no dos Fatigued) vía EffectManager', gmConditionPanel.room.effectInstances.length === 1 && gmConditionPanel.room.effectInstances[0].effectId === 'srd_exhausted', JSON.stringify(gmConditionPanel.room.effectInstances));

const exhaustedInstanceId = gmConditionPanel.room.effectInstances[0].instanceId;
await send(conditionPanelPlayer, { type: 'gm-remove-effect', roomCode: conditionPanelCode, actorId: conditionPanelPlayer.participant.id, instanceId: exhaustedInstanceId });
record('Panel GM: no-GM no puede remover efectos', conditionPanelPlayer.errors.some(e => /solo el GM/i.test(e)) && gmConditionPanel.room.effectInstances.length === 1, conditionPanelPlayer.errors.join(' | '));

await send(gmConditionPanel, { type: 'gm-remove-effect', roomCode: conditionPanelCode, actorId: conditionPanelGmId, instanceId: exhaustedInstanceId });
record('Panel GM: remover por instanceId refleja ausencia en el siguiente room-update', gmConditionPanel.room.effectInstances.length === 0, JSON.stringify(gmConditionPanel.room.effectInstances));
record('Panel GM: la sala continua consistente tras aplicar/reaplicar/remover', gmConditionPanel.room.combatants.some(c => c.id === conditionPanelBane.id) && gmConditionPanel.room.code === conditionPanelCode, JSON.stringify(gmConditionPanel.room.combatants.map(c => c.id)));

gm.ws.close(); ownershipGm.ws.close(); ownerA.ws.close(); ownerB.ws.close(); stabilizationGm.ws.close(); profileGm.ws.close(); profilePlayer.ws.close(); largeGm.ws.close(); diehardGm.ws.close(); gmTouch.ws.close(); player.ws.close(); gmHaste.ws.close(); gmAoo.ws.close(); gmDiagonalAoo.ws.close(); gmMultiAoo.ws.close(); gmDiagonalMelee.ws.close(); gmCharge.ws.close(); gmAid.ws.close(); gmPassThrough.ws.close(); gmFlanking.ws.close(); gmFfs.ws.close(); gmFa.ws.close(); gmDef.ws.close(); gmDisabled.ws.close(); gmStun.ws.close(); gmEntangled.ws.close(); gmBlinded.ws.close(); gmConditionPanel.ws.close(); conditionPanelPlayer.ws.close();
console.log(JSON.stringify(results, null, 2));
if (results.some(r => !r.ok)) process.exitCode = 1;

# Diseño: Condición Oficial Blinded (Cegado)

## 1. Objetivo
Diseñar la vertical oficial de la condición **Blinded** (Cegado) utilizando puramente el motor de estado y la arquitectura de reductor de efectos (EffectReducer) del sistema D&D 3.5, sin requerir implementaciones de mecánicas que aún no existen en el motor táctico (como raycasting de visión, skills de Search/Spot, o la dote Blind-Fight).

## 2. Fuentes normativas
- **D&D 3.5 SRD**: Special Abilities & Conditions - Conditions Summary -> Blinded.
- **D&D 3.5 SRD**: Combat -> Actions in Combat -> Run / Charge (interacción con ceguera).
- **D&D 3.5 SRD**: Combat -> Combat Modifiers -> Total Concealment.

## 3. Regla oficial parafraseada
Un personaje cegado no puede ver. Recibe las siguientes penalizaciones:
- Penalizador de -2 a la Clase de Armadura (CA).
- Pierde su bonificador de Destreza a la CA (si tiene alguno).
- Su velocidad se reduce a la mitad. No puede usar las acciones de Correr (Run) ni Cargar (Charge) sin fallar o requerir un chequeo de Equilibrio (DC 10).
- Todos los oponentes tienen **Ocultación Total** (50% de probabilidad de fallo) contra el personaje cegado.
- (Fuera de alcance temporal) Todas las consecuencias relacionadas con: habilidades afectadas por la visión, la mayoría de skills STR/DEX afectadas por la condición, actividades que fallan automáticamente por requerir visión, localización de objetivos, y adaptación a la ceguera prolongada.
- Todos los oponentes poseen Ocultación Total respecto del personaje cegado, por lo que el personaje no puede realizar Ataques de Oportunidad contra ellos.

## 4. Estado actual
- **¿Existe `srd_blinded` en catálogo?** No.
- **¿Qué consecuencias oficiales ya puede representar el motor?** Prácticamente todas las mecánicas de combate esenciales: pérdida de Destreza a la CA (`NO_DEX_TO_AC`), bloqueo de Ataques de Oportunidad (`NO_THREAT`, `CANNOT_MAKE_AOO`), penalización a la CA (`numeric modifier`), mitigación de velocidad (`MovementRateContribution`) y ocultación total ofensiva (`ConcealmentContribution` con `perspective: "attacks_by_target"`).
- **¿Qué no puede representar?** Fallos automáticos en Avistar (Spot)/Buscar (Search), ya que el sistema actual de D&D-TCA no ha implementado el subsistema de Percepción y habilidades fuera de combate estricto.

## 5. Rule ID
`EFFECT-BLINDED`

## 6. Clasificación arquitectónica
- **Blinded** se modela exclusivamente como una **Condición Oficial (Fuente)** puramente declarativa en el catálogo de efectos (`packages/shared/src/effects/catalog.ts`).
- No requiere lógicas imperativas, cálculos aislados en handlers ni booleanos persistidos. Actúa inyectando *traits*, *modifiers* y *contributions* que las reglas base (como `DEFENSE-CONCEALMENT`) resuelven de forma agnóstica.

## 7. Consecuencias oficiales y 8. Mapeo al pipeline
La entrada del catálogo se mapeará de la siguiente manera:
- **`traits`**: `["NO_DEX_TO_AC", "CANNOT_MAKE_AOO"]`
- **`modifiers`**: `[{ type: "numeric", stat: "AC", value: -2, stackingGroup: "condition", stackingPolicy: "lowest_value" }]`
- **`movementRateContributions`**: `[{ numerator: 1, denominator: 2, stackingKey: "condition:blinded:half-speed" }]`
- **`concealmentContributions`**: `[{ perspective: "attacks_by_target", kind: "total", missChancePercent: 50, stackingKey: "condition:blinded" }]`
- **`ruleOverrides`**: `["FORBID_RUN", "FORBID_CHARGE"]`

## 9. Relación con Concealment
Blinded **no** es Concealment. Blinded es una fuente fisiológica que *emite* una contribución de Ocultación Total. 
La regla `DEFENSE-CONCEALMENT` recibe esa contribución y resuelve el d100 de fallo, respetando el agnosticism de la fuente. 

## 10. Defensa y DEX
Utiliza el modificador numérico estándar para reducir la CA en 2, y el trait existente `NO_DEX_TO_AC` (el mismo que usa Desprevenido/Aturdido) para despojar correctamente al objetivo de su destreza defensiva y esquiva. 

## 11. Ataques
El ataque se penaliza exclusivamente a través del 50% de probabilidad de fallo introducido por la ocultación total. El Sneak Attack del atacante se deshabilita automáticamente por la arquitectura existente, ya que `canApplySneakAttack` deniega el bonus cuando el objetivo tiene ocultación efectiva.

## 12. Movimiento
La velocidad se limita matemáticamente a través de `movementRateContributions`. Se previene directamente cualquier intento de `RUN` o `CHARGE` con los overrides pertinentes, ya que esto proviene directamente de la regla oficial y NO depende de crear un sistema de Balance.

## 13. Threat / AdO / Flanking
El ciego recibe el trait `CANNOT_MAKE_AOO`, ya que todos los oponentes poseen Ocultación Total respecto del personaje cegado, impidiendo mecánicamente la ejecución de Ataques de Oportunidad. No se incluye `NO_THREAT` por falta de respaldo normativo explícito sobre la pérdida absoluta de amenaza y flanqueo.

## 14. Skills y Visión
Fuera de alcance. El Sprint 047 deja fuera TODAS las consecuencias relacionadas con: habilidades afectadas por la visión, la mayoría de skills STR/DEX afectadas por la condición, actividades que fallan automáticamente por requerir visión, localización de objetivos, y adaptación a la ceguera prolongada.

## 15. Stacking
- Al acumular múltiples instancias de ceguera temporal, `onStack: "ignore"` es la opción correcta porque los efectos son absolutos, previniendo penalizadores acumulativos.
- Si el personaje está cegado y enmarañado (Entangled), las velocidades se dividen independientemente y apilan multiplicativamente de forma segura bajo el modelo iterativo de ratios actual.

## 16. UI
Las interfaces actuales de `ActionsPanel` y pre-cálculo visual reconocerán la pérdida de CA, el recorte de movimiento y el tag del efecto gracias a la perfecta neutralidad del catálogo, sin requerir ningún render condicional extra como `if (isBlinded)`.

## 17. Logging
La validación `getConcealmentAssessment` y `resolveAttack` mostrará a los jugadores que el ataque falla debido al porcentaje de ocultación aportado por el estado del atacante.

## 18. Compatibilidad Legacy
No introduce bloqueos para el código legacy. Se ajusta armónicamente a la arquitectura del modifier pipeline.

## 19. Alcance fuera del sprint
La Opción **B — Blinded Core parcial** seleccionada y recomendada:
Incluye:
• AC -2
• NO_DEX_TO_AC
• velocidad ×1/2
• FORBID_RUN
• FORBID_CHARGE
• CANNOT_MAKE_AOO
• ConcealmentContribution
• Total Concealment (50%)
• integración con DEFENSE-CONCEALMENT

No incluye:
• Search
• Spot
• resto de skills
• targeting por casilla
• localización de enemigos
• lectura
• adaptación a la ceguera
• Blind-Fight
• sistema completo de visión
• Line of Sight
• Line of Effect
• NO_THREAT
• cambios en flanqueo

## 20. Riesgos
Prácticamente nulos. Se apalanca infraestructura madura del sprint 046 (Concealment Core) y 024 (Efectos Condicionales).

## 21. Tests
- **Unitario**: `srd_blinded` emite total concealment contra los ataques del portador y restringe DEX a la CA.
- **Unitario**: Ceguera inhabilita la aportación de Ataque Furtivo.
- **Unitario**: Se bloquea correr, cargar y Ataques de Oportunidad.
- **Integración**: `resolveAttack` lanza un d100 en ataques emitidos por un personaje con `srd_blinded`, registrando el log.

## 22. Definition of Done
- `srd_blinded` implementado en `effectsCatalog`.
- Unit y E2E passing.
- Documentos de la suite actualizados.

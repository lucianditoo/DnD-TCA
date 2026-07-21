# Informe de Auditoría Normativa: Brechas y Discrepancias PHB 3.5 vs `combat/`

**Tipo de documento**: Auditoría de fidelidad literal de la carpeta normativa `combat/` (archivos 01-13) frente al Capítulo 8: Combate del Manual del Jugador 3.5. Documento puramente analítico — no modifica los archivos auditados ni ningún código; las enmiendas propuestas en la Sección 4 requieren su propio ciclo NDD → `Proceed`.

**Nota de versión**: este archivo contenía previamente un "Registro de Divergencias del Motor de Combate" (motor vs reglas, de fases tempranas del proyecto). Ese registro se conserva íntegro como **Apéndice A**, con anotaciones de vigencia — la mayoría de sus filas fueron resueltas por sprints posteriores. El cuerpo principal del documento es ahora la auditoría corpus-vs-manual solicitada.

**Método**: lectura íntegra de los 13 archivos (1.491 líneas totales, más `14_resumen_de_reglas.txt`, que existe pero queda fuera del rango 01-13 indexado) y cruce contra las reglas oficiales del capítulo (págs. 133-160 del PHB 3.5 en español, según las referencias de página del propio texto).

---

## 1. Resumen Ejecutivo de la Auditoría

La carpeta `combat/` es, en esencia, una **transcripción casi literal (vía OCR) del Capítulo 8 en español**, no una reformulación local de reglas. Esto es una excelente noticia para la fidelidad: el contenido normativo coincide con el manual en la abrumadora mayoría de mecánicas — límite de 1 AdO por asalto salvo Reflejos de Combate, diagonales 1-2-1-2, corte de esquinas, terreno difícil ×2 (×3 en diagonal), CA de toque, críticos con confirmación, presa completa con sus 4 pasos, expulsión con Tabla 8-9, y la economía moribundo/estabilización -1 a -9 con 10% por asalto.

El componente más afectado **no es ninguna pila de reglas concreta, sino la integridad editorial del corpus**: los archivos contienen duplicación masiva de bloques (el archivo 09 es ~95% contenido repetido de 01/07/08; el 06 duplica 03+05; el 12 duplica la mitad del 04; el 13 duplica bloques de 03/06), y esa duplicación ya ha producido la única contradicción normativa grave detectada: el archivo 13 se contradice **a sí mismo** sobre la economía de acciones a 0 PG (ver D-01). En un corpus con N copias de cada regla, cada corrección futura debe aplicarse N veces o el corpus diverge — exactamente el antipatrón que `.ai/coverage/V1_LAUNCH_MANIFESTO.md` prohíbe en código ("una regla, una fuente"), reproducido en la capa documental.

En segundo lugar, el corpus tiene **brechas por referencia**: las reglas transcritas citan mecánicas de otras páginas del manual ("consulta la pág. X") que nunca fueron transcritas, y varias tienen impacto directo en el mapa táctico (progresión de ataques iterativos, Piruetas para evitar AdO, línea de efecto, impedimenta).

Balance de hallazgos: **1 discrepancia bloqueante, 3 desviaciones, 6 notas** (Sección 2) y **8 gaps** (Sección 3).

---

## 2. Matriz de Discrepancias Detectadas

| ID | Archivo Local | Sección / Mecánica | Regla en `combat/` | Regla Oficial PHB 3.5 | Severidad |
|---|---|---|---|---|---|
| D-01 | `13_heridas_y_muerte.txt` (línea 21) | Incapacitado (0 PG) | "Sólo puedes realizar una acción de movimiento o una acción estándar por turno, y sufrirás 1 punto de daño después de completar **cada acción**." | A 0 PG solo las acciones **extenuantes** (estándar y equivalentes) infligen 1 punto de daño; las acciones de movimiento NO dañan (pág. 145). El propio archivo 13 lo dice correctamente más abajo (línea 48: "Puedes realizar acciones de movimiento sin causarte más daño"). El resumen y el detalle del mismo archivo se contradicen; el motor (Sprint 025-R, economía Disabled de `lifeRules`) implementa la versión correcta. | **Bloqueante para V1.0** (contradicción interna en la fuente normativa; riesgo de que un sprint futuro "corrija" el motor contra la línea equivocada) |
| D-02 | `10_modificadores_de_combate.txt` (línea 101) | Ocultación total | "si tienes una línea de efecto hasta un objetivo, pero no línea visual... se considera que tiene **cobertura total** respecto a ti" | La condición descrita es **ocultación total** (pág. 152). Cobertura total es otra mecánica (línea 88 del mismo archivo, correctamente descrita) con consecuencias distintas: ocultación total permite atacar la casilla con 50% de fallo; cobertura total prohíbe atacar. El resto del párrafo aplica las consecuencias correctas de ocultación — el error es solo de etiqueta, pero cruza dos mecánicas distintas en una carpeta normativa. | Desviación |
| D-03 | `02_como_funciona_el_combate.txt` (línea 8) vs `04_iniciativa.txt` (línea 14) | Asalto de sorpresa — acciones permitidas | 02: "podrá realizar una acción (**estándar o de movimiento**)". 04: "tendrá derecho a realizar una **acción estándar**". | El PHB (pág. 138) dice "una acción estándar" (sustituible por una de movimiento por la regla general de sustitución, también transcrita). Ambas redacciones son defendibles por separado, pero el corpus enuncia la misma regla de dos formas en dos archivos — divergencia editorial dentro de la fuente de verdad. | Desviación (interna) |
| D-04 | `03_estadisticas_de_combate.txt` (líneas 37, 43) y duplicados en `06`/`13` | Fórmula de CA | "10 + bonificador de armadura + bonificador de escudo + modificador de Destreza + modificador de tamaño" | La fórmula oficial completa añade armadura natural, desvío y esquiva (págs. 134-135). El texto SÍ los cubre después bajo "Otros modificadores" (líneas 50-54), igual que el manual — no hay contradicción, pero la fórmula-resumen aparece 3 veces y la ampliada solo 1, invirtiendo el peso editorial del original. El motor (`Rules.totalArmorClass` + `IntrinsicDefense`) implementa la fórmula completa. | Desviación (de énfasis, no de contenido) |
| D-05 | `01` (línea 30), `07` (línea 70), `09` (línea 46) | Alcance natural de criaturas muy pequeñas | "normalmente tienen un alcance natural de **o'**" | "0'" — corrupción de OCR (letra o por cero), repetida en las tres copias del bloque. Sentido recuperable, pero es un valor numérico corrupto. | Nota |
| D-06 | `10_modificadores_de_combate.txt` (línea 93) | Golpe de gracia | Párrafo termina en "...y otra para darle el golpe de gracia). **L**" | Texto truncado por OCR (la "L" es el arranque de una línea perdida). El contenido previo es fiel al manual (pág. 153). | Nota |
| D-07 | Todos los archivos | Erratas de OCR sistémicas | "quiequiere decir" (×6), "res ponderán", "ccuales", "sindemostrar", "Cuandote", "Jocupada", "unun", palabras partidas ("obstaculi zado") | Texto oficial sin erratas. Ninguna altera el valor de una regla (salvo D-05/D-06, ya listadas), pero degradan la fuente normativa. | Nota |
| D-08 | `01`, `03`, `07`, `09` | Tabla 8-4 (Tamaño y escala) | La tabla completa aparece **cuatro veces** (una copia por archivo). | El manual la imprime una vez (pág. 149). Cuatro copias = cuatro puntos de divergencia futura. Hoy las cuatro son idénticas. | Nota (deuda estructural) |
| D-09 | `05`, `06` (duplicado), `08` | Tabla 8-2 (Acciones en el combate) | Aparece tres veces completa. | Impresa una vez (pág. 141). Mismas implicaciones que D-08; hoy las tres copias son idénticas. | Nota (deuda estructural) |
| D-10 | `00_indice.txt` | Índice | Indexa 01-14, pero el rango canónico tratado como normativo es 01-13; `14_resumen_de_reglas.txt` existe con checklist propia. | — (gobernanza local, no del manual). Falta decidir formalmente si el 14 es normativo o auxiliar. | Nota |
| D-11 | `06_ataques.txt` (línea 58) y copia en `10_modificadores_de_combate.txt` (línea 12) | Enzarzado en cuerpo a cuerpo (disparar a melé) | "Dos personajes están enzarzados... cuando son enemigos y están **amenazándose mutuamente**" | RAW inglés: *"are enemies of each other and **either** threatens the other"* — basta una dirección de amenaza. La formulación mutua del corpus anularía el penalizador -4 en el caso arquetípico (arquero enemigo trabado por un espadachín aliado: amenaza unilateral). El motor implementa la formulación RAW correcta (Sprint ATK-RANGED-INTO-MELEE, `getRangedIntoMeleeAssessment`, test T3); el corpus queda pendiente de enmienda (E-10). | Desviación (traducción) |

**Nota de cierre (Sprint 042.5, 2026-07-18)**: la auditoría de baseline global encontró que `tests/sprint011.test.mjs` ("Ray of Frost nunca recibe el +2...") seguía fallando desde que `ATK-RANGED-INTO-MELEE` se integró, porque el test (anterior a esa regla) esperaba los números de antes de que el penalizador -4 existiera. Confirmada la trazabilidad completa (Manual → `combat/06_ataques.txt:58` → esta fila D-11 → `docs/rules/registry.md` → `getRangedIntoMeleeAssessment` → test), se corrigió únicamente el test — el motor y esta fila ya eran correctos.

**Verificaciones que PASARON sin discrepancia** (auditadas y conformes): límite de 1 AdO/asalto + Reflejos de Combate = 1 + mod(Des) (`08`, líneas 5 y 17 — coincide con `rules.ts:516`); AdO a bonificador completo; diagonales 1-2-1-2 y prohibición de cortar esquinas con permiso explícito de pasar en diagonal junto a criaturas (coincide con la corrección del Sprint 037); terreno difícil ×2/×3 y prohibición de correr/cargar; escurrirse -4/-4 (coincide con `srd_squeezing`); CA de toque que ignora armadura/escudo/natural y conserva Des/tamaño/desvío (coincide con `targetAcType: "touch"`); crítico con confirmación y excepción de dados extra no multiplicados; daño masivo (50+, Fort CD 15); daño no letal (grogui/inconsciente); carga (+2/-2, mínimo 10 ft, camino despejado); retirada (casilla inicial no amenazada); paso de 5'; flanqueo por línea entre centros con excepción multicasilla (coincide con Sprints 025-A/027); cobertura +4 esquina-a-esquinas y cobertura blanda sin bono a Reflejos; ocultación 20%/50%; presa completa (modificador especial de tamaño, 4 pasos, acciones en presa — coincide con Sprints 029/030); derribo/desarme/embestida/arrollar/romper arma; expulsión con Tabla 8-9; retrasar/preparar acción con reanclaje de iniciativa; moribundo -1/-9 con 10% (coincide con Sprint 021); combate con dos armas (Tabla 8-8: -6/-10, -4/-8, -4/-4, -2/-2).

---

## 3. Gaps Críticos de Mecánicas Omitidas

| ID | Mecánica omitida | Dónde la cita el corpus sin transcribirla | Impacto táctico |
|---|---|---|---|
| G-01 | **Progresión de ataques iterativos** (+6/+1, +11/+6/+1, +16/+11/+6/+1) | `05`/`07`: "ataque completo... por orden de mayor a menor bonificador", sin la progresión -5 ni los umbrales de BAB | Base numérica exacta de `getAttackRoutine`/`getEffectiveAttackRoutine` (Sprints 036/038). El motor la implementa; la carpeta normativa no la respalda. **El gap más crítico.** |
| G-02 | **Piruetas (Tumble) para evitar AdO** (CD 15 media velocidad por casillas amenazadas; CD 25 a través del espacio de un enemigo) | `01`/`07`/`09`: "consulta la habilidad Piruetas, en la pág. 79" | Única contramedida de habilidad contra AdO por movimiento; sin ella el subsistema de AdO del corpus está incompleto. |
| G-03 | **Línea de efecto** (definición formal, pág. 176) | `11` (expulsión): "necesitas tener línea de efecto"; implícita en cobertura total | La geometría de cobertura/AoE del motor (Sprints 013/033) necesita la distinción visual-vs-efecto para conjuros que doblan esquinas. |
| G-04 | **Impedimenta / carga transportable** (pág. 161: carga ligera/media/pesada, efecto en velocidad y Des máxima) | `07`/`09`/`10`: "consulta 'Carga transportable', pág. 161" | Modificaría velocidad táctica y CA; ni el motor ni el corpus lo modelan. |
| G-05 | **Definiciones formales de las condiciones citadas en Tablas 8-5/8-6** (deslumbrado, enmarañado, estremecido/asustado, cegado, gateando) | Las tablas las usan como filas sin definir su semántica completa | El motor ya define varias (`srd_stunned`, `srd_dazed`, `srd_prone`, `srd_fatigued`...); las restantes (Entangled, Blinded, Dazzled, Shaken) figuran en "Falta" de `PROJECT_STATUS.md` sin respaldo normativo local. |
| G-06 | **CD de salvación de conjuros** (10 + nivel del conjuro + modificador de característica) | `03` da la CD como "viene determinada por el propio ataque" con dos ejemplos sueltos | El pipeline de salvaciones (Sprint 024) y `SpellDefinition` usan CD fija por conjuro sin fórmula normativa transcrita. (Estrictamente Cap. 10, pero el Cap. 8 la usa en cada ejemplo.) |
| G-07 | **Diagramas del capítulo** (flanqueo, cobertura, alcance de criaturas Grandes) | Perdidos en la transcripción a texto plano | Los diagramas resuelven los casos ambiguos exactos (esquinas de flanqueo, casilla no amenazada por lanza larga) que más disputas generan; solo sobrevive la prosa. |
| G-08 | **Caídas/asfixia/entornos y daño de característica** | `13` los remite a la GDM — fiel al manual, que hace lo mismo | No es un gap de fidelidad sino un límite heredado del propio capítulo; se registra para que nadie los busque aquí. |

Los cuatro ejemplos de gap sugeridos por la instrucción de auditoría fueron verificados y resultaron **estar cubiertos**: cobertura para criaturas de distintos tamaños (`10`, línea 87), ocultación por sombras (`10`, línea 98), penalizador -4 por disparar al cuerpo a cuerpo sin Disparo Preciso (`06` línea 58, `10` línea 12) y posición elevada +1 (`10`, Tabla 8-5). No se registran como gaps.

---

## 4. Recomendaciones de Enmienda para el Backlog (Sprint de Saneamiento)

Acciones documentales atómicas, alineadas con la filosofía declarativa V6 ("una regla, una fuente"; los archivos de texto son datos normativos puros, el motor es el único ejecutor):

1. **E-01 (corrige D-01, prioridad máxima)**: en `13_heridas_y_muerte.txt`, reescribir la línea-resumen de 0 PG para que coincida con su propia sección detallada y con el manual (el punto de daño se sufre solo tras acciones estándar/extenuantes). Una línea; el motor no se toca (ya es correcto).
2. **E-02 (corrige D-02)**: en `10_modificadores_de_combate.txt`, sustituir "cobertura total" por "ocultación total" en la línea 101. Una palabra.
3. **E-03 (corrige D-03)**: unificar la redacción del asalto de sorpresa en `02` y `04` a la fórmula RAW, eligiendo **un** archivo como dueño de la regla y dejando en el otro una referencia cruzada.
4. **E-04 (corrige D-08/D-09 y la deuda estructural)**: desduplicar el corpus — cada tabla y bloque de reglas vive en exactamente un archivo (el temáticamente correcto según `00_indice.txt`); los demás lo referencian, no lo copian. `09_posicionamiento.txt` quedaría casi vacío tras la desduplicación y debería reescribirse con el contenido de posicionamiento que hoy no tiene dueño (ocupación, adyacencia, espacio).
5. **E-05 (cierra G-01)**: transcribir la progresión oficial de ataques iterativos por BAB en `06_ataques.txt`, como respaldo normativo de `getAttackRoutine` y del Sprint 038 pendiente.
6. **E-06 (cierra G-02/G-03/G-04)**: añadir `15_reglas_referenciadas.txt` con las tres transcripciones faltantes citadas por el propio corpus: Piruetas anti-AdO, línea de efecto e impedimenta.
7. **E-07 (cierra G-05)**: añadir un glosario de condiciones con las definiciones formales, anotando junto a cada una el ID del catálogo del motor cuando exista (`srd_stunned`, ...) y "SIN IMPLEMENTAR" cuando no — enlazando el corpus con `.ai/coverage/`.
8. **E-08 (corrige D-05/D-06/D-07)**: pasada única de saneamiento de OCR (erratas de D-07, "o'" → "0'" de D-05, restauración de la línea truncada de D-06 desde el manual).
9. **E-09 (resuelve D-10)**: documentar en `00_indice.txt` el estatus de `14_resumen_de_reglas.txt` (normativo o auxiliar).

Ninguna enmienda toca código TypeScript ni esquemas Zod; todas son ediciones de `.txt`/`.md`. Aun así, la ejecución del Sprint de Saneamiento debe entrar por el flujo normal (plan → revisión → `Proceed`) porque altera la fuente normativa contra la que se validan los sprints de reglas.

---

## Cierre

Discrepancias críticas mapeadas: **1 bloqueante (D-01)**, 4 desviaciones (D-02, D-03, D-04, D-11), 6 notas (D-05 a D-10), 8 gaps (G-01 a G-08). Fidelidad global del corpus: alta en contenido, frágil en estructura — el riesgo dominante no es lo que dice, sino cuántas veces lo dice.

---

## Apéndice A — Registro histórico de Divergencias del Motor (preservado, con vigencia anotada)

Contenido previo de este archivo (fases tempranas), conservado porque no existe control de versiones en esta carpeta. Columna "Vigencia 2026-07" añadida por esta auditoría.

| Rule ID | Regla Normativa | Comportamiento registrado entonces | Tipo | Vigencia 2026-07 |
|---------|-----------------|-----------------------------------|------|------------------|
| `MOVE-02` | Atravesar enemigos conscientes posible vía Piruetas/Arrollar. | El motor rechazaba toda ruta a través de un enemigo consciente. | Simplificación Deliberada | **Vigente** — sigue sin sistema de Habilidades/Tumble (ver G-02 de esta auditoría). |
| `SP-02` | La carga no es detenida por criaturas indefensas. | `chargeResolver.ts (isCellOccupied)` rechazaba la carga con cualquier criatura en ruta. | Posible Bug / Simplificación | **Sin re-verificar en esta auditoría** — pendiente de confirmación en el código actual antes de darla por resuelta. |
| `AOO-03` | Límite de 1 AdO por ronda salvo Reflejos de Combate. | El servidor no limitaba AdO por ronda. | Bug | **CERRADA (verificación en código, 2026-07-17)** — `rules.ts:515-521` aplica `maxAooAllowed = 1` (o `1 + max(0, mod(Des))` con `srd_combat_reflexes`) y rechaza si `opportunityAttacksThisRound >= maxAooAllowed`; el servidor incrementa el contador en `attackCommands.ts:204,223,377` y lo reinicia por ronda (Sprint 032, `roundTickListener`), con restricción de objetivo único (`targetsAttackedThisRoundViaAoO`, DT-007). Deuda residual saldada: `tests/aoo-limit-regression.test.mjs` (Sprint ATK-RANGED-INTO-MELEE) fija el invariante — límite base, `1+mod(Des)` con dote, reinicio de contador y DT-007. **Fila cerrada por completo.** |
| `POS-02` | Criaturas Grandes ocupan 10ft+ con alcance acorde. | Footprint 1×1 en colisiones/flanqueo. | Simplificación Deliberada | **Resuelta** — footprints multicasilla, flanqueo y AdO multiposición (Sprints 025-A/027/028). |
| `ATK-REFLEXES` | AdO provocados por conjurar, disparar, levantarse, beber, etc. | Solo el movimiento provocaba. | Incompleto | **Resuelta en gran parte** — oráculo `actionProvokesOpportunityAttack` e interrupción transaccional para conjuros y armas a distancia (Sprint 032); acciones menores (beber poción, etc.) siguen pendientes de catálogo. |
| `FLAT-FOOTED` | Desprevenido al inicio del combate, sin Des a la CA. | CA completa en todo momento. | Simplificación Deliberada | **Resuelta** — `srd_flat_footed` en `effects/catalog.ts` + CA desglosada con Touch AC. |
| `COND-02` | Moribundo pierde 1 PG por ronda. | Sin sangrado automático por ronda. | Incompleto | **Resuelta** — Global Round Tracker & Bleeding (Sprint 021). |
| `EFFECT-STUNNED` | Aturdido suelta objetos, no actúa, -2 CA, pierde Des. | Stunned parcial sin soltar objetos. | Incompleto | **Parcialmente vigente** — inventario V5 existe (Sprint 026), pero el "soltar objetos sostenidos" al quedar aturdido sigue sin implementarse. |

# Walkthrough — D-1B-I9 Design: Withdraw Normative Preview Parity

Responsabilidad: evidencia de auditoría, decisiones y alcance documental I9.
Autoridad: registro; integración en [NDD Capítulo 11](docs/designs/normative-movement-design.md#capítulo-11--i9-withdraw-normative-preview-parity), reglas propias en [Withdraw Rev. 3](docs/designs/withdraw/design.md).
Lifecycle: Rotativo.
Reemplaza: walkthrough I8 ejecutado, conservado en Git.
Complementa: [plan propuesto único](docs/designs/normative-movement-design.md#118-plan-de-implementación-propuesto--único-plan-activo-i9), [estado](PROJECT_STATUS.md), [pendientes](TODO.md), [índice](INDEX.md).
Consumidores: Architecture Reviewer y agentes que implementarán solo tras Proceed específico.

## Baseline y auditoría

Baseline limpio master/origin/master `791fb4bacfe82bddb1bc3af1324de2e9b74e622b`. I6/I7 aprobados; I8 TECHNICALLY APPROVED tras I8R1 según el owner. Windows CI del código I8 SUCCESS sobre af60111; I8R1 fue documental. Esta entrega es diseño únicamente: ningún código/test productivo modificado ni suite técnica ejecutada.

Inspeccionados movementPreview, useBoardSelection, viewModel, App, ActionsPanel/summary, presentationModel, Board y TacticalScene3D; referencia real handleWithdraw I8 y contratos de Resolution/Cost/Commit/Route/rules. Releídos puntos pertinentes de tests Withdraw/I7 y del WebSocket real. Inventario de call sites y responsabilidades en NDD §11.2.

Confirmado legacy-withdraw: el hook no crea proyección/candidatos; calcula total/pasos legacy y llama getHighlightedCells. viewModel usa factor ×2/×1 y budget residual, escanea tablero y valida vía isLegalNextPathStep/validateMovePath. App preserva altura y permite editar estados inválidos solo para ordinary, reancla destino Withdraw con otro helper y su rama de envío retorna antes del guard ordinary. El panel anuncia full-round ×2 incondicionalmente, aunque el rango legacy contempla Disabled ×1. La presentación ya admite la misma evidencia de proyección; su variable ordinary en realidad indica que hay una proyección normativa.

## Decisiones cerradas

Opción B: buildWithdrawMovementPreview separado y privados comunes mínimos de proyección/estructura/vecinos, sin framework de acciones ni llamar ordinary para corregir luego su budget. Mismo MovementPreviewProjection con reasonSource en illegal; disponibilidad/variante separadas. Budget total ×2/×1 del snapshot y gates Disabled reales, contador diagonal real y false fijo para isAcrobatic.

Thin V1 policy web solo después de ready, basada en steps occupiedCells y huellas shared de otros, sin geometría nueva ni reanclado. Riesgo de drift con servidor reconocido y mitigado por tests futuros contra handler I8 real independiente, incluidos helpless/Large no-anchor/dead/aliado y precedencia. Si resolver devuelve insufficient-budget no se ejecuta V1, igual que I8: UI muestra exceso y policy no completada, no falsa Retirada legal. Illegal no fabrica coste/steps/prefijo.

Con gasto previo, acción bloqueada separadamente de la ruta; nunca budget residual ficticio. Se puede mantener un draft diagnóstico con límite completo hipotético claramente etiquetado, sin Disponible/Quedarían ni confirmación. Variante normal full-round ×2 vs limitada estándar ×1 (incluido Diehard), esfuerzo solo servidor. No predictor AdO: texto de huella inicial completa exenta y provocación posterior posible; sin Tumble/CD25/CD15 ni isAcrobatic wire.

Wiring/kind withdraw y máximo ocho candidatos desde draft/origen, altura I7 preservada; una proyección para panel/ambos renderers, sin token/effect/context mutation ni reglas por cámara. Confirmación Withdraw incorpora guard propio antes del mismo Intent; resets de familia/actor/turno y recomposición de mismo actor ante room-update se distinguen. Stale N→N+1 siempre resuelto por servidor.

Nivel futuro B solo web/tests/docs sobre contratos vigentes; shared/reglas/server requerirían C y contratos/infraestructura D con nueva Review. Fase 3 de .agents/AGENTS.md permite omitir plan separado para A/B y el owner condiciona el root a que sea obligatorio: se conserva el plan completo único en §11.8, pendiente de aprobación; root implementation_plan.md permanece ausente. No se reabren planes ejecutados I7/I8. Matriz de paridad y E2E A…F en §11.7; 22 preguntas respondidas en §11.9. Cero ODR bloqueantes, ninguna autoaprobación.

## DoD documental

Solo cinco Markdown: NDD existente, PROJECT_STATUS, TODO, INDEX y este walkthrough, cada uno según su responsabilidad. Withdraw NDD sigue propietario de V1; no se duplica allí Movement Cost. master-coverage, Registry, tests, scripts y código permanecen intactos; no nuevas afirmaciones de cobertura/CI ejecutados en esta entrega.

Verificados antes del commit: diff check, enlaces/anchors locales, SSOT, auditoría real, un solo plan propuesto pendiente de Proceed, scope solo Markdown y ausencia de root plan duplicado/unrelated. Commit documental único y push origin/master; CI técnico no requerido.

Awaiting Architecture Review and Proceed.

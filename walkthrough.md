# Walkthrough — D-1B-I7 Design: Normative Movement Preview Parity

Responsabilidad: registrar auditoría real, decisiones y alcance documental de I7.
Autoridad: registro; el contrato vive únicamente en [NDD D-1B Capítulo 9](docs/designs/normative-movement-design.md#capítulo-9--i7-normative-movement-preview-parity).
Lifecycle: Rotativo.
Reemplaza: walkthrough I6, conservado en Git.
Complementa: [plan activo](implementation_plan.md), [estado](PROJECT_STATUS.md), [pendientes](TODO.md).
Consumidores: Architecture Reviewer y agentes que implementarán tras Proceed.

## Auditoría y decisiones

Baseline limpio en master: 650f22dd514fac56b033acb6e937b3aabe5cdc3d, coincidente con origin/master. I6 técnicamente aprobado por Architecture Review externa según el owner. Auditoría de apps/web y helpers shared, localizada en NDD §9.2: un cuerpo de costes legacy en shared, cinco llamadas web de coste, una validación web, tres expresiones de presupuesto/rango y cero consumidor web de resolver/contador/Tumble. Dos renderers comparten BoardPresentationModel; SelectedInfo presenta speed shared y no coste de ruta. No tablero mobile/companion separado ni nuevo protocolo necesario.

Diseño selecciona resolver puro directamente y adapter web presentacional; snapshot recibido contiene todos los inputs. States distinguen legal/exceso/illegal/empty/unavailable; sin prefix inventado ni Commit. Eje y huellas vienen de shared; Tumble es intención y CD25 contingencia, sin RNG/AoO cliente nuevo. Matriz RAW no se duplica ni rediseña.

La auditoría cerró dos riesgos de autoría: endpoint enemigo bloquea hoy construir tránsito CD25 y 5ft comparte draft/botón con ordinary. NDD §9.6 define draft inválido corregible y previewKind explícito, con selector local 5ft que conserva pipeline/comando legacy. Over-budget se muestra íntegro, confirmación ordinaria bloqueada. Props y fuentes se separan para no migrar Withdraw/Run/Charge/forced/preparation. Celdas del grid actual usan z=0: autoría ordinary preservará altura del actor sin introducir movimiento vertical.

Implementación futura estrictamente apps/web consumiendo APIs existentes: Nivel B; cambios shared/contratos/protocolo/server requieren reclasificación C/D fuera del plan seleccionado. Esta entrega no es Proceed y espera Review/Proceed explícitos. Las doce preguntas de diseño quedan respondidas en NDD §9.8; ningún ODR bloqueante permanece abierto.

## Verificación documental

NDD único ampliado, plan temporal en raíz e INDEX actualizado; plan I6 ejecutado conservado como referencia. PROJECT_STATUS refleja aprobación I6 y diseño I7; TODO contiene solo próximos pasos. Estrategia futura cubre paridad/no mutation/budget/axis/Tumble, ambos renderers, staleness, payload y regresiones. Sin tests implementados/ejecutados ni nuevas afirmaciones de cobertura: master-coverage y Registry permanecen intactos.

DoD de esta entrega: diff check, enlaces y anchors locales, SSOT, contenido auditado y diff únicamente Markdown verificados antes de commit. No código productivo, shared TS, servidor, UI ni tests modificados.

Awaiting Architecture Review and Proceed.

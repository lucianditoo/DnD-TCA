# Walkthrough — Saneamiento documental posterior a D-1B-I5

Responsabilidad: Registrar el saneamiento ejecutado y su validación documental.
Autoridad: Registro
Lifecycle: Rotativo
Reemplaza: Walkthrough de I5, conservado en Git.
Complementa: [PROJECT_STATUS.md](PROJECT_STATUS.md), [INDEX.md](INDEX.md)
Consumidores: Siguiente agente y revisión del cambio documental.

## Alcance y baseline

Cambio Nivel A, autorizado por el propietario. Baseline de código auditada:
`6dc34f2823824a3fcf523790b2a19538bc19fe29` (D-1B-I5), publicada en master con
[Windows CI #67 verde](https://github.com/lucianditoo/DnD-TCA/actions/runs/30756609816).
No se cambia código, tests, Rule IDs ni decisiones normativas de los NDD.
Este saneamiento no aprueba I5 ni inicia otro sprint funcional.

## Cambios

- Estado distingue I1/I3 integrados de I2/I4/I5 y sus consumidores pendientes.
- TODO conserva acciones pendientes; ROADMAP distingue contratos existentes,
  hitos por diseñar y antecedentes que requieren revalidación.
- INDEX apunta a los siete capítulos de D-1B y localiza el MVP histórico.
- Master coverage incorpora evidencia de I1–I5 y distingue baseline actual
  de cortes históricos; no presenta los conteos como una ejecución local nueva.
- Registry conserva todas sus Rule IDs y estados, corrigiendo notas antiguas
  de Concealment y referencias de planificación de ATTACK-FULL.
- El manifiesto reconoce los cuatro inventarios PHB. RULES corrige anotaciones
  verificadas de Cover/LoE/Concealment, movimiento e indefensión/Golpe de Gracia.
- RULES_ENGINE y WORKFLOW se reducen a responsabilidades y referencias;
  CODEX_GUIDE elimina su tabla duplicada. No se crea una nueva jerarquía documental.
- `docs/designs/combat-engine-mvp.md` pasa a
  [docs/archive/combat-engine-mvp.md](docs/archive/combat-engine-mvp.md):
  cuerpo histórico conservado, cabecera de supersesión explícita y referencias
  activas actualizadas. No se eliminan NDD vigentes ni inventarios temáticos.
- DT-023 registra lo resuelto y mantiene explícitamente lo todavía pendiente.

## Preservación del trabajo local

El rótulo local «COMPLETADO» no estaba respaldado por un gate de DnD-TCA.
El walkthrough local contenía notas de otro proyecto. Con aprobación expresa
del propietario se preservó una copia byte a byte fuera del repositorio,
verificada por SHA-256, antes de reemplazarlo. Ese contenido ajeno no se publica.
`test.txt` y `.claude/` permanecen intactos y fuera del staging/commit;
no se abrió ni leyó `.claude/settings.local.json`.

## Validación

- Validador documental en memoria: 15 documentos y 160 enlaces locales
  comprobados, sin archivos ni anclas faltantes.
- Preservación del cuerpo del MVP archivado y ausencia de referencias
  activas a la ruta retirada, salvo esta explicación de la migración.
- 54 filas del Registry comparadas contra HEAD: Rule ID, nombre y estado
  sin cambios.
- `git diff --check` correcto y revisión del diff exclusivamente documental.
- DoD local reducido de Nivel A (GOVERNANCE §5.2): no se vuelve a ejecutar
  la suite completa localmente; Windows CI corre sobre el commit publicado.

## Continuidad

El siguiente paso funcional requiere el gate arquitectónico de I5 y la
resolución de las decisiones abiertas que afecten su integración. No se da
Proceed implícito a Publication, comandos, preview, renderer ni UI.
El saneamiento no modifica D-1B-C3-01 ni cierra ODR-D1B-I5-1.

READY FOR ARCHITECTURE REVIEW

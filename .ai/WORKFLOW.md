# WORKFLOW — Navegación del flujo oficial

Responsabilidad: Localizar el proceso obligatorio sin mantener una copia.
Autoridad: Derivada
Lifecycle: Permanente
Reemplaza: —
Complementa: [Índice documental](../INDEX.md)
Consumidores: Agentes que buscan el Reader Pipeline y el gate de cierre.

## Fuentes del proceso

- [GOVERNANCE.md](../GOVERNANCE.md): principios, niveles de cambio y política documental.
- [.agents/AGENTS.md](../.agents/AGENTS.md): Reader Pipeline, fases, aprobación y Definition of Done.
- [INDEX.md](../INDEX.md): ubicación única de las responsabilidades documentales.

No se mantienen aquí otras fases, listas de archivos obligatorios o
excepciones de validación. El rigor aplicable se determina por el nivel del
cambio en GOVERNANCE y por el flujo operativo de AGENTS.

## Validación publicada

[Windows CI](../.github/workflows/windows-ci.yml) es el gate canónico para
las validaciones que los sandboxes locales no pueden ejecutar. Los comandos,
el arranque y cierre del servidor y los artefactos se consultan en el
workflow; la evidencia de ejecuciones vive en
[master-coverage.md](../docs/testing/master-coverage.md).

La existencia del workflow no acredita un resultado: hay que observar su
ejecución sobre el commit publicado. Un CI verde tampoco sustituye el
veredicto arquitectónico exigido por el flujo.

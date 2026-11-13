# Prompts para tareas de desarrollo

Usá [AGENTS.md](../AGENTS.md) y la [gobernanza](../GOVERNANCE.md) para decidir el rigor. Indicá qué resultado querés y qué acciones autorizás.

- **Implementación:** «Implementá [resultado]. Debe cumplir [criterios]. El alcance es [superficies]. Entregá el diff verificado y la documentación afectada».
- **Diseño:** «Diseñá [capacidad]. Compará las opciones relevantes y definí la prueba de aceptación. Entregá el diseño para revisión».
- **Defecto:** «Corregí [síntoma]. Reproducilo con una regresión, verificá el comportamiento esperado y registrá la evidencia».
- **Revisión:** «Revisá [diff/SHA] por [invariante o riesgo]. Devolvé hallazgos con evidencia y comprobaciones faltantes».
- **Continuidad:** «Retomá [tarea] desde [chat/Issue/PR]. Contrastá el resumen con Git y continuá dentro del alcance aprobado».

# Diseño de Higiene y Mantenimiento del Repositorio

## Objetivo
Limpiar el repositorio de archivos generados, temporales o innecesarios y actualizar la configuración de Git para evitar el seguimiento accidental de archivos derivados, manteniendo la estructura limpia y libre de ruido.

## Problema que Resuelve
1. **Directorios Temporales Residuales**: El directorio `.tmp-equipment-inspect/` es un residuo de inspección y no tiene utilidad en el proyecto.
2. **Archivos Generados en Git**: Archivos como `tsconfig.tsbuildinfo` (generado por TypeScript) y potenciales logs no deseados no están adecuadamente excluidos en `.gitignore`.
3. **Falta de Protección contra Archivos de Reportes**: Si algún desarrollador o agente genera localmente reportes como `walkthrough.md` o `implementation_plan.md` en la raíz del repositorio en lugar de la carpeta de artifacts, estos podrían versionarse accidentalmente.

## Arquitectura / Organización Estructural Propuesta
La higiene se centrará únicamente en la gestión de archivos no funcionales y reglas de exclusión:
- Eliminación física de `.tmp-equipment-inspect/`.
- Actualización de `.gitignore` en la raíz del repositorio.

## Componentes Afectados
- Archivo `.gitignore` en la raíz del proyecto.
- Directorio temporal `.tmp-equipment-inspect/` (eliminación).

## Riesgos
- **Riesgo extremadamente bajo**. No se modifica código fuente de TypeScript, JavaScript, CSS o HTML.
- No hay impacto funcional sobre el motor táctico de combate.

## Compatibilidad e Impacto
- **Rule Engine**: Ninguno (no se modifica código).
- **CombatSnapshot**: Ninguno.
- **EquipmentCatalog**: Ninguno.
- **Ownership**: Ninguno.
- **WebSocket**: Ninguno.
- **UI**: Ninguno.
- **Tests**: Ninguno. Las suites de pruebas se mantendrán 100% funcionales.

## Estrategia de Implementación
1. Eliminar recursivamente el directorio `.tmp-equipment-inspect/`.
2. Modificar `.gitignore` para añadir las siguientes reglas:
   - `walkthrough.md` e `implementation_plan.md` (para evitar guardado local erróneo en el repositorio).
   - `*.tsbuildinfo` (para ignorar la metadata de compilación de TypeScript).
   - `.tmp-*` (para ignorar cualquier carpeta temporal creada en el futuro).
3. Validar el estado del repositorio mediante compilación y ejecución de pruebas.

## Estrategia de Testing / Verificación
- Correr el flujo completo de validaciones del monorrepósito:
  ```powershell
  npm test
  npm run typecheck
  npm run build
  node scripts/e2e-websocket.mjs
  ```
- Garantizar que la suite completa sigue aprobada al 100%.

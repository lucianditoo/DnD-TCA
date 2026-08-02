# Walkthrough — Sprint D-1B Capítulo 4

## Objetivo
Redactar el Capítulo 4 de `normative-movement-design.md`, estableciendo el contrato normativo de las **Movement Actions** y formalizando su rol como consumidoras estrictas de Route Validation, Movement Cost y Movement Budget, sin redefinir geometría, reglas ni lógica de coste.

## Secciones añadidas
- **4.1 Propósito y alcance**
- **4.2 Concepto de Movement Action:** Define normativamente cómo consumen presupuesto y seleccionan rutas sin redefinir topología.
- **4.3 Action Consumers:** Impone la reutilización obligatoria de los sistemas de Route Validation y Coste, prohibiendo validaciones ad-hoc por acción.
- **4.4 a 4.8:** Definiciones conceptuales abstractas de `Move Action`, `Double Move`, `Run`, `Withdraw` y `Charge` basadas exclusivamente en su consumo de la ruta y presupuesto.
- **4.9 y 4.10:** Definiciones y separación conceptual entre `Five-Foot Step` (excepción al presupuesto, previene AdO, excluido en terreno difícil) y `Minimum Movement` (movimiento ordinario en situación de bajo presupuesto).
- **4.11 Forced Movement:** Catalogado explícitamente como perteneciente a otro contrato futuro y fuera de los presupuestos ordinarios.
- **4.12 Autoridad y previews:** Mantiene inalterado el contrato de servidor autoritativo vs predicciones locales de UI.
- **4.13 Invariantes normativos:** Documentación de 9 invariantes clave para guiar capítulos posteriores (ej. la ejecución y mutación de estado quedan explícitamente diferidas, ninguna acción redefine la geometría).
- **4.14 Límites y ODR:** Cierra el capítulo delineando explícitamente qué queda fuera (TurnState, AoO pipeline, transacciones, renderer).

## Decisiones normativas y ODR nuevas
- Se consolidó el modelo "Action as a Consumer", donde ninguna acción de movimiento tiene derecho a diseñar su propia topología.
- **Ninguna ODR nueva fue abierta**, ya que la estructura preaprobada del documento y del SRD no presentan ambigüedades respecto al consumo pasivo de validación de rutas por parte de las acciones.

## Archivos modificados
- `docs/designs/normative-movement-design.md`
- `PROJECT_STATUS.md`
- `walkthrough.md`

READY FOR ARCHITECTURE REVIEW

# Walkthrough — Sprint D-1R1 (Geometría Normativa Espacial Remediation)

## Objetivo
Resolver los hallazgos documentales y contradicciones señalados durante el Architecture Gate del Sprint D-1 original, limpiando las definiciones de geometría normativa, identidades y dependencias de assessments para producir un NDD arquitectónico riguroso.

## Entregables
- **`docs/designs/normative-spatial-geometry.md`**: Reesquematizado y reescrito. Establece dos identidades espaciales formales, independiza totalmente Threat de LoE, purga inferencias gráficas de los hazards, asienta Squeezing y footprint sizes inferiores a Small, y delinea explícitamente Distance vs Route Cost.
- **`docs/designs/spatial-engine-2.5d.md`**: Corrección in-situ en la sección de Threat para remover la dependencia errónea hacia LoE, sincronizándolo con D-1R1.
- **`PROJECT_STATUS.md`**: Actualizado reflejando el progreso del sprint documental.

## Matriz de Resolución de Hallazgos (Architecture Gate)

| Hallazgo / Observación | Reviewer | Estado | Evidencia de Resolución (NDD) |
|---|---|---|---|
| Falsa incompatibilidad A-001 vs D-1 sobre `zFeet`. | Claude | **Rejected** | A-001 ya declaraba `surfaceId` sin persistir `zFeet`. (Se aclara precedencia delegada). |
| Threat duplicando LoE y contradicción en AoO. | Codex | **Accepted** | Sec. 11: Threat es puramente alcance/ocupación. AoO compone Threat + LoE + Cover separadamente. Corregido en A-001. |
| Métrica XYZ indeterminada / Distancia vs Coste. | Codex | **Accepted** | Sec. 7: Se separa Spatial Distance (simétrica) de Route Cost. Se registra ODR bloqueante para la fórmula 3D exacta. |
| Trazado LoE ambiguo ("vector o cilindro"). | Codex | **Accepted** | Sec. 9: Instauración del contrato `Spatial Trace` como primitiva única de recorrido geométrico. |
| Contradicción opacidad/LoE (ej: humo vs vidrio). | Codex | **Accepted** | Sec. 10: Vision (afectado por opacidad) y LoE (afectado por solidez) desconectados y sin compartir blockers idénticos. |
| Ausencia de identidad aérea / no anclada. | Codex | **Accepted** | Sec. 2: Creación de `Volumetric Spatial Coordinate` para caída y vuelo, coexistiendo con `Anchored Spatial Position`. |
| 50% de caída parcial inventado. | Codex | **Accepted** | Sec. 12: Se remueve la regla inventada y se difiere la mecánica exacta, reteniendo solo el invariante de soporte válido. |
| Vertical Profile inferido rígidamente de Size. | Codex | **Accepted** | Sec. 5: Instaurada cadena de precedencia (plantilla > transformación > estado > snapshot) sin dependencia fija. |
| Tamaño de celda ambiguo vs `cellSizeFeet`. | Codex | **Accepted** | Sec. 1: Fijado normativamente a 5 pies para V1, con `spaceFeet` permitiendo co-ocupación si es menor a 5. |
| Footprint como segunda tabla manual y < Small. | Codex | **Accepted** | Sec. 4: Extirpada tabla manual. Permite explícitamente ocupación subcelular para Tiny/Diminutive/Fine. |
| Ausencia de min/max Reach. | Codex | **Accepted** | Sec. 8: Reach explicitado como conjunto matemático con límites mínimos/máximos y múltiples orígenes. |
| Squeezing incompleto. | Codex | **Accepted** | Sec. 4: Separación formal entre footprint natural, footprint efectivo y Body Prism efectivo. |
| Dependencia inversa de Hazards. | Codex | **Accepted** | Sec. 14: Hazards formalizados como áreas pasivas consultadas por el Rules Engine, sin detonar eventos desde la geometría pura. |
| Previews de cliente erróneamente prohibidos. | Codex | **Accepted** | Sec. 15: Permitidos previews de helpers puros sobre proyección FoW, pero confirmando que el cliente carece de autoridad normativa. |
| Snapshots no cubiertos adecuadamente. | Codex | **Accepted** | Sec. 16: Listado exhaustivo de todas las primitivas y estructuras que el Snapshot debe congelar y persistir. |
| Board legacy como autoridad duplicada. | Codex | **Accepted** | Sec. 16: El Board legacy sobrevive únicamente como adaptación tras un proxy V1, sin autoridad en dominios V2 puros. |
| Contratos consumidores omitidos. | Codex | **Accepted** | Sec. 17: Agregada matriz semántica formal de consumidores de `Anchored Spatial Position` y `Volumetric Spatial Coordinate`. |

Todos los hallazgos validados han sido documentados, extirpando ambigüedades arquitectónicas o delegando responsablemente mediante ODRs.

## Estado del Gate
D-1 ARCHITECTURE APPROVED AFTER D-1R1 REMEDIATION

# ADR-0003: EquipmentCatalog Is The Source Of Truth

## Estado

Aceptado

## Contexto

Armas, armaduras y escudos tienen datos reutilizables: danio, critico, alcance, bonificadores, penalizadores, velocidad, peso y otros campos futuros. Copiar esos datos dentro de cada perfil produce duplicacion e inconsistencias.

## Decision

`EquipmentCatalog` es la unica API oficial para consultar armas, armaduras y escudos.

Los perfiles guardan IDs de catalogo, no objetos completos. Los datos completos y estadisticas derivadas se calculan desde el catalogo compartido.

## Alternativas consideradas

- Guardar objetos completos dentro del perfil: facil al inicio, pero duplica datos.
- Acceder directamente a arrays del catalogo desde UI/server: acopla capas y dificulta cambiar estructura.
- Mantener datos de equipo separados por app: genera divergencia entre frontend y servidor.

## Consecuencias

Beneficios:

- Una unica fuente para equipo.
- Perfiles mas livianos.
- Cambios de catalogo se reflejan de forma consistente.
- Preparado para materiales, magia, tamanios y variantes futuras.

Costos:

- Las pantallas deben resolver datos por ID.
- Hay que mantener compatibilidad/migraciones si cambian IDs.
- El catalogo necesita validacion para evitar IDs duplicados.


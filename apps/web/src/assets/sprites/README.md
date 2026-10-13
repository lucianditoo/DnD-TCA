# Assets pixel-art de D-4

Estos cinco sprites fueron generados como recursos originales para DnD-TCA durante la implementación de D-4 mediante la herramienta integrada de generación de imágenes de Codex. La revisión pixel-art compacta usa una paleta reducida y bloques deliberadamente visibles para mantener una escala legible respecto de las casillas tácticas.

- `knight.png`: caballero humano con espada y escudo.
- `mage.png`: maga con bastón.
- `ranger.png`: arquera exploradora.
- `rogue.png`: pícaro ligero para Bane, sin arco ni carcaj.
- `orc.png`: guerrero orco con lanza.

Uso: texturas billboard del renderer táctico. No proceden de la referencia visual comercial aportada por el propietario y no copian personajes identificables. El renderer usa filtrado nearest-neighbor y fallbacks por familia hasta que exista un atlas completo por arquetipo/dirección/pose.

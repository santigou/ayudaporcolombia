# Base de conocimiento — Ayuda por Colombia

Esta carpeta es una **base de conocimiento para Obsidian** que documenta el proyecto *Ayuda por Colombia*.

## Cómo usarla

1. Abre Obsidian → **Open folder as vault** → selecciona esta carpeta (`docs/obsidian/`).
2. Empieza por el mapa de contenidos: [[00 - Índice (MOC)]].
3. Las notas usan `[[wikilinks]]` para conectarse entre sí y bloques de callout (`> [!info]`, `> [!warning]`) que Obsidian renderiza con estilo.

## Convenciones

- **Prefijo numérico** en notas de referencia para ordenarlas (`00`, `01`...).
- **Frontmatter YAML** con `tags`, `aliases`, `tipo` en cada nota.
- **Diagramas Mermaid** para arquitectura y flujos.
- Enlaces bidireccionales: cada nota enlaza a las relacionadas.

## Estado del proyecto

> [!warning] Discrepancia importante
> El `schema.prisma` actual contiene un rediseño avanzado (más modelos) que **aún no está migrado ni implementado** en el código. Ver [[Estado del proyecto y divergencias]].

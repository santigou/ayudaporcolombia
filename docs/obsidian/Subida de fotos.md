---
tags: [backend, uploads, multer]
aliases: [Fotos, Multer, Uploads]
tipo: referencia
---

# Subida de fotos

Implementado en `server/src/middleware/upload.middleware.ts`.

## Configuración de multer

- **Destino**: `process.cwd()/uploads` (se crea con `mkdirSync(recursive)` al importar).
- **Nombre**: `<crypto.randomUUID()><ext>` — no conserva el nombre original.
- **Límites**: tamaño máx **5 MB/archivo**, máx **5 archivos** por request.
- **MIME permitidos**: `image/jpeg`, `image/png`, `image/webp`, `image/gif`. Otro → error "Solo se permiten imágenes".

## Dónde se usa

Solo en `POST /api/points` con `upload.array("photos", 5)` (antes del handler). Los archivos llegan en `req.files` y se mapean a URLs públicas `/uploads/<filename>`.

## Cómo se sirven

En `app.ts`:
```ts
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
```

- En **dev**, Vite hace proxy de `/uploads` al backend (`vite.config.ts`).
- En **prod**, el mismo Express sirve las imágenes.

## En el modelo

Las URLs se guardan en la tabla `Attachment` (`type=image`). La API las normaliza a `photos: string[]` en el listado/detalle, y el frontend las muestra en `PointDetail.tsx`.

> [!warning] No hay limpieza
> Si un punto se rechaza o elimina, **las fotos quedan en disco**. No hay garbage collection. Ver [[Seguridad y consideraciones]].

> [!warning] Validación solo por MIME
> Multer valida `mimetype`, que se puede falsificar en la petición. No hay validación real del contenido (magic bytes). Aceptable para confianza-moderada, mejorable.

## Pendiente

- Migración a almacenamiento en la nube si crece el volumen (declarado en README, ver [[Backlog]]).

## Relacionado

- [[Flujo de creación de un Punto]]
- [[Arquitectura general]]
- [[Middleware]]

# Mapeos por expresiones (JSONata)

> Cómo adaptar **tu formato** al nuestro sin que nadie escriba código: defines
> un JSON de mapeo con expresiones [JSONata](https://docs.jsonata.org/) y lo
> activas con tu API key. Documento pensado para los equipos de las apps partner.

## Idea en 30 segundos

Tú nos envías (o esperas recibir) un JSON con una forma distinta a la nuestra.
En vez de cambiar tu API, declaras **cómo construir tu objeto a partir del
nuestro** (y viceversa) con un JSON "plantilla" donde cada hoja-string es una
expresión JSONata que se evalúa contra el JSON de origen.

**Ejemplo real** — App B recibe `{ location: { origin, destination }, description }`:

```json
{
  "location": {
    "origin":      "$join($map(point.locations[type='origin'], function($l){ $l.address }), ',')",
    "destination": "$join($map(point.locations[type='destination'], function($l){ $l.address }), ',')"
  },
  "description": "point.description"
}
```

Cada hoja produce un valor del objeto resultado. La plantilla se guarda en
nuestra BD (versionada) y se evalúa en un worker aislado con timeout.

## Reglas de la plantilla

| Nodo | Comportamiento |
|---|---|
| string | **Expresión JSONata**, evaluada contra el input (raíz: tu payload en inbound; el sobre `{event, point, source}` en outbound) |
| objeto | Recursión clave por clave |
| array | Recursión elemento por elemento (los strings dentro TAMBIÉN son expresiones) |
| `{ "$literal": X }` | X **tal cual** (constante; úsalo para strings que no son expresiones) |
| número / bool / null | Constante |

Consejos: string constante → `"'Bogota'"` (comillas simples dentro) o `$literal`.
Campo inexistente → `undefined` (JSONata es tolerante; no revienta).

## Inputs según dirección

**INBOUND** (tu payload → nuestro sobre canónico). Tu plantilla produce:

```jsonc
{
  "externalId": "<tu id, OBLIGATORIO para dedup>",
  "source": { "app": "'mi-app'", "id": "..." },   // opcional, anti-eco
  "point": {
    "type": "'need_help' | 'offer_help'",
    "title": "...", "description": "...", "helpTypeName": "...",
    "locations": [ { "type": "'location'|'origin'|'destination'", "lat": 4.71, "lng": -74.07, "city": "...", "neighborhood": "...", "address": "..." } ],
    "contacts": [ { "type": "'phone'|'whatsapp'|'instagram'|'email'|'other'", "value": "..." } ],
    "supplies": [ { "name": "...", "targetQuantity": 10, "unit": "..." } ],
    "expiresAt": "ISO-8601"
  }
}
```

> El resultado SIEMPRE se valida contra nuestro esquema canónico (títulos
> 3-200, descripción 10-5000, 1-5 locations, etc.). Un mapeo que produzca algo
> inválido recibe un `400` con el campo exacto — nunca corrompe datos.

**OUTBOUND** (nuestro sobre → tu formato). Tu plantilla consume:

```jsonc
{
  "event": "point_created | point_updated",
  "point": { id, code, type, title, description, status, verificationStatus,
             helpTypeName, locations[{type,lat,lng,address,city,neighborhood}],
             contacts[], supplies[], photos[], expiresAt, createdAt, updatedAt },
  "source": { app: "ayudaporcolombia", id, code, url }
}
```

(y produce EXACTAMENTE el JSON que tu webhook espera recibir).

## Endpoints (auth: tu API key, `X-API-Key` o `Authorization: Bearer`)

| Método y ruta | Uso |
|---|---|
| `POST /api/integrations/v1/mappings/dry-run` | **Prueba sin guardar**: `{direction, definition, sampleInput}` → `{ok, result, canonicalCheck}` |
| `POST /api/integrations/v1/mappings` | Guarda nueva versión `{direction, definition, notes?, activate?}` |
| `GET /api/integrations/v1/mappings?direction=inbound` | Tus versiones |
| `POST /api/integrations/v1/mappings/:id/activate` | Activa una versión (desactiva las demás) — **rollback**: activa la anterior |
| `DELETE /api/integrations/v1/mappings/:id` | Borra una versión NO activa |

Flujo recomendado: **dry-run con un payload tuyo real → create(activate) →
produce tráfico → si algo falla, activate la versión anterior.** El moderador
puede ver tus versiones (auditoría) y desactivar una a la fuerza si rompe algo.

## Límites de seguridad

- Timeout por evaluación: 2s (configurable) — una expresión colgada se corta.
- Input/resultado máx 256KB.
- JSONata es sandboxed: sin red, disco ni acceso a `process`.
- Errores con ruta exacta: `location.origin: expresión inválida (...)`.

## Cheatsheet JSONata mínima

```
a.b                        campo anidado
locations[type='origin']   filtrar array
$map(arr, function($x){ $x.name })   transformar
$join(arr, ',')            unir strings
$ count(arr)               longitud (sin espacio: $count)
'string constante'         literal
a != null ? a : 'default'  condicional (ternario)
$ string(a)                cast a string
$now()                     timestamp ISO actual
```

Documentación completa de JSONata: https://docs.jsonata.org/simple

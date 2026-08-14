# -*- coding: utf-8 -*-
"""Verificación rápida del estado de la BD tras la importación (temporal)."""
import sys
import psycopg2

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

c = psycopg2.connect(host="192.168.1.33", port=5434, user="ayuda", password="5I9kqS^!W3Edt5Cx", dbname="ayudaporcolombia")
cur = c.cursor()

cur.execute('''SELECT ht.name, count(*) FROM "Point" p
               LEFT JOIN "HelpType" ht ON ht.id = p."helpTypeId"
               WHERE p.status = 'active' AND p."verificationStatus" = 'approved'
               GROUP BY 1 ORDER BY 2 DESC''')
print("Puntos activos+aprobados por HelpType:")
for r in cur.fetchall():
    print("  ", r)

print("\nPuntos por estado (todos):")
cur.execute('''SELECT p.status, p."verificationStatus", count(*)
               FROM "Point" p GROUP BY 1, 2 ORDER BY 3 DESC''')
for r in cur.fetchall():
    print("  ", r)

print("\nPuntos pending por motivo (nota en descripcion):")
cur.execute('''SELECT split_part(split_part(p.description, '[Pendiente: ', 2), '.', 1), count(*)
               FROM "Point" p
               WHERE p.status = 'pending' AND p.description LIKE '%[Pendiente:%'
               GROUP BY 1 ORDER BY 2 DESC''')
for r in cur.fetchall():
    print("  ", r)

print("\nContactos por tipo:")
cur.execute('SELECT type, count(*) FROM "Contact" GROUP BY 1 ORDER BY 2 DESC')
for r in cur.fetchall():
    print("  ", r)

cur.execute('SELECT count(*) FROM "PointSupply"')
print("PointSupply:", cur.fetchone()[0])
cur.execute('SELECT count(*) FROM "Supply"')
print("Supply unicos:", cur.fetchone()[0])
cur.execute('SELECT count(*) FROM "Point"')
print("Point total:", cur.fetchone()[0])
cur.execute('SELECT count(*) FROM "Contact"')
print("Contact total:", cur.fetchone()[0])
print("\nContactos con telefono:")
cur.execute('''SELECT p.title, ct.value, l.city FROM "Contact" ct
               JOIN "Point" p ON p.id = ct."pointId"
               JOIN "PointLocation" pl ON pl."pointId" = p.id
               JOIN "Location" l ON l.id = pl."locationId"''')
for r in cur.fetchall():
    print("  ", r)
cur.execute('''SELECT count(*) FROM "Point" p
               JOIN "PointLocation" pl ON pl."pointId" = p.id''')
print("Point con ubicacion:", cur.fetchone()[0])

print("\nMuestra (5 aleatorios):")
cur.execute('''SELECT p.title, p.code, l.city, coalesce(l.address,'-'), l.latitude, l.longitude,
                      left(p.description, 100)
               FROM "Point" p
               JOIN "PointLocation" pl ON pl."pointId" = p.id
               JOIN "Location" l ON l.id = pl."locationId"
               WHERE p."createdAt" > now() - interval '1 day'
               ORDER BY random() LIMIT 5''')
for r in cur.fetchall():
    print("  ", r)

c.close()

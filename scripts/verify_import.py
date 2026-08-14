# -*- coding: utf-8 -*-
"""Verificación rápida del estado de la BD tras la importación (temporal)."""
import sys
import psycopg2

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

c = psycopg2.connect(host="localhost", port=5434, user="ayuda", password="ayuda", dbname="ayudaporcolombia")
cur = c.cursor()

cur.execute('''SELECT ht.name, count(*) FROM "Point" p
               LEFT JOIN "HelpType" ht ON ht.id = p."helpTypeId"
               WHERE p.status = 'active' AND p."verificationStatus" = 'approved'
               GROUP BY 1 ORDER BY 2 DESC''')
print("Puntos activos+aprobados por HelpType:")
for r in cur.fetchall():
    print("  ", r)

cur.execute('SELECT count(*) FROM "PointSupply"')
print("PointSupply:", cur.fetchone()[0])
cur.execute('SELECT count(*) FROM "Supply"')
print("Supply unicos:", cur.fetchone()[0])
cur.execute('SELECT count(*) FROM "Point"')
print("Point total:", cur.fetchone()[0])
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

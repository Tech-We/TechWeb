from fastapi import FastAPI, Request, HTTPException
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import sqlite3
import pandas as pd
from datetime import datetime
import os

app = FastAPI(title="Sistema de Gestión - POS & Servicio Técnico")

# Configurar archivos estáticos y plantillas Jinja2
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

DB_NAME = "database.db"

def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # Tabla de Productos / Inventario
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS productos (
            codigo TEXT PRIMARY KEY,
            nombre TEXT NOT NULL,
            categoria TEXT,
            costo REAL DEFAULT 0,
            precio REAL NOT NULL,
            stock INTEGER NOT NULL
        )
    ''')
    
    # Tabla de Historial / Ventas
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS historial (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            n_recibo TEXT,
            codigo TEXT,
            tipo TEXT,
            cantidad INTEGER,
            precio_unitario REAL,
            detalle TEXT,
            metodo_pago TEXT DEFAULT 'Efectivo',
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(codigo) REFERENCES productos(codigo)
        )
    ''')
    
    # Tabla de Servicio Técnico
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reparaciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            n_orden TEXT UNIQUE,
            cliente TEXT,
            telefono TEXT,
            equipo TEXT,
            falla TEXT,
            estado TEXT,
            presupuesto REAL DEFAULT 0,
            senia REAL DEFAULT 0,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Migraciones preventivas
    try:
        cursor.execute("ALTER TABLE reparaciones ADD COLUMN senia REAL DEFAULT 0")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE productos ADD COLUMN costo REAL DEFAULT 0")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE historial ADD COLUMN n_recibo TEXT")
        cursor.execute("ALTER TABLE historial ADD COLUMN detalle TEXT")
        cursor.execute("ALTER TABLE historial ADD COLUMN metodo_pago TEXT DEFAULT 'Efectivo'")
    except sqlite3.OperationalError:
        pass

    conn.commit()
    conn.close()

init_db()

# --- VISTA PRINCIPAL ---

@app.get("/")
def home(request: Request):
    return templates.TemplateResponse(request=request, name="index.html", context={})

# --- DASHBOARD & ESTADÍSTICAS ---

@app.get("/api/dashboard/stats")
def obtener_stats():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT SUM(total) FROM (
            SELECT (cantidad * precio_unitario) as total FROM historial WHERE tipo = 'VENTA' AND date(fecha) = date('now')
            UNION ALL
            SELECT senia as total FROM reparaciones WHERE date(fecha) = date('now')
        )
    """)
    ventas_hoy = cursor.fetchone()[0] or 0.0

    cursor.execute("SELECT COUNT(*) FROM reparaciones WHERE estado NOT IN ('Entregado', 'Retirado')")
    rep_pendientes = cursor.fetchone()[0] or 0

    cursor.execute("SELECT COUNT(*) FROM productos WHERE stock <= 2")
    stock_critico = cursor.fetchone()[0] or 0

    cursor.execute("""
        SELECT SUM(total) FROM (
            SELECT (cantidad * precio_unitario) as total FROM historial WHERE tipo = 'VENTA' AND strftime('%Y-%m', fecha) = strftime('%Y-%m', 'now')
            UNION ALL
            SELECT senia as total FROM reparaciones WHERE strftime('%Y-%m', fecha) = strftime('%Y-%m', 'now')
        )
    """)
    ingresos_mes = cursor.fetchone()[0] or 0.0

    cursor.execute("SELECT id, n_orden, cliente, telefono, equipo, falla, estado, presupuesto, senia, date(fecha) FROM reparaciones ORDER BY id DESC LIMIT 5")
    reparaciones_rows = cursor.fetchall()
    ultimas_reparaciones = [
        {
            "id": r[0], "n_orden": r[1], "cliente": r[2], "telefono": r[3], 
            "equipo": r[4], "falla": r[5], "estado": r[6], "presupuesto": r[7], "senia": r[8], "fecha": r[9]
        } for r in reparaciones_rows
    ]

    cursor.execute("SELECT nombre, stock FROM productos WHERE stock <= 3 LIMIT 5")
    stock_rows = cursor.fetchall()
    poco_stock = [{"nombre": s[0], "stock": s[1]} for s in stock_rows]

    conn.close()

    return {
        "ventas_hoy": ventas_hoy,
        "rep_pendientes": rep_pendientes,
        "stock_critico": stock_critico,
        "ingresos_mes": ingresos_mes,
        "ultimas_reparaciones": ultimas_reparaciones,
        "poco_stock": poco_stock
    }

# --- INVENTARIO & PRODUCTOS ---

@app.get("/api/inventario")
def obtener_inventario():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT codigo, nombre, categoria, costo, precio, stock FROM productos ORDER BY nombre ASC")
    rows = cursor.fetchall()
    conn.close()
    return [{"codigo": r[0], "nombre": r[1], "categoria": r[2] or "General", "costo": r[3], "precio": r[4], "stock": r[5]} for r in rows]

@app.get("/api/producto/{codigo}")
def buscar_producto(codigo: str):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT codigo, nombre, categoria, costo, precio, stock FROM productos WHERE codigo = ?", (codigo,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {"encontrado": True, "producto": {"codigo": row[0], "nombre": row[1], "categoria": row[2], "costo": row[3], "precio": row[4], "stock": row[5]}}
    return {"encontrado": False}

@app.post("/api/inventario/guardar")
def guardar_producto(datos: dict):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO productos (codigo, nombre, categoria, costo, precio, stock)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(codigo) DO UPDATE SET
                nombre = excluded.nombre,
                categoria = excluded.categoria,
                costo = excluded.costo,
                precio = excluded.precio,
                stock = excluded.stock
        ''', (datos.get("codigo"), datos.get("nombre"), datos.get("categoria", "General"), float(datos.get("costo", 0)), float(datos.get("precio", 0)), int(datos.get("stock", 0))))
        conn.commit()
        conn.close()
        return {"status": "ok"}
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/inventario/{codigo}")
def eliminar_producto(codigo: str):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM productos WHERE codigo = ?", (codigo,))
    conn.commit()
    conn.close()
    return {"status": "ok"}

# --- MOVIMIENTOS DE STOCK (ESCÁNER) ---

@app.post("/api/movimiento")
async def registrar_movimiento(datos: dict):
    codigo = datos.get("codigo")
    nombre = datos.get("nombre")
    categoria = datos.get("categoria", "General")
    costo = float(datos.get("costo", 0))
    precio = float(datos.get("precio", 0))
    cantidad = int(datos.get("cantidad", 1))
    tipo = datos.get("tipo")

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT stock FROM productos WHERE codigo = ?", (codigo,))
    prod = cursor.fetchone()

    if tipo == 'ENTRADA':
        if prod:
            nuevo_stock = prod[0] + cantidad
            cursor.execute("UPDATE productos SET stock = ?, costo = ?, precio = ?, nombre = ?, categoria = ? WHERE codigo = ?", (nuevo_stock, costo, precio, nombre, categoria, codigo))
        else:
            cursor.execute("INSERT INTO productos (codigo, nombre, categoria, costo, precio, stock) VALUES (?, ?, ?, ?, ?, ?)", (codigo, nombre, categoria, costo, precio, cantidad))
    elif tipo == 'VENTA':
        if not prod or prod[0] < cantidad:
            conn.close()
            raise HTTPException(status_code=400, detail="Stock insuficiente")
        nuevo_stock = prod[0] - cantidad
        cursor.execute("UPDATE productos SET stock = ? WHERE codigo = ?", (nuevo_stock, codigo))

    cursor.execute("SELECT COUNT(*) FROM historial WHERE tipo = 'VENTA'")
    v_count = cursor.fetchone()[0]
    n_recibo = f"REC-{1001 + v_count}"
    detalle = f"{cantidad}x {nombre}"

    cursor.execute('''
        INSERT INTO historial (n_recibo, codigo, tipo, cantidad, precio_unitario, detalle, metodo_pago)
        VALUES (?, ?, ?, ?, ?, ?, 'Efectivo')
    ''', (n_recibo, codigo, tipo, cantidad, precio, detalle))
    
    conn.commit()
    conn.close()
    return {"status": "ok", "n_recibo": n_recibo}

# --- SERVICIO TÉCNICO ---

@app.get("/api/reparaciones")
def obtener_reparaciones():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, n_orden, cliente, telefono, equipo, falla, estado, presupuesto, senia, date(fecha) 
        FROM reparaciones ORDER BY id DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "id": r[0], "n_orden": r[1], "cliente": r[2], "telefono": r[3],
            "equipo": r[4], "falla": r[5], "estado": r[6], "presupuesto": r[7], "senia": r[8], "fecha": r[9]
        } for r in rows
    ]

@app.post("/api/reparacion")
async def crear_o_actualizar_reparacion(datos: dict):
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        rep_id = datos.get("id")
        presupuesto = float(datos.get("presupuesto", 0))
        estado = datos.get("estado")
        senia = float(datos.get("senia", 0))
        if estado == "Retirado":
            senia = presupuesto

        if rep_id:
            cursor.execute('''
                UPDATE reparaciones 
                SET cliente = ?, telefono = ?, equipo = ?, falla = ?, estado = ?, presupuesto = ?, senia = ?
                WHERE id = ?
            ''', (datos.get("cliente"), datos.get("telefono"), datos.get("equipo"), datos.get("falla"), estado, presupuesto, senia, rep_id))
            cursor.execute("SELECT n_orden FROM reparaciones WHERE id = ?", (rep_id,))
            n_orden = cursor.fetchone()[0]
        else:
            cursor.execute("SELECT COUNT(*) FROM reparaciones")
            count = cursor.fetchone()[0]
            n_orden = f"ORD-{1001 + count}"
            cursor.execute('''
                INSERT INTO reparaciones (n_orden, cliente, telefono, equipo, falla, estado, presupuesto, senia)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (n_orden, datos.get("cliente"), datos.get("telefono"), datos.get("equipo"), datos.get("falla"), estado, presupuesto, senia))
        
        if estado == "Retirado":
            cursor.execute("SELECT COUNT(*) FROM historial WHERE tipo = 'VENTA'")
            v_count = cursor.fetchone()[0]
            n_recibo = f"REC-{1001 + v_count}"
            detalle = f"Reparación {n_orden}: {datos.get('equipo')}"
            cursor.execute('''
                INSERT INTO historial (n_recibo, tipo, cantidad, precio_unitario, detalle, metodo_pago)
                VALUES (?, 'VENTA', 1, ?, ?, 'Efectivo')
            ''', (n_recibo, presupuesto, detalle))

        conn.commit()
        conn.close()
        return {"status": "ok", "n_orden": n_orden}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/reparacion/{id_rep}")
def eliminar_reparacion(id_rep: int):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM reparaciones WHERE id = ?", (id_rep,))
    conn.commit()
    conn.close()
    return {"status": "ok"}

# --- PUNTO DE VENTA (POS) ---

@app.post("/api/pos/finalizar")
async def finalizar_venta_pos(datos: dict):
    items = datos.get("items", [])
    metodo_pago = datos.get("metodo_pago", "Efectivo")
    
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM historial WHERE tipo = 'VENTA'")
    v_count = cursor.fetchone()[0]
    n_recibo = f"REC-{1001 + v_count}"

    for item in items:
        if item.get("es_reparacion"):
            rep_id = item.get("id")
            presupuesto = float(item.get("precio", 0))
            cursor.execute("UPDATE reparaciones SET estado = 'Retirado', senia = ? WHERE id = ?", (presupuesto, rep_id))
            cursor.execute("SELECT n_orden, equipo FROM reparaciones WHERE id = ?", (rep_id,))
            r_data = cursor.fetchone()
            detalle = f"Reparación {r_data[0]}: {r_data[1]}"
            
            cursor.execute('''
                INSERT INTO historial (n_recibo, tipo, cantidad, precio_unitario, detalle, metodo_pago)
                VALUES (?, 'VENTA', 1, ?, ?, ?)
            ''', (n_recibo, presupuesto, detalle, metodo_pago))
        else:
            codigo = item.get("codigo")
            cantidad = int(item.get("cantidad", 1))
            precio = float(item.get("precio", 0))
            nombre = item.get("nombre")

            cursor.execute("SELECT stock FROM productos WHERE codigo = ?", (codigo,))
            prod = cursor.fetchone()
            if not prod or prod[0] < cantidad:
                conn.close()
                raise HTTPException(status_code=400, detail=f"Stock insuficiente para {nombre}")
            
            nuevo_stock = prod[0] - cantidad
            cursor.execute("UPDATE productos SET stock = ? WHERE codigo = ?", (nuevo_stock, codigo))

            detalle = f"{cantidad}x {nombre}"
            cursor.execute('''
                INSERT INTO historial (n_recibo, codigo, tipo, cantidad, precio_unitario, detalle, metodo_pago)
                VALUES (?, ?, 'VENTA', ?, ?, ?, ?)
            ''', (n_recibo, codigo, cantidad, precio, detalle, metodo_pago))

    conn.commit()
    conn.close()
    return {"status": "ok", "n_recibo": n_recibo, "mensaje": "Venta procesada con éxito."}

# --- BALANCE Y GANANCIAS ---

@app.get("/api/balance/ganancias")
def obtener_balance_ganancias():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    cursor.execute("SELECT codigo, nombre, categoria, costo, precio, stock FROM productos ORDER BY nombre ASC, codigo ASC")
    productos = cursor.fetchall()
    
    resultado = []
    total_invertido_general = 0
    total_vendido_general = 0
    total_ganancia_general = 0

    for p in productos:
        codigo, nombre, categoria, costo, precio, stock = p
        
        cursor.execute("SELECT SUM(cantidad * ? ) FROM historial WHERE codigo = ? AND tipo = 'ENTRADA'", (costo, codigo))
        inv_hist = cursor.fetchone()[0]
        if inv_hist is not None:
            inversion_total = inv_hist
        else:
            inversion_total = costo * stock

        cursor.execute("SELECT SUM(cantidad * precio_unitario) FROM historial WHERE codigo = ? AND tipo = 'VENTA'", (codigo,))
        total_vendido = cursor.fetchone()[0] or 0.0

        cursor.execute("SELECT SUM(cantidad) FROM historial WHERE codigo = ? AND tipo = 'VENTA'", (codigo,))
        cant_vendida = cursor.fetchone()[0] or 0

        costo_de_lo_vendido = costo * cant_vendida
        ganancia = total_vendido - costo_de_lo_vendido

        total_invertido_general += inversion_total
        total_vendido_general += total_vendido
        total_ganancia_general += ganancia

        resultado.append({
            "codigo": codigo,
            "nombre": nombre,
            "categoria": categoria or "General",
            "stock": stock,
            "costo": costo,
            "inversion": inversion_total,
            "vendido": total_vendido,
            "ganancia": ganancia
        })

    conn.close()
    return {
        "items": resultado,
        "totales": {
            "inversion": total_invertido_general,
            "vendido": total_vendido_general,
            "ganancia": total_ganancia_general
        }
    }

# --- HISTORIAL & EXPORTACIÓN EXCEL CON FILTRO DE FECHAS ---

@app.get("/api/historial/ventas")
def obtener_historial_ventas(desde: str = None, hasta: str = None):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    query = """
        SELECT n_recibo, fecha, detalle, metodo_pago, (cantidad * precio_unitario) as total 
        FROM historial WHERE tipo = 'VENTA'
    """
    params = []
    
    if desde and hasta:
        query += " AND date(fecha) BETWEEN date(?) AND date(?)"
        params.extend([desde, hasta])
    elif desde:
        query += " AND date(fecha) >= date(?)"
        params.append(desde)
    elif hasta:
        query += " AND date(fecha) <= date(?)"
        params.append(hasta)
        
    query += " ORDER BY id DESC"
    
    cursor.execute(query, params)
    rows = query and cursor.fetchall()
    conn.close()
    return [{"n_recibo": r[0], "fecha": r[1], "detalle": r[2], "metodo_pago": r[3], "total": r[4]} for r in rows]

@app.get("/api/exportar_excel/ventas")
def exportar_excel_ventas(desde: str = None, hasta: str = None):
    conn = sqlite3.connect(DB_NAME)
    
    query = """
        SELECT n_recibo as 'N° RECIBO', fecha as 'FECHA Y HORA', detalle as 'DETALLE DE PRODUCTOS / SERVICIOS', 
               metodo_pago as 'MÉTODO DE PAGO', (cantidad * precio_unitario) as 'MONTO TOTAL ($)' 
        FROM historial WHERE tipo = 'VENTA'
    """
    params = []
    
    if desde and hasta:
        query += " AND date(fecha) BETWEEN date(?) AND date(?)"
        params = [desde, hasta]
    elif desde:
        query += " AND date(fecha) >= date(?)"
        params = [desde]
    elif hasta:
        query += " AND date(fecha) <= date(?)"
        params = [hasta]
        
    query += " ORDER BY id DESC"
    
    df = pd.read_sql_query(query, conn, params=params)
    conn.close()
    
    filename = f"historial_ventas_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    file_path = os.path.join(os.getcwd(), filename)
    df.to_excel(file_path, index=False, engine='openpyxl')
    return FileResponse(file_path, filename=filename, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

@app.get("/api/exportar_excel/inventario")
def exportar_excel_inventario():
    conn = sqlite3.connect(DB_NAME)
    query = """
        SELECT codigo as 'CÓDIGO / SKU', nombre as 'PRODUCTO / REPUESTO', categoria as 'CATEGORÍA',
               stock as 'STOCK ACTUAL', costo as 'COSTO ($)', precio as 'PRECIO VENTA ($)'
        FROM productos ORDER BY nombre ASC
    """
    df = pd.read_sql_query(query, conn)
    conn.close()
    
    filename = f"inventario_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    file_path = os.path.join(os.getcwd(), filename)
    df.to_excel(file_path, index=False, engine='openpyxl')
    return FileResponse(file_path, filename=filename, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

# RECARGA EN VIVO ACTIVADA (reload=True) PARA MANTENIMIENTO REMOTO INSTANTÁNEO
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
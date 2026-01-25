import pdfplumber
import pandas as pd
import re
import requests

# --- REQUEST a PDF ---

url_pdf = "https://www.trensanmartin.com.ar/pdf/horarios-trenes-retiro-jose-c-paz-pilar-cabred.pdf"
archivo = "data/horarios_san_martin.pdf"

print("Descargando PDF actualizado...")
response = requests.get(url_pdf)
with open(archivo, 'wb') as f:
    f.write(response.content)
print("PDF Descargado.")


# ---CONFIGS ---

# Mapeo de hoja -> ida/vuelta. Cambiar según variaciones
mapa_servicios = {
    0: "1-6_hacia_cabred",
    1: "1-6_hacia_retiro",
    2: "7_hacia_cabred",
    3: "7_hacia_retiro"
}

# Estaciones
estaciones_cabred = [
    "Retiro", "Palermo", "Villa Crespo", "La Paternal", "Villa del Parque", 
    "Devoto", "Sáenz Peña", "Santos Lugares", "Caseros", "El Palomar", 
    "Hurlingham", "W. C. Morris", "Bella Vista", "Muñiz", "San Miguel", 
    "José C. Paz", "Sol y Verde", "Pte. Derqui", "Villa Astolfi", 
    "Pilar", "Manzanares", "Dr. Cabred"
]

# Estaciones invertidas
estaciones_retiro = estaciones_cabred[::-1] 

data_cabred = []
data_retiro = []

patron = re.compile(r'(\d{4}|\d{2}:\d{2}|-{2,})')

print(f"--- Iniciando procesamiento de {archivo} ---")

with pdfplumber.open(archivo) as pdf:
    for i, page in enumerate(pdf.pages):
        
        # Etiqueta según número de hoja
        etiqueta_servicio = mapa_servicios.get(i, f"hoja_{i}_desconocida")
        
        # Se determina la dirección basado en el nombre de la etiqueta
        if "hacia_cabred" in etiqueta_servicio:
            es_hacia_cabred = True
            cols_estaciones = estaciones_cabred
            target_list = data_cabred
        elif "hacia_retiro" in etiqueta_servicio:
            es_hacia_cabred = False
            cols_estaciones = estaciones_retiro
            target_list = data_retiro
        else:
            print(f"⚠️ Hoja {i} omitida: No matchea 'hacia_cabred' ni 'hacia_retiro'.")
            continue

        texto = page.extract_text()
        if not texto: continue
        
        # Procesamiento de líneas
        for linea in texto.split('\n'):
            tokens = patron.findall(linea)
            
            # Debe parecer un ID de tren (4 dígitos al inicio) y tener datos
            if tokens and re.match(r'^\d{4}$', tokens[0]) and len(tokens) > 5:
                
                # Validación de columnas (Servicio + ID + Estaciones)
                cant_esperada = len(cols_estaciones) + 1
                
                if len(tokens) == cant_esperada:
                    # Se agrega la etiqueta de tipo de servicio
                    tokens.insert(0, etiqueta_servicio)
                    target_list.append(tokens)
                else:
                    # Log (PENDIENTE)
                    pass 

# --- EXPORT ---

# Columnas finales
header_cabred = ['Servicio', 'Tren_ID'] + estaciones_cabred
header_retiro = ['Servicio', 'Tren_ID'] + estaciones_retiro

# Archivo hacia Cabred
if data_cabred:
    df_c = pd.DataFrame(data_cabred, columns=header_cabred)
    nombre_cabred = 'db_tren_destino_cabred.json'
    #df_c.to_csv(nombre_cabred, index=False, sep=';', encoding='utf-8-sig')
    df_c.to_json('data/'+nombre_cabred, orient='records', indent=2)
    print(f"✅ Generado: {nombre_cabred} ({len(df_c)} registros)")

# Archivo hacia Retiro
if data_retiro:
    df_r = pd.DataFrame(data_retiro, columns=header_retiro)
    nombre_retiro = 'db_tren_destino_retiro.json'
    #df_r.to_csv(nombre_retiro, index=False, sep=';', encoding='utf-8-sig')
    df_r.to_json('data/'+nombre_retiro, orient='records', indent=2)

    print(f"✅ Generado: {nombre_retiro} ({len(df_r)} registros)")

print("--- Proceso finalizado ---")
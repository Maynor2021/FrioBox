# FrioBox · Mockups interactivos de la estación de lockers

Sitio web interactivo con el modelo 3D de la estación **FrioBox FBX-S1**, construido a partir de la
Asignación No. 5 de ADM4032C Desarrollo Empresarial (Grupo 2, UJCV).

## Cómo abrirlo

Abra `index.html` con doble clic en cualquier navegador moderno (Chrome, Edge, Firefox).
No necesita servidor ni conexión a internet: la librería 3D está incluida en `vendor/`.

Cada escena tiene su propio enlace. Por ejemplo, `index.html#frio` abre directamente la
escena de cadena de frío; sirve para citar una escena concreta en una presentación.

## Qué contiene cada escena

| # | Escena | Qué muestra |
|---|--------|-------------|
| 01 | **Panorama** | La unidad completa girando, con la ficha técnica y la propuesta de valor. |
| 02 | **Vista 360°** | Siete ángulos predefinidos (frontal, 3/4, lateral, posterior, superior, kiosco, zócalo), radiografía del interior, flujo de aire frío, apertura de todas las puertas, 13 puntos de interés con detalle técnico y el cuadro de los 11 casilleros. |
| 03 | **Entrega del pedido** | Los seis pasos del flujograma productivo del plan. En cada paso se mueve la cámara, cambia la pantalla del kiosco, se abre la puerta asignada, se deposita el pedido y se actualiza la app del cliente. |
| 04 | **Acceso QR / PIN** | Retiro real simulado: escaneo del QR de un solo uso con haz del lector, y teclado PIN de 6 dígitos funcional (incluye código vencido y PIN incorrecto). |
| 05 | **Cadena de frío** | Gráfica de las dos zonas con sus bandas objetivo, más simulación de apertura de puerta y de corte de energía con entrada del UPS y alerta a la central. |
| 06 | **Instalación en sitio** | La unidad instalada en gasolinera, supermercado y farmacia, con vistas de peatón, vehicular, aérea y de contexto, plano de implantación con holguras y requisitos del sitio. |
| 07 | **Ficha del proyecto** | Datos de la empresa, ventajas, distingos, FODA/CAME y organigrama, tal como están en el documento. |

## Controles del visor

- **Arrastrar** con el botón izquierdo: girar alrededor de la unidad
- **Rueda del ratón**: acercar y alejar
- **Clic derecho arrastrando**: desplazar la vista
- **Flechas ← →** en la escena de entrega: avanzar y retroceder los pasos

## Especificaciones modeladas

La geometría está a escala real, en metros:

- Unidad de **1.86 × 2.42 × 0.80 m** (ancho × alto con corona × profundidad)
- **11 casilleros**: 4 de congelación (A1–A4, −18 °C) y 7 de refrigeración (B1–B2 y C1–C5, 0 a 5 °C)
- Kiosco central con pantalla de 15", lector QR, teclado PIN, cámara domo y lector NFC
- Cara posterior con unidad condensadora de dos circuitos, rejillas de disipación, puerta de
  servicio, UPS y acometida
- Cuatro anclajes al piso con pernos de expansión

## Estructura de archivos

```
friobox-mockups/
├── index.html            Estructura de la página y contenido de los paneles
├── css/styles.css        Sistema de diseño
├── js/locker.js          Modelo 3D de la unidad, pantallas del kiosco y códigos QR
├── js/environments.js    Entornos: estudio, gasolinera, supermercado, farmacia
├── js/app.js             Visor, cámaras, hotspots y lógica de cada escena
└── vendor/               Three.js r128 y OrbitControls (locales, para uso sin internet)
```

## Notas

- Los códigos QR se dibujan con sus patrones de localización reales para que se vean como un
  QR auténtico, pero **no son decodificables**: representan el formato del código de un solo uso.
- Las temperaturas, la gráfica y las alertas provienen de una simulación en el navegador; sirven
  para demostrar el comportamiento del control térmico, no son telemetría real.
- Las personas y vehículos no se modelaron a propósito: las figuras humanas de baja calidad
  restan credibilidad a un mockup de producto.

---

**Grupo 2** · Hilda Eunice Castillo Urbina · Maynor Enrique Rodríguez Ávila ·
Joshua Israel Calderón Sánchez · Génesis Abigahil Ortega Chavarría · María Fernanda Lagos Reyes
Catedrático: Msc. Manuel Vargas · Universidad José Cecilio del Valle · II Parcial, II Período 2026

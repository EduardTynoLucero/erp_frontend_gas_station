# Frontend · ERP Gas Station

Interfaz del ERP de la gasolinera en **Next.js 16 (App Router)**, **React 19** y **Tailwind CSS 4**, con modo claro y
oscuro. Consume la API REST del backend local (`http://localhost:4000/api/v1`). El menú tiene **dos módulos**:

- **Dashboards** (reportería, analítica e indicadores): Tablero de gastos, Dashboard de ventas (réplica de la pestaña
  «Dashboard» del panel del ETL), Indicadores gerenciales, Reportes e **Integraciones**, con la **carga real de
  reportes de BISS al ETL** (arrastrar y soltar, vista previa del servicio ETL y carga).
- **Gastos** (todo el flujo operativo del prototipo `Expenses_project`): Registro de gastos, Solicitudes y
  autorizaciones, Cuentas por pagar y Mis solicitudes sobre la API real; Caja chica, Compras, Proveedores, Contratos,
  Presupuestos y las demás pantallas del prototipo con sus datos simulados mientras el backend no expone sus tablas.

La **protección de rutas** por módulo y pantalla está en `src/proxy.ts`.

> Todo es local: el backend y PostgreSQL corren en esta máquina (ver `../backend/README.md`).

## Puesta en marcha

Requisitos: Node.js 24 y el backend corriendo en el puerto 4000, con la base preparada y sus catálogos.

```bash
# 1. Backend (otra terminal)
cd ../backend
docker compose up -d && npm run db:preparar && npm run db:semilla   # base en cero, solo catálogos
npm run dev

# 2. Frontend
cd ../frontend
cp .env.example .env.local   # API_URL=http://localhost:4000 (ya existe en esta máquina; se lee al arrancar)
npm install
npm run dev                  # http://localhost:3000
```

Usuarios, uno por puesto (contraseña `demo123`). La pantalla de inicio de sesión los lista.

| Usuario | Entra a | Ve |
|---|---|---|
| `admin` | Tablero | todo el menú (24 pantallas) y el dashboard de todas las estaciones |
| `luis.perez`, `ana.morales` | Tablero | Dashboards y Gastos (según su rol) de todas las estaciones |
| `karla.mendez` | Tablero | gastos, caja chica, compras y dashboard de PCONC; sube los reportes de BISS en Integraciones |
| `carmen.ruiz` | Cuentas por pagar | pagos, proveedores, reportes y caja chica de todas las estaciones; sin dashboard |
| `maria.lopez` | Caja chica | su caja chica, sus compras y sus solicitudes |
| `pedro.gomez` | Mis solicitudes | solo lo propio: gastos y requerimientos de compra |
| `jorge.herrera` | Tablero | consulta y auditoría (bitácora, hallazgos) |

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en el puerto 3000 |
| `npm run build` · `npm start` | Compilación de producción y servidor (puerto 3000) |
| `npm run typecheck` | Verificación de tipos |
| `npm run api:tipos` | Regenera `src/api/esquema.d.ts` desde `../backend/openapi/openapi.json` (correr después de `npm run openapi` en el backend) |

## Arquitectura

```
src/
├── proxy.ts                     protección de rutas (en Next.js 16 el middleware se llama proxy)
├── app/
│   ├── layout.tsx · globals.css  fuente Inter, Tailwind 4, tokens de marca y de gráficas (claro/oscuro)
│   ├── login/                    inicio de sesión (fuera del marco)
│   ├── api/v1/auth/renovar/      renueva la sesión con la cookie de refresco y vuelve a la página pedida
│   └── (erp)/                    páginas con el marco del ERP: gastos, autorizaciones, cuentas-por-pagar,
│       │                         mis-solicitudes, dashboard-ventas, integraciones, sin-acceso
│       └── (prototipo)/          las pantallas del prototipo con datos simulados (tablero, caja-chica, compras…)
├── api/                          cliente tipado (openapi-fetch + tipos generados del contrato OpenAPI)
├── componentes/
│   ├── ui/                       botones (BotonAccion con { ok, motivo }), campos, tablas, tarjetas, avisos, modal
│   ├── marco/                    barra lateral con los dos módulos, encabezado, menú de usuario, tema
│   └── proveedores.tsx           tema, React Query, tooltips, notificaciones
├── modulos/
│   ├── gastos/                   datos (React Query), validación, formulario, diálogos y pantallas
│   ├── dashboards/               datos, filtros, formatos, colores por producto, gráficas y pantalla
│   ├── ingesta/                  carga de reportes al ETL: zona de carga, subidas con su vista previa, historial
│   └── prototipo/                el código de Expenses_project/src (mismas rutas de archivo): reglas, datos
│                                 iniciales y pantallas, sobre el marco y los componentes del ERP
└── lib/                          formato de montos sin float, rutas y permisos, marca
```

- **Mismo origen:** `src/proxy.ts` reenvía `/api/v1/*` (menos las rutas propias, como `/api/v1/auth/renovar`) hacia
  `API_URL`, leída en cada petición. No se usan rewrites de `next.config.ts` porque se fijan al compilar y la imagen de
  Docker quedaría atada a un backend. El navegador solo habla con el frontend, así que las cookies httpOnly del
  backend funcionan sin CORS, y la protección CSRF del backend (cabecera `Origin`) las acepta.
- **Datos:** TanStack Query. Las mutaciones actualizan el detalle en caché e invalidan las listas. Los errores de la
  API llegan como `ErrorApi` (problem+json: `codigo`, `detail`, `errores[{ campo, mensaje }]`).
- **Sesión en el navegador:** si una petición responde 401, el cliente renueva el token (`POST /auth/refresh`, una
  sola renovación compartida) y repite la petición. Si no puede renovarla, manda al inicio de sesión.

## Autenticación y permisos (`src/proxy.ts`)

1. **Sin la cookie `erp_acceso`:** va a `/api/v1/auth/renovar`. Esa ruta usa la cookie de refresco; si no hay
   sesión, termina en `/login?destino=…`.
2. **Con la cookie:** el proxy llama a `GET /api/v1/auth/me` del backend con el token (la fuente autorizada) y lee
   `acceso.modulos` y `acceso.pantallas`.
3. **Ruta raíz (`/`):** redirige al inicio de cada usuario, el mismo del prototipo:
   - **cuentas por pagar** si paga pero no autoriza ni configura (Tesorería);
   - **caja chica** si opera caja chica pero no autoriza ni configura;
   - **mis solicitudes** si solo ve lo propio;
   - **Tablero** si lo tiene; si no, el **Dashboard de ventas** si tiene el módulo `dashboards`.
4. **Ruta sin permiso:** redirige a su inicio con `?denegado=`. El marco muestra el aviso «Su usuario no tiene
   acceso a …» y limpia la URL. Si no tiene ninguna pantalla, va a `/sin-acceso`.

| Ruta | Requiere |
|---|---|
| `/dashboard-ventas` | módulo `dashboards` y pantalla `dashboard-ventas` |
| `/gastos` | módulo `gastos` y pantalla `gastos` |
| `/gastos/nuevo`, `/gastos/:id/editar` | `gastos` o `mis-solicitudes`. Solo redirigen: abren el modal sobre el listado (`/gastos?nuevo=1` o `/mis-solicitudes?nuevo=1`) y sobre el detalle (`/gastos/:id?editar=1`) |
| `/gastos/:id` · `/gastos/simulados/:id` | cualquier pantalla de consulta de gastos |
| `/autorizaciones` · `/cuentas-por-pagar` · `/mis-solicitudes` | su pantalla |
| `/inventario` | módulo `dashboards` y pantalla `inventario` (nivel de tanques; «Configurar tanques» con el permiso `configurar_tanques`) |
| `/tomas-fisicas` | módulo `dashboards` y pantalla `tomas-fisicas` (registrar, editar y anular con el permiso `tomas_fisicas`; sin él, solo lectura) |
| `/historial-cargas` | `historial-cargas`, `cargas` o `integraciones` |
| `/integraciones` | `integraciones` o `cargas` (cargar reportes) |
| `/tablero`, `/caja-chica`, `/compras` y demás pantallas con datos simulados | su pantalla y el módulo al que pertenece (`gastos`; `auditoria` para hallazgos y bitácora; `administracion` para usuarios y estaciones) |

El perfil viaja al layout del servidor en la cabecera interna `x-erp-perfil`, así que no se pide dos veces. El backend
vuelve a validar todo (pantallas, permisos, estaciones y RLS): el proxy solo decide la navegación.

## Plantilla visual

El ERP usa la estructura de la plantilla de Digital Labs (plana y compacta) con la paleta de Puma Energy. Los valores
viven en un solo archivo, `src/app/globals.css` (tokens `--ui-*` y escalas de Tailwind redefinidas):

- **Colores:**
  - **Rojo Puma** `#E30613`, `#C20510` al pasar el ratón (`brand-*`, `primario`): botones principales, opción activa
    del menú, bordes destacados e indicadores clave. Fondos suaves `red-50` en claro y `red-950/30` en oscuro.
  - **Verde Puma** `#007A3D`, `#005C2E` el oscuro y `#008F47` en modo oscuro (`emerald-*`): aprobado, completado,
    indicadores positivos y el botón «Aprobar».
  - **Blanco y gris pizarra** (`slate-*` redefinido): en claro, tarjetas `#FFFFFF` sobre fondo `#F8FAFC`; en oscuro,
    fondo `#111417` y tarjetas `#1A1F24`.
  - **Etiquetas de estado:** borrador en gris, por autorizar en ámbar, aprobado en verde suave, pagado en verde lleno y
    rechazado en rojo. El ámbar se queda para lo pendiente y las advertencias. Lo informativo y «en proceso» (en cola,
    revisando) va en pizarra.
- **Geometría:** esquinas de 2 px (4 px en los modales), sin sombras en las tarjetas ni degradados, y la unidad de
  espacio de Tailwind en 3 px (`p-4` son 12 px).
- **Letra:** Inter de 13 px; `text-sm` son 12 px y `text-xs` 11 px.

Las piezas de `src/componentes/ui` reproducen las de la plantilla:

| Pieza | Archivo | Cómo es |
|---|---|---|
| Barra de título | `tarjeta.tsx` (`EncabezadoPagina`) | El nombre de la pantalla como pestaña activa y las acciones planas a la derecha («+ Nuevo…», «Exportar») |
| Datatable fino | `tabla.tsx` | Cabecera de 22 px, filas de 23 px, letra de 10.5 px, franjas y fila roja suave al pasar el ratón; `BarraTabla`, `MostrarRegistros`, `BuscadorTabla`, `PieTabla` («Mostrando 1 a 50 de 240 registros») y `Paginacion` |
| Filtros del listado | `listado.tsx` | «Ver filtros / Ocultar filtros» con el número de filtros activos y «Borrar filtros»; campos de 28 px con etiqueta de 10 px |
| Campos y botones | `campos.tsx`, `boton.tsx` | 30 px de alto, borde fino, foco rojo; botón principal rojo sólido y el de aprobar verde |
| Modal | `modal.tsx` | Centrado, encabezado con título y botón de cerrar, cuerpo con desplazamiento y pie con los botones (`PieDeModal` los pone desde el formulario) |
| Indicadores y tarjetas | `tarjeta.tsx` | Indicador con la franja roja a la izquierda; tarjeta de borde fino con título de 12 px |
| Pestañas, etiquetas y avisos | `pestanas.tsx`, `insignia.tsx`, `aviso.tsx` | Barra de pestañas con la activa en rojo suave; etiquetas redondas de 18 px; avisos de 11 px |

**Lo que se crea, en un modal:** «Nuevo gasto o solicitud» y la edición de un borrador se abren en un modal sobre el
listado o el detalle (`modulos/gastos/componentes/modal-gasto.tsx`), igual que las tomas físicas, la configuración de
tanques y los formularios de las pantallas del prototipo. La barra lateral conserva sus dos módulos y sus opciones en
vertical; la opción activa va en rojo sólido.

## Modo claro y oscuro

- `next-themes` con estrategia de clase (`dark` en `<html>`) y la variante `@custom-variant dark` de Tailwind 4. La
  interfaz usa clases `dark:` y los colores con nombre de la plantilla (`bg-superficie`, `border-borde`,
  `text-tinta`…), que cambian solos con el tema. La plantilla original es solo clara: el modo oscuro la sigue con
  las mismas piezas, el mismo rojo y el verde un poco más claro (`#008F47`). Donde el verde lleva texto blanco (botón
  «Aprobar», etiqueta «Pagado») se queda en `#007A3D` también en oscuro, por contraste.
- El cambio de tema usa la View Transitions API para un fundido suave, que se desactiva con
  `prefers-reduced-motion`.
- Opciones: claro, oscuro o el del sistema (menú de usuario o botón del encabezado).

## Módulo de Gastos

Pantallas:
- **Registro de gastos:** listado de la plantilla (filtros que se ocultan, «Mostrar N registros», buscador y
  páginas), totales del filtro completo y exportación CSV.
- **Nuevo y editar:** en un modal sobre el listado o el detalle. **Detalle:** con flujo, comprobante e historial.
- **Solicitudes y autorizaciones.**
- **Cuentas por pagar y pagos.**
- **Mis solicitudes.**

Comportamiento:
- **Idempotency-Key:** el formulario genera un UUID al abrirse y lo reutiliza en cada reintento. Así, un doble clic o
  una red inestable no crean dos gastos.
- **Montos como texto:** se validan con los mismos patrones del Zod del backend (máximo de decimales por moneda, tipo
  de cambio para USD) y se envían como texto decimal. Los errores por campo del backend (`errores[].campo`) se marcan
  en el campo correspondiente.
- **Botones según el backend:** cada gasto trae `acciones` con `{ ok, motivo }`. `BotonAccion` deshabilita el botón y
  muestra el motivo en un tooltip accesible (por ejemplo, «Supera su límite de Q1,000.00. Lo autoriza: Contador
  corporativo.»).

## Menú: dos módulos

La barra lateral tiene solo dos secciones desplegables, **Dashboards** y **Gastos**, sin las fases del prototipo. El
módulo de cada pantalla y su orden los da el backend (`iam.pantalla.grupo` y `orden`, migración 0004). Cada usuario ve
solo sus pantallas. Si un módulo está cerrado, su encabezado suma los pendientes de sus pantallas. Lo abierto o
cerrado se recuerda por usuario en este navegador, y el módulo de la página abierta siempre se ve.

Jerarquía visual (`src/componentes/marco/barra-lateral.tsx`): cada módulo es un bloque, separado del otro por un
espacio con un divisor. Su encabezado es una tarjeta (fondo de barra, borde y franja roja a la izquierda) con el
título en mayúsculas de 13 px en negrita y la flecha del acordeón en un recuadro a la derecha; la descripción del
módulo queda solo como ayuda al pasar el ratón. Las pantallas van debajo con sangría, letra de 11.5 px y una línea guía
vertical con un ramal por opción; la opción activa va en rojo sólido. Un nombre largo pasa a dos líneas en vez de
cortarse. Los colores son los de la plantilla, que cambian solos con el tema claro u oscuro.

| Módulo | Pantallas | Datos |
|---|---|---|
| Dashboards | Tablero de gastos · Dashboard de ventas · Indicadores gerenciales · Reportes · Integraciones | Dashboard de ventas y carga de reportes (Integraciones): reales (ETL). Tablero, Indicadores y Reportes: simulados |
| Gastos | Mis solicitudes · Registro de gastos · Solicitudes y autorizaciones · Cuentas por pagar · Caja chica · Compras · Proveedores · Contratos · Recurrentes · Presupuestos · Prorrateo · Franquicia · Alertas · Hallazgos · Auditoría · Catálogos · Estaciones · Usuarios y roles · Configuración | Las cuatro primeras: API real. Las demás: simuladas |

## Integraciones: carga de reportes al ETL

La zona de carga del panel del ETL, dentro del ERP y con su seguridad:

1. **Subir:** se arrastran (o se eligen) uno o varios `.xlsx` de BISS, la Consulta de Tickets o el Reporte de compras.
   Cada archivo viaja tal cual a `POST /api/v1/ingesta/subidas`, con una barra de avance. El backend lo guarda en la
   carpeta compartida con el servicio ETL y deja la solicitud en la cola `ingesta.solicitud`.
2. **Revisión del servicio ETL:** el servicio la toma en segundos, con el mismo código del panel: lee, valida, cuadra
   contra los totales del propio reporte y compara con la base. La tarjeta muestra:
   - qué trae: tickets o líneas, venta, galones, estación y periodo;
   - si cuadra y sus errores o advertencias;
   - **«Qué pasará en la base»**, la comparación del panel del ETL: tickets (o compras) nuevos, los que se actualizan
     y qué datos cambian, los que quedan iguales y los que pierden su factura; el aviso de revisar si es una
     exportación más vieja; y si es un archivo repetido, que no se deja cargar.

   El detalle («Ver tickets comparados con la base…») trae la tabla del panel: cada ticket con «En la base» (Nuevo,
   Cambia y qué, Sin cambio) y su revisión, con los filtros Con revisión, Sin factura, Nuevos y Se actualizan, por
   producto, buscador y páginas (`GET /ingesta/subidas/:id/tickets`). En un Reporte de compras, sus líneas con lo
   mismo. Debajo siguen los productos, el cuadre y las incidencias.

   Si entra otra carga mientras un archivo espera, el servicio lo compara otra vez solo y la tarjeta se actualiza.
   Cuando el archivo ya se cargó, la tarjeta muestra el resultado real y la tabla de la vista previa se cierra.
3. **Cargar:** «Cargar al ETL» solo se habilita si la revisión salió bien; si no, el botón dice por qué. Al
   confirmar, el servicio carga con su pipeline completo: staging, modelo de ventas, vistas de mart y `ANALYZE`. La
   tarjeta muestra el resultado y el enlace al Dashboard de ventas, que se pone al día solo en menos de 30 s.

Más detalles de la pantalla:
- **Estado del servicio:** arriba se ve si el servicio ETL está escuchando la cola. Si no lo está, los archivos esperan
  en cola y la pantalla dice cómo encenderlo.
- **Historial de cargas del ETL:** las últimas 30 de las estaciones del usuario, vengan del navegador, de la carpeta
  vigilada o del panel del ETL.
- **Quién ve qué:**
  - subir y cargar: el permiso «Subir y cargar reportes de BISS al ETL», más la pantalla de cargas o la de
    integraciones;
  - solo consultar el historial: la pantalla de historial de cargas, por ejemplo el auditor.
- **Alcance:** un gerente solo carga reportes de su estación; el backend lo revisa con las estaciones que encontró la
  revisión.
- **Tamaño de los archivos:** hasta 50 MB; uno más grande lo rechaza la pantalla antes de subirlo. Los reportes reales
  pasan de 10 MB (una Consulta de Tickets de varias semanas pesa unos 18). Como la aplicación tiene `proxy.ts`, Next.js
  guarda el cuerpo de cada petición y por defecto solo los primeros 10 MB: el archivo llegaba cortado al backend y la
  subida terminaba en un error 500 («Request body exceeded 10MB», «socket hang up»). Por eso `next.config.ts` fija
  `experimental.proxyClientMaxBodySize` en 64 MB. Al cambiar `next.config.ts` hay que reiniciar `npm run dev`.

## Pantallas del prototipo con datos simulados

Las pantallas que el backend todavía no expone trabajan con el motor del propio prototipo y datos simulados, igual que
su versión de un solo archivo. Registro de gastos, Solicitudes y autorizaciones, Cuentas por pagar, Mis solicitudes, el
Dashboard de ventas y la carga de reportes están conectados a la API real.

Los dos lados están separados. Un gasto del Registro de gastos (backend) todavía no aparece en el Tablero de gastos,
Indicadores, Reportes ni en las demás pantallas simuladas, que leen solo lo registrado en ellas.

Cómo funciona (`src/modulos/prototipo`, el código de `Expenses_project/src` con las mismas rutas de archivo):

- **Mismas reglas:** cada acción (desembolso, liquidación, requerimiento, cotización, orden, contrato, presupuesto,
  prorrateo…) pasa por `lib/acciones.ts`, con los mismos permisos, validaciones y bitácora del prototipo.
- **Datos en este navegador, en cero:** la primera vez se cargan solo los catálogos (`data/seed.ts` y `data/*.json`,
  en un archivo aparte que no pesa en las demás pantallas):
  - empresa, PCONC y Oficina central, unidades, centros de costo, roles, usuarios, categorías, proveedores reales y
    parámetros;
  - el fondo de caja chica de PCONC (Q3,000, a cargo de `maria.lopez`), porque el fondo no se crea desde las
    pantallas.

  No hay gastos, ventas, presupuestos, compras, contratos, recurrentes, hallazgos ni bitácora: se registran en las
  pantallas. La fecha del sistema es la de la PC el día de la primera carga y se cambia en *Configuración*. Los
  cambios quedan en el `localStorage` del navegador y se ven en las otras pestañas. *Configuración → Restablecer datos*
  vuelve a cero, solo en este navegador. Lo guardado por versiones anteriores, con la demostración de octubre, se
  descarta solo (`ESQUEMA` 2 en `lib/local.ts`).
- **La sesión manda:** no hay otro inicio de sesión. El usuario simulado es el de la sesión real, con el mismo nombre
  de usuario, y toma del backend su rol, permisos, pantallas, estaciones, límite y alcance.
- **Mismo filtro de estación:** el del encabezado del ERP, traducido por código (PCONC, OFC…).
- **Marca discreta:** un ícono gris junto al título explica en su tooltip que la pantalla usa datos simulados.
  En *Usuarios y roles*, un aviso aclara que ahí no se cambia el acceso real.
- **Gastos simulados:** los enlaces del Tablero, Alertas, Compras, Franquicia, Indicadores y Prorrateo abren el gasto en
  `/gastos/simulados/:id`. Ahí se aprueba, rechaza, paga, adjunta o verifica el comprobante, como en el prototipo. No
  tiene formulario de edición: el de *Registro de gastos* trabaja con el backend.
- **Componentes:** las pantallas usan los mismos nombres de componentes del prototipo (`components/ui.tsx`), pero
  dibujados con los del ERP, así que tienen modo oscuro.
- **Números del menú:** Alertas y Hallazgos muestran sus pendientes, como en el prototipo. Se calculan en un archivo
  aparte que se carga después de mostrar la página.
- **Pantallas sin página:** cargar reportes e historial de cargas viven en Integraciones. Inventario y tanques y tomas
  físicas todavía no tienen página y no se listan en el menú.

Para pasar una pantalla al backend: el esquema ya tiene sus tablas (`expenses.presupuesto`, `caja_chica`,
`orden_compra`, `contrato`, `recurrente`, `prorrateo`; `audit.evento`, `audit.hallazgo`). Falta exponerlas en la API y
cambiar en la pantalla `useStore()` por consultas a la API, como en el módulo de Gastos.

## Dashboard de ventas

Réplica de la pestaña «Dashboard» del panel del ETL, sobre `GET /api/v1/dashboards/ventas/opciones` y `/ventas`.
Estos son los mismos que en el panel:

- **Filtros y su lógica:**
  - Desde, Hasta, Estación, Producto y Rango rápido (Todo, Últimos 7 días, Últimos 30 días, Este mes, Mes anterior);
  - los rangos se calculan desde el último día con datos;
  - las fechas se aplican a los 700 ms y la estación y el producto a los 300 ms;
  - las fechas se recortan en silencio y nunca se intercambian;
  - «Mes anterior» se desactiva con su motivo cuando no hay datos de ese mes;
  - con una carga nueva del ETL, los filtros se reajustan.
- **Actualización sola:** mientras la pestaña está visible, el dashboard revisa cada 30 s si el servicio ETL publicó
  una carga nueva (`ultimaCarga` de `/dashboards/ventas/opciones`, unos 30 ms). Si la hay, se renueva sin recargar la
  página. La prueba de punta a punta (`cd ../etl && npm run e2e`) lo comprueba con el navegador.
- **Seis indicadores**, con las mismas fórmulas y textos. La comparación contra el periodo anterior lleva ▲/▼ y la
  nota del corte del último día.
- **Cinco filas:** Ventas por día, Por producto, Utilidad por galón, ¿Cuándo se vende? (mapa de calor), Ventas por
  turno, Facturación, Clientes top 10, Tickets para revisar y Tickets que faltan.
- **Cada gráfica:**
  - botón «Ver tabla» con su tabla equivalente y totales;
  - leyenda que oculta o muestra series;
  - tooltips con el mismo contenido.
- **Colores por producto, fijos por nombre:** DIESEL azul, REGULAR naranja, SUPER verde, SIN PRODUCTO gris. No
  cambiaron con la paleta de Puma Energy, para no confundir los combustibles.
- **Mapa de calor:** escala secuencial en rojo Puma, que se invierte en oscuro. Las gráficas de una sola serie que no
  son de un producto (facturación, clientes) también van en rojo (`--acento`). En la cascada de inventario, las
  compras van en verde, las ventas en rojo y el ajuste por toma física en pizarra.
- **Colores de estado** (`--estado-*`: íconos, veredictos y semáforo de los tanques): verde y rojo Puma, ámbar para
  pedir pronto y pizarra para programar o informar.
- **Estados:**
  - «Consultando el modelo…»;
  - error con «Reintentar»;
  - «Todavía no hay datos en el modelo»;
  - «Sin ventas con estos filtros»;
  - aviso de vistas atrasadas.

Diferencias a propósito con el panel:

| Diferencia | Por qué |
|---|---|
| Marco y estilo del ERP (la plantilla con la paleta de Puma Energy), título de página y textos del estado vacío adaptados al ERP | Consistencia con el resto del sistema |
| Al cambiar filtros se conservan la medida elegida y la vista gráfica/tabla; lo ya dibujado queda atenuado mientras llega lo nuevo | El panel reiniciaba todo en cada consulta |
| Montos formateados desde el texto decimal exacto de la API | Sin redondeos de float |
| Las gráficas aparecen con un fundido CSS de 250 ms, no con la animación de Recharts | La animación de Recharts 3 se quedaba a medio camino en desarrollo y dejaba barras, líneas y etiquetas a medio dibujar |
| El valor de los indicadores ajusta su tamaño al ancho de la tarjeta | Con la barra lateral las tarjetas son más angostas |
| `--s5` oscuro pasa de `#d55181` a `#b9457f` (solo un cuarto producto) | Junto a SUPER oscuro no se distinguía con deuteranopía |
| El ícono de «Ver tabla» se ve | En el panel medía 0×0 por un CSS faltante |

## Verificación

| Prueba | Resultado |
|---|---|
| Tipos y compilación | `npm run typecheck` sin errores; `npm run build` compila todas las rutas |
| Prueba de punta a punta contra `localhost:3000` (desarrollo y producción) | Las redirecciones del proxy coinciden con las pantallas de los 10 usuarios. Gastos: Idempotency-Key (reintento, conflicto 422, falta 400), monto con 3 decimales → 422 en `monto`. Flujo crear → aprobar → pagar con FEL; `pagar` deshabilitado sin comprobante y aprobar deshabilitado sobre el límite, ambos con su motivo |
| Dashboard en Chrome sin interfaz | 1440 y 820 px, claro y oscuro, vista de tablas. Rangos rápidos con comparación y corte, recorte de fechas, Desde > Hasta, filtro de estación y tooltips |
| De punta a punta con el servicio ETL (Paso 4, `../etl`: `npm run e2e`) | El dashboard abierto como `karla.mendez` pasa solo, sin recargar, de «Todavía no hay datos» al lote que acaba de cargar el ETL (tickets, venta y rango iguales a la API), sin errores de JavaScript |
| Menú de dos módulos y pantallas (Chrome sin interfaz) | 7 usuarios, 88 pantallas abiertas desde su menú: todas con su encabezado y sin errores de JavaScript. Solo dos módulos, Dashboards y Gastos, sin fases. Cada usuario entra a su inicio. Capturas en claro y oscuro |
| Todo en cero (base vaciada con `db:vaciar` y navegador nuevo) | 8 usuarios, 108 pantallas abiertas desde su menú sin errores de JavaScript. Ninguna muestra `NaN`, `Infinity`, `undefined` ni rastros de la demostración (folios, PDEM, «1 al 10 oct»). Las tarjetas vacías dicen «Todavía no hay…» en claro y oscuro |
| Primera carga desde cero (Integraciones, como `karla.mendez`) | Con el ETL vacío, un reporte de 36 tickets se revisa en 2.4 s y se carga en 2.3 s como carga 1. El ETL vuelve a crear la estación y los productos, y el dashboard pasa de 0 a 36 tickets |
| Carga real desde Integraciones (Chrome sin interfaz, como `karla.mendez`) | Se suelta un reporte de 36 tickets. El servicio ETL lo revisa en 2.3 s: cuadra, 36 nuevos. Al cargarlo, termina en 2.4 s (carga 9, `ANALYZE` incluido) y la carga aparece en el historial. La API del dashboard cuenta 36 tickets más y `etl.carga` guarda quién lo subió |
| Servicio ETL apagado | La subida queda en cola y la pantalla lo avisa; al encender el servicio la revisa sola en 4 s |
| Operación de las pantallas restauradas | Desembolso y liquidación de caja chica (el saldo cambia y el desembolso queda «En reposición»), y los datos siguen ahí al recargar. Requerimiento de compra. Gasto simulado aprobado desde el Tablero. El filtro de estación del encabezado cambia el Tablero y la Caja chica |
| Proxy con las rutas nuevas | Sin sesión → renovar o iniciar sesión. Sin la pantalla → su inicio con `?denegado=` (Solicitante en `/tablero`, Tesorería en `/usuarios`, Gerente en `/hallazgos` y `/configuracion`, Auditor en `/usuarios`) |

## Pendiente

- **Conectar al backend las pantallas con datos simulados:** las tablas ya existen; faltan sus endpoints (ver
  «Pantallas del prototipo con datos simulados»).
- **Vista previa de la carga:** las gráficas de la vista previa (por día, por turno, por hora, facturación) siguen
  solo en el panel del ETL (`npm run panel` en `../etl`). La comparación con la base y la tabla ticket por ticket ya
  están en Integraciones.
- **Comprobantes:** adjuntar archivos y verificarlos; hoy el comprobante es el documento del gasto (FEL o recibo).

El servicio ETL independiente y la prueba de punta a punta están en `../etl`, y el orden para encender todo el ERP, en el
`README.md` de la raíz.

## Docker y Dokploy

`next.config.ts` usa `output: 'standalone'`. El `Dockerfile` sigue el ejemplo oficial de Next.js:

1. Instala las dependencias.
2. Compila con `npm run build`.
3. Copia a la imagen final solo `.next/standalone` (con su `server.js`), `.next/static` y `public/`.
4. La imagen final es Node 24 Alpine, con usuario sin privilegios, `tini` como PID 1 y zona horaria de Guatemala.

| Dato | Valor |
|---|---|
| Dockerfile | `Dockerfile` (contexto `.`, etapa `production` o vacía) |
| Puerto interno | `3000` (en Dokploy, el dominio público apunta a este puerto) |
| Salud | `GET /login` (también es el `HEALTHCHECK` de la imagen) |
| Ya trae | `NODE_ENV=production`, `PORT=3000`, `HOSTNAME=0.0.0.0`, `TZ=America/Guatemala` |

La única variable obligatoria es **`API_URL`**: la dirección del backend dentro de la red de Dokploy, por ejemplo
`http://<App Name del backend>:4000`. Se lee al arrancar, no al compilar, así que no va en «Build-time Arguments». Sin
ella, en producción el servidor responde con error y lo dice en el log.

Diferencias de la compilación de producción:

- **Inicio de sesión:** no muestra la lista de usuarios de demostración ni su contraseña, ni las notas del entorno local.
- **Redirecciones:** la renovación de sesión redirige con rutas relativas. En el contenedor, `request.url` trae la
  dirección interna (`http://0.0.0.0:3000`) y no el dominio del usuario.

## Notas

- `next dev` crea `AGENTS.md` en esta carpeta (lo vuelve a crear en cada arranque). Se desactiva con
  `agentRules: false` en `next.config.ts`.
- El botón «N» abajo a la izquierda es el indicador de desarrollo de Next.js; no aparece en producción.

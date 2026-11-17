# Frontend · ERP Gas Station

Interfaz del ERP de la gasolinera en **Next.js 16 (App Router)**, **React 19** y **Tailwind CSS 4**, con modo claro y
oscuro. Consume la API REST del backend (`/api/v1`, en la PC `http://localhost:4000`). El menú tiene **dos módulos**:

- **Dashboards** (reportería, analítica e indicadores): Tablero de gastos, Dashboard de ventas (réplica de la pestaña
  «Dashboard» del panel del ETL), Indicadores gerenciales, Reportes e **Integraciones**, con la **carga real de
  reportes de BISS al ETL** (arrastrar y soltar, vista previa del servicio ETL y carga).
- **Gastos** (todo el flujo operativo): Registro de gastos, Solicitudes y autorizaciones, Cuentas por pagar, Mis
  solicitudes, Caja chica, Compras, Proveedores, Contratos, Recurrentes, Presupuestos, Prorrateo, Franquicia, Alertas,
  Hallazgos, Auditoría, Catálogos, Estaciones, Usuarios y roles y Configuración.

**Todas las pantallas trabajan con la base por la API del backend.** No hay pantallas con datos simulados, ni datos
escritos en el código, ni nada guardado en `localStorage` o `sessionStorage` (ver «Pantallas conectadas a la API»).

La **protección de rutas** por módulo y pantalla está en `src/proxy.ts`.

> En desarrollo todo es local: el backend y PostgreSQL corren en esta máquina (ver `../backend/README.md`). En
> producción (Dokploy), ver `../CONFIGURACION_DOKPLOY.txt`.

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

Usuarios de la base local, uno por puesto (los crea `npm run db:semilla` con la contraseña `demo123`). La pantalla de
inicio de sesión no lista usuarios ni trae contraseñas: los usuarios viven en la base y se administran en *Usuarios y
roles*; cada quien cambia su contraseña en el menú de usuario → *Cambiar contraseña*.

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
│   └── (erp)/                    páginas con el marco del ERP, una carpeta por pantalla: gastos, autorizaciones,
│                                 cuentas-por-pagar, mis-solicitudes, tablero, indicadores, reportes, alertas,
│                                 hallazgos, auditoria, caja-chica, compras, proveedores, contratos, recurrentes,
│                                 presupuestos, prorrateo, franquicia, catalogos, estaciones, usuarios, configuracion,
│                                 dashboard-ventas, inventario, tomas-fisicas, historial-cargas, integraciones
├── api/                          cliente tipado (openapi-fetch + tipos generados del contrato OpenAPI)
├── componentes/
│   ├── ui/                       botones (BotonAccion con { ok, motivo }), campos, tablas, tarjetas, avisos, modal,
│   │                             barras y columnas de las pantallas de gastos
│   ├── marco/                    barra lateral con los dos módulos, encabezado, menú de usuario (tema y cambio de
│   │                             contraseña), preferencias de interfaz (guardadas en la base) y tema
│   └── proveedores.tsx           tema, React Query, tooltips, notificaciones
├── modulos/                      un módulo por pantalla o grupo de pantallas: datos.ts (consultas y acciones con
│   │                             TanStack Query sobre la API) y pantallas/ y componentes/
│   ├── gastos/                   registro, autorizaciones, cuentas por pagar, mis solicitudes y detalle del gasto
│   ├── tablero/ indicadores/ reportes/ alertas/ franquicia/      analítica de gastos (cifras calculadas por el backend)
│   ├── hallazgos/ auditoria/     control: hallazgos del ETL y bitácora
│   ├── caja-chica/ compras/ presupuestos/ prorrateo/             operación financiera
│   ├── proveedores/ contratos/ recurrentes/ catalogos/           datos maestros
│   ├── usuarios/ estaciones/ configuracion/                      administración
│   ├── dashboards/ operacion/    dashboard de ventas, inventario y tanques, tomas físicas (datos del ETL)
│   └── ingesta/                  carga de reportes al ETL: zona de carga, subidas con su vista previa, historial
└── lib/                          formato de montos sin float, rutas y permisos, marca, tema, CSV, mensajes por entorno
```

- **Mismo origen:** `src/proxy.ts` reenvía `/api/v1/*` (menos las rutas propias, como `/api/v1/auth/renovar`) hacia
  `API_URL`, leída en cada petición. No se usan rewrites de `next.config.ts` porque se fijan al compilar y la imagen de
  Docker quedaría atada a un backend. El navegador solo habla con el frontend (en producción,
  `https://gasstationconcepcion.belsoftinc.net`; el cliente usa rutas relativas, `/api/v1/...`), así que las cookies httpOnly
  del backend quedan solo en este subdominio y funcionan sin CORS, y la protección CSRF del backend (cabecera `Origin`)
  las acepta. En producción el reenvío va a `https://backend-gas-station.belsoftinc.net`, con la IP real del usuario
  aparte (`X-Erp-Ip-Cliente` + `SECRETO_REENVIO`). El frontend no llama al ETL: lo que el ETL deja en la base lo sirve
  el backend.
- **Datos:** TanStack Query. Las mutaciones actualizan el detalle en caché e invalidan las listas. Los errores de la
  API llegan como `ErrorApi` (problem+json: `codigo`, `detail`, `errores[{ campo, mensaje }]`).
- **Sesión en el navegador:** si una petición responde 401, el cliente renueva el token (`POST /auth/refresh`, una
  sola renovación compartida) y repite la petición. Si no puede renovarla, manda al inicio de sesión.
- **Nada en `localStorage` ni `sessionStorage`:** lo que la interfaz recuerda de cada usuario (módulos del menú
  abiertos, filtros a la vista, estación del filtro del encabezado, estación elegida en Inventario y Tomas físicas) es
  una preferencia guardada en la base (`iam.usuario_preferencia`, `GET`/`PUT /api/v1/preferencias`) y lo acompaña a
  cualquier equipo: `usePreferencia(clave, porDefecto)` en `componentes/marco/preferencias.tsx`. El layout del servidor
  las entrega con la página, así el menú sale como el usuario lo dejó, sin parpadeo. El **tema** claro u oscuro es lo
  único que se recuerda en el navegador, en la cookie `erp_tema`, porque debe aplicarse antes de iniciar sesión y
  antes de pintar (`lib/tema.ts`; no se usa `next-themes`).
- **Mensajes según el entorno:** en la PC los avisos de «sin conexión» y «ETL apagado» dicen cómo encender el servicio
  (`npm run dev`); en producción solo dicen qué pasa y a quién avisar (`lib/entorno.ts`).

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
| `/gastos/:id` | cualquier pantalla de consulta de gastos (qué gasto ve cada quien lo decide el backend) |
| `/autorizaciones` · `/cuentas-por-pagar` · `/mis-solicitudes` | su pantalla |
| `/inventario` | módulo `dashboards` y pantalla `inventario` (nivel de tanques; «Configurar tanques» con el permiso `configurar_tanques`) |
| `/tomas-fisicas` | módulo `dashboards` y pantalla `tomas-fisicas` (registrar, editar y anular con el permiso `tomas_fisicas`; sin él, solo lectura) |
| `/historial-cargas` | `historial-cargas`, `cargas` o `integraciones` |
| `/integraciones` | `integraciones` o `cargas` (cargar reportes) |
| `/tablero`, `/caja-chica`, `/compras` y las demás pantallas de gastos, control y administración | su pantalla y el módulo al que pertenece (`gastos`; `auditoria` para hallazgos y bitácora; `administracion` para usuarios y estaciones) |

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
cerrado se recuerda por usuario en la base (preferencia `menu`), y el módulo de la página abierta siempre se ve. Los
números de Alertas y Hallazgos salen de `GET /api/v1/alertas/contadores`.

Jerarquía visual (`src/componentes/marco/barra-lateral.tsx`): cada módulo es un bloque, separado del otro por un
espacio con un divisor. Su encabezado es una tarjeta (fondo de barra, borde y franja roja a la izquierda) con el
título en mayúsculas de 13 px en negrita y la flecha del acordeón en un recuadro a la derecha; la descripción del
módulo queda solo como ayuda al pasar el ratón. Las pantallas van debajo con sangría, letra de 11.5 px y una línea guía
vertical con un ramal por opción; la opción activa va en rojo sólido. Un nombre largo pasa a dos líneas en vez de
cortarse. Los colores son los de la plantilla, que cambian solos con el tema claro u oscuro.

| Módulo | Pantallas | Datos |
|---|---|---|
| Dashboards | Tablero de gastos · Dashboard de ventas · Indicadores gerenciales · Reportes · Integraciones | Todo de la base: ventas, inventario y cargas del ETL; tablero, indicadores y reportes calculados por el backend sobre los gastos |
| Gastos | Mis solicitudes · Registro de gastos · Solicitudes y autorizaciones · Cuentas por pagar · Caja chica · Compras · Proveedores · Contratos · Recurrentes · Presupuestos · Prorrateo · Franquicia · Alertas · Hallazgos · Auditoría · Catálogos · Estaciones · Usuarios y roles · Configuración | Todo de la base, por la API del backend |

## Integraciones: carga de reportes al ETL

La zona de carga del panel del ETL, dentro del ERP y con su seguridad:

1. **Subir:** se arrastran (o se eligen) uno o varios `.xlsx` de BISS, la Consulta de Tickets o el Reporte de compras.
   Cada archivo viaja tal cual a `POST /api/v1/ingesta/subidas`, con una barra de avance. El backend lo guarda en la
   base (`ingesta.archivo`) en la misma transacción en que deja la solicitud en la cola `ingesta.solicitud`: el
   backend y el servicio ETL no comparten ninguna carpeta (en Dokploy son contenedores distintos).
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

## Pantallas conectadas a la API

Todas las pantallas leen y guardan en PostgreSQL por la API del backend. El motor del prototipo (`modulos/prototipo`,
con sus datos simulados en `localStorage`) se eliminó: no queda ninguna pantalla simulada, ningún dato escrito en el
código ni la marca de «datos simulados». Un gasto registrado aparece enseguida en el Tablero, los Indicadores, los
Reportes, las Alertas y el resto, porque todo sale de las mismas tablas.

| Pantalla (ruta) | API del backend | Tablas |
|---|---|---|
| Tablero de gastos (`/tablero`) · Indicadores gerenciales (`/indicadores`) · Reportes (`/reportes`) · Franquicia (`/franquicia`) | `GET /api/v1/tablero`, `/indicadores`, `/reportes`, `/franquicia` | `expenses.gasto`, `expenses.presupuesto` y las ventas del ETL (`dashboards.v_ventas_mensuales`) |
| Alertas (`/alertas`) | `GET /api/v1/alertas`, `/alertas/contadores` | calculadas sobre gastos, presupuestos, contratos, caja chica y cargas del ETL |
| Hallazgos (`/hallazgos`) | `/api/v1/hallazgos` (registrar, analizar los reportes del ETL, cambiar estado, registrar como gasto) | `audit.hallazgo` |
| Auditoría y trazabilidad (`/auditoria`) | `GET /api/v1/auditoria` | `audit.evento` (inmutable) |
| Caja chica (`/caja-chica`) | `/api/v1/caja-chica` (abrir caja, desembolsos, liquidar) | `expenses.caja_chica`, `caja_movimiento`, `caja_liquidacion` |
| Compras (`/compras`) | `/api/v1/compras` (requerimiento, cotizaciones, orden, recepción) | `expenses.orden_compra`, `orden_cotizacion` |
| Presupuestos (`/presupuestos`) · Prorrateo (`/prorrateo`) | `/api/v1/presupuestos`, `/api/v1/prorrateo` | `expenses.presupuesto`, `prorrateo`, `gasto_distribucion` |
| Proveedores · Contratos · Recurrentes | `/api/v1/proveedores`, `/contratos`, `/recurrentes` | `expenses.proveedor`, `contrato`, `recurrente` |
| Catálogos (`/catalogos`) | `/api/v1/catalogos` | `expenses.categoria`, `subcategoria`, `centro_costo`; `org.unidad_negocio` |
| Estaciones (`/estaciones`) | `/api/v1/estaciones` | `org.empresa`, `org.estacion`, `org.estacion_unidad` |
| Usuarios y roles (`/usuarios`) | `/api/v1/usuarios` (usuarios, roles, permisos, pantallas, contraseñas) | `iam.usuario`, `rol`, `rol_permiso`, `rol_pantalla`, `usuario_estacion`, `credencial` |
| Configuración (`/configuracion`) | `/api/v1/configuracion` | `expenses.parametro` (fecha del sistema, periodo, comprobante obligatorio, tope de caja chica, alertas, prorrateo, comisión de tarjeta, merma) y `expenses.nivel_autorizacion` |

Cómo está hecha cada una (`src/modulos/<pantalla>/`, con el módulo de Gastos como modelo):

- **`datos.ts`:** consultas y acciones con TanStack Query sobre el cliente tipado (`api`/`pedir`). Los tipos salen del
  contrato OpenAPI del backend (`npm run api:tipos`), no se declaran a mano.
- **Las reglas están en el backend:** permisos, validaciones, bitácora y cálculos. La pantalla muestra u oculta con
  las banderas que trae la respuesta (`puedeEditar`, `acciones.x { ok, motivo }`) y enseña el mensaje del backend.
- **Dinero exacto:** llega y se envía como texto decimal; los totales y porcentajes los calcula el backend
  (NUMERIC), nunca el navegador.
- **Base en cero:** producción arranca solo con catálogos. Cada pantalla se explica sola cuando todavía no hay nada
  («Todavía no hay…») y todo se registra desde ella (por ejemplo, la caja chica se abre desde su pantalla).
- **Mismo filtro de estación:** el del encabezado del ERP (`useErp().estacionId`).
- **Detalle del gasto:** los enlaces del Tablero, Alertas, Compras, Franquicia, Indicadores, Prorrateo y Caja chica
  abren `/gastos/:id`, donde se aprueba, rechaza, paga, se adjunta la foto o el PDF del comprobante y Contabilidad
  marca la factura como verificada.
- **Cargar reportes e historial de cargas** viven en Integraciones.

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
| Pantallas conectadas a la API, en navegador (Chrome sin interfaz, build de producción con `next start`, backend y base propios) | Los 8 usuarios abren todas las pantallas de su menú (119 en total: admin 27, contador 22, gerencia y auditor 21, gerente de estación 15, tesorería 6, caja chica 4, solicitante 3) sin excepciones de JavaScript, sin errores de consola, sin respuestas ≥ 400 de la API y sin `NaN`, `undefined` ni `Infinity`; antes y después de registrar datos |
| Flujos de escritura por la interfaz (clics y teclado) | Proveedor, categoría con subcategorías y centro de costo; contrato y renovación; plantilla recurrente y su gasto; presupuesto y copia al mes siguiente; prorrateo (aplicar y quitar); caja chica (abrir, desembolsar, liquidar); compra completa (requerimiento, dos cotizaciones, orden, recepción y su gasto); gasto registrado, enviado, aprobado, con PDF adjunto, verificado y pagado; hallazgo a mano, análisis de reportes del ETL y pérdida registrada como gasto; usuario, rol y contraseña; empresa (el encabezado cambia); configuración; cambio de contraseña y de tema |
| Nada en el almacenamiento del navegador | `localStorage` y `sessionStorage` vacíos para los 8 usuarios después de recorrer todo. El tema queda en la cookie `erp_tema`; un módulo del menú cerrado sigue cerrado al recargar (preferencia en la base) |
| Base en cero (solo catálogos, como arranca producción) | `admin` (27 pantallas) y `karla.mendez` (15) sin errores: cada pantalla explica su vacío («Todavía no hay…») |
| Proxy con las rutas nuevas | Sin sesión → renovar o iniciar sesión. Sin la pantalla → su inicio con `?denegado=` (Solicitante en `/tablero`, Tesorería en `/usuarios`, Gerente en `/hallazgos` y `/configuracion`, Auditor en `/usuarios`) |

## Pendiente

- **Vista previa de la carga:** las gráficas de la vista previa (por día, por turno, por hora, facturación) siguen
  solo en el panel del ETL (`npm run panel` en `../etl`). La comparación con la base y la tabla ticket por ticket ya
  están en Integraciones.
- **Verificación de facturas contra la SAT:** hoy «Verificada» es la revisión que registra Contabilidad en el detalle
  del gasto (quién y cuándo); no hay consulta automática al portal de la SAT.

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
| Puerto interno | `3000` |
| Dominio | `https://gasstationconcepcion.belsoftinc.net` (en Dokploy: ese host, puerto `3000`, HTTPS) |
| Salud | `GET /login` (también es el `HEALTHCHECK` de la imagen) |
| Ya trae | `NODE_ENV=production`, `PORT=3000`, `HOSTNAME=0.0.0.0`, `TZ=America/Guatemala` |

Variables (se leen al arrancar, no al compilar: no van en «Build-time Arguments»):

- **`API_URL`:** el subdominio del backend, `https://backend-gas-station.belsoftinc.net`. Si no se pone, en producción
  es ese mismo (`URL_BACKEND_PRODUCCION` en `src/lib/servidor/constantes.ts`); nunca `localhost`. No puede ser la
  dirección de este frontend: el reenvío de `/api/v1` volvería a entrar aquí sin fin. `proxy.ts` lo detecta (compara el
  destino con el dominio de la petición), responde `508` y lo anota en el log.
- **`SECRETO_REENVIO`:** el mismo valor que en el backend. Al pasar por el subdominio del backend, Traefik reemplaza la
  IP del usuario por la del servidor; con el secreto, el frontend se la manda aparte y el límite de inicios de sesión
  sigue contando por usuario.

Si el servidor no pudiera llegar a sus propios subdominios (raro), `API_URL` también acepta la dirección interna del
backend en la red de Dokploy: `http://<App Name del backend>:4000`. La configuración de los tres proyectos está en
`CONFIGURACION_DOKPLOY.txt`, en la carpeta raíz.

Diferencias de la compilación de producción:

- **Inicio de sesión:** no muestra la lista de usuarios de demostración ni su contraseña, ni las notas del entorno local.
- **Redirecciones:** la renovación de sesión redirige con rutas relativas. En el contenedor, `request.url` trae la
  dirección interna (`http://0.0.0.0:3000`) y no el dominio del usuario.

## Notas

- `next dev` crea `AGENTS.md` en esta carpeta (lo vuelve a crear en cada arranque). Se desactiva con
  `agentRules: false` en `next.config.ts`.
- El botón «N» abajo a la izquierda es el indicador de desarrollo de Next.js; no aparece en producción.

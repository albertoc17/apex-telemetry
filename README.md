# APEX Telemetry

Tu copiloto digital para **DiRT Rally 2.0** y **Euro Truck Simulator 2 en PC Windows**. Dashboard web en español, pensado para iPad Air y iPhone, con tres vistas: conducción, vehículo y etapa/viaje. Diseño original de alto contraste, marcha central, barra de luces de RPM, instrumentos y pedales. Incluye demo animada y puente local sin dependencias npm.

**Web:** https://albertoc17.github.io/apex-telemetry/

## Qué hace cada parte

```text
DiRT Rally 2.0 ── UDP 20777 ───────────────┐
                                        ├─ APEX Bridge en tu PC ── HTTPS ── Safari / GitHub Pages
ETS2 ── plugin + servidor Funbit :25555 ──┘
```

GitHub Pages sirve la interfaz estática. El puente debe ejecutarse en el PC mientras juegas: un navegador no recibe paquetes UDP ni lee la memoria de ETS2. La página permite guardar dirección, puerto, unidades y frecuencia; **el Wi-Fi se selecciona desde Ajustes de iOS**. No pide contraseña de Wi-Fi.

## Arranque del puente

1. Instala [Node.js](https://nodejs.org/) 22 o superior en el PC del juego.
2. Descarga este repositorio (Code → Download ZIP), extrae los archivos y abre una terminal en esa carpeta.
3. Ejecuta:

```powershell
npm start
```

No requiere `npm install`. La terminal muestra la dirección Wi-Fi del PC y un token de sesión aleatorio. El token cambia en cada arranque, salvo que definas `APEX_TOKEN` (mínimo 16 caracteres). Mantén la terminal abierta.

## Opción A: conexión local por Wi-Fi

Conecta iPad/iPhone y PC a la misma red. Abre en Safari **la dirección que imprime el puente**, por ejemplo `http://192.168.1.20:8787`. Pulsa ⚙, introduce esa dirección y el token, y elige el juego. Si Windows pregunta por el firewall de Node, permite acceso en tu red privada. No hace falta abrir puertos del router.

Esta dirección sirve exactamente la misma interfaz que Pages. HTTP local permite la telemetría, aunque algunas funciones como mantener la pantalla encendida requieren HTTPS. Las redes de invitados pueden impedir que dos dispositivos se comuniquen.

## Opción B: abrir desde GitHub Pages con telemetría real

La página Pages usa HTTPS y **no puede consultar `http://192.168…`** por las restricciones del navegador. Necesitas un puente HTTPS con certificado que Safari confíe. Tienes dos alternativas:

### Túnel HTTPS (sin instalar certificados en el iPad)

Instala [cloudflared](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/) en Windows. Con el puente ejecutándose, abre otra terminal:

```powershell
cloudflared tunnel --url http://localhost:8787
```

Copia la dirección HTTPS que entrega (por ejemplo `https://nombre-aleatorio.trycloudflare.com`). Abre [APEX en Pages](https://albertoc17.github.io/apex-telemetry/), pulsa ⚙, pega esa dirección y el token del puente. Guarda y conecta.

Los Quick Tunnels son temporales, dependen de Internet y pueden cambiar de URL al reiniciarlos. El túnel transporta la telemetría por Cloudflare; la API exige token incluso con el túnel. No compartas tu token. Cierra el túnel al terminar. La configuración predeterminada solo autoriza el origen `https://albertoc17.github.io`. El puente no hace registro de las peticiones ni escribe tokens en disco.

### HTTPS local

Puedes proporcionar certificado y clave mediante `TLS_CERT` y `TLS_KEY`; el certificado debe incluir la IP o nombre del PC y estar reconocido como confiable por Safari. Un certificado autofirmado sin instalar su CA no basta. Configura luego esa dirección HTTPS en Pages. Safari puede pedir permiso de red local; concédelo para esta conexión. El resultado depende de las políticas de Safari/iOS: si el acceso a red privada está bloqueado, usa el túnel o la opción A.

## Configurar DiRT Rally 2.0

Con el juego cerrado, haz una copia de seguridad y abre:

```text
Documentos\My Games\DiRT Rally 2.0\hardwaresettings\hardware_settings_config.xml
```

Dentro de `motion_platform`, ajusta la entrada UDP:

```xml
<udp enabled="true" extradata="3" ip="127.0.0.1" port="20777" delay="1" />
```

Guarda, inicia el puente y abre el juego. Si SimHub u otra aplicación ocupa 20777, configura su reenvío UDP a otro puerto y usa ese mismo valor en `DIRT_PORT`. APEX escucha UDP solo en el PC local. Solo se admite el paquete clásico `extradata=3` de 264 bytes; EA Sports WRC no es compatible.

DiRT entrega velocidad, marcha, RPM, pedales, fuerzas G, distancia, longitud y tiempo del tramo, además de canales de freno. El modelo de coche y nombre del tramo no se identifican; combustible, daños, temperaturas de motor, clasificación y notas del copiloto no se inventan. La calidad de algunos canales depende del juego y vehículo.

## Configurar Euro Truck Simulator 2

1. Instala el [ETS2 Telemetry Server de Funbit](https://github.com/Funbit/ets2-telemetry-server) siguiendo las instrucciones del proyecto e instala su plugin en el juego. Es una dependencia externa; no se incluye ni se instala automáticamente.
2. Ejecuta `Ets2Telemetry.exe`, abre ETS2 y acepta el plugin cuando el juego lo pida.
3. Comprueba en el PC que `http://127.0.0.1:25555/api/ets2/telemetry` devuelve JSON y que `game.connected` pasa a `true` dentro del juego.
4. Ejecuta APEX Bridge y elige Euro Truck Simulator 2 en el dashboard.

El adaptador usa el esquema documentado de Funbit: velocidad ya en km/h, combustible en litros, temperaturas en °C y navegación en metros. Otros plugins con esquemas diferentes necesitan otro adaptador. Funbit es un proyecto externo antiguo: su funcionamiento debe confirmarse con tu versión actual de ETS2. El SDK oficial de SCS requiere un plugin de PC; este dashboard no sustituye ese plugin.

El panel muestra combustible, agua, aceite, presión de aire, batería, desgaste de motor, consumo y odómetro; en Viaje, ruta, carga, distancia restante y límite. Funbit da una sola temperatura de frenos, que se muestra repetida y se señala en la interfaz. No se genera un mapa ni progreso de viaje ficticio cuando falta distancia inicial.

## Uso en iPad y iPhone

- Usa Safari reciente. iPad en horizontal prioriza el panel; iPhone dispone las tarjetas verticalmente y también tiene distribución horizontal.
- Para abrir como app, usa Compartir → Añadir a pantalla de inicio. La disponibilidad de pantalla completa y Wake Lock depende de iOS, versión y contexto seguro.
- El modo demo está siempre marcado; al perder telemetría real por más de 2,5 segundos se ocultan valores antiguos. Al cambiar de juego se limpia el estado y se inicia una nueva conexión.
- La dirección, unidades, juego y frecuencia se guardan en el dispositivo. El token se guarda en `sessionStorage`, solo en la pestaña; al volver a abrir puede ser necesario ingresarlo otra vez.
- No hay caché offline de telemetría ni service worker. La fuente tipográfica se descarga de Google Fonts; hay fuentes locales de respaldo.

## Variables del puente

Ejemplo PowerShell, antes de `npm start`:

```powershell
$env:PORT = '8787'
$env:DIRT_PORT = '20777'
$env:APEX_ORIGINS = 'https://albertoc17.github.io'
```

| Variable | Predeterminado | Uso |
| --- | --- | --- |
| `PORT` | `8787` | Puerto HTTP/HTTPS |
| `APEX_HOST` | `0.0.0.0` | Interfaz; usa `127.0.0.1` para servir solo al túnel |
| `DIRT_PORT` | `20777` | Recepción UDP en loopback |
| `ETS_URL` | `http://127.0.0.1:25555/api/ets2/telemetry` | API Funbit, restringida al PC local |
| `APEX_TOKEN` | Aleatorio por sesión | Token propio de 16 caracteres o más |
| `APEX_ORIGINS` | `https://albertoc17.github.io` | Orígenes web permitidos, separados por comas, sin ruta ni barra final |
| `TLS_CERT`, `TLS_KEY` | Sin definir | Rutas a certificado y clave PEM para HTTPS |

La API solo lee telemetría, requiere Bearer token, desactiva caché y restringe CORS. No habilita control remoto ni escritura de configuración del juego. La interfaz se sirve sin autenticación; el acceso a datos exige token. Si creas tu propio fork, cambia `APEX_ORIGINS` al origen de tu Pages y los enlaces del README y de la ayuda.

## Desarrollo, pruebas y publicación

```powershell
npm test
npm start
```

Pruebas con `node:test`: conversión y validación de paquetes DiRT, esquema Funbit, token, CORS y rutas HTTP. La integración de juego real requiere una sesión del simulador y una prueba física en tu iPad/iPhone; los paquetes sintéticos no prueban esa compatibilidad.

El workflow `.github/workflows/pages.yml` verifica y publica únicamente `web/` al hacer push a `main`. En GitHub → Settings → Pages, el origen debe ser **GitHub Actions**. El puente no se ejecuta en GitHub Pages.

## Investigación y referencias

Consulta [docs/research.md](docs/research.md) para las fuentes técnicas, referencias de dashboards y decisiones de diseño. Interfaz y código originales; sin copiar skins, logotipos ni assets de los productos estudiados. APEX no es un producto oficial de los juegos ni de esos proyectos.

Licencia MIT.

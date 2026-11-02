# Investigación · 2 de noviembre de 2026

## Dashboards consultados

| Referencia | Observación y aplicación en APEX |
| --- | --- |
| [SimHub](https://www.simhubdash.com/) | Ecosistema de dashboards y múltiples juegos. Se adoptó la jerarquía de conducción con lectura inmediata y vistas por contexto. |
| [SIM Dashboard](https://www.stryder-it.de/simdashboard/) | Uso de teléfono y tablet como display, widgets de RPM, marcha, velocidad y datos especializados por juego. APEX usa controles táctiles, selector de juego y vistas adaptables. |
| [Funbit ETS2 dashboard](https://github.com/Funbit/ets2-telemetry-server) | Dashboard HTML5, skins de camión, REST y WebSockets. APEX usa un adaptador REST en PC y separa mecánica de información del trabajo. |
| [DiRT dashboard de gabrielgouv](https://github.com/gabrielgouv/dirt-rally-telemetry-dashboard) | Dashboard específico para RPM y marcha. Referencia para limitar el alcance a los datos disponibles en el juego. |

Se eligió estética de instrumento de rally: fondo oscuro, cifras condensadas, acento lima, avisos ámbar/rojo y bordes discretos. La marcha ocupa el centro, velocidad a la izquierda, RPM a la derecha y luces en la parte superior. La vista ETS2 conserva la estructura y cambia el contenido mecánico y del viaje. Son decisiones de diseño propias, no mediciones de rendimiento ni afirmaciones de equivalencia funcional.

## Fuentes técnicas

- [SIM Dashboard: activar UDP de DiRT Rally 2](https://www.stryder-it.de/simdashboard/help/en/For_PC_Gamers/Game_Configuration/Dirt_Rally_2): `extradata=3`, configuración XML y puerto.
- [Simucube: DiRT Rally 1/2](https://docs.simucube.com/TunerSoftware/games/DirtRally.html): configuración y conflicto con otros receptores UDP.
- [dr2_logger](https://github.com/ErlerPhilipp/dr2_logger): referencia de telemetría y limitaciones de identificación de vehículos.
- [Protocolo extradata y posiciones de campos](https://github.com/onxtane/f1-lifx-bridge/issues/48): 66 floats, RPM divididas por 10 y campos de etapa. Contrastar en una captura real del juego antes de ampliar a otros títulos Codemasters.
- [Referencia API Funbit](https://github.com/Funbit/ets2-telemetry-server/blob/master/Telemetry.md): nombres, unidades y significado de cada campo ETS2.
- [SCS Telemetry SDK](https://modding.scssoft.com/wiki/Documentation/Engine/SDK/Telemetry): API oficial para plugins de PC.
- [MDN: mixed content](https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content): restricciones para conectar HTTPS a HTTP.
- [Cloudflare Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/): alternativa temporal HTTPS para pruebas y uso personal.

## Límites de la primera versión

El soporte DiRT se implementa sobre el paquete clásico UDP; ETS2 mediante el servidor externo Funbit. No hay lector nativo de memoria compartida ni plugin SCS propio. El refresco de la interfaz y la consulta de red alcanzan 10 Hz; no se afirma latencia de juego sin medición en red y dispositivo reales. Safari debe poder confiar en el certificado y acceder al endpoint. Pages por sí solo solo permite demo e interfaz de conexión.

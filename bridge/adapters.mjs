// Codemasters extradata=3: 66 little-endian float32 values, 264 bytes.
const number = v => typeof v === 'number' && Number.isFinite(v) ? v : null;
const pedal = v => number(v) === null ? null : Math.max(0, Math.min(1, v));
export function parseDirt(buffer, now = Date.now()) {
  if (buffer.length !== 264) return null;
  const f = i => number(buffer.readFloatLE(i * 4));
  if ([0,1,2,7,29,31,33,37,63].some(i => f(i) === null)) return null;
  if (f(7) < 0 || f(7) > 500 || f(37) < 0 || f(63) <= 0 || f(63) > 3000) return null;
  const gear = Math.round(f(33));
  return { game:'dirt', connected:true, paused:false, receivedAt:now,
    speed:f(7)*3.6, rpm:f(37)*10, maxRpm:f(63)*10,
    gear:gear === 10 || gear < 0 ? 'R' : gear === 0 ? 'N' : String(gear),
    throttle:pedal(f(29)), brake:pedal(f(31)), clutch:pedal(f(32)), steering:f(30),
    gLat:f(34), gLong:f(35), elapsed:Math.max(0,f(1)), distance:Math.max(0,f(2)),
    totalDistance:f(61) > 0 ? f(61) : null, lastTime:f(62) > 0 ? f(62) : null,
    brakes:[f(53),f(54),f(51),f(52)], suspension:[f(19),f(20),f(17),f(18)],
    vehicle:null, fuel:null, water:null, oil:null, damage:null, route:null };
}
export function parseEts(data, now = Date.now()) {
  if (!data || typeof data.game?.connected !== 'boolean') throw new Error('Respuesta ETS2 no compatible con Funbit');
  const t=data.truck ?? {}, n=data.navigation ?? {}, j=data.job ?? {};
  const gear=number(t.displayedGear) ?? number(t.gear);
  return {game:'ets2', connected:data.game.connected, paused:!!data.game.paused, receivedAt:now,
    speed:number(t.speed), rpm:number(t.engineRpm), maxRpm:number(t.engineRpmMax),
    gear:gear === null ? null : gear < 0 ? 'R' : gear === 0 ? 'N' : String(gear),
    throttle:pedal(t.gameThrottle),brake:pedal(t.gameBrake),clutch:pedal(t.gameClutch),steering:number(t.gameSteer),
    vehicle:[t.make,t.model].filter(Boolean).join(' ') || null,
    fuel:number(t.fuel), fuelCapacity:number(t.fuelCapacity), consumption:number(t.fuelAverageConsumption),
    water:number(t.waterTemperature), oil:number(t.oilTemperature), air:number(t.airPressure),
    battery:number(t.batteryVoltage), damage:number(t.wearEngine), odometer:number(t.odometer),
    brakes:[t.brakeTemperature,t.brakeTemperature,t.brakeTemperature,t.brakeTemperature].map(number),
    remaining:number(n.estimatedDistance), speedLimit:number(n.speedLimit),
    route:[j.sourceCity,j.destinationCity].filter(Boolean).join(' → ') || null,
    cargo:data.trailer?.attached && typeof data.trailer.name === 'string' ? data.trailer.name : null, income:number(j.income),
    gLat:null,gLong:null,elapsed:null,distance:null,totalDistance:null,
    warnings:[t.fuelWarningOn && 'COMBUSTIBLE BAJO',t.waterTemperatureWarningOn && 'TEMPERATURA ALTA',t.airPressureWarningOn && 'PRESIÓN DE AIRE BAJA',t.parkBrakeOn && 'FRENO DE ESTACIONAMIENTO'].filter(Boolean)};
}

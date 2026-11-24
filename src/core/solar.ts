/** Geographic sun position. Longitude and UTC offset are positive east of Greenwich. */
export interface SolarSettings {
  latitude?: number;
  longitude?: number;
  date: string;
  time: string;
  utcOffset: number;
  /** Clockwise degrees from model north (-Z) to geographic north. */
  north: number;
}

export interface SolarPosition {
  azimuth: number;
  elevation: number;
  sunrise: string | null;
  sunset: string | null;
}

const RAD = Math.PI / 180;
const clock = (minutes: number): string => {
  const local = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(local / 60)).padStart(2, "0")}:${String(local % 60).padStart(2, "0")}`;
};

/** Approximate NOAA solar equations, including civil clock times for sunrise and sunset. */
export function solarPosition(settings: SolarSettings): SolarPosition | null {
  const { latitude, longitude, utcOffset, date, time } = settings;
  if (latitude == null || longitude == null || ![latitude, longitude, utcOffset].every(Number.isFinite)
    || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || utcOffset < -12 || utcOffset > 14) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const day = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(day.getTime())) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (hours > 23 || minutes > 59) return null;
  const year = day.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const days = (Date.UTC(year + 1, 0, 1) - yearStart) / 86400000;
  const fraction = 2 * Math.PI / days * ((day.getTime() - yearStart) / 86400000 + (hours + minutes / 60 - 12) / 24);
  const equation = 229.18 * (0.000075 + 0.001868 * Math.cos(fraction) - 0.032077 * Math.sin(fraction)
    - 0.014615 * Math.cos(2 * fraction) - 0.040849 * Math.sin(2 * fraction));
  const declination = 0.006918 - 0.399912 * Math.cos(fraction) + 0.070257 * Math.sin(fraction)
    - 0.006758 * Math.cos(2 * fraction) + 0.000907 * Math.sin(2 * fraction)
    - 0.002697 * Math.cos(3 * fraction) + 0.00148 * Math.sin(3 * fraction);
  const latitudeRad = latitude * RAD;
  const solarOffset = equation + 4 * longitude - 60 * utcOffset;
  const hourAngle = ((hours * 60 + minutes + solarOffset) / 4 - 180) * RAD;
  const sinElevation = Math.sin(latitudeRad) * Math.sin(declination) + Math.cos(latitudeRad) * Math.cos(declination) * Math.cos(hourAngle);
  const azimuth = (Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(latitudeRad) - Math.tan(declination) * Math.cos(latitudeRad)) / RAD + 180) % 360;
  const riseCos = (Math.cos(90.833 * RAD) - Math.sin(latitudeRad) * Math.sin(declination)) / (Math.cos(latitudeRad) * Math.cos(declination));
  const riseAngle = Math.abs(riseCos) <= 1 ? Math.acos(riseCos) / RAD : null;
  const noon = 720 - solarOffset;
  return {
    azimuth,
    elevation: Math.asin(Math.max(-1, Math.min(1, sinElevation))) / RAD,
    sunrise: riseAngle === null ? null : clock(noon - riseAngle * 4),
    sunset: riseAngle === null ? null : clock(noon + riseAngle * 4),
  };
}

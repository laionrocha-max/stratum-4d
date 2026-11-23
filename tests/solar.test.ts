import { describe, expect, it } from "vitest";
import { solarPosition, type SolarSettings } from "../src/core/solar";

const equinox: SolarSettings = {
  latitude: 0, longitude: 0, date: "2026-03-20", time: "12:00", utcOffset: 0, north: 0,
};

describe("solar lighting", () => {
  it("places the equinox sun near overhead at noon on the equator", () => {
    const sun = solarPosition(equinox);
    expect(sun?.elevation).toBeGreaterThan(87);
    expect(sun?.sunrise).toMatch(/^06:/);
    expect(sun?.sunset).toMatch(/^18:/);
  });

  it("distinguishes east and west and applies location and UTC offset together", () => {
    const morning = solarPosition({ ...equinox, time: "09:00", longitude: -45, utcOffset: -3 });
    const afternoon = solarPosition({ ...equinox, time: "15:00", longitude: -45, utcOffset: -3 });
    expect(morning?.azimuth).toBeCloseTo(90, -1);
    expect(afternoon?.azimuth).toBeCloseTo(270, -1);
    expect(morning?.elevation).toBeCloseTo(solarPosition({ ...equinox, time: "09:00" })!.elevation);
  });

  it("leaves the sunrise and sunset unavailable when the sun stays below the horizon", () => {
    const sun = solarPosition({ ...equinox, latitude: 80, date: "2026-12-21" });
    expect(sun?.elevation).toBeLessThan(0);
    expect(sun?.sunrise).toBeNull();
    expect(sun?.sunset).toBeNull();
  });
});

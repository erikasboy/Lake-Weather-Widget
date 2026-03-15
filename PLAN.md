# Plan: Weather Alert Background Colours

## Overview
Keep Open-Meteo for all weather data. Add a second, independent call to
weatherapi.com just for alerts. Use the result to tint the widget background
and optionally set a tap URL.

---

## 1 — Add API key constant (top of file)
```js
const WEATHERAPI_KEY = "YOUR_KEY_HERE";
```

---

## 2 — Add `fetchAlerts(lat, lon, apiKey)` (after `fetchWeather`)
- Calls: `https://api.weatherapi.com/v1/forecast.json?key=KEY&q=LAT,LON&days=1&alerts=yes`
- Wrapped in try/catch — any failure returns `{ level: "none", url: null }` so the widget never crashes
- Iterates `response.alerts.alert[]`, finds the worst severity:

| weatherapi `severity` | level    |
|-----------------------|----------|
| "Minor"               | "yellow" |
| "Moderate"            | "orange" |
| "Severe" / "Extreme"  | "red"    |
| none / unrecognised   | "none"   |

- Returns `{ level, url }` where `url` is from the worst alert's `url` field

---

## 3 — Changes inside `buildWidget`

### 3a — Fetch alerts (after fetchWeather call)
```js
const alertInfo = await fetchAlerts(lat, lon, WEATHERAPI_KEY);
```

### 3b — Background colour map (before widget construction)
```js
const bgColors = {
  none:   "#0f1b2d",   // existing dark navy
  yellow: "#2d2a12",   // grey/mustard
  orange: "#2d1e0e",   // grey/pumpkin
  red:    "#2d1212",   // grey/paprika
};
```

### 3c — Apply to widget
- Replace hard-coded `"#0f1b2d"` with `bgColors[alertInfo.level]`
- Set `widget.url = alertInfo.url` only when a URL exists (omit entirely if null — Scriptable pattern for no tap action)

---

## Graceful degradation
All of the following silently fall back to `level: "none"`:
- Network error / timeout
- Bad or missing API key (401/403)
- `alerts` key absent in response (free tier, no active alerts)
- Malformed response

---

## Files changed
- `LakeWeather.js` only (constant + new function + 4 lines in buildWidget)
- `PLAN.md` (this file, to be deleted after merging)

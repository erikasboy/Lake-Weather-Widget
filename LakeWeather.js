// LakeWeather Widget for Scriptable
// Medium widget: Temp, Condition, Wind (knots + direction arrow), Moon, Sunrise/Sunset
// Data: Open-Meteo (weather), WeatherAPI.com (alerts)

const WEATHERAPI_KEY = "5c3225a9f1594fa0aee233951251303";

// ── HELPERS: WIND ───────────────────────────────────────────────
function kmhToKnots(kmh) {
  return (kmh * 0.539957).toFixed(1);
}

function degreesToCompass(deg) {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

// Arrow points in the direction the wind is blowing TO
function compassToArrow(deg) {
  const arrows = {
    "N":   "↓",
    "NNE": "↙",
    "NE":  "↙",
    "ENE": "←",
    "E":   "←",
    "ESE": "←",
    "SE":  "↖",
    "SSE": "↖",
    "S":   "↑",
    "SSW": "↗",
    "SW":  "↗",
    "WSW": "→",
    "W":   "→",
    "WNW": "→",
    "NW":  "↘",
    "NNW": "↘",
  };
  const compass = degreesToCompass(deg);
  return arrows[compass] || "·";
}

// ── HELPERS: MOON PHASE ─────────────────────────────────────────
function getMoonPhase(date) {
  const lp = 2551443;
  const newMoon = new Date("2000-01-06T18:14:00Z");
  const diff = (date - newMoon) / 1000;
  const phase = ((diff % lp) / lp + 1) % 1;
  return phase;
}

function moonEmoji(phase) {
  if (phase < 0.0625) return "🌑";
  if (phase < 0.1875) return "🌒";
  if (phase < 0.3125) return "🌓";
  if (phase < 0.4375) return "🌔";
  if (phase < 0.5625) return "🌕";
  if (phase < 0.6875) return "🌖";
  if (phase < 0.8125) return "🌗";
  if (phase < 0.9375) return "🌘";
  return "🌑";
}

function moonPhaseName(phase) {
  if (phase < 0.0625) return "New Moon";
  if (phase < 0.1875) return "Waxing Crescent";
  if (phase < 0.3125) return "First Quarter";
  if (phase < 0.4375) return "Waxing Gibbous";
  if (phase < 0.5625) return "Full Moon";
  if (phase < 0.6875) return "Waning Gibbous";
  if (phase < 0.8125) return "Last Quarter";
  if (phase < 0.9375) return "Waning Crescent";
  return "New Moon";
}

// ── HELPERS: SUNRISE / SUNSET ───────────────────────────────────
function getSunTimes(date, lat, lon) {
  const rad = Math.PI / 180;
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
  const B = (360 / 365) * (dayOfYear - 81) * rad;
  const eqTime = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  const declination = 23.45 * Math.sin(B) * rad;
  const hourAngle = Math.acos(-Math.tan(lat * rad) * Math.tan(declination)) / rad;
  const timezone = -date.getTimezoneOffset() / 60;
  const solarNoon = 12 - (lon / 15) - (eqTime / 60) + timezone;
  const sunriseDecimal = solarNoon - hourAngle / 15;
  const sunsetDecimal  = solarNoon + hourAngle / 15;

  function to24h(decimal) {
    const h = Math.floor(decimal);
    const m = Math.round((decimal - h) * 60);
    const hh = ((h % 24) + 24) % 24;
    const mm = m < 10 ? "0" + m : "" + m;
    return hh + ":" + mm;
  }

  return { sunrise: to24h(sunriseDecimal), sunset: to24h(sunsetDecimal) };
}

// ── HELPERS: WMO WEATHER CODE ────────────────────────────────────
function weatherDescription(code) {
  const codes = {
    0: "Clear", 1: "Mostly Clear", 2: "Partly Cloudy", 3: "Overcast",
    45: "Fog", 48: "Icy Fog",
    51: "Lt Drizzle", 53: "Drizzle", 55: "Hvy Drizzle",
    61: "Lt Rain", 63: "Rain", 65: "Hvy Rain",
    71: "Lt Snow", 73: "Snow", 75: "Hvy Snow", 77: "Snow Grains",
    80: "Showers", 81: "Rain Showers", 82: "Hvy Showers",
    85: "Snow Showers", 86: "Hvy Snow Showers",
    95: "Thunderstorm", 96: "T-Storm + Hail", 99: "T-Storm + Hail",
  };
  return codes[code] || "—";
}

function weatherEmoji(code) {
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫";
  if (code <= 55) return "🌦";
  if (code <= 65) return "🌧";
  if (code <= 77) return "🌨";
  if (code <= 82) return "🌧";
  if (code <= 86) return "🌨";
  return "⛈";
}

// ── HELPERS: TEMPERATURE COLOUR ──────────────────────────────────
function getTempStyle(temp) {
  if (temp >= 40 || temp <= -30) return { color: "#e8f4f8", bg: "#c43921" };
  if (temp >= 35 || temp <= -25) return { color: "#c43921", bg: null };
  if (temp >= 30 || temp <= -20) return { color: "#c46c21", bg: null };
  if (temp >= 25 || temp <= -15) return { color: "#c4a021", bg: null };
  return { color: "#e8f4f8", bg: null };
}

// ── FETCH WEATHER ────────────────────────────────────────────────
async function fetchWeather(lat, lon) {
  const url = "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon + "&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh&temperature_unit=celsius&timezone=auto";
  const req = new Request(url);
  const json = await req.loadJSON();
  return json.current;
}

// ── FETCH ALERTS ─────────────────────────────────────────────────
async function fetchAlerts(lat, lon, apiKey) {
  try {
    const url = "https://api.weatherapi.com/v1/forecast.json?key=" + apiKey + "&q=" + lat + "," + lon + "&days=1&alerts=yes";
    const req = new Request(url);
    const json = await req.loadJSON();
    const alerts = json.alerts && json.alerts.alert;
    if (!alerts || alerts.length === 0) return { level: "none", url: null };
    const rank = { "none": 0, "yellow": 1, "orange": 2, "red": 3 };
    const severityMap = { "Minor": "yellow", "Moderate": "orange", "Severe": "red", "Extreme": "red" };
    let worst = { level: "none", url: null };
    for (const alert of alerts) {
      const level = severityMap[alert.severity] || "none";
      if (rank[level] > rank[worst.level]) {
        worst = { level, url: alert.url || null };
      }
    }
    return worst;
  } catch (e) {
    return { level: "none", url: null };
  }
}

// ── BUILD WIDGET ─────────────────────────────────────────────────
async function buildWidget() {
  Location.setAccuracyToHundredMeters();
  let loc;
  try {
    loc = await Location.current();
  } catch (e) {
    loc = { latitude: 43.6389, longitude: -79.3817 };
  }

  const lat = loc.latitude;
  const lon = loc.longitude;

  const weather = await fetchWeather(lat, lon);
  const alertInfo = await fetchAlerts(lat, lon, WEATHERAPI_KEY);
  const tempC = Math.round(weather.temperature_2m);
  const tempStyle = getTempStyle(42); // TEMP TEST — remove before merging
  const windKnots = kmhToKnots(weather.wind_speed_10m);
  const windCompass = degreesToCompass(weather.wind_direction_10m);
  const windArrow = compassToArrow(weather.wind_direction_10m);
  const condition = weatherDescription(weather.weather_code);
  const condEmoji = weatherEmoji(weather.weather_code);

  const now = new Date();
  const phase = getMoonPhase(now);
  const moonIcon = moonEmoji(phase);
  const moonName = moonPhaseName(phase);
  const sun = getSunTimes(now, lat, lon);

  // ── SCALE: baseline tuned for iPhone SE 2 (375pt wide) ──────────
  const s = n => Math.round(n * Device.screenSize().width / 375);

  // ── ALERT BACKGROUND ─────────────────────────────────────────
  const bgColors = { none: "#0f1b2d", yellow: "#d6c472", orange: "#d6944a", red: "#c85c4a" };

  // ── WIDGET ────────────────────────────────────────────────────
  const widget = new ListWidget();
  widget.backgroundColor = new Color(bgColors[alertInfo.level] || bgColors.none);
  widget.setPadding(s(10), s(14), s(6), s(14));
  if (alertInfo.url) { widget.url = alertInfo.url; }

  // ── ROW 1: Temp (large, left) + Condition emoji + label (right) ──
  const topRow = widget.addStack();
  topRow.layoutHorizontally();
  topRow.bottomAlignContent();

  const tempContainer = topRow.addStack();
  if (tempStyle.bg) {
    tempContainer.backgroundColor = new Color(tempStyle.bg);
    tempContainer.cornerRadius = s(6);
    tempContainer.setPadding(s(2), s(4), s(2), s(4));
  }
  const tempText = tempContainer.addText(tempC + "°");
  tempText.font = Font.boldSystemFont(s(54));
  tempText.textColor = new Color(tempStyle.color);
  tempText.minimumScaleFactor = 0.8;

  topRow.addSpacer();

  const condStack = topRow.addStack();
  condStack.layoutVertically();

  const condEmojiText = condStack.addText(condEmoji);
  condEmojiText.font = Font.systemFont(s(32));
  condEmojiText.rightAlignText();

  condStack.addSpacer(s(2));

  const condLabel = condStack.addText(condition);
  condLabel.font = Font.mediumSystemFont(s(13));
  condLabel.textColor = new Color("#7ec8e3");
  condLabel.rightAlignText();
  condLabel.minimumScaleFactor = 0.7;

  widget.addSpacer(s(2));

  // ── ROW 2: Wind ──
  const windRow = widget.addStack();
  windRow.layoutHorizontally();
  windRow.centerAlignContent();
  windRow.spacing = s(5);

  const arrowText = windRow.addText(windArrow);
  arrowText.font = Font.boldSystemFont(s(20));
  arrowText.textColor = new Color("#7ec8e3");

  const windLabel = windRow.addText(windCompass + "  " + windKnots + " kn");
  windLabel.font = Font.semiboldMonospacedSystemFont(s(14));
  windLabel.textColor = new Color("#e8f4f8");
  windLabel.lineLimit = 1;

  widget.addSpacer(s(4));

  // ── DIVIDER ──
  const divStack = widget.addStack();
  divStack.backgroundColor = new Color("#1e3a5f");
  divStack.size = new Size(0, 1);

  widget.addSpacer(s(4));

  // ── ROW 3: Moon (left) + Sun times (right) ──
  const bottomRow = widget.addStack();
  bottomRow.layoutHorizontally();
  bottomRow.centerAlignContent();

  // Moon: emoji on top, phase name below
  const moonStack = bottomRow.addStack();
  moonStack.layoutVertically();
  moonStack.centerAlignContent();
  moonStack.spacing = s(2);

  const moonIconText = moonStack.addText(moonIcon);
  moonIconText.font = Font.systemFont(s(22));
  moonIconText.centerAlignText();

  const moonNameText = moonStack.addText(moonName);
  moonNameText.font = Font.semiboldSystemFont(s(10));
  moonNameText.textColor = new Color("#c8dff0");
  moonNameText.centerAlignText();
  moonNameText.minimumScaleFactor = 0.7;

  bottomRow.addSpacer();

  // Sun times
  const sunStack = bottomRow.addStack();
  sunStack.layoutVertically();
  sunStack.spacing = s(4);

  const srRow = sunStack.addStack();
  srRow.layoutHorizontally();
  srRow.spacing = s(5);
  srRow.centerAlignContent();
  const srIcon = srRow.addText("🌅");
  srIcon.font = Font.systemFont(s(13));
  const srText = srRow.addText(sun.sunrise);
  srText.font = Font.semiboldMonospacedSystemFont(s(12));
  srText.textColor = new Color("#e8c66d");
  srText.minimumScaleFactor = 0.8;

  const ssRow = sunStack.addStack();
  ssRow.layoutHorizontally();
  ssRow.spacing = s(5);
  ssRow.centerAlignContent();
  const ssIcon = ssRow.addText("🌇");
  ssIcon.font = Font.systemFont(s(13));
  const ssText = ssRow.addText(sun.sunset);
  ssText.font = Font.semiboldMonospacedSystemFont(s(12));
  ssText.textColor = new Color("#e8a54a");
  ssText.minimumScaleFactor = 0.8;

  // Refresh every 15 min
  const nextRefresh = new Date();
  nextRefresh.setMinutes(nextRefresh.getMinutes() + 15);
  widget.refreshAfterDate = nextRefresh;

  return widget;
}

// ── ENTRY POINT ──────────────────────────────────────────────────
const widget = await buildWidget();
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  widget.presentMedium();
}
Script.complete();

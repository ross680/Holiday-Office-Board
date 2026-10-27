// Holiday office TV schedule. This is the only file to edit for dates or the playlist.
// Dates are calendar days in America/New_York. Ranges are inclusive.
// A range may wrap the new year (New Year's runs Dec 26 through Jan 2).
// Summer AC covers Jun 1 through Aug 31 except the Fourth of July window:
// `except` points at that other id, so the July dates live in one place.
//
// Replace a clip but keep the same name: change the ?v= text (first 10 hex
// characters of the new file's SHA-256) so the TV downloads it again.
(function (root) {
  var CONFIG = {
    timeZone: "America/New_York",
    holidays: [
      {
        id: "ny",
        countdownLabel: "NEW YEAR'S DAY",
        anchor: { month: 1, day: 1 },
        windows: [{ start: { month: 12, day: 26 }, end: { month: 1, day: 2 } }],
        clips: [
          "clips/ny01_f657.mp4?v=248f399857",
          "clips/ny02_4ce5.mp4?v=5be541fc8b",
          "clips/ny03_1e6d.mp4?v=62645cea51",
          "clips/ny04_d22d.mp4?v=3892727e2a",
          "clips/ny05_1c0e.mp4?v=dabd7ba988",
          "clips/ny06_8b5f.mp4?v=c9ff19bbeb"
        ]
      },
      {
        id: "vl",
        countdownLabel: "VALENTINE'S DAY",
        anchor: { month: 2, day: 14 },
        windows: [{ start: { month: 2, day: 1 }, end: { month: 2, day: 14 } }],
        clips: [
          "clips/vl01_8a66.mp4?v=3405a5ee68",
          "clips/vl02_5e56.mp4?v=84ef63bf18",
          "clips/vl03_8445.mp4?v=44db841e38",
          "clips/vl04_3f0a.mp4?v=4988e77134"
        ]
      },
      {
        id: "sp",
        countdownLabel: "ST. PATRICK'S DAY",
        anchor: { month: 3, day: 17 },
        windows: [{ start: { month: 3, day: 1 }, end: { month: 3, day: 17 } }],
        clips: [
          "clips/sp01_e053.mp4?v=ce90d76a98",
          "clips/sp02_06b6.mp4?v=b841a4f0f3",
          "clips/sp03_32a0.mp4?v=efe7577537",
          "clips/sp04_1c1c.mp4?v=4273e36d57"
        ]
      },
      {
        id: "fj",
        countdownLabel: "THE FOURTH OF JULY",
        anchor: { month: 7, day: 4 },
        windows: [{ start: { month: 6, day: 24 }, end: { month: 7, day: 5 } }],
        clips: [
          "clips/fj01_566d.mp4?v=e25ef290b8",
          "clips/fj02_2730.mp4?v=42d57a7cd9",
          "clips/fj03_b6bd.mp4?v=fa9d241141",
          "clips/fj04_07a9.mp4?v=e8a915356c",
          "clips/fj05_49b9.mp4?v=4d7d13dab2"
        ]
      },
      {
        id: "ac",
        countdownLabel: "SUMMER",
        anchor: { month: 6, day: 1 },
        except: ["fj"],
        windows: [{ start: { month: 6, day: 1 }, end: { month: 8, day: 31 } }],
        clips: [
          "clips/ac01_937e.mp4?v=d42884b360",
          "clips/ac02_73fe.mp4?v=b9d5b85c5f",
          "clips/ac03_9e86.mp4?v=8771ac8b59",
          "clips/ac04_7cef.mp4?v=8ada1a48e3",
          "clips/ac05_8f92.mp4?v=7aa0a2a4a5"
        ]
      }
    ]
  };

  function padKey(y, m, d) {
    return y * 10000 + m * 100 + d;
  }

  function monthDay(month, day) {
    return month * 100 + day;
  }

  function inRange(month, day, start, end) {
    var cur = monthDay(month, day);
    var a = monthDay(start.month, start.day);
    var b = monthDay(end.month, end.day);
    if (a <= b) return cur >= a && cur <= b;
    return cur >= a || cur <= b;
  }

  function inWindows(holiday, month, day) {
    var windows = holiday.windows || [];
    for (var i = 0; i < windows.length; i++) {
      if (inRange(month, day, windows[i].start, windows[i].end)) return true;
    }
    return false;
  }

  function byId(id) {
    var list = CONFIG.holidays;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function isLive(holiday, month, day) {
    if (!holiday || !inWindows(holiday, month, day)) return false;
    var except = holiday.except || [];
    for (var i = 0; i < except.length; i++) {
      var other = byId(except[i]);
      if (other && inWindows(other, month, day)) return false;
    }
    return true;
  }

  function liveHoliday(month, day) {
    var list = CONFIG.holidays;
    for (var i = 0; i < list.length; i++) {
      if (isLive(list[i], month, day)) return list[i];
    }
    return null;
  }

  function daysBetween(y1, m1, d1, y2, m2, d2) {
    var a = Date.UTC(y1, m1 - 1, d1);
    var b = Date.UTC(y2, m2 - 1, d2);
    return Math.round((b - a) / 86400000);
  }

  function nextAnchor(holiday, y, m, d) {
    var am = holiday.anchor.month;
    var ad = holiday.anchor.day;
    var ay = y;
    if (padKey(ay, am, ad) < padKey(y, m, d)) ay += 1;
    return { y: ay, m: am, d: ad };
  }

  function countdownText(days, label) {
    if (days > 1) return days + " DAYS UNTIL " + label;
    if (days === 1) return "1 DAY UNTIL " + label;
    return "";
  }

  // Soonest window start strictly after this calendar day.
  function nextOpening(y, m, d) {
    var today = padKey(y, m, d);
    var best = null;
    var list = CONFIG.holidays;
    for (var i = 0; i < list.length; i++) {
      var holiday = list[i];
      var windows = holiday.windows || [];
      for (var w = 0; w < windows.length; w++) {
        var start = windows[w].start;
        var sy = y;
        if (padKey(sy, start.month, start.day) <= today) sy += 1;
        var startKey = padKey(sy, start.month, start.day);
        if (!best || startKey < best.key) {
          best = { key: startKey, holiday: holiday };
        }
      }
    }
    return best;
  }

  function clipPath(src) {
    return String(src || "").split("?")[0];
  }

  // Fisher-Yates. `avoid` is a clip path that must not land first when there is
  // another choice, so a reshuffle does not repeat the clip that just played.
  function shuffleClips(list, avoid) {
    var arr = list.slice();
    for (var n = arr.length - 1; n > 0; n--) {
      var j = Math.floor(Math.random() * (n + 1));
      var swap = arr[n];
      arr[n] = arr[j];
      arr[j] = swap;
    }
    var avoidPath = clipPath(avoid);
    if (avoidPath && arr.length > 1 && clipPath(arr[0]) === avoidPath) {
      var k = 1 + Math.floor(Math.random() * (arr.length - 1));
      var first = arr[0];
      arr[0] = arr[k];
      arr[k] = first;
    }
    return arr;
  }

  function rotateTo(list, srcPath) {
    var want = clipPath(srcPath);
    if (!want) return list.slice();
    var i = -1;
    for (var n = 0; n < list.length; n++) {
      if (clipPath(list[n]) === want) {
        i = n;
        break;
      }
    }
    if (i <= 0) return list.slice();
    return list.slice(i).concat(list.slice(0, i));
  }

  // holidayOverride forces that playlist. An unknown id is ignored.
  // Inside a window the chip stays blank. Outside, the next playlist plays and
  // the chip counts down to that holiday's anchor day.
  function resolve(parts, holidayOverride) {
    var y = parts.y;
    var m = parts.m;
    var d = parts.d;
    var live = liveHoliday(m, d);
    var opening = live ? null : nextOpening(y, m, d);
    var scheduled = live || (opening && opening.holiday) || null;
    var forced = holidayOverride ? byId(holidayOverride) : null;
    var playing = forced || scheduled;
    var mode = "empty";
    var days = 0;
    var message = "";
    if (playing && isLive(playing, m, d)) {
      mode = "live";
    } else if (playing) {
      mode = "preview";
      var anchor = nextAnchor(playing, y, m, d);
      days = daysBetween(y, m, d, anchor.y, anchor.m, anchor.d);
      message = countdownText(days, playing.countdownLabel);
    }
    return {
      holiday: playing ? playing.id : "",
      mode: mode,
      days: days,
      message: message,
      label: playing ? playing.countdownLabel : "",
      clips: playing && playing.clips ? playing.clips.slice() : [],
      scheduled: scheduled ? scheduled.id : "",
      live: live ? live.id : ""
    };
  }

  function parseISODate(raw) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw || "");
    if (!match) return null;
    var y = Number(match[1]);
    var m = Number(match[2]);
    var d = Number(match[3]);
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    var dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return { y: y, m: m, d: d };
  }

  var api = {
    CONFIG: CONFIG,
    byId: byId,
    resolve: resolve,
    parseISODate: parseISODate,
    countdownText: countdownText,
    shuffleClips: shuffleClips,
    rotateTo: rotateTo,
    clipPath: clipPath,
    daysBetween: daysBetween
  };

  root.HOLIDAY_CONFIG = CONFIG;
  root.HolidayBoard = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

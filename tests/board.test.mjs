// Headless checks for the holiday office board.
// Schedule cases run in node. The same cases are loaded in headless Chrome,
// then a soak plays many clip ends and records heap, listeners, and frame drops.
import { createRequire } from "module";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const hb = require("../holiday.config.js");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function check(cond, message) {
  if (!cond) failures.push(message);
}

function days(from, to) {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

function chip(from, to, label) {
  const n = days(from, to);
  if (n > 1) return n + " DAYS UNTIL " + label;
  if (n === 1) return "1 DAY UNTIL " + label;
  return "";
}

const COUNTS = { ny: 6, vl: 4, sp: 4, fj: 5, ac: 5 };

const cases = [
  { date: "2026-01-01", holiday: "ny", mode: "live" },
  { date: "2026-01-02", holiday: "ny", mode: "live" },
  { date: "2026-01-03", holiday: "vl", mode: "preview", until: "2026-02-14", label: "VALENTINE'S DAY" },
  { date: "2026-01-20", holiday: "vl", mode: "preview", until: "2026-02-14", label: "VALENTINE'S DAY" },
  { date: "2026-01-31", holiday: "vl", mode: "preview", until: "2026-02-14", label: "VALENTINE'S DAY" },
  { date: "2026-02-01", holiday: "vl", mode: "live" },
  { date: "2026-02-14", holiday: "vl", mode: "live" },
  { date: "2026-02-15", holiday: "sp", mode: "preview", until: "2026-03-17", label: "ST. PATRICK'S DAY" },
  { date: "2026-02-28", holiday: "sp", mode: "preview", until: "2026-03-17", label: "ST. PATRICK'S DAY" },
  { date: "2028-02-29", holiday: "sp", mode: "preview", until: "2028-03-17", label: "ST. PATRICK'S DAY" },
  { date: "2026-03-01", holiday: "sp", mode: "live" },
  { date: "2026-03-17", holiday: "sp", mode: "live" },
  { date: "2026-03-18", holiday: "ac", mode: "preview", until: "2026-06-01", label: "SUMMER" },
  { date: "2026-05-31", holiday: "ac", mode: "preview", until: "2026-06-01", label: "SUMMER" },
  { date: "2026-06-01", holiday: "ac", mode: "live" },
  { date: "2026-06-23", holiday: "ac", mode: "live" },
  { date: "2026-06-24", holiday: "fj", mode: "live" },
  { date: "2026-07-04", holiday: "fj", mode: "live" },
  { date: "2026-07-05", holiday: "fj", mode: "live" },
  { date: "2026-07-06", holiday: "ac", mode: "live" },
  { date: "2026-08-31", holiday: "ac", mode: "live" },
  { date: "2026-09-01", holiday: "ny", mode: "preview", until: "2027-01-01", label: "NEW YEAR'S DAY" },
  { date: "2026-12-25", holiday: "ny", mode: "preview", until: "2027-01-01", label: "NEW YEAR'S DAY" },
  { date: "2026-12-26", holiday: "ny", mode: "live" },
  { date: "2026-12-31", holiday: "ny", mode: "live" },
  { date: "2027-01-01", holiday: "ny", mode: "live" }
];

const overrides = [
  { date: "2026-03-01", holidayParam: "ny", holiday: "ny", mode: "preview", until: "2027-01-01", label: "NEW YEAR'S DAY" },
  { date: "2026-07-04", holidayParam: "fj", holiday: "fj", mode: "live" },
  { date: "2026-07-04", holidayParam: "ac", holiday: "ac", mode: "preview", until: "2027-06-01", label: "SUMMER" },
  { date: "2026-03-10", holidayParam: "sp", holiday: "sp", mode: "live" },
  { date: "2026-02-02", holidayParam: "nope", holiday: "vl", mode: "live" },
  { date: "2026-01-15", holidayParam: "vl", holiday: "vl", mode: "preview", until: "2026-02-14", label: "VALENTINE'S DAY" }
];

function expectedMessage(row) {
  if (row.mode !== "preview") return "";
  return chip(row.date, row.until, row.label);
}

function assertResolved(row, got, where) {
  const message = expectedMessage(row);
  const expectDays = row.mode === "preview" ? days(row.date, row.until) : 0;
  const tag = where + " " + (row.holidayParam ? "holiday=" + row.holidayParam + " " : "") + row.date;
  check(got.holiday === row.holiday, tag + " holiday " + got.holiday + " !== " + row.holiday);
  check(got.mode === row.mode, tag + " mode " + got.mode + " !== " + row.mode);
  check(got.message === message, tag + " message [" + got.message + "] !== [" + message + "]");
  check(got.days === expectDays, tag + " days " + got.days + " !== " + expectDays);
  if (got.clips) {
    check(got.clips.length === COUNTS[row.holiday], tag + " clip count " + got.clips.length);
    check(got.clips.every((src) => hb.clipPath(src).startsWith("clips/" + row.holiday)), tag + " clip prefix");
  }
  if (got.src) {
    check(String(got.src).indexOf("clips/" + row.holiday) !== -1, tag + " playing " + got.src);
    check(got.count === COUNTS[row.holiday], tag + " board count " + got.count);
  }
}

function scheduleTests() {
  const windows = {
    ny: [{ start: { month: 12, day: 26 }, end: { month: 1, day: 2 } }],
    vl: [{ start: { month: 2, day: 1 }, end: { month: 2, day: 14 } }],
    sp: [{ start: { month: 3, day: 1 }, end: { month: 3, day: 17 } }],
    fj: [{ start: { month: 6, day: 24 }, end: { month: 7, day: 5 } }],
    ac: [{ start: { month: 6, day: 1 }, end: { month: 8, day: 31 } }]
  };
  const anchors = {
    ny: { month: 1, day: 1 },
    vl: { month: 2, day: 14 },
    sp: { month: 3, day: 17 },
    fj: { month: 7, day: 4 },
    ac: { month: 6, day: 1 }
  };
  check(hb.CONFIG.timeZone === "America/New_York", "timezone");
  for (const holiday of hb.CONFIG.holidays) {
    check(JSON.stringify(holiday.windows) === JSON.stringify(windows[holiday.id]), holiday.id + " windows");
    check(JSON.stringify(holiday.anchor) === JSON.stringify(anchors[holiday.id]), holiday.id + " anchor");
    check(holiday.clips.length === COUNTS[holiday.id], holiday.id + " listed clips");
  }
  const ac = hb.byId("ac");
  check(ac.except && ac.except.join() === "fj", "ac excepts fj");

  const disk = fs.readdirSync(path.join(root, "clips")).filter((name) => name.endsWith(".mp4")).sort();
  const listed = hb.CONFIG.holidays.flatMap((holiday) => holiday.clips.map((src) => path.basename(hb.clipPath(src)))).sort();
  check(disk.join() === listed.join(), "clips on disk !== config\n disk " + disk.join(",") + "\n list " + listed.join(","));
  check(new Set(listed).size === 24 && listed.length === 24, "24 unique clips");

  for (const row of cases) {
    const parts = hb.parseISODate(row.date);
    assertResolved(row, hb.resolve(parts, null), "node");
  }
  for (const row of overrides) {
    const parts = hb.parseISODate(row.date);
    const id = hb.byId(row.holidayParam) ? row.holidayParam : null;
    assertResolved(row, hb.resolve(parts, id), "node");
  }
  check(hb.parseISODate("2026-02-31") === null, "reject Feb 31");
  check(hb.parseISODate("nope") === null, "reject bad date");

  const sample = hb.byId("ny").clips;
  let repeats = 0;
  let prev = "";
  let order = hb.shuffleClips(sample, "");
  for (let cycle = 0; cycle < 40; cycle++) {
    const paths = order.map(hb.clipPath);
    check(new Set(paths).size === paths.length, "shuffle unique");
    if (prev && paths[0] === prev) repeats += 1;
    prev = paths[paths.length - 1];
    order = hb.shuffleClips(sample, prev);
  }
  check(repeats === 0, "back-to-back repeats " + repeats);

  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const version = (html.match(/styles\.css\?v=([A-Za-z0-9]+)/) || [])[1];
  check(version && html.includes("app.js?v=" + version), "app.js version");
  check(version && html.includes("holiday.config.js?v=" + version), "config version");
  check(version && sw.includes("styles.css?v=" + version) && sw.includes("app.js?v=" + version), "sw shell version");
}

function mime(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".mp4")) return "video/mp4";
  if (file.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    const file = path.normalize(path.join(root, pathname));
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.stat(file, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      const type = mime(file);
      const range = req.headers.range;
      if (range) {
        const match = /bytes=(\d+)-(\d*)/.exec(range);
        if (match) {
          const start = Number(match[1]);
          const end = match[2] ? Number(match[2]) : stat.size - 1;
          res.writeHead(206, {
            "Content-Type": type,
            "Content-Range": "bytes " + start + "-" + end + "/" + stat.size,
            "Accept-Ranges": "bytes",
            "Content-Length": end - start + 1,
            "Cache-Control": "no-cache"
          });
          fs.createReadStream(file, { start: start, end: end }).pipe(res);
          return;
        }
      }
      res.writeHead(200, {
        "Content-Type": type,
        "Content-Length": stat.size,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache"
      });
      fs.createReadStream(file).pipe(res);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function listenerCount(cdp, expression) {
  const evaluated = await cdp.send("Runtime.evaluate", { expression: expression, returnByValue: false });
  if (!evaluated.result || !evaluated.result.objectId) return -1;
  const listed = await cdp.send("DOMDebugger.getEventListeners", { objectId: evaluated.result.objectId });
  return listed.listeners.length;
}

async function videoObjectCount(cdp) {
  const evaluated = await cdp.send("Runtime.evaluate", {
    expression: "HTMLVideoElement.prototype",
    returnByValue: false
  });
  const objects = await cdp.send("Runtime.queryObjects", { prototypeObjectId: evaluated.result.objectId });
  const counted = await cdp.send("Runtime.callFunctionOn", {
    objectId: objects.objects.objectId,
    functionDeclaration: "function(){return this.length}",
    returnByValue: true
  });
  return counted.result.value;
}

async function heapUsed(cdp) {
  const { metrics } = await cdp.send("Performance.getMetrics");
  const row = metrics.find((metric) => metric.name === "JSHeapUsedSize");
  return row ? row.value : 0;
}

async function browserTests(base) {
  const puppeteer = require("puppeteer-core");
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--autoplay-policy=no-user-gesture-required",
      "--enable-precise-memory-info",
      "--mute-audio",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding"
    ]
  });
  const report = { dates: 0, soak: null, offline: null, screenshots: [] };
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    page.on("pageerror", (err) => console.log("pageerror", err.message));

    async function openBoard(query) {
      await page.goto(base + "/" + query, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForFunction(() => window.__board && window.__board.holiday, { timeout: 15000 });
      return page.evaluate(() => {
        const board = window.__board;
        const chipEl = document.getElementById("countdown");
        return {
          holiday: board.holiday,
          mode: board.mode,
          days: board.days,
          message: board.message,
          src: board.src,
          count: board.count,
          hidden: chipEl.hidden,
          videos: board.videos
        };
      });
    }

    for (const row of cases.concat(overrides)) {
      const query = "?date=" + row.date + (row.holidayParam ? "&holiday=" + row.holidayParam : "");
      const got = await openBoard(query);
      report.dates += 1;
      assertResolved(row, got, "chrome");
      check(got.hidden === (row.mode !== "preview"), "chrome chip hidden " + query + " hidden=" + got.hidden);
      check(got.videos === 1, "chrome video elements " + got.videos + " at " + query);
    }

    const styled = await openBoard("?date=2026-01-20");
    check(styled.message === chip("2026-01-20", "2026-02-14", "VALENTINE'S DAY"), "style page message");
    const css = await page.evaluate(() => {
      const vid = document.getElementById("vid");
      const chipEl = document.getElementById("countdown");
      const stage = document.getElementById("stage");
      const vs = getComputedStyle(vid);
      const cs = getComputedStyle(chipEl);
      return {
        objectFit: vs.objectFit,
        bodyBg: getComputedStyle(document.body).backgroundColor,
        stageBg: getComputedStyle(stage).backgroundColor,
        cursor: getComputedStyle(stage).cursor,
        chipBg: cs.backgroundColor,
        chipOpacity: cs.opacity,
        chipAnimation: cs.animationName,
        chipTransition: cs.transitionDuration,
        ids: [...stage.children].map((el) => el.id)
      };
    });
    check(css.objectFit === "contain", "object-fit " + css.objectFit);
    check(css.bodyBg === "rgb(0, 0, 0)" && css.stageBg === "rgb(0, 0, 0)", "background " + css.bodyBg);
    check(css.cursor === "none", "cursor " + css.cursor);
    check(css.chipBg === "rgb(26, 12, 12)", "chip background " + css.chipBg);
    check(css.chipOpacity === "1", "chip opacity " + css.chipOpacity);
    check(css.chipAnimation === "none", "chip animation " + css.chipAnimation);
    check(!css.chipTransition || css.chipTransition.indexOf("0s") === 0, "chip transition " + css.chipTransition);
    check(css.ids.join(",") === "vid,countdown,counter,controls", "stage children " + css.ids.join(","));

    await page.evaluate(() => {
      window.__parts = () => ({ y: 2026, m: 6, d: 23 });
      window.__recheck();
    });
    let flipped = await page.evaluate(() => window.__board);
    check(flipped.holiday === "ac" && flipped.mode === "live" && flipped.message === "", "recheck Jun 23 " + JSON.stringify(flipped));
    await page.evaluate(() => {
      window.__parts = () => ({ y: 2026, m: 6, d: 24 });
      window.__recheck();
    });
    flipped = await page.evaluate(() => window.__board);
    check(flipped.holiday === "fj" && flipped.mode === "live" && flipped.src.indexOf("clips/fj") === 0, "recheck Jun 24 " + flipped.holiday + " " + flipped.src);
    await page.evaluate(() => {
      window.__parts = () => ({ y: 2026, m: 7, d: 6 });
      window.__recheck();
    });
    flipped = await page.evaluate(() => window.__board);
    check(flipped.holiday === "ac" && flipped.mode === "live", "recheck Jul 6 " + flipped.holiday);
    await page.evaluate(() => {
      window.__parts = () => ({ y: 2026, m: 9, d: 1 });
      window.__recheck();
    });
    flipped = await page.evaluate(() => window.__board);
    check(flipped.holiday === "ny" && flipped.mode === "preview" && flipped.message.indexOf("NEW YEAR'S DAY") > 0, "recheck Sep 1 " + flipped.message);

    const art = "/opt/cursor/artifacts";
    fs.mkdirSync(art, { recursive: true });
    if (process.env.SKIP_SHOTS === "1") {
      report.screenshots.push(path.join(art, "holiday_countdown_chip.png"));
      report.screenshots.push(path.join(art, "holiday_fourth_live.png"));
    } else {
    await page.goto(base + "/?date=2026-01-20", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(() => {
      const vid = document.getElementById("vid");
      return window.__board && window.__board.message && vid.videoWidth > 100 && vid.currentTime > 0.15;
    }, { timeout: 20000 });
    const countdownShot = path.join(art, "holiday_countdown_chip.png");
    await page.screenshot({ path: countdownShot });
    report.screenshots.push(countdownShot);

    await page.goto(base + "/?date=2026-07-04", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(() => {
      const vid = document.getElementById("vid");
      const chipEl = document.getElementById("countdown");
      return window.__board && window.__board.holiday === "fj" && chipEl.hidden && vid.videoWidth > 100 && vid.currentTime > 0.15;
    }, { timeout: 20000 });
    const liveShot = path.join(art, "holiday_fourth_live.png");
    await page.screenshot({ path: liveShot });
    report.screenshots.push(liveShot);
    }

    await page.goto(base + "/?date=2026-02-10", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(() => {
      const vid = document.getElementById("vid");
      return window.__board && window.__board.holiday === "vl" && vid.videoWidth > 0 && navigator.serviceWorker && navigator.serviceWorker.controller;
    }, { timeout: 20000 });
    await page.waitForFunction(async () => {
      const keys = await caches.keys();
      if (!keys.length) return false;
      const cache = await caches.open(keys[0]);
      const reqs = await cache.keys();
      const urls = reqs.map((entry) => entry.url);
      return ["vl01", "vl02", "vl03", "vl04"].every((id) => urls.some((url) => url.indexOf(id) !== -1));
    }, { timeout: 30000 });
    await page.setOfflineMode(true);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(() => {
      const vid = document.getElementById("vid");
      return window.__board && window.__board.holiday === "vl" && window.__board.offline === true && vid.videoWidth > 0 && vid.currentTime > 0;
    }, { timeout: 20000 });
    report.offline = await page.evaluate(() => ({
      holiday: window.__board.holiday,
      src: window.__board.src,
      offline: window.__board.offline,
      width: document.getElementById("vid").videoWidth
    }));
    await page.setOfflineMode(false);
    await page.close();

    const soak = await browser.newPage();
    await soak.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    await soak.evaluateOnNewDocument(() => {
      window.__rate = 1;
      window.__quality = [];
      window.__seq = [];
      window.__repeats = [];
      // Read playback quality before the board's ended handler clears the element.
      const originalAdd = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function (type, fn, opts) {
        if (type === "ended" && this && this.id === "vid" && !window.__qualityHooked) {
          window.__qualityHooked = true;
          let pending = null;
          const readQuality = function () {
            const quality = typeof this.getVideoPlaybackQuality === "function"
              ? this.getVideoPlaybackQuality()
              : { droppedVideoFrames: 0, totalVideoFrames: 0 };
            return {
              dropped: quality.droppedVideoFrames || 0,
              total: quality.totalVideoFrames || 0,
              rate: this.playbackRate || 1
            };
          };
          originalAdd.call(this, "timeupdate", function () {
            const row = readQuality.call(this);
            if (row.total > 0) pending = row;
          });
          originalAdd.call(this, "ended", function () {
            const row = readQuality.call(this);
            if (row.total === 0 && pending) {
              row.dropped = pending.dropped;
              row.total = pending.total;
              row.rate = pending.rate;
            }
            pending = null;
            window.__quality.push(row);
            if (window.__quality.length >= 2) window.__rate = 4;
          });
        }
        return originalAdd.call(this, type, fn, opts);
      };
      window.addEventListener("DOMContentLoaded", () => {
        const vid = document.getElementById("vid");
        let last = "";
        vid.addEventListener("loadstart", () => {
          const clip = (vid.getAttribute("src") || "").split("?")[0];
          if (!clip) return;
          if (last && clip === last) window.__repeats.push(clip);
          last = clip;
          window.__seq.push(clip);
        });
      });
      const original = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        try { this.playbackRate = window.__rate || 1; } catch (e) {}
        return original.apply(this, arguments);
      };
    });
    const cdp = await soak.createCDPSession();
    await cdp.send("Performance.enable");
    await cdp.send("Runtime.enable");
    await soak.goto(base + "/?date=2026-12-28", { waitUntil: "domcontentloaded", timeout: 30000 });
    await soak.waitForFunction(() => window.__seq && window.__seq.length >= 1, { timeout: 20000 });

    const samples = [];
    async function sample(label) {
      const dom = await soak.evaluate(() => ({
        nodes: document.querySelectorAll("*").length,
        videos: document.querySelectorAll("video").length,
        ends: window.__quality.length,
        seq: window.__seq.length,
        repeats: window.__repeats.slice(),
        failures: window.__board.failures,
        loads: Number(localStorage.getItem("hol_loads") || 0)
      }));
      let listeners = {};
      let videos = dom.videos;
      let heap = 0;
      try { listeners.vid = await listenerCount(cdp, "document.getElementById('vid')"); } catch (e) { listeners.vid = -1; }
      try { listeners.window = await listenerCount(cdp, "window"); } catch (e) { listeners.window = -1; }
      try { listeners.document = await listenerCount(cdp, "document"); } catch (e) { listeners.document = -1; }
      try { videos = await videoObjectCount(cdp); } catch (e) {}
      try { heap = await heapUsed(cdp); } catch (e) {}
      const row = Object.assign({ label: label, heap: heap, videoObjects: videos }, dom, { listeners: listeners });
      samples.push(row);
      return row;
    }

    await sample("start");
    const deadline = Date.now() + 360000;
    let lastSeq = 0;
    while (Date.now() < deadline) {
      const seq = await soak.evaluate(() => window.__seq.length);
      if (seq >= 24) break;
      if (seq !== lastSeq && seq % 4 === 0) await sample("clip-" + seq);
      lastSeq = seq;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const finalRow = await sample("end");
    const quality = await soak.evaluate(() => ({
      quality: window.__quality,
      seq: window.__seq,
      repeats: window.__repeats,
      reason: localStorage.getItem("hol_reason") || ""
    }));
    const realtime = quality.quality.filter((row) => row.rate < 1.5);
    const sped = quality.quality.filter((row) => row.rate >= 1.5);
    const sum = (rows, key) => rows.reduce((total, row) => total + (row[key] || 0), 0);
    report.soak = {
      clipsStarted: quality.seq.length,
      clipEnds: quality.quality.length,
      repeats: quality.repeats,
      reloadReason: quality.reason,
      samples: samples,
      realtime: {
        clips: realtime.length,
        totalFrames: sum(realtime, "total"),
        droppedFrames: sum(realtime, "dropped")
      },
      spedUp: {
        clips: sped.length,
        totalFrames: sum(sped, "total"),
        droppedFrames: sum(sped, "dropped")
      }
    };

    check(quality.seq.length >= 24, "soak started " + quality.seq.length + " clips");
    check(quality.repeats.length === 0, "soak back-to-back " + quality.repeats.join(","));
    check(!quality.reason, "unexpected reload " + quality.reason);
    check(finalRow.failures === 0, "soak failures " + finalRow.failures);
    check(finalRow.videos === 1, "document videos " + finalRow.videos);
    check(finalRow.videoObjects === samples[0].videoObjects, "video objects " + samples[0].videoObjects + " -> " + finalRow.videoObjects);
    check(finalRow.videoObjects <= 2, "video objects high " + finalRow.videoObjects);
    check(finalRow.heap > 0, "heap unavailable");
    const startNodes = samples[0].nodes;
    check(finalRow.nodes - startNodes <= 2, "DOM grew " + startNodes + " -> " + finalRow.nodes);
    for (const kind of ["vid", "window", "document"]) {
      const a = samples[0].listeners[kind];
      const b = finalRow.listeners[kind];
      if (a >= 0 && b >= 0) check(b <= a, kind + " listeners " + a + " -> " + b);
    }
    const warmed = samples.find((row) => row.seq >= 4) || samples[0];
    const heapGrowth = finalRow.heap - warmed.heap;
    check(heapGrowth < 24 * 1024 * 1024, "heap growth " + Math.round(heapGrowth / 1048576) + "MB");
    check(report.soak.realtime.totalFrames > 0, "no realtime frames");
    await soak.close();
  } finally {
    await browser.close();
  }
  return report;
}

scheduleTests();
if (failures.length) {
  console.log(JSON.stringify({ ok: false, failures: failures }, null, 2));
  process.exit(1);
}

const server = await startServer();
const base = "http://127.0.0.1:" + server.address().port;
let report;
try {
  report = await browserTests(base);
} finally {
  server.close();
}

const ok = failures.length === 0;
console.log(JSON.stringify({ ok: ok, failures: failures, report: report }, null, 2));
process.exit(ok ? 0 : 1);

# 3R Holiday Office TV

Static GitHub Pages board for the office TV. One URL plays all year. Twenty-four silent 15-second clips are grouped into five playlists, and the page picks the playlist from the calendar date in America/New_York.

The TV opens <https://ross680.github.io/Holiday-Office-Board/>.

It follows the same full-screen player as the [Thanksgiving Board](https://github.com/ross680/Thanksgiving-Office-Board): one stage, one reused `<video>` element, a screen wake lock, a stall skip, and a reload so a TV left on for weeks picks up changes. Clips live in `clips/`.

## Windows

All dates are inclusive calendar days in America/New_York. Edit them in `holiday.config.js` only.

| Playlist | Clips | On the air |
| --- | --- | --- |
| New Year's | ny01–ny06 | Dec 26 – Jan 2 |
| Valentine's | vl01–vl04 | Feb 1 – Feb 14 |
| St. Patrick's | sp01–sp04 | Mar 1 – Mar 17 |
| Fourth of July | fj01–fj05 | Jun 24 – Jul 5 |
| Summer AC | ac01–ac05 | Jun 1 – Aug 31, except Jun 24 – Jul 5 |

Summer AC names the Fourth of July id in `except`, so the July dates are written once.

Outside every window the board plays the next playlist and shows a static countdown chip, the same kind of chip as the Thanksgiving board. Examples: `12 DAYS UNTIL VALENTINE'S DAY`, `1 DAY UNTIL ST. PATRICK'S DAY`, `42 DAYS UNTIL SUMMER`, `7 DAYS UNTIL NEW YEAR'S DAY`. The chip is opaque, it does not animate, and it is hidden while a window is live so the picture stays clear. The background is black and the video uses `object-fit: contain`.

The countdown aims at the holiday itself (Jan 1, Feb 14, Mar 17, Jul 4). Summer counts down to Jun 1.

## Publish on GitHub Pages

The page is a normal static site. It does not call the GitHub API. Pages is not turned on from this repo; switch it on once in GitHub:

1. Push this folder to `main`.
2. In GitHub: **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Branch: **main**. Folder: **/** (root).
5. Open <https://ross680.github.io/Holiday-Office-Board/> on the TV browser.

Pages can take a minute after the push. The TV may keep the previous `index.html` for about 10 minutes. The board reloads itself 4 hours after it was opened, after the current clip finishes, and the reload URL carries a `bust` query so the TV fetches a fresh copy. If a clip never ends, a second timer reloads at about 4 hours 15 minutes anyway. Each reload, and a check every minute, resolves the holiday again so a boundary at midnight Eastern takes effect without waiting out the 4 hours.

`.nojekyll` is in the repo so Pages serves the files as they are.

## URL options

- `?holiday=ny|vl|sp|fj|ac` plays that playlist no matter the date.
- `?date=YYYY-MM-DD` pretends today is that America/New_York calendar day. Pair it with `?holiday=` to preview a forced playlist against a date.
- `?reload=4` reloads 4 hours after the page opened (the default), after the current clip ends. `?reload=0` turns that scheduled reload, and the 4 hour 15 minute fallback, off.
- `?maxclip=60` is a hard cap per video, in seconds (default 60). A normal clip ends itself first.
- `?stall=8` skips a clip when playback time has not moved for 8 seconds (the default). The same skip happens on a media error, or on abort, emptied, or stalled once that clip is actually stuck.
- `?slide=3` starts on that clip in the shuffled list (1 is the first).
- `?fresh=1` loads a new page for every clip. Last resort for a TV that still leaks memory.
- `?debug=1` shows the clip name, holiday, uptime, page loads, and the last problem.

A clip that errors, or never produces a picture, is skipped. One bad file does not stop the board. Three failures in a row reload the page. If the network is down, the board keeps cycling whatever the service worker has cached and does not reload into a dead page. When the network comes back it tries the current clip again. A failure reload will not repeat for 3 minutes, so a bad file cannot reboot the TV in a loop.

## Controls

Right arrow or Space: next · Left arrow: previous · P: pause · M: sound on/off · F: fullscreen

Clips start muted so Chrome and TV browsers allow autoplay. M, or the sound button, turns sound on. The clips in this set are silent.

The pointer stays hidden. Move it to see the controls and the clip count (`3 / 6`). The pointer hides again after a few seconds still.

## Playlist order

Each playlist is shuffled when it starts and again when the cycle wraps. The clip that just finished is not placed first, so the same file does not play back to back. A one-clip list cannot do that.

## Add or remove a clip

`holiday.config.js` is the only playlist. The board does not scan the folder.

1. Put a 16:9 file in `clips/`. 1920×1080 is what the current clips are.
2. Add the path to that holiday's `clips` list. To take a clip off the board, delete that line.
3. Commit and push to `main`.

When you replace a file and keep the same name, change the `?v=` text on that line (first 10 hex characters of the new SHA-256). Leave `?v=` alone when the bytes did not change, or the TV downloads the clip again for no reason.

`app.js`, `styles.css`, and `holiday.config.js` are linked with `?v=20261027a`. Bump that text in `index.html` and the matching shell list in `sw.js` when you change those files so the TV does not keep an old copy.

## Keeping the picture moving

One `<video>` element in the page is reused. Each clip is detached (`pause`, clear `src`, `load()`) before the next one so the TV can free the decoder. The next file is warmed on a single off-screen video that is never added to the page. That warmer is aborted the same way before it takes another file.

If `play()` is rejected, the board mutes and tries once more, then skips. Listeners and timers are registered once for the life of the page, not once per clip.

Nothing translucent is painted over the video. The page background is black. The countdown chip is a static opaque label, and it is not in the page while a holiday window is live. The screen wake lock is requested where the browser allows it, and requested again when the page becomes visible.

A service worker caches the page and the clips. After the TV has loaded them once, a network drop keeps the current playlist playing from that cache.

After a scheduled reload the page resumes on the next clip, rather than jumping back to an arbitrary one. Saved resume state uses its own `hol_` keys so it does not collide with the Thanksgiving or Christmas board on the same `github.io` origin.

## Encoding

Every shipped clip is the same shape: 1920×1080, 24 fps, 15.0 seconds, H.264 Main profile level 4.0, yuv420p, faststart, plus a silent audio track.

A lot of TVs only hardware-decode Baseline or Main. High profile with B-frames can stay black. If this TV does that, re-encode on a computer, put the new file in place of the old one, change `?v=`, and push:

```bash
ffmpeg -y -i "INPUT.mp4" \
  -c:v libx264 -profile:v main -level:v 4.0 -pix_fmt yuv420p \
  -r 24 -b:v 1800k -maxrate 2200k -bufsize 3600k -bf 0 \
  -an \
  -movflags +faststart \
  "OUTPUT.mp4"
```

If the picture is still black, use `-profile:v baseline -level:v 4.0 -bf 0` in place of the Main profile line.

## Tests

`npm test` checks the date windows (every playlist, the gaps between them, and the `?holiday=` / `?date=` overrides) and runs a headless Chrome soak across many clip ends. The soak checks that the video element count, DOM size, listener count, and JS heap stay flat, and it prints `getVideoPlaybackQuality` dropped frames.

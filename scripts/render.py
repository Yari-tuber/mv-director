"""mv-director · 渲染：静帧、联系表、成片（多进程并行，60 帧，BT.709）。

在任何地方跑都行，第一个参数是项目文件夹（里面有 index.html、scene.js、song.json、cues.json、audio.wav）：
  python -I render.py <项目> stills bar9 bar13.3 line8 12.5     指定时刻的静帧 → out/stills/，再拼一张联系表
  python -I render.py <项目> bars                               每小节一张（刚过小节头）→ out/stills/每小节.jpg
  python -I render.py <项目> moments                            每个大时刻前后 6 帧 → out/stills/大时刻.jpg
  python -I render.py <项目> lines                              每句歌词唱到关键词那一刻一张 → out/stills/逐句.jpg（对着歌词看演没演出来）
  python -I render.py <项目> video --draft                      草稿：960×540、30 帧，几分钟出来，用来审节奏
  python -I render.py <项目> video                              成片：1920×1080、60 帧 → out/mv.mp4
可选：--debug（画面顶上印 bar / 段落 / 镜头 / 大时刻，审片用，成片别加）  --workers N  --from 秒 --to 秒

需要：Python 装了 playwright（python -m playwright install chromium 一次）、Pillow；ffmpeg 在 PATH。
"""
import argparse, base64, concurrent.futures as cf, functools, http.server, json, os, shutil, subprocess, sys, threading, time
from pathlib import Path

FF = shutil.which('ffmpeg') or sys.exit('找不到 ffmpeg：先装 ffmpeg 并放进 PATH（见 references/安装.md）')


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()


Quiet.extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.mjs': 'text/javascript',
                        '.json': 'application/json', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.wav': 'audio/wav'}


def serve(root):
    h = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(root)))
    threading.Thread(target=h.serve_forever, daemon=True).start()
    return h.server_address[1]


def open_page(p, root, query):
    args = ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--js-flags=--max-old-space-size=8192']
    try:
        b = p.chromium.launch(channel='chrome', headless=True, args=args)
    except Exception:
        b = p.chromium.launch(headless=True, args=args)
    pg = b.new_page(viewport={'width': 1920, 'height': 1080}, device_scale_factor=1)
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    def on_console(m):
        url = (m.location or {}).get('url', '') if isinstance(m.location, dict) else ''
        if m.type == 'error' and 'favicon' not in url: errs.append(m.text + (f'（{url}）' if url else ''))
    pg.on('console', on_console)
    port = serve(root)
    pg.goto(f'http://127.0.0.1:{port}/index.html?render' + query)
    t0 = time.time()
    while True:
        st = pg.evaluate('[window.READY === true, window.MV_ERROR || null]')
        if st[1] or errs: b.close(); sys.exit('页面出错了：\n' + (st[1] or '\n'.join(errs[:6])))
        if st[0]: break
        if time.time() - t0 > 300: b.close(); sys.exit('等了 300 秒页面还没准备好（字体、图片太大？setup 卡住？）')
        time.sleep(0.15)
    return b, pg, errs


GRAB = """async ([t, q]) => { const log = window.render(t); const c = document.getElementById('c');
  return [c.toDataURL('image/jpeg', q), log]; }"""


def grab(pg, t, q=0.92):
    data, log = pg.evaluate(GRAB, [t, q])
    return base64.b64decode(data.split(',', 1)[1]), log


def sheet(items, out, cols=5, w=480, title=''):
    from PIL import Image, ImageDraw, ImageFont
    if not items: return
    ims = [Image.open(f) for f, _ in items]
    h = round(w * ims[0].height / ims[0].width)
    rows = (len(ims) + cols - 1) // cols
    top = 40 if title else 0
    NL = chr(10)
    lh = 30 if not any(NL in lab for _, lab in items) else 52     # 标签两行时留高一点
    S = Image.new('RGB', (cols * w + (cols - 1) * 6, top + rows * (h + lh)), (22, 22, 26))
    d = ImageDraw.Draw(S)
    font = None
    for fp in [r'C:\Windows\Fonts\msyh.ttc', r'C:\Windows\Fonts\simhei.ttf', '/System/Library/Fonts/PingFang.ttc', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc']:
        if Path(fp).exists(): font = ImageFont.truetype(fp, 18); break
    if title: d.text((8, 8), title, fill=(255, 220, 120), font=font)
    for i, ((f, label), im) in enumerate(zip(items, ims)):
        x, y = (i % cols) * (w + 6), top + (i // cols) * (h + lh)
        S.paste(im.resize((w, h)), (x, y + lh - 2))
        for k, part in enumerate(label.split(NL)[:2]):
            while font and len(part) > 4 and d.textlength(part, font=font) > w - 8: part = part[:-2]
            d.text((x + 4, y + 3 + k * 23), part, fill=(240, 210, 140) if k == 0 else (190, 190, 200), font=font)
    S.save(out, quality=88)
    print('联系表', out)


def stills(root, times, labels, out_name, debug, cols=5, title=''):
    from playwright.sync_api import sync_playwright
    od = root / 'out' / 'stills'; od.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b, pg, errs = open_page(p, root, '&debug' if debug else '')
        ts = [pg.evaluate('(r) => window.MV.M.ref(r)', x) if isinstance(x, str) else x for x in times]
        items = []
        for t, lab in zip(ts, labels):
            data, _ = grab(pg, float(t))
            f = od / f't_{float(t):07.3f}.jpg'; f.write_bytes(data); items.append((f, lab or f'{t:.2f}s'))
        b.close()
    sheet(items, od / out_name, cols=cols, title=title)
    if errs: print('页面报错：', ' | '.join(errs[:3]))
    return items


def worker(args):
    root, i0, i1, fps, query, seg, wid, crf, preset = args
    from playwright.sync_api import sync_playwright
    root = Path(root)
    cmd = [FF, '-y', '-v', 'error', '-f', 'image2pipe', '-framerate', str(fps), '-c:v', 'mjpeg', '-i', '-',
           '-vf', 'scale=in_range=pc:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', preset, '-crf', str(crf),
           '-g', str(fps * 2), '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', seg]
    logs = []
    with sync_playwright() as p:
        b, pg, errs = open_page(p, root, query)
        ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        t0 = time.time(); last = t0
        for i in range(i0, i1):
            data, log = grab(pg, i / fps, 0.93)
            ff.stdin.write(data); logs.append(log)
            if time.time() - last > 15:
                last = time.time(); print(f'  [进程{wid}] {i - i0}/{i1 - i0} 帧，{last - t0:.0f} 秒', flush=True)
            if errs: break
        ff.stdin.close(); ff.wait(); b.close()
        if errs: return wid, None, '页面报错：' + ' | '.join(errs[:3])
    return wid, logs, None


def video(root, a):
    info_dur = json.loads((root / 'song.json').read_text(encoding='utf-8'))['dur']
    fps = 30 if a.draft else a.fps
    t_from, t_to = a.__dict__['from'] or 0.0, a.to or info_dur
    n0, n1 = int(round(t_from * fps)), int(round(t_to * fps))
    nw = max(1, min(a.workers or max(2, min(8, (os.cpu_count() or 4) // 3)), (n1 - n0) // 30 or 1))
    query = ('&scale=0.5' if a.draft else '') + ('&debug' if a.debug else '')
    od = root / 'out'; od.mkdir(exist_ok=True); tmp = od / '_seg'; tmp.mkdir(exist_ok=True)
    edges = [n0 + (n1 - n0) * k // nw for k in range(nw + 1)]
    jobs = [(str(root), edges[k], edges[k + 1], fps, query, str(tmp / f'seg{k:02d}.mp4'), k, 22 if a.draft else 15, 'veryfast' if a.draft else 'medium') for k in range(nw)]
    print(f'渲染 {t_from:.2f}–{t_to:.2f} 秒，{n1 - n0} 帧 · {fps} 帧/秒 · {"草稿 960×540" if a.draft else "1920×1080"} · {nw} 个进程并行')
    T = time.time()
    logs = [None] * nw
    with cf.ProcessPoolExecutor(nw) as ex:
        for wid, lg, err in ex.map(worker, jobs):
            if err: sys.exit(f'进程 {wid} 失败：{err}')
            logs[wid] = lg
    print(f'画面渲完，用了 {time.time() - T:.0f} 秒')
    lst = tmp / 'list.txt'
    lst.write_text(''.join(f"file '{(tmp / f'seg{k:02d}.mp4').as_posix()}'\n" for k in range(nw)), encoding='utf-8')
    name = a.out or ('mv_草稿.mp4' if a.draft else 'mv.mp4')
    out = od / name
    cmd = [FF, '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(lst), '-ss', f'{t_from:.4f}', '-i', str(root / 'audio.wav'),
           '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-t', f'{(n1 - n0) / fps:.4f}', '-movflags', '+faststart', str(out)]
    subprocess.run(cmd, check=True)
    flat = [x for lg in logs for x in lg]
    (od / ('textlog_草稿.json' if a.draft else 'textlog.json')).write_text(json.dumps({'fps': fps, 'from': t_from, 'frames': flat}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    for f in tmp.iterdir(): f.unlink()
    tmp.rmdir()
    print(f'写好了 {out}（{(n1 - n0) / fps:.2f} 秒，用时 {time.time() - T:.0f} 秒）。下一步：python -I check.py {root} {"--draft" if a.draft else ""}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project'); ap.add_argument('mode', choices=['stills', 'bars', 'moments', 'lines', 'video'])
    ap.add_argument('times', nargs='*')
    ap.add_argument('--draft', action='store_true'); ap.add_argument('--debug', action='store_true')
    ap.add_argument('--fps', type=int, default=60); ap.add_argument('--workers', type=int)
    ap.add_argument('--from', type=float); ap.add_argument('--to', type=float); ap.add_argument('--out')
    a = ap.parse_args()
    root = Path(a.project).resolve()
    for need in ['index.html', 'scene.js', 'song.json', 'cues.json']:
        if not (root / need).exists(): sys.exit(f'项目里缺 {need}：先跑 new_project.py，或检查第一个参数是不是项目文件夹')
    if a.mode == 'video': return video(root, a)
    song = json.loads((root / 'song.json').read_text(encoding='utf-8'))
    if a.mode == 'stills':
        if not a.times: sys.exit('stills 后面写时刻：bar9 bar13.3 line8 12.5')
        ts = [x if not x.replace('.', '', 1).isdigit() else float(x) for x in a.times]
        stills(root, ts, [str(x) for x in a.times], '静帧.jpg', a.debug)
    elif a.mode == 'lines':
        cues = json.loads((root / 'cues.json').read_text(encoding='utf-8'))
        board = {int(b['line']): b for b in cues.get('board', []) if 'line' in b}
        ts, labs = [], []
        for L in song['lines']:
            if L['t0'] >= song['dur'] - 0.2: continue
            b = board.get(L['n'], {})
            keys = b.get('keys') or []
            pts = [f'line{L["n"]}@{k}' for k in keys] or [f'line{L["n"]}']
            for r_ in pts:
                ts.append(r_ + '+0.25s'); labs.append(f'line{L["n"]}「{L["text"]}」 唱到「{r_.split("@")[-1] if "@" in r_ else "开头"}」' + (chr(10) + f'要看到：{b.get("see", "")}' if b else ''))
        stills(root, ts, labs, '逐句.jpg', a.debug, cols=3, title='逐句：每张是唱到这个词后 0.25 秒。遮住歌词只看图，能看出歌词说的东西吗？看不出 = 没演出来')
    elif a.mode == 'bars':
        ds = [d for d in song['downbeats'] if 0 <= d < song['dur']]
        ts = [d + 0.07 for d in ds]
        labs = [f'bar{round((d - song["first_downbeat"]) / song["bar"]) + 1}  {d:.2f}s' for d in ds]
        stills(root, ts, labs, '每小节.jpg', a.debug, cols=6, title='每小节刚过小节头一帧：相邻几张长得差不多 = 这几小节画面没变化')
    else:
        cues = json.loads((root / 'cues.json').read_text(encoding='utf-8'))
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            b, pg, _ = open_page(p, root, '')
            info = pg.evaluate('window.MV_INFO()'); b.close()
        ms = info['moments'] or []
        if not ms: sys.exit('卡点表里还没有 moments')
        offs = [-0.2, 0.0, 0.05, 0.15, 0.35, 0.7]
        ts, labs = [], []
        for m in ms:
            for o in offs:
                ts.append(max(0, min(song['dur'] - 0.01, m['t'] + o))); labs.append(f'{"★" if m["big"] else "·"}{m["name"]} {o:+.2f}s')
        stills(root, ts, labs, '大时刻.jpg', a.debug, cols=len(offs), title='每行一个大时刻：-0.2s 是之前，0 是那一拍，之后 0.05–0.7s 看它怎么炸开、怎么收')


if __name__ == '__main__':
    main()

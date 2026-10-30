"""mv-director · 审片：拿渲出来的视频和 song.json 对，量「画面到底有没有跟着音乐走」。

  python -I check.py <项目> [--draft] [--video 别的视频.mp4] [--from 13]

量这些（都是从视频像素里量的，不看代码怎么写）：
  1. 小节头命中率：每个小节头那一下，画面动得比前面明显大吗（≥2 倍算命中）
  2. 大时刻：卡点表里 big 的时刻、音乐的大时刻候选，画面有没有「炸」（≥4 倍，或者亮度突变）
  3. 死画面：有没有连续 1 秒以上几乎不动
  4. 起伏：画面运动量和歌的能量、计划的 arc 跟不跟
  5. 切点：硬切有几成落在拍上
  6. 歌词：每句唱的时候屏幕上有没有这句（读 render.py 记下的 textlog），字多大
出 out/审片.md（结论 + 改什么）、out/审片_运动曲线.png、out/stills/审片_大时刻.jpg。
--video 可以拿任何视频来量（比如别的 skill 做的片子），--from 是这段视频对应 song.json 的起点偏移。
"""
import argparse, json, shutil, subprocess, sys
from pathlib import Path

import numpy as np

FF = shutil.which('ffmpeg') or sys.exit('找不到 ffmpeg：先装 ffmpeg 并放进 PATH（见 references/安装.md）')
SW, SH, FPS = 160, 90, 60


def src_fps(video):
    fp = shutil.which('ffprobe') or str(Path(FF).with_name('ffprobe.exe'))
    r = subprocess.run([fp, '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=avg_frame_rate', '-of', 'csv=p=0', str(video)], capture_output=True, text=True).stdout.strip()
    import re
    m = re.search(r'(\d+(?:\.\d+)?)/(\d+(?:\.\d+)?)', r)
    return float(m.group(1)) / float(m.group(2)) if m and float(m.group(2)) else 60.0


def frames(video, fps=FPS):
    raw = subprocess.run([FF, '-v', 'error', '-i', str(video), '-vf', f'fps={fps},scale={SW}:{SH}:flags=area,format=gray', '-f', 'rawvideo', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, SH, SW).astype(np.float32)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project'); ap.add_argument('--draft', action='store_true'); ap.add_argument('--video'); ap.add_argument('--offset', type=float, default=0.0)
    a = ap.parse_args()
    root = Path(a.project).resolve()
    S = json.loads((root / 'song.json').read_text(encoding='utf-8'))
    C = json.loads((root / 'cues.json').read_text(encoding='utf-8')) if (root / 'cues.json').exists() else {}
    video = Path(a.video) if a.video else root / 'out' / ('mv_草稿.mp4' if a.draft else 'mv.mp4')
    if not video.exists(): sys.exit(f'没有 {video}：先 render.py video')
    global FPS
    FPS = int(round(min(60, src_fps(video))))            # 按片子自己的帧率量（30 帧的片子按 60 量会有一半是重复帧）
    F = frames(video, FPS)
    n = len(F); t = np.arange(n) / FPS + a.offset
    lum = F.mean((1, 2)) / 255
    d = np.r_[0, np.abs(np.diff(F, axis=0)).mean((1, 2))]      # 每帧和上一帧差多少（0–255）
    base = max(float(np.median(d)), 0.25 * float(d.mean()), 0.2)
    out = []
    P = lambda s: out.append(s)
    dur = min(S['dur'], t[-1])

    def win(x0, x1): i0, i1 = max(0, int((x0 - a.offset) * FPS)), min(n, int((x1 - a.offset) * FPS) + 1); return slice(i0, max(i0 + 1, i1))
    def ratio(tt, pre=(0.45, 0.08), post=(-0.02, 0.10)):
        hit = d[win(tt + post[0], tt + post[1])].max()
        bg = np.median(d[win(tt - pre[0], tt - pre[1])]) + 0.15 * base + 1e-3
        return hit / bg, hit

    # 1 小节头
    dbs = [x for x in S['downbeats'] if 0.3 < x < dur - 0.2]
    rs = [ratio(x)[0] for x in dbs]
    hit_rate = np.mean([r >= 2 for r in rs]) if rs else 0
    # 拍点（全部拍）
    bs = [x for x in S['beats'] if 0.3 < x < dur - 0.2]
    rb = [ratio(x, pre=(0.2, 0.06))[0] for x in bs]
    beat_rate = np.mean([r >= 1.6 for r in rb]) if rb else 0
    # 2 大时刻
    big = []
    def ref(r):
        if isinstance(r, (int, float)): return float(r)
        sys.path.insert(0, str(Path(__file__).parent)); from cue_lint import Song
        return Song(S).ref(r)
    for m in C.get('moments', []):
        if m.get('big'):
            try: big.append((ref(m['at']), m.get('name', '?'), '卡点表'))
            except Exception: pass
    for c in S.get('big', []):
        if c['score'] >= 0.9 and not any(abs(c['t'] - b[0]) < S['beat'] * 0.55 for b in big): big.append((c['t'], c['why'][:16], '音乐候选'))
    big.sort()
    bres = []
    for tt, name, src in big:
        if tt > dur - 0.1: continue
        r, h = ratio(tt, pre=(0.6, 0.1), post=(-0.03, 0.15))
        dl = abs(lum[win(tt - 0.02, tt + 0.15)].mean() - lum[win(tt - 0.5, tt - 0.1)].mean())
        bres.append((tt, name, src, r, dl, r >= 4 or dl >= 0.12))
    # 3 死画面
    dead = []
    quiet = d < max(0.35, base * 0.18)
    i = 0
    while i < n:
        if quiet[i]:
            j = i
            while j < n and quiet[j]: j += 1
            if (j - i) / FPS >= 1.0: dead.append((t[i], t[j - 1]))
            i = j
        else: i += 1
    # 4 起伏
    k = int(S['bar'] * FPS)
    sm = np.convolve(d, np.ones(k) / k, 'same')
    en = np.interp(t, np.arange(len(S['env']['energy'])) / S['env']['fps'], S['env']['energy'])
    en_s = np.convolve(en, np.ones(k) / k, 'same')
    corr = float(np.corrcoef(sm, en_s)[0, 1]) if sm.std() > 0 else 0
    arc_corr = None
    if C.get('arc'):
        sys.path.insert(0, str(Path(__file__).parent)); from cue_lint import Song
        sg = Song(S); arc = sorted((sg.ref(r), v) for r, v in C['arc'])
        av = np.interp(t, [x for x, _ in arc], [v for _, v in arc])
        arc_corr = float(np.corrcoef(sm, av)[0, 1]) if sm.std() > 0 and np.std(av) > 0 else None
    # 每段平均运动
    secm = []
    for s in S['sections']:
        w = win(s['t0'], s['t1']); secm.append((s, float(d[w].mean() / base)))
    # 5 切点（亮度直方图突变 = 硬切）
    hist = np.stack([np.histogram(f, bins=16, range=(0, 255))[0] for f in F]).astype(np.float32) / (SW * SH)
    hd = np.r_[0, np.abs(np.diff(hist, axis=0)).sum(1)]
    cut_idx = [i for i in range(2, n - 2) if hd[i] > 0.6 and hd[i] == hd[i - 2:i + 3].max()]
    cuts = [t[i] for i in cut_idx]
    sung = [c['t'] for L in S['lines'] for c in L['chars']]
    on_beat = [any(-max(1.5 / FPS, 0.03) <= c - b <= 0.12 for b in S['beats'] + sung) for c in cuts]   # 落在拍上或某个字唱出来的那一刻都算；闪白、故障转场会晚一两帧落地
    # 6 歌词
    tl_path = root / 'out' / ('textlog_草稿.json' if a.draft else 'textlog.json')
    lyr = []
    if tl_path.exists() and not a.video:
        TL = json.loads(tl_path.read_text(encoding='utf-8')); tfps = TL['fps']; frs = TL['frames']; f0 = TL.get('from', 0)
        for L in S['lines']:
            i0, i1 = int((max(0, L['t0']) - f0) * tfps), int((min(dur, L['sung_end']) - f0) * tfps)
            if i1 <= i0: continue
            seen = [max([e['px'] for e in frs[i] if e['n'] == L['n'] and e['a'] > 0.4] or [0]) for i in range(max(0, i0), min(len(frs), i1))]
            cover = np.mean([s > 0 for s in seen]) if seen else 0
            # 这句第一次上屏（透明度 > 0.4）是什么时候：和对齐出来的开唱时间比
            j0, j1 = max(0, int((L['t0'] - 1.5 - f0) * tfps)), min(len(frs), int((L['t0'] + 1.5 - f0) * tfps))
            first = next((i for i in range(j0, j1) if any(e['n'] == L['n'] and e['a'] > 0.4 for e in frs[i])), None)
            lag = None if first is None else first / tfps + f0 - L['t0']
            lyr.append((L, cover, max(seen) if seen else 0, lag))

    # ---------- 报告 ----------
    P(f'# 审片：{video.name}')
    P(f'\n片长 {n / FPS:.2f} 秒（{FPS} 帧/秒）· 画面每帧变化中位数 {base:.2f}（0–255）· 歌 {S["bpm"]:.1f} BPM\n')
    verdict = []
    P('## 1. 卡点\n')
    P(f'- 小节头命中率 **{hit_rate * 100:.0f}%**（{len(dbs)} 个小节头，画面变化 ≥ 前面 2 倍算命中）{"✓" if hit_rate >= 0.7 else "✗ 低于 70%：很多小节头画面没反应"}')
    P(f'- 拍点命中率 {beat_rate * 100:.0f}%（每一拍，≥1.6 倍算）{"" if beat_rate >= 0.3 else "：拍上几乎没有动作，画面像在自己飘"}')
    if hit_rate < 0.7: verdict.append(f'小节头只命中 {hit_rate * 100:.0f}%：每个小节头都要有看得见的动作（换镜头、推一下、换颜色、字砸下来）')
    if cuts:
        P(f'- 硬切 {len(cuts)} 次，{np.mean(on_beat) * 100:.0f}% 落在拍上或字上（之前 1.5 帧到之后 0.12 秒）{"✓" if np.mean(on_beat) >= 0.8 else "✗ 有切点没落在拍上"}')
        off = [f'{c:.2f}' for c, ok in zip(cuts, on_beat) if not ok]
        if off: P(f'  - 不在拍上的切点：{", ".join(off[:12])}'); verdict.append('有硬切不在拍上：' + ', '.join(off[:6]))
    P('\n## 2. 大时刻（画面有没有炸）\n')
    P('| 时刻 | 名字 | 来源 | 运动倍数 | 亮度突变 | 结果 |\n|---|---|---|---|---|---|')
    for tt, name, src, r, dl, good in bres:
        P(f'| {tt:.2f}s | {name} | {src} | {r:.1f}× | {dl:.2f} | {"✓ 炸了" if good else "✗ 没炸起来"} |')
        if not good: verdict.append(f'{tt:.2f}s「{name}」没炸起来（{r:.1f} 倍）：这一拍要整个画面变——换镜头 + 推近/闪/震，画面主体变形')
    P('\n## 3. 死画面\n')
    if dead:
        for a0, a1 in dead: P(f'- ✗ {a0:.2f}–{a1:.2f}s（{a1 - a0:.1f} 秒）几乎不动')
        verdict.append(f'有 {len(dead)} 处超过 1 秒不动：' + '，'.join(f'{a0:.1f}–{a1:.1f}s' for a0, a1 in dead[:5]))
    else: P('- ✓ 没有超过 1 秒不动的地方')
    P('\n## 4. 起伏\n')
    P(f'- 画面运动量 vs 歌的能量：相关 {corr:.2f}' + ('' if corr >= 0.2 else '（这首歌能量起伏小时这项参考意义不大，看下面每段）'))
    if arc_corr is not None:
        P(f'- 画面运动量 vs 计划的 arc：相关 **{arc_corr:.2f}** {"✓" if arc_corr >= 0.4 else "✗ 画面没按计划起伏"}')
        if arc_corr < 0.4: verdict.append(f'画面起伏没按 arc 走（相关 {arc_corr:.2f}）：arc 低的段落要收（少动、留白），高的段落要放（快切、大动作）')
    P('\n| 段落 | 时间 | 歌的能量 | 画面运动（相对全片平均） |\n|---|---|---|---|')
    for s, v in secm: P(f'| {s["kind"]} | {s["t0"]:.1f}–{s["t1"]:.1f} | {s["energy"]:.2f} | {v:.2f}× {"▇" * min(20, int(v * 5))} |')
    chv = [v for s, v in secm if s['kind'] == '副歌']; otv = [v for s, v in secm if s['kind'] != '副歌']
    if chv and otv and max(chv) < max(otv): verdict.append('副歌的画面运动不是全片最大：副歌要最炸')
    if lyr:
        P('\n## 5. 歌词上屏\n')
        timing = S['lines'][0].get('timing', '') if S['lines'] else ''
        P(f'逐字时间来源：{timing}' + ('' if '强制对齐' in timing else '（⚠ 不是强制对齐，开唱时间本身可能就差半秒以上）') + '\n')
        P('| 句 | 歌词 | 上屏比开唱 | 唱的时候在屏幕上 | 最大字号 |\n|---|---|---|---|---|')
        for L, cov, px, lag in lyr:
            lg = '没找到' if lag is None else f'{lag:+.2f}s'
            okl = lag is not None and -0.35 <= lag <= 0.15
            P(f'| line{L["n"]} | {L["text"]} | {lg} {"✓" if okl else "✗"} | {cov * 100:.0f}% {"✓" if cov >= 0.75 else "✗"} | {px}px {"⚠ 偏小" if 0 < px < 100 else ""} |')
        early = [f'line{L["n"]}（{lag:+.2f}s）' for L, cov, px, lag in lyr if lag is not None and not (-0.35 <= lag <= 0.15)]
        if early: verdict.append('这些句子上屏时间和唱的对不上（负数 = 字比唱早，正数 = 字比唱晚；要在开唱前 0.35 秒到开唱后 0.15 秒之间）：' + '、'.join(early))
        bad = [f'line{L["n"]}' for L, cov, _, _ in lyr if cov < 0.75]
        if bad: verdict.append('这些句子唱的时候屏幕上大半时间没有字：' + '、'.join(bad))
        small = [L for L, cov, px, _ in lyr if 0 < px < 100]
        if len(small) > len(lyr) / 3: verdict.append('多数歌词字号不到 100px：像字幕，不像 MV。歌词要当画面主角')
    P('\n## 结论\n')
    if verdict:
        for v in verdict: P(f'- ✗ {v}')
    else: P('- ✓ 量出来都过关。再整支看一遍，挑最平淡的一段加戏。')
    P('\n图：out/审片_运动曲线.png（红竖线 = 小节头，黄点 = 大时刻）；out/stills/审片_大时刻.jpg（每个大时刻前后的帧）')
    (root / 'out').mkdir(exist_ok=True)
    tag = ('_' + video.stem) if a.video else ('_草稿' if a.draft else '')
    rep = root / 'out' / f'审片{tag}.md'
    rep.write_text('\n'.join(out) + '\n', encoding='utf-8')
    print('\n'.join(out))
    # 图
    try:
        import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
        from matplotlib import font_manager
        for nm in ['Microsoft YaHei', 'SimHei', 'Noto Sans CJK SC', 'PingFang SC']:
            if any(f.name == nm for f in font_manager.fontManager.ttflist): plt.rcParams['font.family'] = nm; break
        fig, ax = plt.subplots(figsize=(max(16, dur * 0.4), 4.5), dpi=110)
        fig.patch.set_facecolor('#16161a'); ax.set_facecolor('#1d1d22'); ax.tick_params(colors='#bbb')
        ax.plot(t, d / base, color='#9ad', lw=0.7, label='每帧画面变化（÷全片中位数）')
        ax.plot(t, sm / base, color='#fff', lw=1.5, label='一小节平均')
        ax.plot(t, en_s * (sm / base).max(), color='#e8c170', lw=1.2, alpha=0.8, label='歌的能量（缩放）')
        for x in S['downbeats']:
            if 0 <= x <= dur: ax.axvline(x, color='#c33', lw=0.6, alpha=0.6)
        for tt, name, src, r, dl, good in bres: ax.plot([tt], [(d / base).max() * 0.95], marker='*', ms=14, color='#ffd34d' if good else '#ff3b3b')
        for a0, a1 in dead: ax.axvspan(a0, a1, color='#f00', alpha=0.2)
        ax.set_xlim(a.offset, a.offset + n / FPS); ax.legend(loc='upper left', fontsize=8, facecolor='#222', labelcolor='#ddd')
        ax.set_title(f'{video.name}：小节头命中 {hit_rate * 100:.0f}%（红线 = 小节头，星 = 大时刻：黄 = 炸了，红 = 没炸）', color='#eee', loc='left', fontsize=10)
        fig.tight_layout(); fig.savefig(root / 'out' / f'审片_运动曲线{tag}.png', facecolor=fig.get_facecolor()); plt.close(fig)
        # 大时刻前后帧
        from PIL import Image, ImageDraw
        if bres:
            offs = [-0.2, 0.0, 0.05, 0.15, 0.35, 0.7]; tw, th = 320, 180
            img = Image.new('RGB', (len(offs) * (tw + 4), len(bres) * (th + 24)), (20, 20, 24)); dr = ImageDraw.Draw(img)
            from PIL import ImageFont
            fnt = None
            for fp in [r'C:\Windows\Fonts\msyh.ttc', r'C:\Windows\Fonts\simhei.ttf', '/System/Library/Fonts/PingFang.ttc', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc']:
                if Path(fp).exists(): fnt = ImageFont.truetype(fp, 15); break
            for r_, (tt, name, src, r, dl, good) in enumerate(bres):
                for c_, o in enumerate(offs):
                    x = max(0, tt + o - a.offset)
                    raw = subprocess.run([FF, '-v', 'error', '-ss', f'{x:.3f}', '-i', str(video), '-frames:v', '1', '-vf', f'scale={tw}:{th}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
                    if len(raw) == tw * th * 3: img.paste(Image.frombytes('RGB', (tw, th), raw), (c_ * (tw + 4), r_ * (th + 24) + 22))
                    dr.text((c_ * (tw + 4) + 4, r_ * (th + 24) + 4), f'{name} {o:+.2f}s {"OK" if good else "NO"}', fill=(255, 220, 120), font=fnt)
            (root / 'out' / 'stills').mkdir(parents=True, exist_ok=True)
            img.save(root / 'out' / 'stills' / f'审片_大时刻{tag}.jpg', quality=85)
    except Exception as e:
        print('（图没画出来：', e, '）')


if __name__ == '__main__':
    main()

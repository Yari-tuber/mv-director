"""mv-director · 卡点表检查：cues.json 对不对得上 song.json（拍子、段落、大时刻候选、歌词）。

  python -I cue_lint.py <项目>

✗ = 必须改（不改不许开始画）；⚠ = 想清楚再决定（在 plan.md 里写一句为什么不改也行）。
顺手出一张 out/cue_map.png：歌的能量 + 你排的镜头、大时刻、歌词上屏方式、起伏曲线，一眼看出哪里空、哪里挤。
"""
import json, re, sys
from pathlib import Path

MODES = {'pop', 'slam', 'karaoke', 'type', 'chat', 'stamp', 'wave', 'scatter', 'big', 'stack', 'bubble', 'scene', 'none'}
HERO = {'stamp', 'big', 'stack', 'slam', 'scene', 'scatter'}
FX = {'flash', 'punch', 'shake', 'rgb', 'invert', 'blackout', 'strobe', 'zoomblur', 'glitch', 'tilt', 'ring', 'speedlines', 'stutter', 'freeze', 'slowmo', 'drift'}
TRANS = {'cut', 'fade', 'flash', 'whip', 'zoom', 'iris', 'wipe', 'glitch', 'smash', 'push'}
EVENTS = {'beat', 'bar', 'kick', 'snare', 'hat', 'line', 'char', 'shot', 'big', 'moment'}
SIZES = {'hero': 210, 'big': 150, 'mid': 108, 'small': 78}


class Song:
    def __init__(self, s):
        self.s = s
        self.db0 = min(range(len(s['downbeats'])), key=lambda i: abs(s['downbeats'][i] - s['first_downbeat'])) if s['downbeats'] else 0

    def bar_t(self, n, beat=1):
        s = self.s; i = self.db0 + n - 1
        t = s['downbeats'][i] if 0 <= i < len(s['downbeats']) else s['first_downbeat'] + (n - 1) * s['bar']
        if beat != 1:
            bi = next((k for k, b in enumerate(s['beats']) if abs(b - t) < 0.03), None)
            t = s['beats'][bi + beat - 1] if bi is not None and bi + beat - 1 < len(s['beats']) else t + (beat - 1) * s['beat']
        return t

    def ref(self, r):
        if isinstance(r, (int, float)): return float(r)
        x = re.sub(r'\s+', '', str(r))
        m = re.match(r'^(bar-?\d+(?:\.\d+)?|line\d+(?:@[^+\-]+)?|beat\d+|end|start|-?\d*\.?\d+)((?:[+-]\d*\.?\d+(?:b|s|bar)?)*)$', x)
        if not m: raise ValueError(f'看不懂的时间「{r}」（写 bar9 / bar9.3 / line4 / line4@某个词 / line4@end / 12.5，可加 +0.5b / -0.1s）')
        base = m.group(1)
        if base.startswith('bar'):
            n, _, b = base[3:].partition('.'); t = self.bar_t(int(n), int(b) if b else 1)
        elif base.startswith('line'):
            ln, _, word = base[4:].partition('@')
            L = next((l for l in self.s['lines'] if l['n'] == int(ln)), None)
            if not L: raise ValueError(f'没有这一句：line{ln}')
            t = L['t0'] if not word else (L['sung_end'] if word == 'end' else self.word_t(L, word))
        elif base.startswith('beat'): t = self.s['beats'][int(base[4:]) - 1]
        elif base == 'end': t = self.s['dur']
        elif base == 'start': t = 0.0
        else: t = float(base)
        for o in re.findall(r'[+-]\d*\.?\d+(?:b|s|bar)?', m.group(2)):
            v = float(re.match(r'[+-]\d*\.?\d+', o).group(0))
            t += v * self.s['bar'] if o.endswith('bar') else v * self.s['beat'] if o.endswith('b') else v
        return t

    def word_t(self, L, word):
        txt = ''.join(c['c'] for c in L['chars']); k = txt.find(re.sub(r'\s+', '', word))
        if k < 0: raise ValueError(f'第 {L["n"]} 句「{L["text"]}」里没有「{word}」')
        return L['chars'][k]['t']

    def near(self, t, arr):
        return min((abs(t - x) for x in arr), default=9)

    def label(self, t):
        s = self.s; db = s['downbeats']
        i = max([k for k, d in enumerate(db) if d <= t + 0.03], default=None)
        if i is None: return f'bar0（{t:.2f}s）'
        b = i - self.db0 + 1; nb = len([x for x in s['beats'] if db[i] - 0.03 <= x <= t + 0.03])
        return f'bar{b}' + ('' if abs(t - db[i]) < 0.03 else f'.{max(1, nb)}') + f'（{t:.2f}s）'


def main():
    root = Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
    S = json.loads((root / 'song.json').read_text(encoding='utf-8'))
    C = json.loads((root / 'cues.json').read_text(encoding='utf-8'))
    scene_js = (root / 'scene.js').read_text(encoding='utf-8') if (root / 'scene.js').exists() else ''
    plan = (root / 'plan.md').read_text(encoding='utf-8') if (root / 'plan.md').exists() else ''
    sg = Song(S); dur = S['dur']; beat = S['beat']; bar = S['bar']
    err, warn, ok = [], [], []
    X = lambda m: err.append(m); Wn = lambda m: warn.append(m)

    # ---------- 立意 ----------
    if len(C.get('concept', '')) < 8: X('concept（一句话立意）没写或太短：这支 MV 到底在演什么？写清楚再排镜头')
    if not plan or '（填）' in plan or len(plan) < 300: Wn('plan.md 还没写完：把音乐、这段歌在讲什么、主角和世界、逐句分镜、起伏和大时刻填完')

    scene_nc = re.sub(r'//[^\n]*', '', scene_js)   # 去掉注释再查
    if (C.get('images') or re.search(r"images\s*:\s*\{\s*[\w'\"]", scene_nc) or re.search(r'new\s+Image\s*\(|M\.photo\s*\(', scene_nc)
            or re.search(r'scene"\s*:\s*"photo"', json.dumps(C, ensure_ascii=False))):
        X('用了图片（images / photo 镜头）：这个 skill 的画面全部用代码画，不用生图、照片和网图')

    # ---------- 读懂歌词：逐句分镜 ----------
    story = C.get('story', '')
    if len(story) < 20: X('story 没写：先用一两段话写清楚这一段歌在讲什么（主角是谁、发生了什么、情绪怎么变），画面全从这里来')
    board = {}
    for i, b_ in enumerate(C.get('board', [])):
        try: board[int(b_.get('line'))] = b_
        except Exception: X(f'board 第 {i + 1} 条没写 line（第几句）')
    need_lines = [L for L in S['lines'] if L['t0'] < S['dur'] - 0.3]
    board_rows = []
    for L in need_lines:
        tag = f'line{L["n"]}「{L["text"]}」'
        b_ = board.get(L['n'])
        if not b_: X(f'{tag}：board 里没有这句。每一句都要写：says（字面在说什么）、see（画面上要看到什么）、keys（这句里要演出来的词）'); continue
        if len(b_.get('says', '')) < 6: X(f'{tag}：says 太短：这句字面上在说什么？')
        if len(b_.get('see', '')) < 8: X(f'{tag}：see 太短：观众在画面上具体看到什么（谁、在哪、在干嘛）？')
        keys = b_.get('keys') or []
        if not keys: X(f'{tag}：keys 没写：从这句里挑 1–3 个要演出来的词（名词、动作），唱到它们时画面要兑现')
        txt = re.sub(r'\s+', '', L['text'])
        for k in keys:
            if re.sub(r'\s+', '', k) not in txt: X(f'{tag}：keys 里的「{k}」不是这句歌词里的词（要原词）')
        board_rows.append((L, b_, [k for k in keys if re.sub(r'\s+', '', k) in txt]))

    # ---------- 镜头 ----------
    shots = C.get('shots', [])
    if not shots: X('shots 是空的')
    rs = []
    for i, sh in enumerate(shots):
        try: t0 = sg.ref(sh.get('at', 0))
        except Exception as e: X(f'镜头 {i + 1}：{e}'); continue
        rs.append((t0, sh))
    rs.sort(key=lambda x: x[0])
    if rs and rs[0][0] > 0.01: X(f'第一个镜头要从 0 秒开始（现在从 {rs[0][0]:.2f} 秒）')
    names = set(re.findall(r'^\s{2,6}([A-Za-z_$][\w$]*)\s*(?::\s*(?:function\s*)?\(|\()', scene_js, re.M))
    for k, (t0, sh) in enumerate(rs):
        t1 = rs[k + 1][0] if k + 1 < len(rs) else dur
        nm = sh.get('scene', '?')
        tag = f'镜头 {k + 1}「{nm}」{sg.label(t0)}'
        if scene_js and nm not in names and nm != 'photo': X(f'{tag}：scene.js 的 shots 里没有 {nm}（内置的只有 photo）')
        if nm == 'photo':
            img = (sh.get('params') or {}).get('img')
            if not img: X(f'{tag}：photo 镜头要写 params.img（图的名字）')
            elif img not in (C.get('images') or {}) and img not in scene_js: X(f'{tag}：图「{img}」没在 cues.json 的 images 里登记')
        if k > 0:
            dd, dbt = sg.near(t0, S['downbeats']), sg.near(t0, S['beats'])
            on_lyric = str(sh.get('at', '')).replace(' ', '').startswith('line')   # 卡在歌词开唱 / 某个字上：跟着唱走，不要求在拍上
            if dd > 0.04 and not on_lyric:
                if dbt <= 0.04:
                    if not sh.get('offbeat'): Wn(f'{tag}：切在拍上、不在小节头。故意的就写 "offbeat": true')
                else: X(f'{tag}：切点既不在拍上（离最近的拍 {dbt * 1000:.0f} ms），也不在歌词上。用 bar9 / bar9.3 / line3 / line3@某字 这种写法')
        L = t1 - t0
        if L < beat * 0.95: X(f'{tag}：只有 {L:.2f} 秒（不到一拍），太碎')
        if L > bar * 8.05 and not sh.get('hold'): X(f'{tag}：{L / bar:.1f} 小节不换镜头太长。真要长镜头写 "hold": true，并在镜头里安排至少两次画面变化')
        elif L > bar * 4.05 and not sh.get('hold'): Wn(f'{tag}：{L / bar:.1f} 小节没换镜头。镜头里有没有每 1–2 小节一次的变化？')
        if not sh.get('why'): Wn(f'{tag}：没写 why（这句唱什么、所以画什么）')
        tr = sh.get('in', 'cut').split('-')[0]
        if tr not in TRANS: X(f'{tag}：没有这种转场 {sh.get("in")}（{" ".join(sorted(TRANS))}，whip/push 后面可加 -left/-right/-up/-down）')
    if rs:
        avg = dur / len(rs)
        if avg > bar * 4: Wn(f'平均 {avg / bar:.1f} 小节换一次镜头，偏慢；这首 {S["bpm"]:.0f} BPM，一般 1–3 小节一换，副歌更快')
        ok.append(f'{len(rs)} 个镜头，平均 {avg:.1f} 秒（{avg / bar:.1f} 小节）')
    shot_ts = [t for t, _ in rs]

    # ---------- 逐句：唱到这句、唱到关键词时画面有没有动作 ----------
    mom_ts = []
    for m_ in C.get('moments', []):
        try: mom_ts.append(sg.ref(m_['at']))
        except Exception: pass
    for L, b_, keys in board_rows:
        tag = f'line{L["n"]}「{L["text"]}」'
        k0 = sg.word_t(L, keys[0]) if keys else L['t0']
        if not any(L['t0'] - bar * 1.0 <= t <= k0 + 0.3 for t in shot_ts) and not any(abs(t - k0) <= 0.3 for t in mom_ts):
            X(f'{tag}：唱这句的时候画面没换（这句前后没有新镜头，关键词上也没有时刻）。每句歌词都要有自己的画面')
        for k in keys:
            tk = sg.word_t(L, k)
            if not any(-0.15 <= tk - t <= 0.35 for t in shot_ts + mom_ts):
                Wn(f'{tag}：唱到「{k}」（{tk:.2f}s）那一刻没有镜头或时刻。写 "at": "line{L["n"]}@{k}"，让画面在这个字上兑现')

    # ---------- 大时刻 ----------
    ms = []
    for i, m in enumerate(C.get('moments', [])):
        try: ms.append((sg.ref(m['at']), m))
        except Exception as e: X(f'大时刻 {i + 1}：{e}')
    big = [(t, m) for t, m in ms if m.get('big')]
    need = max(3, round(dur / 12))
    if len(big) < need: X(f'大时刻（big: true）只有 {len(big)} 个，这么长至少要 {need} 个：观众要被「炸」到')
    for t, m in ms:
        tag = f'大时刻「{m.get("name", "?")}」{sg.label(t)}'
        if sg.near(t, S['beats']) > 0.04 and not str(m.get('at', '')).replace(' ', '').startswith('line'): X(f'{tag}：不在拍上，也不在歌词上')
        fxs = [f if isinstance(f, str) else f.get('fx') for f in m.get('fx', [])]
        for f in fxs:
            if f not in FX: X(f'{tag}：没有这种特效 {f}（{" ".join(sorted(FX))}）')
        if m.get('big'):
            if len(m.get('what', '')) < 6: X(f'{tag}：big 的大时刻要写 what：画面本身发生了什么变化（不能只靠闪白、震动）')
            if len(fxs) < 2: Wn(f'{tag}：只有 {len(fxs)} 个特效，大时刻一般叠 2–3 个（比如 punch + flash + shake）')
            if sg.near(t, shot_ts) > beat * 1.01: Wn(f'{tag}：前后一拍内没有换镜头。画面要在这一拍「变」：要么换镜头，要么 what 里写清楚怎么变形')
    for c in S.get('big', []):
        has_big = any(abs(t - c['t']) <= beat * 0.55 for t, _ in big)
        has_any = has_big or any(abs(t - c['t']) <= beat * 0.55 for t, _ in ms) or sg.near(c['t'], shot_ts) <= beat * 0.55
        if c['score'] >= 0.9 and not has_big: X(f'音乐在 {c["at"]}（{c["t"]:.2f}s）炸了：{c["why"]}——画面没有 big 的大时刻')
        elif c['score'] >= 0.6 and not has_any: Wn(f'{c["at"]}（{c["t"]:.2f}s）{c["why"]}：画面没有任何动作（镜头、大时刻都没有）')
    for s in S.get('stops', []):
        if not any(s['t'] - beat <= t <= s['resume'] + beat * 0.5 for t, _ in ms) and sg.near(s['t'], shot_ts) > beat:
            Wn(f'{s["kind"]} {s["t"]:.2f}→{s["resume"]:.2f}s：音乐空了一下，画面最好也「收」（定格、变暗、只留一样东西），回来时再炸')

    # ---------- 歌词 ----------
    LY = C.get('lyrics', {}); dflt = LY.get('default', {}); per = LY.get('lines', {})
    def style(L):
        st = {'mode': 'pop', 'size': 'big'}; st.update(dflt)
        sh = None
        for t, s_ in rs:
            if t <= L['t0'] + 0.05: sh = s_
        if sh and sh.get('lyrics'): st.update(sh['lyrics'])
        st.update(per.get(f'line{L["n"]}', {}))
        return st
    seq = []
    for L in S['lines']:
        st = style(L); tag = f'line{L["n"]}「{L["text"]}」'
        if st['mode'] not in MODES: X(f'{tag}：没有这种上屏方式 {st["mode"]}（{" ".join(sorted(MODES))}）')
        px = SIZES.get(st['size'], st['size']) if isinstance(st['size'], str) else st['size']
        if st['mode'] not in ('scene', 'none', 'stack', 'big') and isinstance(px, (int, float)) and px < 100 and not st.get('quiet'):
            X(f'{tag}：字号 {px}px 太小，像字幕。歌词是画面的一部分：至少 mid（108）。真要小写 "quiet": true')
        if L['hook'] and st['mode'] not in HERO and st.get('size') != 'hero':
            Wn(f'{tag} 是全曲金句：给它「主角」待遇（stamp / big / stack / slam / scatter，或 size: hero，或 scene 自己画）')
        if st['mode'] == 'none' and not st.get('why'): Wn(f'{tag}：歌词不上屏？写个 why')
        seq.append((st['mode'], str(st.get('pos', 'lower'))))
    run = 1
    for i in range(1, len(seq)):
        run = run + 1 if seq[i] == seq[i - 1] else 1
        if run == 5: Wn(f'line{i - 3}–line{i + 1} 连续 5 句一样的上屏方式和位置，看起来就是字幕：换着来')
    kinds = {m for m, _ in seq}
    if len(kinds) < 3: Wn(f'歌词只用了 {len(kinds)} 种上屏方式（{"、".join(sorted(kinds))}）：至少 3 种，跟着段落换')
    if any(m == 'scene' for m, _ in seq) and 'logLyric' not in scene_js and 'drawLine' not in scene_js:
        Wn('有歌词写了 mode: scene（自己画），但 scene.js 里没有调用 M.logLyric / M.drawLine：审片会以为这句没上屏')

    # ---------- 起伏 ----------
    arc = []
    for r, v in C.get('arc', []):
        try: arc.append((sg.ref(r), v))
        except Exception as e: X(f'arc：{e}')
    arc.sort()
    if len(arc) < 3: Wn('arc（计划的起伏）少于 3 个点：写出哪里收、哪里放、哪里最高')
    else:
        vs = [v for _, v in arc]
        if max(vs) < 0.85 or min(vs) > 0.5: Wn(f'arc 最低 {min(vs)}、最高 {max(vs)}：起伏不够，全程一个劲就等于没有高潮')
        def av(t):
            if t <= arc[0][0]: return arc[0][1]
            for (t0, v0), (t1, v1) in zip(arc, arc[1:]):
                if t0 <= t <= t1: return v0 + (v1 - v0) * (t - t0) / max(1e-6, t1 - t0)
            return arc[-1][1]
        ch = [s for s in S['sections'] if s['kind'] == '副歌']
        if ch:
            a_ch = sum(av((s['t0'] + s['t1']) / 2) for s in ch) / len(ch)
            a_ot = [av((s['t0'] + s['t1']) / 2) for s in S['sections'] if s['kind'] != '副歌']
            if a_ot and a_ch < max(a_ot): Wn(f'副歌的计划强度（{a_ch:.2f}）不是全片最高（别的段有 {max(a_ot):.2f}）：确定吗？')

    # ---------- 规则 ----------
    for r in C.get('rules', []):
        if r.get('on') not in EVENTS: X(f'rules：on 写 {r.get("on")}，只能是 {" ".join(sorted(EVENTS))}')
        if r.get('fx') not in FX: X(f'rules：没有这种特效 {r.get("fx")}')
        try:
            span = sg.ref(r.get('to', 'end')) - sg.ref(r.get('from', 0))
            if span > bar * 16: Wn(f'rules {r.get("on")}→{r.get("fx")} 覆盖 {span / bar:.0f} 小节：一直同一种打点会麻木，分段换着来')
            if r.get('on') in ('beat', 'kick') and r.get('fx') in ('flash', 'shake', 'invert', 'strobe') and span > bar * 4:
                Wn(f'rules 每拍都 {r["fx"]} 持续 {span / bar:.0f} 小节：太累眼睛，留给副歌最狠的几小节')
        except Exception as e: X(f'rules：{e}')

    # ---------- 输出 ----------
    print(f'检查 {root.name}/cues.json  ·  {len(rs)} 镜头 · {len(ms)} 个时刻（big {len(big)}）· {len(S["lines"])} 句歌词')
    for m in ok: print('  ✓', m)
    for m in err: print('  ✗', m)
    for m in warn: print('  ⚠', m)
    try: draw(root, S, sg, rs, ms, arc, style)
    except Exception as e: print('（cue_map.png 没画出来：', e, '）')
    if err: print(f'\n{len(err)} 个必须改。改完再跑一遍。'); sys.exit(1)
    print('\n通过 ✓' + (f'（还有 {len(warn)} 个提醒，过一遍）' if warn else '') + '。看一眼 out/cue_map.png，然后开始画。')


def draw(root, S, sg, rs, ms, arc, style):
    import matplotlib; matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from matplotlib import font_manager
    for name in ['Microsoft YaHei', 'SimHei', 'Noto Sans CJK SC', 'PingFang SC']:
        if any(f.name == name for f in font_manager.fontManager.ttflist): plt.rcParams['font.family'] = name; break
    dur = S['dur']; env = S['env']; fps = env['fps']
    fig, ax = plt.subplots(figsize=(max(16, dur * 0.42), 6.2), dpi=110)
    fig.patch.set_facecolor('#16161a'); ax.set_facecolor('#1d1d22'); ax.tick_params(colors='#bbb')
    t = [i / fps for i in range(len(env['energy']))]
    ax.fill_between(t, 0, env['energy'], color='#e8c170', alpha=0.25, lw=0)
    for d in S['downbeats']:
        if 0 <= d <= dur: ax.axvline(d, color='#555', lw=0.6)
    for s in S['sections']:
        ax.text(s['t0'] + 0.05, 1.33, s['kind'], color='#aaa', fontsize=9)
        ax.axvline(s['t0'], color='#999', lw=1.5)
    cols = ['#3b6ea5', '#c0504d', '#4f9a6b', '#a0782a', '#7d5ba6', '#2f8f8f', '#b05f8f', '#8a8a8a']
    scn = {}
    for k, (t0, sh) in enumerate(rs):
        t1 = rs[k + 1][0] if k + 1 < len(rs) else dur
        c = cols[scn.setdefault(sh.get('scene'), len(scn)) % len(cols)]
        ax.add_patch(plt.Rectangle((t0, 1.05), t1 - t0, 0.2, color=c, alpha=0.85))
        ax.text(t0 + 0.05, 1.15, f'{sh.get("scene")}', color='#fff', fontsize=8, va='center', clip_on=True)
        if sh.get('in', 'cut') != 'cut': ax.text(t0, 1.27, sh['in'], color='#ffd34d', fontsize=7, ha='center')
    for L in S['lines']:
        st = style(L)
        ax.plot([L['t0'], L['sung_end']], [0.95, 0.95], color='#ffd34d' if L['hook'] else '#ddd', lw=3)
        ax.text(L['t0'], 0.88 - (L['n'] % 2) * 0.06, f'{st["mode"]}', color='#ffd34d' if L['hook'] else '#ccc', fontsize=7)
    for tm, m in ms:
        ax.plot([tm], [0.75], marker='*' if m.get('big') else 'o', color='#ff3b3b' if m.get('big') else '#ff9a3b', ms=16 if m.get('big') else 7)
        ax.text(tm, 0.66, m.get('name', ''), color='#ff8080', fontsize=8, ha='center')
    for c in S.get('big', []):
        ax.plot([c['t']], [0.58], marker='v', color='#6fd3ff', ms=8)
    if arc:
        ax.plot([a for a, _ in arc], [v * 0.5 for _, v in arc], color='#ff5fd2', lw=2, label='计划的起伏 arc（×0.5）')
    ax.set_ylim(0, 1.4); ax.set_xlim(0, dur); ax.set_yticks([])
    ax.set_title('卡点表：上排色块 = 镜头；黄线 = 歌词（金色 = 金句，下面写上屏方式）；红星 = big 大时刻；蓝三角 = 音乐上的大时刻候选；粉线 = 起伏', color='#eee', fontsize=10, loc='left')
    ax.legend(loc='lower right', fontsize=8, facecolor='#222', labelcolor='#ddd')
    (root / 'out').mkdir(exist_ok=True)
    fig.tight_layout(); fig.savefig(root / 'out' / 'cue_map.png', facecolor=fig.get_facecolor()); plt.close(fig)


if __name__ == '__main__':
    main()

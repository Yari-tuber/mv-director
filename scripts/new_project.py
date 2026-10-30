"""mv-director · 建项目：拷运行库、模板、字体，接着跑听歌拆解。

  python -I new_project.py <项目文件夹> --song 歌.mp3 --lrc 歌词.lrc [--start 13 --end 58] [--stems 分轨文件夹] [--bpm 99]

项目文件夹可以已经存在（比如里面已经放了歌和歌词），已有的 scene.js / cues.json / plan.md 不会被覆盖。
有 demucs 就先分四轨（鼓、贝斯、人声、其他）再传 --stems：拍点和逐字时间准很多；也可以加 --demucs 让我自己分（要已经装好 demucs）。
"""
import argparse, shutil, subprocess, sys
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('dir'); ap.add_argument('--song', required=True); ap.add_argument('--lrc', '--lyrics', dest='lrc', help='带时间的 LRC，或一行一句的纯文本歌词')
    ap.add_argument('--start', type=float, default=0); ap.add_argument('--end', type=float)
    ap.add_argument('--stems'); ap.add_argument('--bpm', type=float); ap.add_argument('--lang', help='歌词语言（默认 Chinese；英文歌写 English，日语 Japanese，粤语 Cantonese）')
    ap.add_argument('--demucs', action='store_true', help='用 python -m demucs 先分四轨（需要已装 demucs）')
    a = ap.parse_args()
    d = Path(a.dir).resolve(); d.mkdir(parents=True, exist_ok=True)
    (d / 'mv').mkdir(exist_ok=True)
    shutil.copy2(SKILL / 'runtime' / 'mv.js', d / 'mv' / 'mv.js')              # 运行库每次都更新成 skill 里最新的
    for f in ['index.html', 'scene.js', 'cues.json']:
        if not (d / f).exists(): shutil.copy2(SKILL / 'template' / f, d / f)
    if not (d / 'plan.md').exists(): shutil.copy2(SKILL / 'references' / '立意模板.md', d / 'plan.md')
    fd = d / 'fonts'; fd.mkdir(exist_ok=True)
    for f in (SKILL / 'fonts').iterdir():
        if not (fd / f.name).exists(): shutil.copy2(f, fd / f.name)
    (d / 'out').mkdir(exist_ok=True)
    song = Path(a.song).resolve()
    stems = a.stems
    if a.demucs and not stems:
        import os
        dpy = os.environ.get('MV_DEMUCS_PY') or sys.executable           # demucs 装在别的 Python 里就用环境变量 MV_DEMUCS_PY 指过去
        print('先用 demucs 分四轨（100 秒的歌 CPU 上大约 1–2 分钟；第一次会下载约 80 MB 模型）…')
        r = subprocess.run([dpy, '-m', 'demucs', '-n', 'htdemucs', '-o', str(d / 'stems'), str(song)])
        if r.returncode == 0: stems = str(d / 'stems' / 'htdemucs' / song.stem)
        else: print('demucs 没跑通（没装？python -m pip install demucs），直接用混音继续：拍点会差一些，也没法逐字对齐')
    cmd = [sys.executable, '-I', str(SKILL / 'scripts' / 'listen.py'), str(song), '--out', str(d), '--start', str(a.start)]
    if a.end: cmd += ['--end', str(a.end)]
    if a.lrc: cmd += ['--lrc', str(Path(a.lrc).resolve())]
    if stems: cmd += ['--stems', str(Path(stems).resolve())]
    if a.bpm: cmd += ['--bpm', str(a.bpm)]
    if a.lang: cmd += ['--lang', a.lang]
    r = subprocess.run(cmd)
    if r.returncode: sys.exit('听歌拆解失败')
    print(f'\n项目建好了：{d}\n下一步：读 song.md、看 songmap.png，然后写 plan.md（立意），再写 cues.json（卡点表）')


if __name__ == '__main__':
    main()

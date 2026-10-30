"""mv-director · 从成片抽帧拼联系表（不需要页面，任何视频都行）。

  python -I sheet.py <视频> <输出.jpg> [--song song.json] [--times 1.2 3.4 ...] [--cols 6] [--w 384]
不给 --times 就按 song.json 每个小节头后 0.1 秒抽一张。
"""
import argparse, json, shutil, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

FF = shutil.which('ffmpeg') or sys.exit('找不到 ffmpeg：先装 ffmpeg 并放进 PATH（见 references/安装.md）')


def grab(video, t, w, h):
    raw = subprocess.run([FF, '-v', 'error', '-ss', f'{t:.3f}', '-i', str(video), '-frames:v', '1', '-vf', f'scale={w}:{h}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
    return Image.frombytes('RGB', (w, h), raw) if len(raw) == w * h * 3 else Image.new('RGB', (w, h), (60, 0, 0))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('video'); ap.add_argument('out'); ap.add_argument('--song'); ap.add_argument('--times', nargs='*', type=float)
    ap.add_argument('--cols', type=int, default=6); ap.add_argument('--w', type=int, default=384); ap.add_argument('--offset', type=float, default=0.1)
    a = ap.parse_args()
    if a.times: ts = a.times; labs = [f'{t:.2f}s' for t in ts]
    else:
        S = json.loads(Path(a.song).read_text(encoding='utf-8'))
        ds = [d for d in S['downbeats'] if 0 <= d < S['dur'] - 0.1]
        ts = [d + a.offset for d in ds]; labs = [f'bar{i + 1 if ds[0] >= S["first_downbeat"] - 0.01 else i}  {d:.2f}s' for i, d in enumerate(ds)]
    w = a.w; h = w * 9 // 16
    rows = (len(ts) + a.cols - 1) // a.cols
    img = Image.new('RGB', (a.cols * (w + 4), rows * (h + 24)), (20, 20, 24)); dr = ImageDraw.Draw(img)
    font = None
    for fp in [r'C:\Windows\Fonts\msyh.ttc', r'C:\Windows\Fonts\simhei.ttf']:
        if Path(fp).exists(): font = ImageFont.truetype(fp, 16); break
    for i, (t, lab) in enumerate(zip(ts, labs)):
        x, y = (i % a.cols) * (w + 4), (i // a.cols) * (h + 24)
        img.paste(grab(a.video, t, w, h), (x, y + 22)); dr.text((x + 4, y + 2), lab, fill=(255, 220, 120), font=font)
    img.save(a.out, quality=86); print('写好了', a.out)


if __name__ == '__main__':
    main()

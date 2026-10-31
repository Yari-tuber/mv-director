"""mv-director · 检查环境：缺什么、怎么装，一次说清楚。

  python -I doctor.py
"""
import importlib, os, shutil, subprocess, sys

ok, bad, opt = [], [], []


def need(name, fix):
    try:
        importlib.import_module(name); ok.append(name)
    except Exception:
        bad.append((name, fix))


print(f'Python {sys.version.split()[0]}（{sys.executable}）')
if sys.version_info < (3, 9): bad.append(('Python ≥ 3.9', '装新一点的 Python'))
for m in ['numpy', 'scipy', 'matplotlib', 'PIL']:
    need(m, 'python -m pip install numpy scipy matplotlib pillow')
need('playwright', 'python -m pip install playwright，然后 python -m playwright install chromium（装了 Chrome 也可以不下）')
for t in ['ffmpeg', 'ffprobe']:
    if shutil.which(t): ok.append(t)
    else: bad.append((t, '装 ffmpeg 并放进 PATH（Windows：winget install Gyan.FFmpeg；macOS：brew install ffmpeg）'))

# 分轨（推荐）：装在别的 Python 里就用 MV_DEMUCS_PY 指过去，new_project.py --demucs 也用它
dpy = os.environ.get('MV_DEMUCS_PY') or sys.executable
r = subprocess.run([dpy, '-c', 'import demucs'], capture_output=True, text=True)
if r.returncode == 0: ok.append('demucs')
else:
    opt.append(('demucs（分轨，推荐）', 'python -m pip install demucs（装在别的 Python 里就设 MV_DEMUCS_PY 指过去）；'
                '或者自己用别的工具分好人声和鼓，放进一个文件夹用 --stems'))

# 逐字对齐（强烈推荐）
py = os.environ.get('MV_ALIGNER_PY') or sys.executable
r = subprocess.run([py, '-c', 'import torch, transformers; print(transformers.__version__, torch.cuda.is_available())'], capture_output=True, text=True)
if r.returncode == 0:
    v, cuda = r.stdout.split()
    ok.append(f'逐字对齐（transformers {v}，{"显卡" if cuda == "True" else "CPU"}）')
    major = int(v.split('.')[0]) if v.split('.')[0].isdigit() else 0
    if major < 5: opt.append(('transformers 版本', f'现在是 {v}，Qwen3 对齐模型要 5.x：python -m pip install -U transformers'))
    model = os.environ.get('MV_ALIGNER_MODEL') or 'Qwen/Qwen3-ForcedAligner-0.6B-hf'
    print(f'对齐模型：{model}（第一次用会自动下载约 1.8 GB；国内先设 HF_ENDPOINT=https://hf-mirror.com，或者设 MV_ALIGNER_MODEL 指到下好的文件夹）')
else:
    opt.append(('逐字对齐（强烈推荐）', 'python -m pip install torch transformers（有 NVIDIA 显卡装 CUDA 版 torch 更快）；'
                '或者设环境变量 MV_ALIGNER_PY 指到一个装了它们的 Python。没有它，字幕只能整句出现、对不准每个字'))

print('\n✓ 有了：' + '、'.join(ok))
for n, f in bad: print(f'✗ 缺 {n}：{f}')
for n, f in opt: print(f'⚠ {n}：{f}')
print('\n' + ('都齐了，可以开始。' if not bad else '先把 ✗ 的装上。'))
sys.exit(1 if bad else 0)

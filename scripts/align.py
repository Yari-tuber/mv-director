"""mv-director · 逐字强制对齐：已知歌词文本，在人声里找出每个字从哪一刻开始唱。

  python align.py --audio 人声.wav --text 歌词.txt --out words.json [--start 秒 --end 秒] [--model 模型]

用的是 Qwen3-ForcedAligner-0.6B（阿里通义，Apache-2.0，Hugging Face：Qwen/Qwen3-ForcedAligner-0.6B-hf），
支持中文、英文、粤语、日语、韩语等 11 种语言，一次最多 5 分钟。
需要：torch、transformers（5.x，带 Qwen3-ASR 支持）、ffmpeg。有 NVIDIA 显卡更快，没有也能用 CPU 跑（慢一些）。
模型第一次会从 Hugging Face 自动下载约 1.8 GB；国内先设 HF_ENDPOINT=https://hf-mirror.com，或用 --model 指向下好的文件夹。

输出 words.json：{"offset": 起点秒, "items": [{"text": 字, "start": 秒, "end": 秒, "src": 在歌词文本里的位置}, …]}
时间已经加上 offset（= 原音频里的秒数）。listen.py 会自己调用它，一般不用手动跑。
"""
import argparse, json, os, shutil, subprocess, sys, unicodedata
from pathlib import Path

MODEL_ID = 'Qwen/Qwen3-ForcedAligner-0.6B-hf'


def kept(ch):
    return ch == "'" or unicodedata.category(ch)[0] in ('L', 'N')   # 对齐模型只认文字和数字，标点空格跳过


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--audio', required=True); ap.add_argument('--text', required=True); ap.add_argument('--out', required=True)
    ap.add_argument('--start', type=float, default=0.0); ap.add_argument('--end', type=float)
    ap.add_argument('--model', default=os.environ.get('MV_ALIGNER_MODEL') or MODEL_ID)
    ap.add_argument('--lang', default='Chinese', help='Chinese / English / Cantonese / Japanese / Korean …')
    a = ap.parse_args()
    import numpy as np
    ff = shutil.which('ffmpeg')
    if not ff: sys.exit('找不到 ffmpeg')
    cmd = [ff, '-v', 'error', '-ss', f'{a.start:.3f}', '-i', a.audio]
    if a.end: cmd += ['-t', f'{a.end - a.start:.3f}']
    cmd += ['-f', 'f32le', '-ar', '16000', '-ac', '1', '-']
    wav = np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, '<f4').copy()
    dur = len(wav) / 16000
    if dur > 300: sys.exit(f'这段人声 {dur:.0f} 秒，对齐模型一次最多 5 分钟：用 --start/--end 只对其中一段')
    text = Path(a.text).read_text(encoding='utf-8-sig')
    pos = [i for i, c in enumerate(text) if kept(c)]
    if not pos: sys.exit('歌词里没有能对齐的字')
    import torch
    from transformers import AutoModelForTokenClassification, AutoProcessor
    cuda = torch.cuda.is_available()
    dtype = torch.bfloat16 if cuda and torch.cuda.is_bf16_supported() else torch.float32
    dev = 'cuda' if cuda else 'cpu'
    print(f'加载对齐模型（{a.model}，{dev}）…', flush=True)
    proc = AutoProcessor.from_pretrained(a.model)
    model = AutoModelForTokenClassification.from_pretrained(a.model, dtype=dtype).to(dev).eval()
    inputs, words = proc.prepare_forced_aligner_inputs(audio=wav, transcript=text, language=a.lang)
    inputs = inputs.to(dev, dtype)
    with torch.inference_mode():
        out = model(**inputs)
    items = proc.decode_forced_alignment(logits=out.logits, input_ids=inputs['input_ids'], word_lists=words,
                                         timestamp_token_id=model.config.timestamp_token_id)[0]
    res, k = [], 0
    for it in items:                                      # 模型返回的字和歌词里的字按顺序一一对上
        t = str(it.get('text', ''))
        n = sum(1 for c in t if kept(c)) or len(t)
        res.append({'text': t, 'start': round(a.start + float(it['start_time']), 3), 'end': round(a.start + float(it['end_time']), 3), 'srcs': pos[k:k + n]})
        k += n
    if k != len(pos):
        print(f'⚠ 对齐结果 {k} 个字，歌词里 {len(pos)} 个字：歌词和唱的可能不完全一样（漏唱、多唱、写错字），时间可能整段错开', flush=True)
    Path(a.out).write_text(json.dumps({'offset': a.start, 'model': a.model, 'device': dev, 'items': res}, ensure_ascii=False), encoding='utf-8')
    print(f'对齐了 {len(res)} 个字 / 词，{dur:.1f} 秒 → {a.out}', flush=True)


if __name__ == '__main__':
    main()

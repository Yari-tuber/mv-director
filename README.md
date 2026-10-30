# mv-director · 让 AI 读懂歌词、卡准节拍，用代码做音乐 MV

给 Codex、Claude Code 这类 AI 编程助手用的 skill。你给它一首歌和歌词，它会：

1. **听懂音乐**：把歌分成鼓、人声等几条音轨，找出每一拍、每个小节、副歌和抽鼓；用对齐模型把每个字的开唱时间对到大约 0.1 秒。
2. **读懂歌词**：先写清楚这首歌在讲什么、主角是谁、情绪怎么走，再逐句写分镜，每句画面演出这句在说什么。
3. **用你选的画风来画**：可以借 lemo-opuscar、花叔 huashu-art-motion 这些风格库里的画风（换别的风格库也行）。它会先翻一遍有哪些画风，推荐几个最配这首歌的，问你要哪个。
4. **卡点、渲染、审片**：镜头切在小节头上，进副歌那一拍画面炸开，字在唱出来那一刻出现；渲出 1080p 60 帧，再从成片画面里量一遍字对不对得上、画面跟没跟拍，不合格自己改。

画面全部用代码画（HTML Canvas 逐帧渲染），不用生图。

## 安装

### 1. 装环境

需要 Python 3.9+ 和 ffmpeg，然后：

```bash
python -m pip install numpy scipy matplotlib pillow playwright demucs torch transformers
python -m playwright install chromium
```

- `demucs`：分轨，推荐装。
- `torch` + `transformers`：逐字对齐，强烈推荐装。有 NVIDIA 显卡就装 CUDA 版 torch，没有也能用 CPU。
- 对齐模型第一次用时会自动下载约 1.8 GB；国内先设 `HF_ENDPOINT=https://hf-mirror.com`。

装完在 skill 文件夹里跑一次 `python -I scripts/doctor.py`，它会告诉你还缺什么。详细说明见 [references/安装.md](references/安装.md)。

### 2. 装 skill

在 Codex 里发：

```
$skill-installer 安装 https://github.com/Yari-tuber/mv-director（SKILL.md 在仓库根目录，安装时用 --path . --name mv-director）
```

也可以自己克隆：

```bash
git clone https://github.com/Yari-tuber/mv-director ~/.agents/skills/mv-director    # Codex
git clone https://github.com/Yari-tuber/mv-director ~/.claude/skills/mv-director    # Claude Code
```

装好后**新开一个对话**。

### 3. 准备一个风格库（可选）

想借画风，就把风格库下到你的工作文件夹，比如：

```bash
git clone https://github.com/lemomo-ai/lemo-opuscar
```

花叔的 huashu-art-motion 可以按它的说明装成 skill，也可以 clone 下来。别的风格库也行，只要里面有画风说明。

## 用法：提示词模板

工作文件夹里放好歌（mp3 / wav）和歌词（带时间的 `.lrc` 最好；一行一句的纯文本 `.txt` 也行），然后对 AI 说：

**让它翻风格库、推荐几个给你选**

```
用 mv-director 给 song.mp3 做一支 MV，做 30 秒左右，你挑最有戏的一段。
歌是 <歌手> 的《<歌名>》，歌词在 lyrics.lrc。
画风从 lemo-opuscar 里挑：先翻一遍它有哪些画风，按这首歌推荐几个给我选，我选好你再做。
```

它会列出推荐和全部画风，然后问你。你回一句就行：

```
就用 <画风名>。
```

**换成花叔的画风库**

```
……画风从花叔的 huashu-art-motion 里挑：先翻一遍有哪些画风，推荐几个给我选。
```

**换成别的风格库**

```
……画风参考 <风格库的文件夹或 GitHub 地址>：先看懂它的画风是怎么组织的，推荐几个给我选。
```

**直接指定画风，不用问**

```
……画风用 lemo-opuscar 的 ink-wash（中国水墨）。
```

**指定段落**

```
……只做 0:45 到 1:20 这一段。
```

成片在项目文件夹的 `out/mv.mp4`，制作记录在 `NOTES.md`。

## 它和别的 MV skill 有什么不一样

我们读过、跑过十来个开源的 MV / 画风 skill。它们各有长处，但没有一个把这四件事都串起来、用检查卡住：

| | 常见做法 | mv-director |
|---|---|---|
| 节拍 | 手填速度，或者测了不用 | 分轨后从鼓轨测，加拍减拍的小节也认得 |
| 歌词时间 | 整句时间，字平均点亮 | 逐字强制对齐，中文、英文、日语、粤语都行 |
| 画面演不演歌词 | 一个好看的意象画到尾 | 逐句分镜，检查脚本逐句查：每句画面都要换，关键词那一刻要兑现 |
| 做完验收 | 没有，或者只看技术问题 | 从成片画面里量：字早晚、小节头命中、大时刻、死画面，不过不许交 |

## 流程

```
建项目（分轨、测拍、逐字对齐）→ 拆解音乐 → 读懂歌词、逐句分镜 → 选画风（问你）
→ 画风卡、零件清单 → 卡点表（检查）→ 画、逐句出图自查 → 草稿审片（最多三轮）→ 成片
```

每一步的做法和门槛写在 [SKILL.md](SKILL.md)，细节在 [references/](references/)。

## 局限

- **画得好不好看靠模型**：画面是模型现写的代码，画风库只是参考。
- **画风借规则不借内容**：故事和镜头都要模型自己构思。
- **逐字对齐需要装模型**：没装时只能用 LRC 的整句时间。
- **对齐一次最多 5 分钟**：纯文本歌词要整首对齐，所以整首不能超过 5 分钟；带时间的 LRC 没有这个限制。

## 致谢与许可

- 本 skill：MIT，© 2026 亚里（[Yari-tuber](https://github.com/Yari-tuber)）。
- 逐字对齐模型：Qwen3-ForcedAligner-0.6B（阿里通义千问，Apache-2.0），用的时候下载，不随仓库分发。
- 分轨：demucs（Meta，MIT），需要自己安装。
- `参考代码/剪纸木偶/`：Miranda Dixon-Luinenburg（cyborggirl963）的 paper-cut 引擎，MIT（见同目录 LICENSE-paper-cut.txt）。只作为关节剪影画法的参考，不直接加载。
- 字体：思源黑体 / Noto Sans SC、霞鹜文楷、抖音美好体、站酷庆科黄油体、Bangers、Anton，都是 SIL OFL 1.1，作者和来源见 [fonts/字体授权.md](fonts/字体授权.md)。
- 文档里提到的风格库 lemo-opuscar（LemoLab，MIT）、huashu-art-motion（花叔 alchaincyf，MIT）不随本仓库分发，请到原仓库获取并遵守它们的许可。
- 做的 MV 发布时请署上歌曲的版权信息，以及借用的画风来源。

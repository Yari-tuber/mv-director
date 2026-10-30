// scene.js —— 这一支 MV 的画面。只写「画什么」；什么时候切、什么时候炸、歌词怎么上屏写在 cues.json。
// 规矩：画面只由时间决定（不许 Math.random / Date / 上一帧状态；随机用 M.hash(i) / M.rng(种子)）。
// 每个镜头函数 (ctx, s, M)：ctx 是 1920×1080 的画布；s = { t 全片秒, lt 镜头内秒, p 镜头进度 0..1, dur, params }；
// M 是工具箱（完整说明 references/画面库.md）：
//   M.pulse('beat'|'bar'|'kick'|'snare'|'line'|'char'|'big', {decay})  打点包络 1→0
//   M.bar() / M.beat() / M.section() / M.env('energy'|'low'|'high') / M.intensity()
//   M.line() / M.chars(line) / M.hit('大时刻名') / M.after('大时刻名') / M.ease.* / M.hash / M.noise
MV.scene({
  bg: '#101014',
  // fonts: { MyFont: 'assets/xxx.woff' },        // 自带的 fonts/ 已经全部加载，这里只写额外的
  setup(M) {
    // 缓存不随时间变的东西（底纹、静态背景）：M.cached('key', w, h, (g) => { ... })
  },
  shots: {
    // 卡点表 shots[].scene 写的名字必须在这里有
    main(ctx, s, M) {
      const { W, H } = M;
      const kick = M.pulse('kick', { decay: 0.12 });
      const bar = M.pulse('bar', { decay: 0.35 });
      ctx.fillStyle = `hsl(${(M.count('bar') * 47) % 360} 60% ${18 + 10 * bar}%)`;
      ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(1 + 0.12 * kick, 1 + 0.12 * kick);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(0, 0, 220 + 60 * M.intensity(), 0, M.TAU); ctx.stroke();
      ctx.restore();
    },
  },
  // lyricDefault: { font: 'NotoSansSC-900', fill: '#fff', stroke: '#000' },   // 全片歌词默认样子（cues.json 的 lyrics.default 会覆盖）
  // glyph(ctx, ch, x, y, px, st, M) { ... }     // 想让歌词字长成这个画风（网点、金箔、毛笔），在这里画一个字
  // post(ctx, M) { ... }                        // 镜头和歌词画完之后、加镜头运动之前（世界层叠加）
  // overlay(ctx, M) { ... }                     // 最上层（屏幕层：画框、署名、颗粒），不跟镜头晃
  // camera(cam, M) { ... }                      // 每帧改镜头：cam.zoom / cam.x / cam.y / cam.rot
});

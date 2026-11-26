# v14 数据、公式与研究依据

## 1. 架构与边界

```
外部生产者 corpus/  --/feed-->  系统 server/  --SSE-->  前端 src/
 全量文本 + 预计算聚合          聚合 + 最近文本缓存        渲染
```

- **外部生产者**：独立进程、独立端口（默认 5400），持有约 700 万条预生成文本；提供 `/feed`、`/texts`、`/aggregates`、`/health`、`/control`。
- **系统**：只持久化话题元数据、5 分钟/1 小时聚合和最近窗口文本；历史文本向生产者按需查询。重启从 `server/.data/hourly.ndjson` 恢复。
- **数据所有权**：生产者是“平台侧”的模拟，系统是“观察台”。文本语料不进入系统快照；快照只含话题、帧、事件和聚合状态。

所有时间 epoch 毫秒，显示 Asia/Shanghai。所有内容为合成数据，不接真实平台、不爬取、不冒充真实记录。

## 2. 话题模型（7 天）

- 40 个虚构城市议题原型 × 80 座城市 = 3200 个唯一标题，按 `slot×977 mod 3200` 置换分配；7 天窗口内不重复。
- 每 90 分钟一个新话题（约 16 个/天）；累计曝光低于 500 万不入库；同时在榜实测 8–23 个。
- 寿命 8–60 小时，对数均匀；5 个 Beta 形脉冲叠加，起点比例 0、.13、.29、.48、.70；解析积分 `∫ rate dt = 累计曝光`。
- 话题对象：`id, slot, archetype, key, title, city, bornAt, endsAt, pulses[5], clusters[5], color, tags, description, eventTitles, simulation`。
- `pulses` 只负责曝光率 `views`；**不再用 `discussionRatio` 生成观点计数**。
- `RETENTION = 7 × DAY`。7 天前的话题、帧、事件、聚合与语料全部清理。

曝光率：`u=(t-at)/duration`，`0<u<1` 时 `A·u^a·(1-u)^b / (m^a(1-m)^b)`，`m=a/(a+b)`；区间外为零。a、b 为整数，多项式原函数给出窗口精确积分。气泡半径 `r=100·sqrt(rate/100000)`，面积正比于每分钟曝光。

## 3. 文本记录契约

```js
{
  id, topicSlot, archetype,
  layer: 'post' | 'comment' | 'reply',
  parentId, rootId,
  time, author,                       // author 仅展示 handle
  cluster: 0..4,                      // 现有 5 类观点
  emotion: 'e0'..'e20' | 'e21',       // DUTIR 21 小类 + 无显著情绪
  intensity: 1 | 3 | 5 | 7 | 9 | 0,   // DUTIR 五级；neutral 为 0
  text, tokens[], keywords[],
  metrics: {
    views?, likes, reposts?, comments?,   // 主帖
    replies?, impressions?, position?     // 评论/回复；后两者 internal
  },
  weight                                // 生产者侧参考值；系统会用原始指标重算
}
```

父级规则：主帖 `parentId=null, rootId=id`；评论挂在主帖；回复挂在评论。`comments`/`replies` 由子节点数回填，保证层级一致。

## 4. 指标与可见性

| 指标 | 主帖 | 评论 | 回复 | 公开 |
|---|---|---|---|---|
| 浏览/曝光 | 有（话题曝光分摊） | 内部潜变量 | 内部潜变量 | 评论/回复不公开 |
| 点赞 | 有 | 有 | 有 | 是 |
| 转发/分享 | 有 | 无 | 无 | 是 |
| 评论数 | 有 | — | — | 是 |
| 回复数 | — | 有 | 无 | 是 |
| 文本层级 | 有 | 有 | 有 | 是 |
| 作者 | handle | handle | handle | 是；无粉丝/认证 |

**为什么评论浏览量不公开**：评论是懒加载、按热度重排、楼中楼可折叠的；一条评论被看到取决于排名位置与滚动深度，同一条评论对不同用户的“曝光”差异极大。平台内部可以做曝光埋点（排序、创作者分析），但公开的“浏览量”既不稳定也会暴露排序机制。故只作内部潜变量，用于点赞率校正；`impressions`/`position` 在公共 API 中剥离。

**为什么帖与评不能共用一套指标**：主帖分母是浏览，评论分母是曝光；主帖有转发，评论有楼中楼；两者量级与长尾形态不同。直接相加会把“曝光位置”误当成“内容影响力”。

## 5. 情绪本体（DUTIR）

采用大连理工大学情感词汇本体库的 7 大类 21 小类，另加“无显著情绪”：

- 乐：快乐、安心
- 好：尊敬、赞扬、相信、喜爱、祝愿
- 怒：愤怒
- 哀：悲伤、失望、疚、思
- 惧：慌、恐惧、羞
- 恶：烦闷、憎恶、贬责、妒忌、怀疑
- 惊：惊奇

每条文本单标签 + 强度（1/3/5/7/9；neutral 0）。5×22 的条件分布定义在 `shared/dutir.js`：受影响观点更偏愤怒/失望，相关方更偏怀疑/贬责，期待观点更偏祝愿/相信，支持观点更偏赞扬/喜爱，其他观点更偏思/怀疑。外环显示 Top 8 小类 + 其他；21 小类用于筛选与列表标签。DUTIR 覆盖了 Ekman/NRC/七情无法区分的“期盼（祝愿）”与“致敬（尊敬）”。

## 6. 分层权重

```
主帖：  er = (likes + 2·reposts + 1.5·comments) / max(views,1)
        n = views;         prior = .02;   C = 1000
评论：  er = likes / max(impressions,1) + .002·log1p(replies)
        n = impressions;   prior = .006;  C = 200
回复：  同评论;                              C = 100

shrunk = (C·prior + er·n) / (C + n)
rel    = shrunk / prior
base   = clamp((log2(rel)+2)/4, 0, 1)
weight = round(100 · base · layerCoef)
layerCoef: 主帖 1.0，评论 .85，回复 .7
```

- `rel=0.25`→0，`1`→50，`≥4`→100；样本不足（主帖 <5,000 浏览、评论 <100 曝光、回复 <50）标“样本不足”，但仍参与聚合。
- 环形/条形用 `Σweight`；词云用 `Σ(1+weight/50)`；讨论列表按 `weight desc`。原始计数另存，tooltip 同时显示“加权影响力”与“讨论量”。
- 这是课程演示的设计选择，不是任何平台的官方公式；公开可引用的排序公式（HN gravity、Reddit hot、Wilson、贝叶斯平均）只作为方法参考。

## 7. 聚合与帧

系统摄取每条文本时重算权重，写入三层桶：

- 5 秒桶：内存，最近 10 分钟；用于 `m5`。
- 5 分钟桶：内存，最近 2 小时；用于 `h1`。
- 1 小时桶：持久化，7 天；用于历史与回填。

帧：`{seq, time, values:{topicId:{views, counts:{m5,h1}, raw:{m5,h1}, emotions}}}`。`views` 来自 `rateAt`；`counts` 为加权计数；`raw` 为原始条数；`emotions` 为加权情绪计数（近 1 小时）。

小时聚合行：`{topicSlot, archetype, hour, weighted[5], raw[5], emotions{id:weight}}`。5 分钟聚合行：`{topicSlot, archetype, bucket, weighted, raw, emotions}`。

启动回填：读 `hourly.ndjson` 与生产者 `/aggregates?step=5m`（最近 2 小时，跳过当前 5 分钟桶），再从当前 5 分钟起点以 100× 追赶到现在，之后 1× 实时。生产者断线时保留缓存并在 5 秒后重连。

## 8. 语料生产

- 7 天滚动窗口，110 个入库话题，**实测 7,000,000 条**（1,525 主帖 / 6,305,475 评论 / 693,000 回复）；峰值约 300 条/秒，1 天约 100 万条。
- 层级：每话题 8–24 个主帖（约占 0.02%），评论约 90%，回复约 10%；评论按 `views^1.15` 分配到主帖，回复按可见性分配到评论。
- 时间：按话题曝光率曲线 × 中国时区昼夜倍率（22:00 峰、04:00 谷，峰谷比约 18×）抽样；主帖在生命周期内分布，评论不早于主帖，回复不早于评论。
- 观点：按当前活跃脉冲的 `opinion[5]` 抽样；情绪：按 5×22 矩阵条件抽样。
- 指标：主帖浏览按 `0.55^i` 幂律分摊话题累计曝光；点赞率对数正态；转发约为点赞的 5%–40%。评论/回复曝光 = 主帖浏览 × 打开评论区比例 × 位置幂律；点赞按曝光 × 重尾点赞率；回复数按泊松/可见性分配。
- 文本：组合式句式库（40 原型 × 5 观点 × 3 层 + 22 情绪短语 + 连接词 + 200 条原型专属句），槽位填充城市/标题/关键词/情绪词；确定性 RNG（FNV-1a + Mulberry32）。禁止真实人物、事件、机构。
- 文件：`corpus/out/topics/<slot>.ndjson.gz`（每话题按时间排序）、`manifest.json`、`aggregates/hourly.ndjson`、`aggregates/by5m.ndjson`。`out/` 不入 git；全量 **552MB gzip**（约 1.6GB raw），最大话题 343,271 条。
- 构建：`npm run corpus:build`；快速开发 `node corpus/build.js --days 1 --total 20000`。

### 校准比例

- 热门话题原创:评论:转发约 1:1–3:2–4；平台整体转发约是原创的 4 倍（Weibo-COV）。本模型按话题内 主帖:评论 约 1:数百、点赞远高于评论/转发。
- 评论点赞重尾：小话题中零赞比例高；全量语料的长尾大多为 0 赞，可见的前几条承担主要权重。这是位置偏置的真实形态。
- 昼夜峰值/低谷约 18×；早餐/午餐有小峰。

## 9. API 契约

- `GET /api/snapshot`：`serverTime, step, retention, retentionStart, model:'synthetic-corpus-v1', topics, frames, events, corpus`。
- `GET /api/stream`：SSE 5 秒，`Last-Event-ID` 续传；帧同上。
- `GET /api/topic/:id/history`：`{rows:[{hour,time,views,weighted,raw,emotions}]}`。
- `GET /api/topic/:id/texts?from&to&opinion&emotion&layer&limit&sort`：样本文本（含 tokens，剥离 impressions/position）。
- `GET /api/topic/:id/words?from&to&opinion&emotion&limit`：加权词表 + 样本文本。
- `GET /api/topic/:id/discussion?from&to&opinion&emotion&sort&cursor&limit`：主帖分页 + 评论/回复树。界面默认回溯 **6 小时**，因为主帖在话题生命周期内稀疏分布；词云仍用近 1 小时窗口。
- `GET /api/corpus/status`：生产者连接、回填数量、错误。
- 生产者内部：`GET /health`、`/manifest`、`/feed?from&speed&catchup`、`/texts`、`/aggregates?step=5m`、`POST /control`。

## 10. 研究依据

平台指标与可见性：

- 微博开放平台 `statuses/show`：`reposts_count`、`comments_count`、`attitudes_count`，无公开评论阅读数；`favorited` 是“我是否收藏”的布尔值。https://open.weibo.com/wiki/2/statuses/show
- 微博阅读数定义（全平台被看到的次数）；公开可见性随内容状态变化。https://weibo.com/2016713117/M68Y0cveu
- 微博热搜规则（2021-08-23）：热度=(搜索热度+讨论热度+传播热度)×互动率；官方未公布权重与阈值。https://www.163.com/dy/article/GI638TEE0552FHQX.html
- B 站视频 `stat` 同时给出 view/danmaku/reply/favorite/coin/share/like；评论热度排序不等于纯点赞（同视频高赞评论可能排在较低赞之后）。https://api.bilibili.com/x/web-interface/view?bvid=BV1GJ411x7h7 、https://api.bilibili.com/x/v2/reply?type=1&oid=80433022&sort=2&ps=5
- 知乎问题公开关注者/被浏览/回答数；回答公开赞同/评论/收藏/喜欢，反对数不公开；浏览量为作者侧数据。https://www.zhihu.com/creator
- 贴吧标准界面公开回复数、楼层赞、楼中楼回复；点击量仅旧版/控制台可见。
- 抖音播放量主要在创作者中心；快手公开播放；B 站公开播放/弹幕/投币。https://creator.douyin.com/ 、https://m.zol.com.cn/article/10284161.html

情感本体：

- 徐琳宏、林鸿飞等，《情感词汇本体的构造》，情报学报 2008, 27(2):180-185；DUTIR 资源页 http://ir.dlut.edu.cn/info/1013/1142.htm （21 小类、五级强度、极性；科研教学使用）。
- GoEmotions（27 类 + neutral，Reddit 评论）：https://arxiv.org/abs/2005.00547
- NRC Emotion Lexicon（Plutchik 8 维）：https://saifmohammad.com/WebPages/NRC-Emotion-Lexicon.htm

比例与排序：

- Weibo-COV：8,284,992 条原创 / 40,893,953 条总量；CHECKED：2,104 帖 → 1,185,702 评论、1,868,175 转发；SAGraph：评论:转发 = 2.35:1。https://arxiv.org/abs/2005.09174 、https://arxiv.org/abs/2010.09029 、https://arxiv.org/abs/2403.15105
- Hacker News gravity：`score=(P-1)/(T+2)^1.8`；Reddit hot：`log10(max(|s|,1))+sign(s)·(t-1134028003)/45000`；Wilson 下界与贝叶斯平均用于小样本收缩。https://raw.githubusercontent.com/wting/hackernews/master/news.arc 、https://github.com/reddit-archive/reddit/blob/master/r2/r2/lib/db/_sorts.pyx 、https://www.evanmiller.org/how-not-to-sort-by-average-rating.html
- 重尾检验不应只看 log-log 直线；Clauset et al. 建议 MLE + KS + 似然比。https://arxiv.org/abs/0706.1062

生命周期与热度分位：

- 热度分位：15 万 / 30 万 / 49.3 万 / 86.4 万 / 165.5 万 / 490.8 万 / 2000 万（公开热搜存档 nicearrack/weibo-hot-search，MIT，2021-03 至 2021-09）。
- 累计曝光 `V=25×H` 为经验映射，不是官方公式。
- 多峰与衰减：Crane & Sornette (2008) https://arxiv.org/abs/0803.2189 ；Hu et al. (2017) https://doi.org/10.1371/journal.pone.0168749 ；Yang & Leskovec (2011) https://snap.stanford.edu/class/cs224w-readings/yang11memeshapes.pdf 。
- 热搜寿命：Cui & Kertész (2021) https://doi.org/10.1140/epjds/s13688-021-00263-0 。

未公开/不可验证：知乎是否在生产中使用 Wilson；微博/知乎/贴吧/抖音/快手/B 站的具体排序权重；所有平台评论曝光；抖音播放阈值；完播率定义。文档中这些均标注为“设计选择”或“估计”，不冒充官方口径。

## 11. 限制

- 语料是合成抽样：绝对速率按真实平台抽样比缩放，帖:评:回复比例与赞/浏览比保持真实；不是完整平台流量。
- 700 万条会产生句式重复；用槽位/结构变体/原型分布缓解，词云不受影响。
- 全链路加权改变环形含义：它表示“互动加权影响力占比”，不是讨论量占比；tooltip 同时给原始讨论量。
- 7 天保留删除了多月历史；`RETENTION` 常量可扩展。
- 生产 Worker 无外部生产者时使用分析回退，文本相关功能不可用。

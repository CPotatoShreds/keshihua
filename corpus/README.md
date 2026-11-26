# 外部语料生产者

这个目录是**外部数据源**，不是观潮系统本体。它模拟一个平台的文本流，独立进程、独立端口，把预生成的帖/评/回复输送给系统。

## 生成

```bash
npm run corpus:build
# 等价于 node corpus/build.js（默认 7 天 / 700 万条）
# 快速开发：
node corpus/build.js --days 1 --total 20000 --out corpus/out-test
```

- 40 个议题原型 × 80 城市，90 分钟一个话题；7 天约 110 个入库话题。
- 每话题按曝光分摊记录数；主帖 8–24 个，评论约 90%，回复约 10%。
- 文本由 `phrases/` 的组合式句式 + 槽位 + 情绪短语生成；确定性 RNG，可复现。
- 输出：
  - `out/topics/<slot>.ndjson.gz`：每话题按时间排序。
  - `out/manifest.json`：话题、记录数、窗口、文件。
  - `out/aggregates/hourly.ndjson`：话题×小时加权/原始/情绪计数。
  - `out/aggregates/by5m.ndjson`：话题×5 分钟聚合（回填最近 2 小时）。
- `out/` 不入 git。全量实测 **552MB gzip**（约 1.6GB raw）；最大话题 343,271 条。

## 运行

```bash
npm run corpus:serve
# 或 node corpus/producer.js --port 5400 --dir corpus/out
```

启动后日志会打印窗口、话题数、记录数。系统默认连接 `http://127.0.0.1:5400`，可用 `CORPUS_URL` 覆盖。

## API

| 路径 | 说明 |
|---|---|
| `GET /health` | 窗口、话题、记录、订阅者、暂停/倍速、最后记录时间 |
| `GET /manifest` | 完整 manifest |
| `GET /feed?from=&speed=&catchup=1` | SSE 文本流；按时间 k 路归并；`catchup` 先快进到当前时刻再 1× |
| `GET /texts?slot=&from=&to=&layer=&cluster=&emotion=&sort=&sample=&limit=` | 某话题窗口文本；`sort=hot` 按权重 |
| `GET /aggregates?from=&to=&step=5m` | 小时或 5 分钟聚合 NDJSON |
| `POST /control` | `{paused,speed,seek}`；seek 会让现有订阅收到 `reset` 事件 |

`/texts` 返回原始记录（含内部 `impressions`/`position`），仅供系统使用；系统公共 API 会剥离。

## 与系统的边界

- 生产者持有全量文本；系统只持久化聚合与最近窗口文本。
- 历史文本查询走 `/texts`；生产者离线时系统显示“语料源离线”，不伪造文本。
- 生产者不参与前端渲染，不直接对浏览器暴露。
- 生产 Worker 不包含生产者；完整语料演示需先启动本进程。

## 语料说明

- 所有文本是合成的，不来自真实用户；不包含真实人物、事件、机构。
- 绝对速率按主流平台抽样比缩放；帖:评:回复比例、点赞/浏览比、评论重尾与昼夜曲线保持真实形态。
- 评论浏览量为内部潜变量，不对应任何平台的公开字段。
- 情绪为 DUTIR 21 小类 + 无显著情绪；每条单标签 + 强度。
- 大话题的文件较大；首次 `/texts` 查询会解压并缓存整个话题，可能占用数百 MB 内存。需要更小规模时用 `--scale .1` 或 `--total`。

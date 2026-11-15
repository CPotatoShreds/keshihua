# v12 数据、公式与研究依据

## 指标

气泡/流量图编码新增曝光率（曝光/分钟）。曝光不是去重人数，也不是用户主动进入内容后的浏览。累计曝光不能减少，因此话题消亡归零指当前曝光率。所有数字是合成数据，不混合第三方热度，不声称反推真实曝光。

固定公式：r=100*sqrt(rate/100000)，r是世界坐标。πr²正比于rate。1000万与200万面积比5，半径比sqrt(5)≈2.236；半径线性会把面积差夸大为25倍。不做对数压缩、当前最大值归一化或数据半径上限。所有圆使用统一相机平移缩放。小圆命中范围可扩大但不可见，不伪造面积。汇流粒子暂时关闭。

依据：D3官方 [scaleRadial](https://d3js.org/d3-scale/linear) 规定输入线性对应输出半径的平方。

## 生命周期

每个话题5个事件峰。u=(t-at)/duration，0<u<1时核为 A*u^a*(1-u)^b/(m^a*(1-m)^b)，m=a/(a+b)，区间外为零。所有峰相加得每分钟曝光率。a,b为整数，多项式原函数给出窗口精确积分；每峰带观点权重，积分乘讨论比例得到5类讨论数量。

事件起点比例0、.13、.29、.48、.70，峰持续时间、幅度、形状各异，支持回应后再升温。峰尺度是确定性伪随机的对数均匀参数，约3500至940万曝光/分钟，可能叠加。寿命为演示设计的4小时至28天，并非真实统计分布。24故事模板按日期构造独立实例。

现实话题“消亡”通常是低于观察阈值，不保证永远为零。有限终点与Beta形核是为课程演示而选的模型，不是论文原公式，也不是现实预测。

研究启发：

- Crane & Sornette (2008), *Robust dynamic classes revealed by measuring the response function of a social system*：[预印本](https://arxiv.org/abs/0803.2189)，DOI 10.1073/pnas.0803685105。近500万视频日浏览序列，讨论内外部冲击后的不同衰减动态；启发急爆、慢降。
- Hu et al. (2017), *Predicting Key Events in the Popularity Evolution of Online Information*：[PLOS ONE](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0168749)。爆发、峰值、衰退及单峰/多峰演化；启发事件核叠加。
- Yang & Leskovec (2011), *Patterns of Temporal Variation in Online Media*：[作者存档](https://snap.stanford.edu/class/cs224w-readings/yang11memeshapes.pdf)。不同内容增长与衰退形态。

## 契约

Topic：id,title,description,tags,color,bornAt,endsAt,amplitude,discussionRatio,pulses,clusters,eventTitles,simulation=true。
Pulse：at,duration,amplitude,a,b,opinion[5]。
Frame：seq=time/5000,time,values[id]={views:曝光率,counts:{m5:5类,h1:5类}}。
Event：id,topicId,time,title,kind,body。只传已发生事件，界面再按观看时间过滤。所有时间epoch毫秒，显示Asia/Shanghai。

rateAt(q,t)返回当前曝光/分钟；aggregate(q,t,minutes)返回窗口曝光总量views与讨论counts；valuesAt返回当前rate和两组窗口讨论数。传输数字四舍五入，前端解析采样保持连续小数。

## 传输与采样

120天完整小时帧+起止/事件节点+最近10分钟5秒帧，约3500帧、130话题、未压缩3.8MB。客户端用共享合成模型精确取样任意历史时刻，不跨小时简单线性插值。

SSE每5秒推送，seq排序去重、Last-Event-ID续传，超1小时断线重新快照。客户端压缩老细帧回小时/节点，避免长期打开无限累积。实时约5秒缓冲，观看时钟逐帧连续推进。

流量图约每3像素一个时间桶；桶大于1分钟时用此前桶长度的平均速率（积分除桶宽），避免小时热点被中心单点漏采。窄视野显示瞬时速率。图表区间均值与气泡时刻率不同，tooltip明确标注。极小话题仍可能小于一像素，可放大或搜索。

讨论为真实5分钟/1小时积分，不重复叠加重叠窗口。实际平台接入时需用历史查询与多分辨率聚合接口替换合成模型；本版不是生产后端。

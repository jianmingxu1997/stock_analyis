# 📊 小斐股票分析系统

> 自动化股票筛选 + 交互式仪表盘 + 持仓管理  
> 最后更新：2026-03-09

---

## 🎯 系统功能

### 股票分析
- ✅ **每日自动更新** - 周一至周五 16:00 自动执行
- ✅ **10 指标评分** - 技术面 + 基本面综合评分
- ✅ **行业 Top20** - 每个行业选前 20 名
- ✅ **持仓管理** - 7 只强制持仓股票自动跟踪
- ✅ **交互式仪表盘** - 筛选、搜索、K 线图
- ✅ **飞书通知** - 结果自动推送
- ✅ **GitHub 同步** - 数据自动备份

### ETF 数据（新增）
- ✅ **317 只主流 ETF** - 宽基、科技、医药、消费等
- ✅ **历史数据** - 2025-01-01 至今，83,261 条记录
- ✅ **智能过滤** - 去重、去券商名、保留纯净 ETF
- 🔄 **仪表盘整合** - 计划中

---

## 📁 目录结构

```
projects/project_stock/
├── 📁 scripts/workflow/      # 工作流脚本
│   ├── run-full-workflow.js      # 完整工作流编排
│   ├── update-daily-data.js      # 数据更新
│   ├── screen-stocks.js          # 股票筛选 + 持仓添加
│   ├── generate-dashboard.js     # 仪表盘生成
│   ├── send-notification.js      # 飞书通知
│   └── upload-to-github.js       # GitHub 上传
├── 📁 output/
│   ├── 📁 excel/             # Excel 输出
│   └── 📁 dashboard/         # HTML 仪表盘
├── 📁 data/
│   ├── 📁 merged/            # 合并的历史数据
│   └── 📁 pools/             # 股票池配置
├── 📁 config/
│   └── feishu-config.json        # 飞书配置
├── 📁 docs/
│   └── 工作流说明.md              # 详细文档
└── README.md                     # 本文件
```

---

## 🚀 快速开始

### 手动执行完整工作流

```bash
cd projects/project_stock
node scripts/workflow/run-full-workflow.js
```

### 单独执行步骤

```bash
# 1. 数据更新
node scripts/workflow/update-daily-data.js

# 2. 股票筛选
node scripts/workflow/screen-stocks.js

# 3. 生成仪表盘
node scripts/workflow/generate-dashboard.js

# 4. 发送通知
node scripts/workflow/send-notification.js

# 5. 上传 GitHub
node scripts/workflow/upload-to-github.js
```

---

## 📊 持仓股票列表

| 代码 | 名称 | 行业 |
|------|------|------|
| 601600.SH | 中国铝业 | 铝 |
| 600392.SH | 盛和资源 | 小金属 |
| 603993.SH | 洛阳钼业 | 小金属 |
| 000969.SZ | 安泰科技 | 小金属 |
| 002046.SZ | 国机精工 | 机械基件 |
| 002270.SZ | 华明装备 | 电气设备 |
| 601611.SH | 中国核建 | 建筑工程 |

**说明：** 持仓股票强制加入 Excel，不参与行业 Top20 筛选。

---

## 🎨 仪表盘功能

### 筛选功能

- **💼 只看持仓** - 只显示 7 只持仓股票
- **⭐ 只看 9-10 分** - 只显示高分股票
- **🏭 行业筛选** - 按行业过滤
- **🔍 搜索框** - 搜索股票名称/代码

### K 线图

- 点击股票加载 K 线图
- 支持日线/月线切换
- 显示 MA5、MA10、成交量

---

## ⏰ 定时任务

### Cron 配置

```cron
# 周一至周五 16:00
0 16 * * 1-5
```

### 查看定时任务

```bash
openclaw cron list
```

### 手动触发

```bash
openclaw cron run stock-analysis-workflow
```

---

## 📝 修改历史

### 2026-03-09

- ✅ 持仓股票强制加入 Excel（不参与筛选）
- ✅ 股票代码带后缀显示（.SH/.SZ）
- ✅ 筛选按钮互斥逻辑优化
- ✅ 行业 Top20 确认（原 Top5）
- ✅ 工作流文档创建

---

## 📖 详细文档

查看 `docs/工作流说明.md` 了解更多细节。

---

*🌙 小斐姐 · 2026*

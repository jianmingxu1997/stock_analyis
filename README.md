# 股票分析自动化系统

> 自动化工作流：数据更新 → 股票筛选 → 仪表盘生成 → 通知推送

---

## 📁 目录结构

```
stock-data/
├── scripts/                # 脚本文件
│   ├── workflow/          # 核心工作流脚本
│   │   ├── run-full-workflow.js    # 完整工作流编排
│   │   ├── update-daily-data.js    # 盘后数据更新
│   │   ├── screen-stocks.js        # 股票筛选
│   │   ├── generate-dashboard.js   # 仪表盘生成
│   │   └── send-notification.js    # 通知发送
│   ├── utils/             # 工具脚本
│   │   └── embed-logo.js           # Logo 嵌入
│   └── archive/           # 历史/测试脚本（归档）
│
├── data/                  # 数据文件
│   ├── merged/           # 合并的历史数据
│   ├── daily/            # 单日数据
│   └── factors/          # 因子数据
│
├── output/                # 输出文件
│   ├── excel/            # Excel 筛选结果
│   ├── dashboard/        # HTML 仪表盘
│   └── reports/          # JSON 报告
│
├── logs/                  # 日志文件
├── config/                # 配置文件
└── docs/                  # 文档
```

---

## 🚀 快速开始

### 方式一：运行完整工作流（推荐）

```bash
cd C:\Users\Bob\.openclaw\workspace\stock-data

# 自动检测日期
node scripts/workflow/run-full-workflow.js

# 或指定日期
node scripts/workflow/run-full-workflow.js 20260302
```

### 方式二：分步执行

```bash
# 1. 更新数据
node scripts/workflow/update-daily-data.js

# 2. 筛选股票
node scripts/workflow/screen-stocks.js

# 3. 生成仪表盘
node scripts/workflow/generate-dashboard.js ../output/excel/全股票池分析_行业 Top5.xlsx ../output/dashboard/小斐智能选股 1.0.html

# 4. 发送通知
node scripts/workflow/send-notification.js
```

---

## ⏰ 定时任务配置

### Windows 任务计划程序

```powershell
# 以管理员身份运行 PowerShell
cd C:\Users\Bob\.openclaw\workspace\stock-data

# 创建工作流定时任务（工作日 16:00）
$action = New-ScheduledTaskAction -Execute "node" `
    -Argument "scripts/workflow/run-full-workflow.js" `
    -WorkingDirectory "C:\Users\Bob\.openclaw\workspace\stock-data"

$trigger = New-ScheduledTaskTrigger -Weekly `
    -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday `
    -At 4pm

Register-ScheduledTask `
    -TaskName "StockAnalysisWorkflow" `
    -TaskPath "\Stock\" `
    -Action $action `
    -Trigger $trigger `
    -RunLevel Highest `
    -Force
```

---

## 📊 输出文件

### Excel 筛选结果
- **位置**: `output/excel/全股票池分析_行业 Top5.xlsx`
- **内容**: 180-220 只高分股票（8 分以上）

### HTML 仪表盘
- **位置**: `output/dashboard/小斐智能选股 1.0.html`
- **大小**: 约 9MB（含 Base64 Logo）
- **功能**: 交互式股票筛选 + K 线图

### 执行报告
- **位置**: `logs/report-YYYYMMDD.json`
- **内容**: 各阶段执行结果、耗时、错误信息

---

## 📝 日志查看

```bash
# 查看今日日志
Get-Content logs\workflow-2026-03-02.log -Tail 50

# 查看最新报告
cat logs\report-20260302.json
```

---

## 🔧 配置说明

### workflow-config.json

```json
{
    "workflow": {
        "schedule": "0 16 * * 1-5"  // 工作日 16:00
    },
    "stages": {
        "dataUpdate": {
            "retry": 2,              // 失败重试 2 次
            "timeout": 1800000       // 超时 30 分钟
        }
    }
}
```

---

## 📈 监控指标

| 指标 | 目标值 | 告警阈值 |
|------|--------|----------|
| 执行成功率 | >99% | <95% |
| 数据更新成功率 | 100% | <98% |
| 平均执行时间 | <20 分钟 | >30 分钟 |

---

## 🐛 故障排查

### 问题 1: 数据更新失败
```bash
# 检查 API 可用性
node scripts/archive/test-api.js

# 手动执行
node scripts/workflow/update-daily-data.js

# 查看日志
Get-Content logs\update-*.log -Tail 100
```

### 问题 2: 仪表盘未生成
```bash
# 检查 Excel 文件
ls output/excel/*.xlsx

# 手动生成
node scripts/workflow/generate-dashboard.js
```

---

## 📚 相关文档

- [自动化工作流设计文档](docs/自动化工作流设计文档.md)
- [股票仪表盘开发文档](docs/股票仪表盘开发文档.md)
- [盘后数据采集系统说明](docs/盘后数据采集系统 - 完整说明文档.md)

---

*最后更新：2026-03-02*  
*作者：小斐姐 🌙*

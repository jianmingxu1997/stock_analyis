/**
 * ========================================
 * 盘后数据更新脚本（新浪 API 版）
 * ========================================
 * 
 * 功能：每个交易日盘后下载 1383 只股票的当日行情数据
 * 数据源：新浪 API（主）+ 东方财富 API（备用）
 * 输出：更新到 data/merged/ 目录下的 CSV 文件
 * 
 * 使用方法：
 * node update-daily-data.js [交易日期]
 * 
 * 示例：
 * node update-daily-data.js 20260227
 * 
 * 作者：小斐姐
 * 日期：2026-03-02
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ========================================
// 📋 配置区域
// ========================================

const WORKSPACE = path.join(__dirname, '..', '..');
const STOCK_POOL_FILE = path.join(WORKSPACE, 'data', 'pools', 'stock-pool-from-total-stocks.json');
const MERGED_DIR = path.join(WORKSPACE, 'data', 'merged');
const LOG_DIR = path.join(WORKSPACE, 'logs');

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 日志文件
const LOG_FILE = path.join(LOG_DIR, `update-${new Date().toISOString().split('T')[0]}.log`);

// 市场代码前缀映射
const MARKET_PREFIX = {
    'sh_main': ['600', '601', '603', '605'],
    'sz_main': ['000', '001', '002', '003'],
    'chinext': ['300', '301'],
    'star': ['688', '689'],
    'bse': ['4', '8', '920']
};

// CSV 文件映射
const CSV_FILES = {
    'sh_main': 'sh_main.csv',
    'sz_main': 'sz_main.csv',
    'chinext': 'chinext.csv',
    'star': 'star.csv',
    'bse': 'bse.csv'
};

// CSV 字段
const CSV_HEADERS = 'ts_code,trade_date,open,high,low,close,pre_close,change,pct_chg,vol,amount';

// ========================================
// 📝 日志函数
// ========================================

function log(message, level = 'INFO') {
    const timestamp = new Date().toISOString().split('T').join(' ').substring(0, 19);
    const logLine = `[${timestamp}] [${level}] ${message}`;
    console.log(logLine);
    fs.appendFileSync(LOG_FILE, logLine + '\n', 'utf8');
}

function logError(message, error) {
    log(`${message}: ${error.message}`, 'ERROR');
}

// ========================================
// 🔧 工具函数
// ========================================

/**
 * 判断股票属于哪个市场
 */
function getMarket(tsCode) {
    const code = tsCode.split('.')[0];
    
    for (const [market, prefixes] of Object.entries(MARKET_PREFIX)) {
        if (prefixes.some(prefix => code.startsWith(prefix))) {
            return market;
        }
    }
    
    return null;
}

/**
 * 从新浪 API 获取股票当日行情（主 API）
 */
async function fetchFromSina(tsCode, retry = 3) {
    for (let i = 0; i < retry; i++) {
        try {
            const code = tsCode.split('.')[0];
            const market = tsCode.split('.')[1].toLowerCase();
            const sinaCode = market + code;  // sh601398
            
            const url = `https://hq.sinajs.cn/list=${sinaCode}`;
            
            const response = await axios.get(url, {
                headers: {
                    'Referer': 'https://finance.sina.com.cn/',
                    'User-Agent': 'Mozilla/5.0'
                },
                timeout: 15000
            });
            
            const content = response.data;
            
            if (!content || !content.includes('"')) {
                if (i < retry - 1) {
                    await new Promise(r => setTimeout(r, 2000 * (i + 1)));
                    continue;
                }
                return null;
            }
            
            const match = content.match(/="([^"]+)"/);
            if (!match) {
                return null;
            }
            
            const fields = match[1].split(',');
            
            // 新浪 API 字段说明：
            // [0] 股票名，[1] 开盘，[2] 昨收，[3] 当前价，[4] 最高，[5] 最低
            // [8] 成交量 (股), [9] 成交额 (元)
            // [30] 日期 (2026-03-02), [31] 时间 (15:00:03)
            
            // 使用 API 返回的实际交易日期
            const apiDate = fields[30] ? fields[30].replace(/-/g, '') : new Date().toISOString().split('T')[0].replace(/-/g, '');
            
            return {
                success: true,
                source: 'sina',
                data: {
                    ts_code: tsCode,
                    trade_date: apiDate,  // 使用 API 返回的日期
                    open: parseFloat(fields[1]) || 0,
                    high: parseFloat(fields[4]) || 0,
                    low: parseFloat(fields[5]) || 0,
                    close: parseFloat(fields[3]) || 0,
                    pre_close: parseFloat(fields[2]) || 0,
                    change: (parseFloat(fields[3]) - parseFloat(fields[2])) || 0,
                    pct_chg: ((parseFloat(fields[3]) - parseFloat(fields[2])) / parseFloat(fields[2]) * 100) || 0,
                    vol: Math.round(parseFloat(fields[8]) / 100) || 0,  // 股转手 (除以 100)
                    amount: parseFloat(fields[9]) / 10000  // 元转千元
                }
            };
            
        } catch (error) {
            if (i < retry - 1) {
                await new Promise(r => setTimeout(r, 2000 * (i + 1)));
                continue;
            }
            return { success: false, source: 'sina', error: error.message };
        }
    }
    
    return null;
}

/**
 * 从东方财富 API 获取股票当日行情（备用 API）
 */
async function fetchFromEastmoney(tsCode, retry = 3) {
    for (let i = 0; i < retry; i++) {
        try {
            const code = tsCode.split('.')[0];
            const market = tsCode.split('.')[1];
            const secid = market === 'SH' ? `1.${code}` : `0.${code}`;
            
            const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&ut=fa5fd1943c7b386f172d6893dbfba10b&fields=f43,f44,f45,f46,f47,f48,f162,f170`;
            
            const response = await axios.get(url, {
                headers: {
                    'Referer': 'https://quote.eastmoney.com/',
                    'User-Agent': 'Mozilla/5.0'
                },
                timeout: 15000
            });
            
            if (!response.data.data) {
                return { success: false, source: 'eastmoney', error: '无数据' };
            }
            
            const d = response.data.data;
            
            return {
                success: true,
                source: 'eastmoney',
                data: {
                    ts_code: tsCode,
                    trade_date: new Date().toISOString().split('T')[0].replace(/-/g, ''),
                    open: (d.f43 || 0) / 100,
                    high: (d.f44 || 0) / 100,
                    low: (d.f45 || 0) / 100,
                    close: (d.f46 || 0) / 100,
                    pre_close: (d.f60 || 0) / 100,
                    change: (d.f61 || 0) / 100,
                    pct_chg: (d.f162 || 0) / 100,
                    vol: (d.f47 || 0) / 100,
                    amount: (d.f48 || 0) / 10000
                }
            };
            
        } catch (error) {
            if (i < retry - 1) {
                await new Promise(r => setTimeout(r, 2000 * (i + 1)));
                continue;
            }
            return { success: false, source: 'eastmoney', error: error.message };
        }
    }
    
    return null;
}

/**
 * 获取股票数据（主备切换）
 */
async function fetchStockData(tsCode) {
    // 优先使用新浪 API
    const sinaResult = await fetchFromSina(tsCode);
    
    if (sinaResult && sinaResult.success) {
        return sinaResult;
    }
    
    // 新浪失败，使用东方财富
    log(`${tsCode} 新浪 API 失败，切换到东方财富`, 'WARN');
    const eastmoneyResult = await fetchFromEastmoney(tsCode);
    
    if (eastmoneyResult && eastmoneyResult.success) {
        return eastmoneyResult;
    }
    
    // 都失败
    return {
        success: false,
        source: 'both',
        error: `新浪：${sinaResult?.error || '未知'}，东财：${eastmoneyResult?.error || '未知'}`
    };
}

/**
 * 读取现有 CSV 文件的最新日期
 */
function getLatestDate(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');
    
    if (lines.length < 2) {
        return null;
    }
    
    // 第二行是最新数据（日期倒序）
    const secondLine = lines[1].split(',');
    return secondLine[1];  // trade_date
}

/**
 * 追加数据到 CSV 文件
 */
function appendToCSV(filePath, data, tradeDate) {
    let content = '';
    
    if (fs.existsSync(filePath)) {
        content = fs.readFileSync(filePath, 'utf8');
    } else {
        // 新文件，先写表头
        content = CSV_HEADERS + '\n';
        log(`创建新文件：${filePath}`, 'INFO');
    }
    
    // 检查是否已存在该日期的数据
    const lines = content.trim().split('\n');
    const existingDates = new Set();
    
    for (let i = 1; i < lines.length; i++) {
        const fields = lines[i].split(',');
        if (fields.length > 1) {
            existingDates.add(fields[1]);
        }
    }
    
    // 过滤掉已存在的数据（只检查 CSV 里是否已有这个日期）
    const newData = data.filter(d => !existingDates.has(d.trade_date));
    
    if (newData.length === 0) {
        return 0;  // 没有新数据
    }
    
    // 按日期倒序排序
    newData.sort((a, b) => b.trade_date.localeCompare(a.trade_date));
    
    // 追加到文件开头（表头之后）
    const newLines = newData.map(d => 
        `${d.ts_code},${d.trade_date},${d.open},${d.high},${d.low},${d.close},${d.pre_close},${d.change},${d.pct_chg},${d.vol},${d.amount}`
    );
    
    // 插入到表头之后
    const headerLine = content.split('\n')[0];
    const restLines = content.split('\n').slice(1);
    const newContent = headerLine + '\n' + newLines.join('\n') + '\n' + restLines.join('\n');
    
    fs.writeFileSync(filePath, newContent, 'utf8');
    
    return newData.length;
}

/**
 * 按市场分组股票
 */
function groupByMarket(stocks) {
    const groups = {};
    
    stocks.forEach(stock => {
        const market = getMarket(stock.tsCode);
        if (market) {
            if (!groups[market]) {
                groups[market] = [];
            }
            groups[market].push(stock);
        }
    });
    
    return groups;
}

// ========================================
// 🚀 主函数
// ========================================

async function main() {
    log('========================================');
    log('  盘后数据更新（新浪 API 主用）');
    log('========================================');
    
    const startTime = Date.now();
    
    // 获取交易日期（参数或默认今天）
    let tradeDate = process.argv[2];
    
    if (!tradeDate) {
        // 默认使用最近一个交易日（今天如果是周末则用周五）
        const today = new Date();
        const dayOfWeek = today.getDay();
        
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            // 周末，用周五
            today.setDate(today.getDate() - (dayOfWeek === 0 ? 2 : 1));
        }
        
        tradeDate = today.toISOString().split('T')[0].replace(/-/g, '');
    }
    
    log(`交易日期：${tradeDate}`);
    
    // 读取股票池
    log('读取股票池...');
    const stockPoolData = JSON.parse(fs.readFileSync(STOCK_POOL_FILE, 'utf8'));
    const stocks = stockPoolData.stockPool;
    log(`股票池：${stocks.length}只`);
    
    // 按市场分组
    const groups = groupByMarket(stocks);
    
    log('\n市场分布:');
    Object.entries(groups).forEach(([market, marketStocks]) => {
        log(`  ${market}: ${marketStocks.length}只`);
    });
    
    // 更新统计
    const stats = {
        total: 0,
        success_sina: 0,
        success_eastmoney: 0,
        failed: 0,
        exists: 0
    };
    
    const failedStocks = [];
    
    // 逐个市场更新
    for (const [market, marketStocks] of Object.entries(groups)) {
        const csvFile = path.join(MERGED_DIR, CSV_FILES[market]);
        
        log(`\n更新 ${market} (${marketStocks.length}只股票)...`);
        
        // 检查该市场最新日期
        const latestDate = getLatestDate(csvFile);
        if (latestDate === tradeDate) {
            log(`该市场已有 ${tradeDate} 数据，跳过`, 'WARN');
            continue;
        }
        
        // 批量获取数据（避免限流）
        const batchSize = 20;
        const batches = Math.ceil(marketStocks.length / batchSize);
        
        const newData = [];
        
        for (let i = 0; i < batches; i++) {
            const batch = marketStocks.slice(i * batchSize, (i + 1) * batchSize);
            
            // 并发获取（每批最多 5 个并发）
            const concurrency = 5;
            for (let j = 0; j < batch.length; j += concurrency) {
                const subBatch = batch.slice(j, j + concurrency);
                
                const promises = subBatch.map(async (stock) => {
                    const result = await fetchStockData(stock.tsCode);
                    
                    if (result && result.success) {
                        stats.total++;
                        if (result.source === 'sina') {
                            stats.success_sina++;
                        } else if (result.source === 'eastmoney') {
                            stats.success_eastmoney++;
                        }
                        newData.push(result.data);
                    } else {
                        stats.failed++;
                        failedStocks.push({
                            tsCode: stock.tsCode,
                            error: result?.error || '未知错误'
                        });
                        log(`${stock.tsCode} 失败：${result?.error}`, 'ERROR');
                    }
                });
                
                await Promise.all(promises);
                
                // 子批次间暂停
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // 批次间暂停，避免限流
            if (i < batches - 1) {
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
            
            // 显示进度
            const current = Math.min((i + 1) * batchSize, marketStocks.length);
            const percent = ((current / marketStocks.length) * 100).toFixed(1);
            log(`进度：${percent}% (${current}/${marketStocks.length})`);
        }
        
        // 追加到 CSV
        if (newData.length > 0) {
            const added = appendToCSV(csvFile, newData, tradeDate);
            log(`追加 ${added} 条数据到 ${CSV_FILES[market]}`);
        } else {
            log(`无新数据`, 'WARN');
        }
    }
    
    // 最终统计
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    log('\n========================================');
    log('  更新完成');
    log('========================================');
    
    log(`总股票数：${stats.total + stats.failed}`);
    log(`成功（新浪）：${stats.success_sina}`);
    log(`成功（东财）：${stats.success_eastmoney}`);
    log(`失败：${stats.failed}`);
    log(`成功率：${((stats.total / (stats.total + stats.failed)) * 100).toFixed(1)}%`);
    log(`耗时：${elapsed}秒`);
    
    if (stats.failed > 0) {
        log('\n⚠️  失败股票列表:', 'WARN');
        failedStocks.slice(0, 20).forEach(s => {
            log(`  ${s.tsCode}: ${s.error}`, 'WARN');
        });
        
        if (failedStocks.length > 20) {
            log(`  ... 还有 ${failedStocks.length - 20} 只`, 'WARN');
        }
        
        // 保存失败列表
        const failedFile = path.join(LOG_DIR, `failed-${tradeDate}.json`);
        fs.writeFileSync(failedFile, JSON.stringify(failedStocks, null, 2), 'utf8');
        log(`失败列表已保存到：${failedFile}`, 'INFO');
    }
    
    // 保存统计报告
    const report = {
        tradeDate,
        elapsed,
        stats,
        failedStocks,
        timestamp: new Date().toISOString()
    };
    
    const reportFile = path.join(LOG_DIR, `report-${tradeDate}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf8');
    log(`统计报告已保存到：${reportFile}`, 'INFO');
    
    // 发送飞书通知
    log('发送飞书通知...', 'INFO');
    try {
        const { sendFeishuMessage, buildCardMessage } = require('./send-notification.js');
        const cardMessage = buildCardMessage(report);
        await sendFeishuMessage(cardMessage);
    } catch (error) {
        log(`飞书通知发送失败：${error.message}`, 'WARN');
    }
}

// 运行主函数
main().catch(error => {
    logError('程序执行失败', error);
    process.exit(1);
});

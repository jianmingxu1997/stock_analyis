/**
 * ========================================
 * 盘后数据更新脚本 - 强制更新版本
 * ========================================
 * 
 * 功能：强制下载并更新当日行情数据
 * 特点：跳过日期检查，直接追加数据
 * 
 * 使用方法：
 * node update-daily-data-force.js
 * 
 * 作者：小斐姐
 * 日期：2026-03-02
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const STOCK_POOL_FILE = path.join(__dirname, 'stock-pool-from-total-stocks.json');
const MERGED_DIR = path.join(__dirname, 'data', 'merged');
const LOG_DIR = path.join(__dirname, 'logs');

if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

const LOG_FILE = path.join(LOG_DIR, `update-${new Date().toISOString().split('T')[0]}.log`);

const MARKET_PREFIX = {
    'sh_main': ['600', '601', '603', '605'],
    'sz_main': ['000', '001', '002', '003']
};

const CSV_FILES = {
    'sh_main': 'sh_main.csv',
    'sz_main': 'sz_main.csv'
};

const CSV_HEADERS = 'ts_code,trade_date,open,high,low,close,pre_close,change,pct_chg,vol,amount';

function log(message, level = 'INFO') {
    const timestamp = new Date().toISOString().split('T').join(' ').substring(0, 19);
    const logLine = `[${timestamp}] [${level}] ${message}`;
    console.log(logLine);
    fs.appendFileSync(LOG_FILE, logLine + '\n', 'utf8');
}

function getMarket(tsCode) {
    const code = tsCode.split('.')[0];
    for (const [market, prefixes] of Object.entries(MARKET_PREFIX)) {
        if (prefixes.some(prefix => code.startsWith(prefix))) {
            return market;
        }
    }
    return null;
}

async function fetchFromSina(tsCode, retry = 3) {
    for (let i = 0; i < retry; i++) {
        try {
            const code = tsCode.split('.')[0];
            const market = tsCode.split('.')[1].toLowerCase();
            const sinaCode = market + code;
            
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
            if (!match) return null;
            
            const fields = match[1].split(',');
            
            // 获取实际交易日期（从系统日期）
            const today = new Date();
            const tradeDate = today.toISOString().split('T')[0].replace(/-/g, '');
            
            return {
                success: true,
                source: 'sina',
                data: {
                    ts_code: tsCode,
                    trade_date: tradeDate,
                    open: parseFloat(fields[1]) || 0,
                    high: parseFloat(fields[4]) || 0,
                    low: parseFloat(fields[5]) || 0,
                    close: parseFloat(fields[3]) || 0,
                    pre_close: parseFloat(fields[2]) || 0,
                    change: (parseFloat(fields[3]) - parseFloat(fields[2])) || 0,
                    pct_chg: ((parseFloat(fields[3]) - parseFloat(fields[2])) / parseFloat(fields[2]) * 100) || 0,
                    vol: parseFloat(fields[7]) || 0,
                    amount: parseFloat(fields[8]) / 10000
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

function groupByMarket(stocks) {
    const groups = {};
    stocks.forEach(stock => {
        const market = getMarket(stock.tsCode);
        if (market) {
            if (!groups[market]) groups[market] = [];
            groups[market].push(stock);
        }
    });
    return groups;
}

// 强制追加数据（不检查日期）
function appendToCSVForce(filePath, data) {
    let content = '';
    
    if (fs.existsSync(filePath)) {
        content = fs.readFileSync(filePath, 'utf8');
    } else {
        content = CSV_HEADERS + '\n';
        log(`创建新文件：${filePath}`, 'INFO');
    }
    
    // 按日期倒序排序
    data.sort((a, b) => b.trade_date.localeCompare(a.trade_date));
    
    const newLines = data.map(d => 
        `${d.ts_code},${d.trade_date},${d.open},${d.high},${d.low},${d.close},${d.pre_close},${d.change},${d.pct_chg},${d.vol},${d.amount}`
    );
    
    const headerLine = content.split('\n')[0];
    const restLines = content.split('\n').slice(1);
    const newContent = headerLine + '\n' + newLines.join('\n') + '\n' + restLines.join('\n');
    
    fs.writeFileSync(filePath, newContent, 'utf8');
    
    return data.length;
}

async function main() {
    log('========================================');
    log('  盘后数据更新（强制更新版本）');
    log('========================================');
    
    const startTime = Date.now();
    
    const today = new Date();
    const tradeDate = today.toISOString().split('T')[0].replace(/-/g, '');
    
    log(`交易日期：${tradeDate}`);
    log(`注意：此版本会强制追加数据，不检查重复`);
    
    log('读取股票池...');
    const stockPoolData = JSON.parse(fs.readFileSync(STOCK_POOL_FILE, 'utf8'));
    const stocks = stockPoolData.stockPool;
    log(`股票池：${stocks.length}只`);
    
    const groups = groupByMarket(stocks);
    
    log('\n市场分布:');
    Object.entries(groups).forEach(([market, marketStocks]) => {
        log(`  ${market}: ${marketStocks.length}只`);
    });
    
    const stats = {
        total: 0,
        success_sina: 0,
        failed: 0
    };
    
    for (const [market, marketStocks] of Object.entries(groups)) {
        const csvFile = path.join(MERGED_DIR, CSV_FILES[market]);
        
        log(`\n更新 ${market} (${marketStocks.length}只股票)...`);
        
        const batchSize = 20;
        const batches = Math.ceil(marketStocks.length / batchSize);
        
        const newData = [];
        
        for (let i = 0; i < batches; i++) {
            const batch = marketStocks.slice(i * batchSize, (i + 1) * batchSize);
            
            const concurrency = 5;
            for (let j = 0; j < batch.length; j += concurrency) {
                const subBatch = batch.slice(j, j + concurrency);
                
                const promises = subBatch.map(async (stock) => {
                    const result = await fetchFromSina(stock.tsCode);
                    
                    if (result && result.success) {
                        stats.total++;
                        stats.success_sina++;
                        newData.push(result.data);
                    } else {
                        stats.failed++;
                        log(`${stock.tsCode} 失败：${result?.error}`, 'ERROR');
                    }
                });
                
                await Promise.all(promises);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            const current = Math.min((i + 1) * batchSize, marketStocks.length);
            const percent = ((current / marketStocks.length) * 100).toFixed(1);
            log(`进度：${percent}% (${current}/${marketStocks.length})`);
            
            if (i < batches - 1) {
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
        
        if (newData.length > 0) {
            const added = appendToCSVForce(csvFile, newData);
            log(`✅ 追加 ${added} 条数据到 ${CSV_FILES[market]}`);
        } else {
            log(`⚠️ 无新数据`, 'WARN');
        }
    }
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    log('\n========================================');
    log('  更新完成');
    log('========================================');
    
    log(`总股票数：${stats.total + stats.failed}`);
    log(`成功（新浪）：${stats.success_sina}`);
    log(`失败：${stats.failed}`);
    log(`成功率：${((stats.success_sina / (stats.total + stats.failed)) * 100).toFixed(1)}%`);
    log(`耗时：${elapsed}秒`);
}

main().catch(error => {
    log(`程序执行失败：${error.message}`, 'ERROR');
    process.exit(1);
});

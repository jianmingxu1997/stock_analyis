// Tushare 数据下载器
// 批量下载 A 股历史数据到本地

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 配置
const TUSHARE_TOKEN = 'ee8524fdaa2ee318cbb578e42b4eaaecdad6af533b6dc7d4200c4e6a';
const TUSHARE_API = 'http://api.tushare.pro';
const DATA_DIR = path.join(__dirname, 'data', 'daily');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`✅ 创建数据目录：${DATA_DIR}`);
}

// A 股全部股票代码（从 Tushare 获取）
async function getAllStockCodes() {
    console.log('📋 获取全部 A 股股票代码...');
    
    try {
        const response = await axios.post(TUSHARE_API, {
            api_name: 'stock_basic',
            token: TUSHARE_TOKEN,
            params: {
                exchange: '',
                list_status: 'L'
            }
        });
        
        if (response.data.code !== 0) {
            throw new Error(response.data.msg);
        }
        
        const stocks = response.data.data.items.map(item => ({
            ts_code: item[0],
            symbol: item[1],
            name: item[2],
            exchange: item[3]
        }));
        
        console.log(`✅ 获取到 ${stocks.length} 只股票`);
        return stocks;
    } catch (error) {
        console.error('❌ 获取股票代码失败:', error.message);
        
        // 如果 API 失败，使用预设的股票池（包含主要股票）
        console.log('⚠️ 使用预设股票池（61 只主要股票）...');
        return getPredefinedStocks();
    }
}

// 预设股票池（主要股票）
function getPredefinedStocks() {
    return [
        // 银行
        '601939.SH', '601398.SH', '601288.SH', '601988.SH', '601658.SH',
        '601328.SH', '600036.SH', '601166.SH', '600000.SH', '600016.SH',
        
        // 保险 + 证券
        '601318.SH', '601628.SH', '601688.SH', '600030.SH', '000776.SZ',
        
        // 能源
        '601088.SH', '601898.SH', '000937.SZ', '000983.SZ', '601699.SH',
        
        // 基建
        '601668.SH', '601390.SH', '601186.SH', '601800.SH', '601618.SH',
        
        // 通信
        '600941.SH', '601728.SH', '600050.SH', '000063.SZ',
        
        // 航运
        '601919.SH', '600026.SH', '601872.SH', '601006.SH',
        
        // 消费
        '600887.SH', '600519.SH', '000858.SZ', '000568.SZ', '002304.SZ',
        
        // 机械
        '600031.SH', '000066.SZ', '000157.SZ', '601766.SH',
        
        // 医药
        '600513.SH', '000999.SZ', '600276.SH', '300760.SZ', '600436.SH',
        
        // 汽车
        '601633.SH', '600104.SH', '000625.SZ', '002594.SZ', '601127.SH',
        
        // 科技
        '000725.SZ', '002415.SZ', '300014.SZ', '300750.SZ', '002230.SZ',
        '600745.SH', '000100.SZ', '601012.SH', '002460.SZ'
    ].map(code => ({ ts_code: code }));
}

/**
 * 下载单只股票的日线数据
 */
async function downloadStockData(tsCode, startDate, endDate) {
    // 文件名直接用股票代码，如：000001.SZ.csv
    const filePath = path.join(DATA_DIR, `${tsCode}.csv`);
    
    // 检查是否已存在
    if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const fileAge = Date.now() - stats.mtimeMs;
        
        // 如果文件小于 1 天，直接使用缓存
        if (fileAge < 24 * 60 * 60 * 1000) {
            return { cached: true, path: filePath };
        }
    }
    
    try {
        const response = await axios.post(TUSHARE_API, {
            api_name: 'daily',
            token: TUSHARE_TOKEN,
            params: {
                ts_code: tsCode,
                start_date: startDate,
                end_date: endDate
            }
        });
        
        if (response.data.code !== 0) {
            throw new Error(response.data.msg);
        }
        
        const fields = response.data.data.fields;
        const items = response.data.data.items;
        
        if (items.length === 0) {
            return { cached: false, path: null, reason: '无数据' };
        }
        
        // 保存为 CSV
        const header = fields.join(',');
        const rows = items.map(item => item.join(',')).join('\n');
        const csv = header + '\n' + rows;
        
        fs.writeFileSync(filePath, csv, 'utf8');
        
        return { 
            cached: false, 
            path: filePath, 
            count: items.length 
        };
        
    } catch (error) {
        return { 
            cached: false, 
            path: null, 
            error: error.message 
        };
    }
}

/**
 * 批量下载所有股票数据
 */
async function downloadAll() {
    console.log('========================================');
    console.log('  Tushare 数据下载器');
    console.log('========================================\n');
    
    const startDate = '20250101'; // 从 2025 年开始
    const endDate = new Date().toISOString().replace(/-/g, '').slice(0, 8);
    
    console.log(`📅 下载范围：${startDate} 至 ${endDate}\n`);
    
    // 获取股票列表
    const stocks = await getAllStockCodes();
    
    let success = 0;
    let cached = 0;
    let failed = 0;
    
    console.log(`📥 开始下载，共 ${stocks.length} 只股票...\n`);
    
    for (let i = 0; i < stocks.length; i++) {
        const stock = stocks[i];
        const tsCode = stock.ts_code || stock;
        
        process.stdout.write(`[${(i + 1).toString().padStart(3)}/${stocks.length}] ${tsCode}... `);
        
        const result = await downloadStockData(tsCode, startDate, endDate);
        
        if (result.cached) {
            console.log('✅ 缓存');
            cached++;
        } else if (result.path) {
            console.log(`✅ 成功 (${result.count}条)`);
            success++;
        } else {
            console.log(`❌ 失败：${result.error || result.reason}`);
            failed++;
        }
        
        // 避免触发限流 - 每 50 次请求暂停 1 分钟
        if ((i + 1) % 50 === 0) {
            console.log('\n⏸️  触发限流保护，暂停 60 秒...\n');
            await new Promise(resolve => setTimeout(resolve, 60000));
        } else {
            // 正常延迟
            await new Promise(resolve => setTimeout(resolve, 1200));
        }
    }
    
    console.log('\n========================================');
    console.log('  下载完成');
    console.log('========================================');
    console.log(`成功：${success}`);
    console.log(`缓存：${cached}`);
    console.log(`失败：${failed}`);
    console.log(`总计：${stocks.length}`);
    console.log('========================================\n');
    
    console.log(`📁 数据保存位置：${DATA_DIR}`);
}

// 运行下载
downloadAll().catch(console.error);

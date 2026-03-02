// 从 CSV 文件提取股票代码并下载历史数据
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

/**
 * 从 CSV 文件提取股票代码
 */
function extractStockCodesFromCSV(csvPath) {
    console.log(`📖 读取 CSV 文件：${csvPath}...`);
    
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.trim().split('\n');
    
    // 跳过表头
    const dataLines = lines.slice(1);
    
    // 提取 ts_code 列（第 3 列，索引 2）
    const stockCodes = new Set();
    
    dataLines.forEach(line => {
        // CSV 解析（处理引号）
        const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (matches && matches.length >= 3) {
            let tsCode = matches[2].replace(/"/g, '').trim();
            if (tsCode && tsCode.match(/^[0-9]+\.(SH|SZ|BJ)$/)) {
                stockCodes.add(tsCode);
            }
        }
    });
    
    const codes = Array.from(stockCodes).sort();
    console.log(`✅ 提取到 ${codes.length} 只股票\n`);
    
    return codes;
}

/**
 * 下载单只股票的日线数据
 */
async function downloadStockData(tsCode, startDate, endDate) {
    const filePath = path.join(DATA_DIR, `${tsCode}.csv`);
    
    // 检查是否已存在
    if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const fileAge = Date.now() - stats.mtimeMs;
        
        // 如果文件小于 1 天且大于 100 字节，使用缓存
        if (fileAge < 24 * 60 * 60 * 1000 && stats.size > 100) {
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
 * 批量下载
 */
async function downloadAll(stockCodes) {
    console.log('========================================');
    console.log('  Tushare 数据下载器（CSV 股票列表）');
    console.log('========================================\n');
    
    const startDate = '20250101';
    const endDate = new Date().toISOString().replace(/-/g, '').slice(0, 8);
    
    console.log(`📅 下载范围：${startDate} 至 ${endDate}`);
    console.log(`📊 股票数量：${stockCodes.length}\n`);
    
    let success = 0;
    let cached = 0;
    let failed = 0;
    
    for (let i = 0; i < stockCodes.length; i++) {
        const tsCode = stockCodes[i];
        
        process.stdout.write(`[${(i + 1).toString().padStart(4)}/${stockCodes.length}] ${tsCode}... `);
        
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
        
        // 限流保护 - 每 50 次暂停 1 分钟
        if ((i + 1) % 50 === 0) {
            console.log('\n⏸️  触发限流保护，暂停 60 秒...\n');
            await new Promise(resolve => setTimeout(resolve, 60000));
        } else {
            await new Promise(resolve => setTimeout(resolve, 1200));
        }
    }
    
    console.log('\n========================================');
    console.log('  下载完成');
    console.log('========================================');
    console.log(`成功：${success}`);
    console.log(`缓存：${cached}`);
    console.log(`失败：${failed}`);
    console.log(`总计：${stockCodes.length}`);
    console.log('========================================\n');
    
    console.log(`📁 数据保存位置：${DATA_DIR}`);
}

// 主函数
async function main() {
    const csvPath = path.join(__dirname, 'data', '260227_total_stocks.csv');
    
    if (!fs.existsSync(csvPath)) {
        console.log(`❌ CSV 文件不存在：${csvPath}`);
        return;
    }
    
    const stockCodes = extractStockCodesFromCSV(csvPath);
    await downloadAll(stockCodes);
}

main().catch(console.error);

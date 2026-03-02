// 合并股票数据到少量大 CSV 文件
// 按市场分类合并

const fs = require('fs');
const path = require('path');
const csv = require('csv-writer').createObjectCsvWriter;

const DATA_DIR = path.join(__dirname, 'data', 'daily');
const OUTPUT_DIR = path.join(__dirname, 'data', 'merged');

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`✅ 创建输出目录：${OUTPUT_DIR}`);
}

/**
 * 根据股票代码分类
 */
function classifyStock(tsCode) {
    const code = tsCode.split('.')[0];
    const market = tsCode.split('.')[1];
    
    // 北交所 (4/8/920 开头)
    if (code.startsWith('4') || code.startsWith('8') || code.startsWith('920')) {
        return 'bse';
    }
    
    // 科创板 (688/689 开头)
    if (code.startsWith('688') || code.startsWith('689')) {
        return 'star';
    }
    
    // 创业板 (300/301 开头)
    if (code.startsWith('300') || code.startsWith('301')) {
        return 'chinext';
    }
    
    // 沪市主板 (600/601/603/605 开头)
    if (market === 'SH' && (code.startsWith('600') || code.startsWith('601') || code.startsWith('603') || code.startsWith('605'))) {
        return 'sh_main';
    }
    
    // 深市主板 (000/001/002/003 开头)
    if (market === 'SZ' && (code.startsWith('000') || code.startsWith('001') || code.startsWith('002') || code.startsWith('003'))) {
        return 'sz_main';
    }
    
    // 其他归入 misc
    return 'misc';
}

/**
 * 读取单个 CSV 文件
 */
function readStockCSV(tsCode) {
    const filePath = path.join(DATA_DIR, `${tsCode}.csv`);
    
    if (!fs.existsSync(filePath)) {
        return null;
    }
    
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.trim().split('\n');
        
        if (lines.length < 2) {
            return [];
        }
        
        // 解析表头
        const headers = lines[0].split(',');
        
        // 解析数据并添加 ts_code 列
        const data = lines.slice(1).map(line => {
            const values = line.split(',');
            const row = { ts_code: tsCode };
            headers.forEach((header, index) => {
                row[header.trim()] = values[index] ? values[index].trim() : '';
            });
            return row;
        });
        
        return data;
        
    } catch (error) {
        console.error(`❌ 读取 ${tsCode} 失败：${error.message}`);
        return null;
    }
}

/**
 * 主函数
 */
async function mergeAll() {
    console.log('========================================');
    console.log('  股票数据合并工具');
    console.log('========================================\n');
    
    // 获取所有股票文件
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.csv'));
    console.log(`📊 找到 ${files.length} 个股票文件\n`);
    
    // 分类存储
    const categories = {
        'sh_main': [],
        'sz_main': [],
        'chinext': [],
        'star': [],
        'bse': [],
        'misc': []
    };
    
    const stats = {
        total: 0,
        success: 0,
        fail: 0,
        rows: 0
    };
    
    // 读取并分类
    console.log('📖 开始读取并分类...\n');
    
    for (let i = 0; i < files.length; i++) {
        const tsCode = files[i].replace('.csv', '');
        const category = classifyStock(tsCode);
        
        const data = readStockCSV(tsCode);
        
        if (data && data.length > 0) {
            categories[category].push(...data);
            stats.success++;
            stats.rows += data.length;
        } else {
            stats.fail++;
        }
        
        stats.total++;
        
        // 显示进度
        if ((i + 1) % 500 === 0) {
            console.log(`   进度：${i + 1}/${files.length} 成功：${stats.success} 失败：${stats.fail}`);
        }
    }
    
    console.log(`\n✅ 读取完成！成功：${stats.success} 失败：${stats.fail} 总行数：${stats.rows}\n`);
    
    // 写入文件
    console.log('💾 开始写入合并文件...\n');
    
    const csvHeaders = [
        { id: 'ts_code', title: 'ts_code' },
        { id: 'trade_date', title: 'trade_date' },
        { id: 'open', title: 'open' },
        { id: 'high', title: 'high' },
        { id: 'low', title: 'low' },
        { id: 'close', title: 'close' },
        { id: 'pre_close', title: 'pre_close' },
        { id: 'change', title: 'change' },
        { id: 'pct_chg', title: 'pct_chg' },
        { id: 'vol', title: 'vol' },
        { id: 'amount', title: 'amount' }
    ];
    
    for (const [category, data] of Object.entries(categories)) {
        if (data.length === 0) {
            console.log(`⚪ 跳过 ${category} (无数据)`);
            continue;
        }
        
        const outputPath = path.join(OUTPUT_DIR, `${category}.csv`);
        
        const writer = csv({
            path: outputPath,
            header: csvHeaders
        });
        
        console.log(`📝 写入 ${category}.csv (${data.length} 行)...`);
        
        await writer.writeRecords(data);
        
        const fileSize = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
        console.log(`✅ ${category}.csv 完成 (${fileSize} MB)\n`);
    }
    
    // 生成统计报告
    console.log('========================================');
    console.log('  合并完成!');
    console.log('========================================\n');
    
    console.log('📊 文件统计:\n');
    console.log('文件名          | 行数      | 大小 (MB)');
    console.log('----------------|-----------|----------');
    
    for (const category of Object.keys(categories)) {
        const filePath = path.join(OUTPUT_DIR, `${category}.csv`);
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            const lines = fs.readFileSync(filePath, 'utf8').split('\n').length - 1;
            console.log(`${category.padEnd(15)} | ${lines.toString().padStart(9)} | ${(stats.size / 1024 / 1024).toFixed(2).padStart(8)}`);
        }
    }
    
    console.log('\n========================================\n');
}

mergeAll().catch(console.error);

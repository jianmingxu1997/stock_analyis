#!/usr/bin/env node
/**
 * 股票分析自动化工作流编排脚本
 * 
 * 功能：按顺序执行数据更新 → 股票筛选 → 仪表盘生成 → 通知发送
 * 用法：node run-full-workflow.js [tradeDate]
 * 示例：node run-full-workflow.js 20260302
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// ========================================
// 配置
// ========================================
const WORKSPACE = path.join(__dirname, '..', '..');
const SCRIPTS_DIR = path.join(__dirname);
const LOGS_DIR = path.join(WORKSPACE, 'logs');
const OUTPUT_DIR = path.join(WORKSPACE, 'output');

// 获取交易日期（工作日用今天，周末用周五）
function getTradeDate() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        // 周末，用周五
        today.setDate(today.getDate() - (dayOfWeek === 0 ? 2 : 1));
    }
    
    return today.toISOString().split('T')[0].replace(/-/g, '');
}

const TRADE_DATE = getTradeDate();
const EXCEL_FILE = path.join(OUTPUT_DIR, 'excel', `${TRADE_DATE}_小斐选股_行业 top20.xlsx`);

// 确保日志目录存在
if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// 日志工具
function log(message, level = 'INFO', module = 'WORKFLOW') {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 23);
    const logLine = `[${timestamp}] [${level}] [${module}] ${message}`;
    console.log(logLine);
    
    // 写入日志文件
    const logFile = path.join(LOGS_DIR, `workflow-${new Date().toISOString().split('T')[0]}.log`);
    fs.appendFileSync(logFile, logLine + '\n');
}

// 执行脚本
async function executeScript(scriptName, args = [], timeout = 300000) {
    const scriptPath = path.join(SCRIPTS_DIR, scriptName);
    // 对包含空格的参数添加引号
    const argsStr = args.map(arg => arg.includes(' ') ? `"${arg}"` : arg).join(' ');
    const command = `node "${scriptPath}" ${argsStr}`;
    
    log(`执行：${command}`, 'INFO', 'EXEC');
    
    try {
        const { stdout, stderr } = await execPromise(command, { 
            timeout,
            maxBuffer: 10 * 1024 * 1024
        });
        
        if (stdout) console.log(stdout);
        if (stderr) console.warn(stderr);
        
        return { success: true, stdout, stderr };
    } catch (error) {
        log(`执行失败：${error.message}`, 'ERROR', 'EXEC');
        return { 
            success: false, 
            error: error.message,
            stdout: error.stdout,
            stderr: error.stderr
        };
    }
}

// 重试执行
async function executeWithRetry(scriptName, args, config) {
    const { retry = 2, retryDelay = 300000, timeout = 300000 } = config;
    
    for (let attempt = 1; attempt <= retry + 1; attempt++) {
        log(`尝试 ${attempt}/${retry + 1}`, 'INFO', 'RETRY');
        
        const result = await executeScript(scriptName, args, timeout);
        
        if (result.success) {
            return { success: true, attempt };
        }
        
        if (attempt <= retry) {
            log(`${retryDelay / 1000}秒后重试...`, 'WARN', 'RETRY');
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
    
    return { success: false, attempts: retry + 1 };
}

// ========================================
// 工作流阶段
// ========================================
const stages = [
    {
        name: '数据更新',
        script: 'update-daily-data.js',
        args: [],
        timeout: 600000,   // 10 分钟
        retry: 3,
        retryDelay: 60000,
        critical: false
    },
    {
        name: 'ETF 数据更新',
        script: 'update-etf-daily-data.js',
        args: [],
        timeout: 300000,   // 5 分钟
        retry: 2,
        retryDelay: 30000,
        critical: false    // 非关键：ETF 数据更新失败也继续
    },
    {
        name: '股票筛选',
        script: 'screen-stocks.js',
        args: [],
        timeout: 120000,  // 2 分钟
        retry: 1,
        retryDelay: 60000,
        critical: true
    },
    {
        name: '仪表盘生成',
        script: 'generate-dashboard.js',
        args: [
            EXCEL_FILE,
            path.join(OUTPUT_DIR, 'dashboard', '小斐智能选股 1.0.html')
        ],
        timeout: 300000,  // 5 分钟
        retry: 1,
        retryDelay: 60000,
        critical: false
    },
    {
        name: '上传到 GitHub',
        script: 'upload-to-github.js',
        args: [],
        timeout: 120000,  // 2 分钟
        retry: 2,
        retryDelay: 30000,
        critical: false    // 非关键：上传失败也要发通知
    },
    {
        name: '结果通知',
        script: 'send-notification.js',
        args: [],
        timeout: 30000,
        retry: 3,
        retryDelay: 10000,
        critical: false
    }
];

// ========================================
// 主函数
// ========================================
async function main() {
    const startTime = Date.now();
    const tradeDate = process.argv[2];
    
    console.log('========================================');
    console.log('  🚀 股票分析自动化工作流');
    console.log('========================================\n');
    
    if (tradeDate) {
        log(`工作流开始执行 (交易日期：${tradeDate})`);
    } else {
        log('工作流开始执行 (自动检测日期)');
    }
    
    const results = [];
    let workflowSuccess = true;
    
    for (const stage of stages) {
        const stageStart = Date.now();
        log(`\n开始阶段：${stage.name}`, 'INFO', 'STAGE');
        
        // 添加交易日期参数
        const args = tradeDate ? [...stage.args, tradeDate] : stage.args;
        
        // 执行阶段
        const result = await executeWithRetry(stage.script, args, {
            retry: stage.retry,
            retryDelay: stage.retryDelay,
            timeout: stage.timeout
        });
        
        const stageDuration = ((Date.now() - stageStart) / 1000).toFixed(1);
        
        if (result.success) {
            log(`✅ 阶段完成：${stage.name} (耗时：${stageDuration}秒)`, 'INFO', 'STAGE');
            results.push({
                stage: stage.name,
                success: true,
                duration: stageDuration,
                attempts: result.attempt
            });
        } else {
            if (stage.critical) {
                log(`❌ 关键阶段失败：${stage.name}，终止工作流`, 'ERROR', 'STAGE');
                results.push({
                    stage: stage.name,
                    success: false,
                    duration: stageDuration,
                    attempts: result.attempts,
                    error: result.error
                });
                workflowSuccess = false;
                break;
            } else {
                log(`⚠️  非关键阶段失败：${stage.name}，继续执行后续步骤`, 'WARN', 'STAGE');
                results.push({
                    stage: stage.name,
                    success: false,
                    duration: stageDuration,
                    attempts: result.attempts,
                    error: result.error,
                    note: '已跳过，继续执行'
                });
            }
        }
    }
    
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    // 生成报告
    log(`\n工作流执行${workflowSuccess ? '成功' : '失败'} (总耗时：${totalDuration}秒)`, 'INFO', 'WORKFLOW');
    
    const report = {
        date: new Date().toISOString(),
        tradeDate: tradeDate || new Date().toISOString().split('T')[0],
        success: workflowSuccess,
        totalDuration: totalDuration,
        stages: results
    };
    
    // 保存报告
    const reportFile = path.join(LOGS_DIR, `report-${new Date().toISOString().split('T')[0].replace(/-/g, '')}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf8');
    log(`报告已保存：${reportFile}`, 'INFO', 'REPORT');
    
    console.log('\n========================================');
    console.log('  📊 执行结果摘要');
    console.log('========================================\n');
    
    results.forEach(r => {
        const icon = r.success ? '✅' : '❌';
        console.log(`${icon} ${r.stage}: ${r.success ? '成功' : '失败'} (${r.duration}秒, ${r.attempts}次尝试)`);
    });
    
    console.log(`\n⏱️  总耗时：${totalDuration}秒`);
    console.log(`📁 报告：${reportFile}\n`);
    
    // 退出码
    process.exit(workflowSuccess ? 0 : 1);
}

// 运行
main().catch(error => {
    log(`工作流异常：${error.message}`, 'FATAL', 'WORKFLOW');
    console.error('Fatal error:', error);
    process.exit(1);
});

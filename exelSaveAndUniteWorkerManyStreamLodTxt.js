const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const puppeteer = require('puppeteer-core');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const request = require("request-promise");
const xlsx = require('node-xlsx').default;
const path = require('path');

// Configuration
const CONFIG = {
    IMG_DIR: 'imging2',
    XLSX_DIR: 'xlsx',
    LOGS_DIR: 'logs',
    FINAL_XLSX: 'final_products.xlsx',
    MAX_PAGES_PER_WORKER: 3,
    PAGE_NAVIGATION_TIMEOUT: 30000,
    REQUEST_TIMEOUT: 15000,
    MAX_RETRIES: 3
};

// URLs to scrape
const TARGET_URLS = [
    'https://gluvexlab.com/catalog/analizatory-vlagnosti/',
    'https://gluvexlab.com/catalog/analizatory-stepeni-belizny/',
    // ... остальные URL
];

// Initialize directories
async function initDirs() {
    await Promise.all([
        fs.mkdir(CONFIG.IMG_DIR, { recursive: true }),
        fs.mkdir(CONFIG.XLSX_DIR, { recursive: true }),
        fs.mkdir(CONFIG.LOGS_DIR, { recursive: true })
    ]);
}

// Chrome executable paths
const CHROME_PATHS = [
    // ... пути к Chrome
];

async function findChromePath() {
    // ... существующая реализация
}

async function downloadImage(url, filename) {
    // ... существующая реализация
}

async function parseProductPage(page) {
    // ... существующая реализация
}

async function saveToExcel(data, workerId, fileName = `products_${workerId}_${Date.now()}`) {
    try {
        const filePath = path.join(CONFIG.XLSX_DIR, `${fileName}.xlsx`);
        const buffer = xlsx.build([{
            name: 'Products',
            data: [
                ['Title', 'Article', 'Brand', 'Country', 'Image', 'Price', 'Category'],
                ...data.map(p => [p.title, p.article, p.brand, p.country, p.image, p.price, p.category])
            ]
        }]);
        await fs.writeFile(filePath, buffer);
        return filePath;
    } catch (err) {
        console.error('Error saving Excel:', err);
        return null;
    }
}

async function mergeExcelFiles() {
    try {
        const files = await fs.readdir(CONFIG.XLSX_DIR);
        const xlsxFiles = files.filter(f => f.endsWith('.xlsx') && f !== CONFIG.FINAL_XLSX);

        if (xlsxFiles.length === 0) {
            console.log('No Excel files to merge');
            return;
        }

        console.log(`Merging ${xlsxFiles.length} Excel files...`);

        // Читаем все файлы
        const worksheets = [];
        for (const file of xlsxFiles) {
            const filePath = path.join(CONFIG.XLSX_DIR, file);
            const workSheets = xlsx.parse(filePath);

            if (workSheets.length > 0 && workSheets[0].data.length > 1) {
                // Берем данные без заголовков (первая строка)
                worksheets.push(...workSheets[0].data.slice(1));
            }
        }

        if (worksheets.length === 0) {
            console.log('No data to merge');
            return;
        }

        // Создаем финальный файл с заголовками
        const finalData = [
            ['Title', 'Article', 'Brand', 'Country', 'Image', 'Price', 'Category'],
            ...worksheets
        ];

        const buffer = xlsx.build([{
            name: 'Products',
            data: finalData
        }]);

        const finalPath = path.join(CONFIG.XLSX_DIR, CONFIG.FINAL_XLSX);
        await fs.writeFile(finalPath, buffer);

        console.log(`Successfully merged data into ${finalPath}`);

        // Удаляем временные файлы (опционально)
        for (const file of xlsxFiles) {
            await fs.unlink(path.join(CONFIG.XLSX_DIR, file));
        }
        console.log(`Removed ${xlsxFiles.length} temporary files`);
    } catch (err) {
        console.error('Error merging Excel files:', err);
    }
}

async function log(workerId, message) {
    // ... существующая реализация
}

async function scrapePage(page, url) {
    // ... существующая реализация
}

async function workerTask() {
    await initDirs();
    const workerId = process.pid;
    const chromePath = await findChromePath();

    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
        ]
    });

    process.on('message', async ({ type, url }) => {
        if (type === 'new-url') {
            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 800 });

            try {
                await log(workerId, `Starting to process: ${url}`);
                await scrapePage(page, url);
            } catch (err) {
                await log(workerId, `Error processing ${url}: ${err.message}`);
            } finally {
                await page.close();
                process.send({ type: 'ready' });
            }
        }
    });

    process.send({ type: 'ready' });
}

// Cluster management
if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running with ${numCPUs} CPUs`);
    let currentIndex = 0;
    let completedWorkers = 0;
    const totalUrls = TARGET_URLS.length;

    // Initialize workers
    const workers = Array(Math.min(numCPUs, 4)).fill().map(() => {
        const worker = cluster.fork();

        worker.on('message', ({ type }) => {
            if (type === 'ready') {
                if (currentIndex < totalUrls) {
                    worker.send({
                        type: 'new-url',
                        url: TARGET_URLS[currentIndex++]
                    });
                } else {
                    completedWorkers++;
                    // Все URL обработаны, можно начинать объединение
                    if (completedWorkers === workers.length) {
                        console.log('All workers completed their tasks. Merging Excel files...');
                        mergeExcelFiles().then(() => {
                            console.log('Merging completed. Exiting...');
                            process.exit(0);
                        });
                    }
                }
            }
        });
        return worker;
    });

    cluster.on('exit', (worker) => {
        console.log(`Worker ${worker.process.pid} died - restarting`);
        const newWorker = cluster.fork();
        newWorker.on('message', ({ type }) => {
            if (type === 'ready' && currentIndex < totalUrls) {
                newWorker.send({
                    type: 'new-url',
                    url: TARGET_URLS[currentIndex++]
                });
            }
        });
    });

} else {
    workerTask().catch(err => {
        console.error('Worker fatal error:', err);
        process.exit(1);
    });
}
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const puppeteer = require('puppeteer-core');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const fs2 = require('fs-extra');
const moment = require('moment');





// const request = require("request-promise");

const tr = require('tor-request');
const request = require("request-promise");

// Конфигурация Tor
tr.TorControlPort.password = '';
const xlsx = require('node-xlsx');


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

console.log('go');
// URLs to scrape
// const TARGET_URLS = [
//     'https://gluvexlab.com/catalog/kolby',
//     'https://gluvexlab.com/catalog/raskhodnye_materialy/',
// ];
// const TARGET_URLS = [
//     'https://gluvexlab.com/catalog/kolby','https://gluvexlab.com/catalog/raskhodnye_materialy/','https://gluvexlab.com/catalog/laboratornye-vesy/','https://gluvexlab.com/catalog/butylki-laboratornye/'
// ];
const TARGET_URLS=['https://gluvexlab.com/catalog/kolonki-dlya-gkh/','https://gluvexlab.com/catalog/kolonki-dlya-vezhkh/'];
// const TARGET_URLS=['https://gluvexlab.com/catalog/ionnye-chromatografy/','https://gluvexlab.com/catalog/instrumentalnaya-tonkosloynaya-chromatografiya/','https://gluvexlab.com/catalog/okhlazhdayushchie_kamery_ips/','https://gluvexlab.com/catalog/okhdazhdayushchie_inkubatory_na_osnove_effekta_pelte_ipp/','https://gluvexlab.com/catalog/kompressornye_okhlazhdayushchie_inkubatory_icp/','https://gluvexlab.com/catalog/inkubatory_serii_i/','https://gluvexlab.com/catalog/co2_inkubator_ico/','https://gluvexlab.com/catalog/ik-fure-spektrometry/','https://gluvexlab.com/catalog/moduli-nasosov-dlya-vegch/','https://gluvexlab.com/catalog/moduli-detektorov-dlya-vegch/','https://gluvexlab.com/catalog/moduli-termostatov-dlya-vegch/','https://gluvexlab.com/catalog/moduli-avtosamplerov-dlya-vegch/','https://gluvexlab.com/catalog/zhidkostnye_khromatografy/'];
// let TARGET_URLS=['https://gluvexlab.com/catalog/ionnye-chromatografy/','https://gluvexlab.com/catalog/instrumentalnaya-tonkosloynaya-chromatografiya/','https://gluvexlab.com/catalog/okhlazhdayushchie_kamery_ips/','https://gluvexlab.com/catalog/okhdazhdayushchie_inkubatory_na_osnove_effekta_pelte_ipp/','https://gluvexlab.com/catalog/kompressornye_okhlazhdayushchie_inkubatory_icp/','https://gluvexlab.com/catalog/inkubatory_serii_i/','https://gluvexlab.com/catalog/co2_inkubator_ico/','https://gluvexlab.com/catalog/ik-fure-spektrometry/','https://gluvexlab.com/catalog/moduli-nasosov-dlya-vegch/','https://gluvexlab.com/catalog/moduli-detektorov-dlya-vegch/','https://gluvexlab.com/catalog/moduli-termostatov-dlya-vegch/','https://gluvexlab.com/catalog/moduli-avtosamplerov-dlya-vegch/','https://gluvexlab.com/catalog/zhidkostnye_khromatografy/']
// const TARGET_URLS = ['https://gluvexlab.com/catalog/analizatory-vlagnosti/','https://gluvexlab.com/catalog/analizatory-stepeni-belizny/','https://gluvexlab.com/catalog/atomno_absorbtsionnye_spektrofotometry/','https://gluvexlab.com/catalog/vodyanye_bani/','https://gluvexlab.com/catalog/maslyanye_bani/','https://gluvexlab.com/catalog/vakuumnye-kontrollery/','https://gluvexlab.com/catalog/vakuumnye-otkachnye-sistemy/','https://gluvexlab.com/catalog/vesovoe-oborudovanie/','https://gluvexlab.com/catalog/analiticheskie-vesy/','https://gluvexlab.com/catalog/vesy-dlya-kalibrovki-pipetok/','https://gluvexlab.com/catalog/precizionnye-vesy/','https://gluvexlab.com/catalog/laboratorno-promyshlennye/'];
// Initialize directories
// Обновляем функцию инициализации директорий
async function initDirs() {
    await Promise.all([
        fs.mkdir(CONFIG.IMG_DIR, { recursive: true }),
        fs.mkdir(CONFIG.XLSX_DIR, { recursive: true }),
        fs.mkdir(CONFIG.LOGS_DIR, { recursive: true })
    ]);
}


// Chrome executable paths
const CHROME_PATHS = [
    // Windows
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    // Mac
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
];

async function findChromePath() {
    for (const p of CHROME_PATHS) {
        try {
            await fs.access(p);
            return p;
        } catch (e) {
            continue;
        }
    }
    throw new Error('Chrome not found. Install Chrome or specify path manually');
}

async function downloadImage(url, filename) {
    for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
        try {
            const response = await request({
                url,
                encoding: null,
                resolveWithFullResponse: true,
                timeout: CONFIG.REQUEST_TIMEOUT
            });

            await fs.writeFile(path.join(CONFIG.IMG_DIR, filename), response.body);
            return true;
        } catch (err) {
            if (attempt === CONFIG.MAX_RETRIES) {
                console.error(`Failed to download ${url} after ${CONFIG.MAX_RETRIES} attempts`);
                return false;
            }
            await new Promise(r => setTimeout(r, 1000 * attempt));
        }
    }
}

async function parseProductPage(page) {
    const content = await page.content();
    const $ = cheerio.load(content);

    const extractText = (selector) => $(selector).text().trim();
    const extractAttribute = (label) => {
        const element = $(`.uk-section .uk-margin-xsmall:contains('${label}')`);
        return element.length ? element.text().replace(label, '').trim() : '';
    };

    const title = extractText(".fw-title h1");
    const price = extractText(".product-page__price-block");
    const description = extractText(".fw-tab-content.active");
    const category = $(".uk-breadcrumb li").last().text().trim();
    const contentshort = $(".product__shortdesc").text();

    const atributesall = $(`.uk-section .uk-margin-xsmall`).text().trim();

    const article = extractAttribute('Артикул:');
    const brand = extractAttribute('Бренд:');
    const country = extractAttribute('Страна производства:');

    // Image handling
    let imageName = 'no_image.png';
    const imgSrc = $(".uk-section .product-page__img img").attr('src');
    if (imgSrc) {
        const ext = '.png';
        imageName = `${title.replace(/[^\w]/g, '')}_${Date.now()}${ext}`;
        await downloadImage(`https://gluvexlab.com${imgSrc}`, imageName);
    }

    return {
        title,
        article,
        brand,
        country,
        image: imageName,
        description,
        contentshort,
        price,
        atributesall,
        category
    };
}
// async function saveToExcel(data, workerId, fileName = `products_${workerId}_${Date.now()}`) {
//     try {
//         const filePath = path.join(CONFIG.XLSX_DIR, `${fileName}.xlsx`);
//         const buffer = xlsx.build([{
//             name: 'Products',
//             data: [
//                 ['Title', 'Article', 'Brand', 'Country', 'Image','Description','Contentshort', 'Price', 'Category'],
//                 ...data.map(p => [p.title, p.article, p.brand, p.country, p.image, p.description, p.contentshort, p.price, p.category])
//             ]
//         }]);
//         await fs.writeFile(filePath, buffer);
//         return filePath;
//     } catch (err) {
//         console.error('Error saving Excel:', err);
//         return null;
//     }
// }

async function saveToExcel(data, workerId, fileName = `products_${workerId}}`) {
    try {

        const headers = [
            'Название',
            'Артикул',
            'Бренд',
            'Страна производства',
            'Изображение',
            'Описание',
            'Краткое описание',
            'Цена',
            'Все атрибуты',
            'Категория'
        ];


        // 2. Преобразуем массив объектов в массив массивов
        const rows = data.map(product => [
            product.title || '',
            product.article || '',
            product.brand || '',
            product.country || '',
            product.image || '',
            product.description || '',
            product.contentshort || '',
            product.price || '',
            product.atributesall || '', // Характеристики (можно заполнить позже)
            product.category || ''
        ]);



        const filePath = path.join('xlsx', `${fileName}.xlsx`);

        let workSheets = [];

        // If file exists, read it, otherwise create new with headers
        if (fs2.existsSync(filePath)) {
            workSheets = xlsx.parse(fs2.readFileSync(filePath));
            // console.log(workSheets)

            if (workSheets.length === 0) {
                // workSheets.push( headers );
                workSheets.push({ name: 'Products', data: [headers] });

                // console.log(workSheets)
            }

        } else {
            workSheets.push({ name: 'Products', data: [headers] });
            // console.log(workSheets)

            // console.log(workSheets);
        }

        workSheets[0].data.push(...rows);
        let klenghta=workSheets[0].data.length;
        await log(workerId, `Добавил уже в ${workerId}=:= ${klenghta} время текущее${moment().format("dddd, MMMM Do YYYY, h:mm:ss a")} `);

        console.log(`количество добавленных в ${workerId}=${klenghta} время ${moment().format("dddd, MMMM Do YYYY, h:mm:ss a")} ` );





        // workSheets.push( ...rows );
        //
        //
        const buffer = xlsx.build(workSheets);

        await fs2.writeFileSync(filePath, buffer); // ✅ Buffer, а не массив
        console.log(`Файл сохранён: ${filePath}`);
        return filePath;



    } catch (error) {
        console.error('Error writing to Excel file:', error);
        throw error; // Re-throw to handle in calling function
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
            ['Title', 'Article', 'Brand', 'Country', 'Image', 'Description', 'Contentshort', 'Price', 'Category'],
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
        // for (const file of xlsxFiles) {
        //     await fs.unlink(path.join(CONFIG.XLSX_DIR, file));
        // }
        console.log(`not self Removed ${xlsxFiles.length} temporary files`);
    } catch (err) {
        console.error('Error merging Excel files:', err);
    }
}

async function log(workerId, message) {
    try {
        const logFile = path.join(CONFIG.LOGS_DIR, `worker_${workerId}.log`);
        await fs.appendFile(logFile, `[${new Date().toISOString()}] ${message}\n`);
    } catch (err) {
        console.error('Logging failed:', err);
    }
}

async function scrapePage(page, url) {
    const workerId = process.pid;
    let allProducts = [];
    let pageNum = 1;
    let currentUrl = url;
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 3;

    // Создаем клиент CDP для управления браузером
    const client = await page.target().createCDPSession();

    await log(workerId, `Starting scraping category: ${url}`);

    while (true) {
        let pageProducts = [];

        try {
            await log(workerId, `Processing page ${pageNum}: ${currentUrl}`);

            // Очистка кеша каждые 3 страницы
            if (pageNum % 7 === 0) {
                await client.send('Network.clearBrowserCache');
                await log(workerId, `Cleared browser cache after page ${pageNum}`);
            }

            // Задержка 1 минута после каждой 5-й страницы
            if (pageNum > 1 && pageNum % 7 === 0) {
                await log(workerId, `Processed 7 pages, waiting for 2 minute...`);
                await new Promise(r => setTimeout(r, 120000)); // 2 минута задержки
                await log(workerId, `Resuming after delay`);
            }

            // Переход на страницу с таймаутом
            await page.goto(currentUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });

            // Ожидание загрузки продуктов
            try {
                await page.waitForSelector('.product-items', {
                    timeout: 20000,
                    visible: true
                });
            } catch (err) {
                await log(workerId, `Retrying page load for ${currentUrl}`);
                await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
            }

            // Получение ссылок на продукты
            const productLinks = await page.$$eval(
                '.product-items .fw-product-card__img a',
                links => links.map(link => link.href)
            );

            await log(workerId, `Found ${productLinks.length} products on page ${pageNum}`);

            // Парсинг каждого продукта
            for (const link of productLinks) {
                try {
                    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                        await log(workerId, `Too many consecutive errors (${consecutiveErrors}), skipping product ${link}`);
                        continue;
                    }

                    await page.goto(link, {
                        waitUntil: 'domcontentloaded',
                        timeout: 40000
                    });

                    // Повторные попытки загрузки страницы продукта
                    let retries = 3;
                    while (retries > 0) {
                        try {
                            await page.waitForSelector('.fw-title h1', {
                                timeout: 15000,
                                visible: true
                            });
                            break;
                        } catch (err) {
                            retries--;
                            if (retries === 0) throw err;
                            await page.reload({ waitUntil: 'domcontentloaded', timeout: 40000 });
                        }
                    }

                    const productData = await parseProductPage(page);
                    if (productData) {
                        pageProducts.push(productData);
                        consecutiveErrors = 0;
                    }

                    await new Promise(r => setTimeout(r, 1500));

                } catch (err) {
                    consecutiveErrors++;
                    await log(workerId, `Error (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}) on product ${link}: ${err.message}`);
                    await page.goto('about:blank');
                    await new Promise(r => setTimeout(r, 3000));
                }
            }

            // Сохранение данных текущей страницы в TXT
            if (pageProducts.length > 0) {
                // const excelFileName = `worker_${workerId}_page_${pageNum}`;
                const excelFileName = `worker_${workerId}`;

                try {
                    await saveToExcel(pageProducts, workerId, excelFileName);
                    await log(workerId, `Saved ${pageProducts.length} products from page ${pageNum} to ${excelFileName}.xlsx`);
                } catch (err) {
                    await log(workerId, `Failed to save Excel for page ${pageNum}: ${err.message}`);
                }
            }

            // Обработка пагинации
            try {
                await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                const nextButton = await page.$('li.page.next:not(.d-none) > a');

                if (!nextButton) {
                    await log(workerId, `No more pages found. Finished at page ${pageNum}`);
                    break;
                }

                const nextPageUrl = await page.evaluate(btn => btn.href, nextButton);

                try {
                    await Promise.all([
                        nextButton.click(),
                        page.waitForNavigation({
                            waitUntil: 'domcontentloaded',
                            timeout: 60000
                        })
                    ]);
                } catch {
                    await page.goto(nextPageUrl, {
                        waitUntil: 'domcontentloaded',
                        timeout: 60000
                    });
                }

                await page.waitForSelector('.product-items', { timeout: 20000 });
                currentUrl = page.url();
                pageNum++;

                // Стандартная задержка между страницами
                const paginationDelay = pageNum > 5 ? 5000 : 2000;
                await new Promise(r => setTimeout(r, paginationDelay));

            } catch (err) {
                await log(workerId, `Pagination error: ${err.message}`);
                break;
            }

        } catch (err) {
            await log(workerId, `Page processing error: ${err.message}`);
            break;
        }
    }

    // Закрываем клиент CDP
    await client.detach();
    await log(workerId, `Completed. Total products: ${allProducts.length}`);
}



// Обновляем workerTask для использования TXT
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
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs-extra');

console.log('получим все ссылки и запишем в файл');
let scrape = async () => {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox']
    });
    const page = await browser.newPage();
    const pageURL = 'https://www.desta-lab.ru/category/laboratornoe-oborudovanie/';

    try {
        await page.goto(pageURL);
        await page.setViewport({ width: 1500, height: 1076 });
        console.log(`Открываю страницу: ${pageURL}`);
    } catch (error) {
        console.log(`Не удалось открыть страницу: ${pageURL} из-за ошибки: ${error}`);
    }

    console.log(`получаю ссылки всех категорий на главной каталога...`);
    const postsSelector = '.layout-center .subcat-wrapper__item_sec a';
    await page.waitForSelector(postsSelector, {timeout: 0});

    // Получаем массив ссылок
    let postUrls = await page.$$eval(
        postsSelector, postLinks => postLinks.map(link => link.href)
    );

    console.log(postUrls);
    console.log(`получил ссылки!`);

    // Преобразуем массив в строку (каждая ссылка на новой строке)
    const urlsText = postUrls.join('\"\,\"');
    // const urlsText = postUrls;

    // Создаем директорию, если ее нет
    await fs.ensureDir('txt');

    // Записываем данные в файл
    try {
        await fs.writeFile('txt/testFile.txt', urlsText);
        console.log('Данные успешно записаны в файл!');
    } catch (err) {
        console.error('Ошибка при записи в файл:', err);
    }

    browser.close();
    return 'end';
}

scrape().then((value) => {
    console.log(value);
}).catch(err => {
    console.error('Ошибка в scrape:', err);
});
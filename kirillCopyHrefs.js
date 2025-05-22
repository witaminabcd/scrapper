const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const request = require("request");
const mysql = require("mysql2");
const xlsx = require('node-xlsx').default;

console.log('получим все ссылки и запишем в файл');
let scrape = (async () => {
    const browser = await puppeteer.launch({
            args: ['--no-sandbox']
        }
    );
    // const browser = await puppeteer.launch({headless: false});

    // Откроем новую страницу
    const page = await browser.newPage();
    const pageURL = 'https://gluvexlab.com/catalog/';
    // const pageURL = url;



    const content = await page.content();
    const $ = cheerio.load(content);

    try {
        // Попробуем перейти по URL
        await page.goto(pageURL);

        console.log(`Открываю страницу: ${pageURL}`);
        // сделать 90
        // await page.click('body > section.product-category-page.uk-section.fw-first-section > div > div > div > noindex > div.sort-view-bar.fw-sort-view-bar.uk-grid > div.fw-limit > a:nth-child(4)');

    } catch (error) {
        console.log(`Не удалось открыть страницу: ${pageURL} из-за ошибки: ${error}`);
    }  // Найдём все ссылки на статьи


    // .letter-group__link
    console.log(`получаю ссылки всех категорий на главной каталога...`);
    const postsSelector = '.category-columns a';
    await page.waitForSelector(postsSelector, {timeout: 0});
    let postUrls = await page.$$eval(
        postsSelector, postLinks => postLinks.map(link => "'"+link.href+"'")
    );
    let postUrlsFrom='';
    // postUrlsFrom=['https://gluvexlab.com/catalog/butylki-laboratornye?page=3'];
    // postUrlsFrom=['https://gluvexlab.com/catalog/avtoklavy-1/','https://gluvexlab.com/catalog/probopodgotovka/','https://gluvexlab.com/catalog/avtomaticheskie_sistemy_dozirovaniya/','https://gluvexlab.com/catalog/avtosamplery/','https://gluvexlab.com/catalog/alyuminievye-chashki/']

    // postUrlsFrom=['https://gluvexlab.com/catalog/butylki-laboratornye/','https://gluvexlab.com/catalog/boksy_biologicheskoy_bezopasnosti/','https://gluvexlab.com/catalog/boksy-dlya-raboty-s-laboratornymi-givotnymi/','https://gluvexlab.com/catalog/byuretki/','https://gluvexlab.com/catalog/vakuumnye-otkachnye-sistemy/']
    // if(postUrlsFrom){
    //     postUrls=postUrlsFrom;
    // }

    console.log(postUrls);
    console.log(`получил ссылки!`);
    let numberLoop=0;
    let numberLoopPage=1;
    console.log('пробую записать данные в таблицу таблищу ссылок'+".xlsx");
    console.log(postUrls);
    fs.open('txt/testFile.txt', 'w', (err) => {
        if(err) throw err;
        console.log('File created');
    });
    fs.appendFile('txt/testFile.txt', postUrls, (err) => {
        if(err) throw err;
        console.log('Data has been added!');
    });
    // const buffer = xlsx.build([{ name: 'Sheet1', data: [postUrls] }]);
    // await fs.writeFileSync("xlsls/hrefscollection"+'.xlsx', buffer, 'binary');
    console.log('пробую записать данные в таблищу ссылок вышло нет')

    // for (let postUrl of postUrls) {
    //     try {
    //         numberLoop++;
    //         await page.goto(postUrl);
    //         console.log('Открываю страницу из каталога:', postUrl,'---проход-',numberLoop);
    //         await  scrapeTestLoop(page,postUrl,numberLoop,numberLoopPage);
    //     } catch (error) {
    //         console.log(error);
    //         console.log('Не удалось открыть страницу: ', postUrl);
    //     }
    // }
    browser.close();
    let titles='end';
    return titles;
})

scrape().then((value) => {
    console.log(value);

});
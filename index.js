const puppeteer = require('puppeteer');
const converter = require('json-2-csv');
const fs = require('fs');
 
 
exports.handler =  (async () => {
  try {
    console.log("Opening the browser......");
    
    var url = 'https://www.amazon.com.mx/s?k=Ego&i=beauty&rh=n%3A11260452011%2Cp_89%3Aego&dc&__mk_es_MX=%C3%85M%C3%85%C5%BD%C3%95%C3%91&qid=1610182576&rnid=11790855011&ref=sr_nr_p_89_1';
    const browser = await puppeteer.launch({
      headless: false,  
      'ignoreHTTPSErrors': true
    });
    const page = await browser.newPage();
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    
    // Wait for the required DOM to be rendered
    await page.waitForSelector('#search'); // #search
    // Get the link to all the required books
    let urls = await page.$$eval('div.s-desktop-width-max.s-desktop-content.sg-row > div.sg-col-16-of-20.sg-col.sg-col-8-of-12.sg-col-12-of-16 > div.sg-col-inner span[data-component-type="s-search-results"] > div.s-main-slot > div.s-result-item.s-asin', links => { // div.s-desktop-width-max.s-desktop-content.sg-row > div.sg-col-16-of-20.sg-col.sg-col-8-of-12.sg-col-12-of-16 > div.sg-col-inner span[data-component-type="s-search-results"] > div.s-main-slot > div.s-result-item.s-asin
      // Extract the links from the data
      links = links.map(el => el.querySelector('span[data-component-type="s-product-image"] > a').href);
      return links;
    });
    
    // Function to open a new page instance and get the relevant data from them
    let pagePromise = (link) => new Promise(async(resolve, reject) => {
      let dataObj = {};
      let newPage = await browser.newPage();
      await newPage.goto(link);
      dataObj['link'] = link;
      dataObj['title'] = await newPage.$eval('span#productTitle', text => text.textContent.trim());
      dataObj['price'] = await newPage.evaluate(() => {
        const price = document.querySelector('span#priceblock_ourprice')
        if (price) {
          return price.innerHTML.trim();
        } else {
          return null;
        }
      });
      dataObj['offer'] = await newPage.evaluate(() => {
        const offer = document.querySelector('#regularprice_savings .priceBlockSavingsString')
        if (offer) {
          return offer.innerHTML.trim();
        } else {
          return null;
        }
      });
      dataObj['image_url'] = await newPage.$eval('div#imgTagWrapperId img', img => img.src);
      dataObj['availability'] = await newPage.evaluate(() => {
        const availability = document.querySelector('div#availability span.a-size-medium.a-color-success')
        if (availability.innerHTML.trim() === 'Disponible.') {
          return availability.innerHTML.trim();
        } else {
          return 'Not Available';
        }
      });
      dataObj['rating'] = await newPage.evaluate(() => {
        const rating = document.querySelector('i.a-icon.a-icon-star span.a-icon-alt')
        if (rating && rating.innerHTML) {
          return rating.innerHTML.trim();
        } else {
          return 0;
        }
      });
      dataObj['reviews'] = await newPage.evaluate(() => 
        Array.from(document.querySelectorAll('div[data-hook="review-collapsed"] span'))
        .map(link => (link.innerHTML.trim()))
      );

      resolve(dataObj);
      await newPage.close();
    });

    let scrapedData = [];
    // Loop through each of those links, and get details with the help of pagePromise
    for(link in urls){
      let currentPageData = await pagePromise(urls[link]);
      scrapedData.push(currentPageData);
//      console.log (currentPageData);
    }
    
    // convert JSON array to CSV string
    converter.json2csv(scrapedData, (err, csv) => {
      if (err) {
        throw err;
      }
      // write CSV to a file
      fs.writeFileSync('amazon.csv', csv);
    }, {
      delimiter:{
        field: ";"
      } 
    });

    await browser.close();
  } catch (err) {
    console.log("Could not create a browser instance => : ", err);
  }
  
})();


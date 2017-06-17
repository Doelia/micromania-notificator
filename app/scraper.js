const cheerio = require('cheerio')

// Get HTML content from an url
// Use casperjs to bypass anti-bot security
const url_get_content = url => new Promise((r, e) => {
    console.log('get content of url', url, '...');
    url
        ?
        execFile('casperjs', ['./casper.js', '--url=' + url], { maxBuffer: 1024 * 1000 },
            (error, stdout, sterr) => {
                error ? e(error) : r(stdout)
            }
        ) :
        error('No URL')
});

const platform_page = {
    'ps2': 'autres/ps2/jeux-occasion.html',
    'ps3': 'ps3/jeux/occasions.html',
    'ps4': 'ps4/jeux/occasions.html',
    'x360': 'xbox-360/jeux/occasions.html',
    'wii': 'autres/wii/jeux-occasion.html',
    'ds': 'autres/ds/jeux-occasion.html',
    '3ds': '3ds/jeux/occasions.html',
    'psp': 'autres/psp/jeux-occasion.html',
};

const build_url = (platform, page) =>
    'http://www.micromania.fr/' + platform_page[platform] + '?dir=desc&order=price&p=' + page;

// Moke HTML content of http://www.micromania.fr/autres/wii/jeux-occasion.html?dir=desc&order=price&p=1
const moke_html = (platform, page) => new Promise(r =>
    fs.readFile('./moke_360.html', 'utf8', (err, data) => r(data))
);

// Build array of games items from DOM document
const extract_items_from_document = $ => {
    let tab = [];
    $('.item').each(function() {
        tab.push({
            'price': $(this).find('.price').html(),
            'name': $(this).find('.product-name a').html(),
            'link': $(this).find('.product-name a').attr('href'),
            'image': $(this).find('.product-image img').attr('src'),
        });
    });
    return tab;
};

const get_max_page = (platform) => Promise.resolve()
    .then(() => build_url(platform, 100))
    .then(url_get_content)
    .then(cheerio.load)
    .then($ => {
        return $('.pages li.current').html();
    })


// Build and return array of items on the desired platform of the page
const get_items_on_page = (platform, page) => Promise.resolve()
    .then(() => build_url(platform, page))
    //	.then(moke_html)
    .then(url_get_content)
    .then(cheerio.load)
    .then(extract_items_from_document)

// Return all items from a platform, in looping on pages from 1 to max_page
module.export.get_items = (platform, max_page) => {
    let full_items = [];
    let previous = Promise.resolve();
    for (let page = 1; page <= max_page; page++) {
        // Execute one by one
        previous = (new Promise(r => {
            previous.then(() => {
                r(get_items_on_page(platform, page));
            });
        }));
        full_items.push(previous);
    }
    return Promise.all(full_items)
        .then(tab => tab.reduce((p, c) => [...p, ...c], []))
};
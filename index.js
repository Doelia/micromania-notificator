const cheerio = require('cheerio')
const $ = require('jquery');
const execFile = require('child_process').execFile;
const fs = require('fs');

const NB_PAGE = 3;
const PLATFORM = 'wii';

const get_content = url => new Promise((r, e) =>
	url
	? execFile('casperjs', ['./casper.js', '--url=' + url], {maxBuffer: 1024 * 1000}, (error, stdout, sterr) => {
		error ? e(error) : r(stdout)
	})
	: error('No URL')
);

const build_url = (platform, page) => 'http://www.micromania.fr/autres/' + platform + '/jeux-occasion.html?dir=desc&order=price&p=' + page;

const moke = (platform, page) => new Promise((r,err) =>
	fs.readFile('./moke.html', 'utf8', (err,data) => r(data))
);

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

const get_items_on_page = (platform, page) => Promise.resolve()
	.then(() => build_url(platform, page))
//	.then(moke)
	.then(get_content)
	.then(cheerio.load)
	.then(extract_items_from_document)

const get_items = (platform, max_page) => {
	let full_items = [];
	for (let page = 0; page < max_page; page++) {
		full_items.push(get_items_on_page(platform, page));
	}
	return Promise.all(full_items)
		.then(tab => tab.reduce((p,c) => [...p, ...c], []))
}

const store_infile = (json) => fs.writeFile('./last_storage.json', JSON.stringify(json, null, 4), 'utf8', () => {});

const compare_list_items = (l1, l2) => {

}

const last_list_stored = platform => {

}

get_items(PLATFORM, NB_PAGE)
	.then(store_infile)
	.then(console.log)


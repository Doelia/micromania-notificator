const cheerio = require('cheerio')
const $ = require('jquery');
const execFile = require('child_process').execFile;
const fs = require('fs');
const Db = require('tingodb')().Db,
    	assert = require('assert');

var db = new Db('./db/', {});

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

const moke_html = (platform, page) => new Promise((r,err) =>
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
	.then(moke_html)
//	.then(get_content)
	.then(cheerio.load)
	.then(extract_items_from_document)

const get_items = (platform, max_page) => {
	let full_items = [];
	for (let page = 0; page < max_page; page++) {
		full_items.push(get_items_on_page(platform, page));
	}
	return Promise.all(full_items)
		.then(tab => tab.reduce((p,c) => [...p, ...c], []))
};

const store_infile = (filename, json) =>
	fs.writeFile(filename, JSON.stringify(json, null, 4), 'utf8', () => {});


const platform_db = (platform) => { 

	let collection = db.collection(platform);
	
	return {

	store_indb: (list, timestamp) =>
		list.forEach(v => collection.insert({ v, timestamp}))
	,

	get_lasttimestamp: () => new Promise(r =>
		collection
		.find({})
		.sort({timestamp: -1})
		.limit(1)
		.toArray((err, item) => r(item[0].timestamp))
	),

	get_items_fromtimestamp: (timestamp) => new Promise((r,e) =>
		collection
		.find({'timestamp': timestamp})
		.toArray((err, items) => r(items.map(v => v.v)))
	),

	get_previous_timestamp: (timestamp) => new Promise(r =>
		collection
		.find({'timestamp': { $lt: timestamp}})
		.sort({timestamp: -1})
		.limit(1)
		.toArray((err, item) => r(item ? item[0].timestamp : 0))
	),

}}


function go_store()
{
	get_items(PLATFORM, NB_PAGE)
	.then(json => store_indb(PLATFORM, json, + new Date()))
	//.then(json => store_infile(build_filename(PLATFORM), json))
	//.then(console.log)
}

//go_store();
//

let p_db = platform_db('wii');
let curent_items = [];
let previous_items = [];
p_db
	.get_lasttimestamp()
	.then(timestamp => p_db.get_items_fromtimestamp(timestamp)
		.then(v => {
			curent_items = v;
			return timestamp;
		})
	)
	.then(p_db.get_previous_timestamp)
	.then(timestamp => p_db.get_items_fromtimestamp(timestamp)
		.then(v => {
			previous_items = v;
			return timestamp;
		})
	)
	.then(() => { return {curent_items, previous_items}})
	.then(console.log)




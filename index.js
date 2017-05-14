const cheerio = require('cheerio')
const $ = require('jquery');
const execFile = require('child_process').execFile;
const fs = require('fs');
const Db = require('tingodb')().Db;
const assert = require('assert');

var db = new Db('./db/', {});

const NB_PAGE = 3;
const PLATFORM = 'wii';

// Get HTML content from an url
// Use casperjs to bypass anti-bot security
const url_get_content = url => new Promise((r, e) =>
	url
	? execFile('casperjs', ['./casper.js', '--url=' + url], {maxBuffer: 1024 * 1000}, (error, stdout, sterr) => {
		error ? e(error) : r(stdout)
	})
	: error('No URL')
);

const build_url = (platform, page) => 'http://www.micromania.fr/autres/' + platform + '/jeux-occasion.html?dir=desc&order=price&p=' + page;

// Moke HTML content of http://www.micromania.fr/autres/wii/jeux-occasion.html?dir=desc&order=price&p=1
const moke_html = (platform, page) => new Promise((r,err) =>
	fs.readFile('./moke.html', 'utf8', (err,data) => r(data))
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

// Build and return array of items on the desired platform of the page
const get_items_on_page = (platform, page) => Promise.resolve()
	.then(() => build_url(platform, page))
	.then(moke_html)
//	.then(url_get_content)
	.then(cheerio.load)
	.then(extract_items_from_document)

// Return all items from a platform, in looping on pages from 1 to max_page
const get_items = (platform, max_page) => {
	let full_items = [];
	for (let page = 0; page < max_page; page++) {
		full_items.push(get_items_on_page(platform, page));
	}
	return Promise.all(full_items)
		.then(tab => tab.reduce((p,c) => [...p, ...c], []))
};

// Store array of itemes in a JSON File
// Use for debug / making moke file
const store_infile = (filename, json) =>
	fs.writeFile(filename, JSON.stringify(json, null, 4), 'utf8', () => {});

// DB Manager for a platform
const platform_db = (platform) => { 

	let collection = db.collection(platform);
	
	return {

    // Store in persitant DB an array of items.
	// Give a timestamp to archive it
	store_indb: (items, timestamp) =>
		items.forEach(v => collection.insert({ v, timestamp}))
	,

	// Return last timestamp where items are pushed
	get_lasttimestamp: () => new Promise(r =>
		collection
		.find({})
		.sort({timestamp: -1})
		.limit(1)
		.toArray((err, item) => r(item[0].timestamp))
	),

	// Return array of items stored on a timestamp
	get_items_fromtimestamp: (timestamp) => new Promise((r,e) =>
		collection
		.find({'timestamp': timestamp})
		.toArray((err, items) => r(items.map(v => v.v)))
	),

	// Return the previous timestamp before an another timestamp
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

let p_db = platform_db(PLATFORM);
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




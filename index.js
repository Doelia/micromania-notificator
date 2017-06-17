const cheerio = require('cheerio')
const execFile = require('child_process').execFile;
const fs = require('fs');
var mongoose = require('mongoose');
const assert = require('assert');
const express = require('express');
const push = require('pushover-notifications');
var nconf = require('nconf');

var app = express()
app.set('view engine', 'ejs');

// nconf
nconf.argv()
    .env()
    .file({ file: 'config.json' });

nconf.defaults({
    'PORT': 8080,
    'WEB_URL': 'http://localhost:' + nconf.get('PORT') + '/',
});

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
    'wii': 'autres/wii/jeux-occasion.html',
    'ps4': 'ps4/jeux/occasions.html',
    'ps2': 'autres/ps2/jeux-occasion.html',
    'x360': 'xbox-360/jeux/occasions.html',
    'ps3': 'ps3/jeux/occasions.html',
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
const get_items = (platform, max_page) => {
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

// Store array of itemes in a JSON File
// Use for debug / making moke file
const store_infile = (filename, json) =>
    fs.writeFile(filename, JSON.stringify(json, null, 4), 'utf8', () => {});

// DB Manager for a platform
const platform_db = (platform) => {

    let db = mongoose.connect(nconf.get('MONGODB'));
    let collection = db.connection.collection(platform);

    return {

        // Store in persitant DB an array of items.
        // Give a timestamp to archive it
        // TODO return promise with json insert
        store_indb: (items, timestamp) =>
            items.forEach(v => collection.insert({ v, timestamp })),

        // Return last timestamp where items are pushed
        get_lasttimestamp: () => new Promise(r =>
            collection
            .find({})
            .sort({ timestamp: -1 })
            .limit(1)
            .toArray((err, item) => r((item && item[0] && item[0].timestamp) ? item[0].timestamp : 0))
        ),

        // Return array of items stored on a timestamp
        get_items_fromtimestamp: (timestamp) => new Promise((r, e) =>
            collection
            .find({ 'timestamp': timestamp })
            .toArray((err, items) => r(items.map(v => v.v)))
        ),

        // Return the previous timestamp before an another timestamp
        get_previous_timestamp: (timestamp) => new Promise(r =>
            collection
            .find({ 'timestamp': { $lt: timestamp } })
            .sort({ timestamp: -1 })
            .limit(1)
            .toArray((err, item) => r((item && item[0] && item[0].timestamp) ? item[0].timestamp : 0))
        ),

    }
}

// Return all items added in new_items from old_items
const get_added = (old_items, new_items) =>
    new_items.filter(v => !old_items
        .map(o => o.name)
        .some(o => o == v.name)
    )

// Return all items deleted in new_items from old_items
const get_deleted = (old_items, new_items) =>
    old_items.filter(v => !new_items
        .map(o => o.name)
        .some(o => o == v.name)
    )

// Return items added at timestamp
const get_diff = (p_db, timestamp) => {

    let last_ts;
    let previous_ts;
    let new_items = [];
    let old_items = [];

    return p_db.get_items_fromtimestamp(timestamp)
        .then(v => {
            last_ts = timestamp;
            new_items = v;
            return timestamp;
        })
        .then(p_db.get_previous_timestamp)
        .then(timestamp => p_db.get_items_fromtimestamp(timestamp)
            .then(v => {
                previous_ts = timestamp;
                old_items = v;
                return timestamp;
            })
        )
        .then(() => {
            return {
                'timestamp': last_ts,
                'previous_timestamp': previous_ts,
                'added': get_added(old_items, new_items),
                'deleted': get_deleted(old_items, new_items),
            }
        })
}

// Return all items added for each stored step
const build = (timestamp, p_db) => new Promise(r => {
    console.log('build', timestamp, '...');
    if (!timestamp) return r([]);
    get_diff(p_db, timestamp)
        .then(diff => {
            build(diff.previous_timestamp, p_db).then(
                out => r([diff, ...out])
            )
        });
});

app.get('/games/:platform', function(req, res) {
    let p_db = platform_db(req.params.platform);
    p_db
        .get_lasttimestamp()
        .then(ts => build(ts, p_db))
        .then(list => res.render('games', { "list_diff": list }))
})


const send_push = (platform, new_items) => {

    if (!nconf.get('PUSHOVER_USER_KEY') || !nconf.get('PUSHOVER_TOKEN')) {
        console.warn('No pushover key, skip push notifaction');
        return;
    }

    var p = new push({
        user: nconf.get('PUSHOVER_USER_KEY'),
        token: nconf.get('PUSHOVER_TOKEN'),
    });

    var msg = {
        message: new_items.length + ' jeux sont disponibles sur la platforme ' + platform + ' !!', // required
        title: "Micromania notificator",
        sound: 'magic',
        device: 'devicename',
        priority: 1,
        url: nconf.get('WEB_URL') + 'games/' + platform
    };

    p.send(msg, function(err, result) {
        if (err) {
            throw err;
        }
        console.log(result);
    });
}


function go_scrap() {
    let platform = nconf.get('platform')
    let p_db = platform_db(platform);

    if (!platform || !platform_page[platform]) {
        console.info('Please provite an existing platform with --platform');
        process.exit(0);
    }

    console.info('Start scraping, platform', platform, '. Get nb pages...');

    get_max_page(platform)
        .then(nb_page => {
            console.info(nb_page, 'pages to process...');
            return get_items(platform, nb_page)
        })
        .then(json => p_db.store_indb(json, +new Date()))
        .then(json => store_infile('./last_storage.json', json))
        .then(() => {
            console.info('Done!');
            return p_db.get_lasttimestamp()
        })
        .then(ts => get_diff(p_db, ts))
        .then(diff => {
            console.log('added in platform', platform, ':', diff);
            if (diff.added.length > 0) {
                send_push(platform, diff.added);
            }
        })
}

function go_serve() {
    app.listen(nconf.get('PORT'), () => {
        console.info('App listening on http://localhost:' + nconf.get('PORT'));
    })
}

switch (process.argv[2] || '') {
    case 'serve':
        go_serve();
        break;
    case 'scrap':
        go_scrap();
        break;
    case 'test_push':
        send_push('wii', []);
        break;
    default:
        console.info('npm run scrap')
        console.info('npm run process -- --platform wii')
}
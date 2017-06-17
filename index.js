const execFile = require('child_process').execFile;
const fs = require('fs');
const assert = require('assert');
const push = require('pushover-notifications');
var nconf = require('nconf');

var app = require('./app/server.js');

nconf.argv()
    .env()
    .file({ file: 'config.json' });

nconf.defaults({
    'PORT': 8080,
    'WEB_URL': 'http://localhost:' + nconf.get('PORT') + '/',
});

// Store array of itemes in a JSON File
const store_infile = (filename, json) =>
    fs.writeFile(filename, JSON.stringify(json, null, 4), 'utf8', () => {});


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
        .then(json => {
            p_db.store_indb(json, +new Date());
            return json;
        })
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
        console.info('App listening on ' + nconf.get('WEB_URL'));
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
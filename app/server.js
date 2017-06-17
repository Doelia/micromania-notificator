const express = require('express');

var app = express()
app.set('view engine', 'ejs');

app.get('/games/:platform', function(req, res) {
    let p_db = platform_db(req.params.platform);
    p_db
        .get_lasttimestamp()
        .then(ts => build(ts, p_db))
        .then(list => res.render('games', { "list_diff": list }))
});

module.export = app;
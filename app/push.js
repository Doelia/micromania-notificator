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
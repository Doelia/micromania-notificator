var mongoose = require('mongoose');

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
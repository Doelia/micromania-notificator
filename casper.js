var casper = require('casper').create();
casper.start(casper.cli.get('url'));
casper.then(function() {
    this.echo(this.getHTML());
});
casper.run();

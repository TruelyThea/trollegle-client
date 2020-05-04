(function() {
    let converter = new Converter();
    
    fs.readFile('./DOCUMENTATION.md', 'utf8', (err, data) => {
        if (err) throw err;    
        document.querySelector("#docs-api").innerHTML = converter.makeHtml(data);
    });
})();


(function() {
    document.addEventListener('setIdentifier', function (event) {
        window.identifier = event.detail.identifier;
        console.log('window.identifier definido como: ' + window.identifier);
    });
})();

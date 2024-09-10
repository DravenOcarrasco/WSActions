(function() {
    document.addEventListener('setWsActionConfig', function (event) {
        console.log(event)
        window.WSACTION = {
            config:{}
        }
        window.WSACTION.config = {
            ...event.detail
        }
    });
    document.addEventListener('wsActionReloadPage', function (event) {
        window.location.reload();
    });
})();
(function() {
    document.addEventListener('setIdentifier', function (event) {
        window.identifier = event.detail.identifier;
        console.log('window.identifier definido como: ' + window.identifier);
    });
})();


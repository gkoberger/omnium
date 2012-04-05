var omniumWrapper = function(){
    function randomNum() {
        return Math.floor(Math.random() * 10000);
    }

    var callbacks = {};

    var Storage = function(){
        this.save = function(arg1, arg2, arg3) {
            var cid = randomNum(),
                message = {'action': 'storage_set', 'cid': cid},
                callback = function(){};

            if(typeof arg1 == 'object') {
                message['values'] = arg1;
                if(typeof arg2 == 'function') {
                    callback = arg2;
                }
            } else {
                message['values'] = {};
                message['values'][arg1] = arg2;
                if(typeof arg3 == 'function') {
                    callback = arg3;
                }
            }

            callbacks[cid] = callback;
            postMessage(message);
        }

        this.request = function(keys, callback) {
            callback = callback || function(){};

            var cid = randomNum();

            callbacks[cid] = callback;
            postMessage({'cid': cid, 'action': 'storage_get', 'keys': keys});
        }

        this.remove = function(name) {
            ss.storage[name] = null;
        }
    }
    this.storage = new Storage();

    this.getImage = function(url, callback) {
        var cid = randomNum();
        callbacks[cid] = callback;
        postMessage({'cid': cid, 'action': 'image_get', 'url': url});
    }

    on('message', function(r) {
        var cid = r.cid,
            message = undefined;

        if(typeof r.message != "undefined") {
            message = r.message;
        }

        if(r.image != 'undefined') {
            message = 'data:image/'+r.image+';base64,' + unsafeWindow.btoa(message);
        }

        callbacks[cid].call(unsafeWindow, message);
    });

};

_ = new omniumWrapper();


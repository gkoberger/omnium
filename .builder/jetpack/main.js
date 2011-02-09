var pageMod = require("page-mod"),
    ss = require("simple-storage");
const data = require("self").data;

// Message Handling
var myWorker;
function handleMessage(m) {
    var cid = m.cid;
    if(m.action == "storage_set") {

        for(var i in m.values) {
            ss.storage[i] = m.values[i];
        }
        myWorker.postMessage({'cid': cid});
    }

    if(m.action == "storage_get") {
        var to_return = false;

        if(typeof m.keys == "string") {
            to_return = ss.storage[m.keys];
        } else {
            var keys = m.keys,
                to_return = {};

            for(var i=0; i<keys.length; i++) {
                to_return[keys[i]] = ss.storage[keys[i]];
            }
        }

        var m = {'message': to_return, 'cid': cid};
        myWorker.postMessage(m);
    }
}

pageMod.PageMod({
  include: %(included)s,
  contentScriptWhen: "ready",
  contentScriptFile: %(scripts)s,
  onAttach: function onAttach(worker, mod) {
    // Register the handleMessage function as a listener
    worker.on('message', handleMessage);
    // Take a reference to the worker so as to post messages back to it
    myWorker = worker;
  },
});


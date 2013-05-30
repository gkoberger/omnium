var pageMod = require("page-mod"),
    ss = require("simple-storage"),
    prefs = require("simple-prefs"),
    xhr = require("xhr");

const data = require("self").data;

// Message Handling
var mainWorker, slaveWorker;
function handleMessage(m) {
    var cid = m.cid;
    switch (m.action) {
      case "storage_set":
        for(var i in m.values) {
            ss.storage[i] = m.values[i];
        }
        mainWorker.postMessage({'cid': cid});
        break;
      case "storage_get":
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
        mainWorker.postMessage(m);
        break;
      case "image_get":
        function uint8ToString(buf) {
            var i, length, out = '';
            for (i = 0, length = buf.length; i < length; i += 1) {
                out += String.fromCharCode(buf[i]);
            }
            return out;
        }

        var req = new xhr.XMLHttpRequest(),
            image_filename = m.url.split('.'),
            image_type = image_filename[image_filename.length - 1];

        req.open("GET", m.url, true);
        req.overrideMimeType("text/plain; charset=x-user-defined");
        req.onreadystatechange = function() {
           if (req.readyState == 4) {
              if (req.status == 200) {
                 var tmp = req.responseText;

                 var length = tmp.length;
                 var data = new Uint8Array(length);
                 for (var i=0; i<length; ++i)
                    data[i] = tmp.charCodeAt(i);
                 mainWorker.postMessage({'cid': cid, 'message': uint8ToString(data), 'image': image_type});
              }
           }
        };
        req.send(null);
        break;
      case "worker_invoke":
        if (slaveWorker) {
          slaveWorker.postMessage({
            'cid': cid,
            'name': m.name,
            'message': m.message
          });
        }
        break;
      case "features_to_add":
        mainWorker.postMessage({'cid': cid, 'message': '%(featurecount)s'});
        break;
    }
}

var pgmd, wpgmd;
function initPageMod() {
    if (pgmd)
      pgmd.destroy();
    if (wpgmd)
      wpgmd.destroy();
    pgmd = pageMod.PageMod({
      include: %(included)s,
      contentScriptWhen: "ready",
      contentScriptFile: %(scripts)s,
      onAttach: function onAttach(worker, mod) {
        // Register the handleMessage function as a listener
        worker.on('message', handleMessage);
        // Take a reference to the worker so as to post messages back to it
        mainWorker = worker;
      },
    });
    var workers = %(workers)s;
    if (workers.length) {
        wpgmd = pageMod.PageMod({
          include: %(included)s,
          contentScriptWhen: "ready",
          contentScriptFile: workers,
          onAttach: function(worker, mod) {
            worker.on("message", function(msg) {
              if (mainWorker)
                mainWorker.postMessage({'cid': msg.cid, 'message': msg.message});
            });
            slaveWorker = worker;
          }
        });
    }
}

prefs.on("urls", initPageMod);
initPageMod();

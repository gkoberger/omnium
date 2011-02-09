(function() {
    var info = {},
        browsers = ["Firefox", "Chrome"],
        elements = document.getElementsByTagName('a');

    for (var i = 0; i < browsers.length; i++) {
        var browser = browsers[i];
        if (navigator.userAgent.indexOf(browser) > 0) {
            info.browser = browser;
            info.version = parseFloat(navigator.userAgent.substring(navigator.userAgent.indexOf(browser) + browser.length + 1));
        }
    }

    if (info.browser == "Firefox") {
        info.browser += " " + info.version;
        if (info.version < 4) {
            info.type = "greasemonkey";
            info.suffix = ".user.js";
        } else {
            info.type = "jetpack";
            info.suffix = ".xpi";
        }
    } else if(info.browser == "Chrome") {
        info.type = "chrome";
        info.suffix = ".user.js";
    }

    for (var i = 0; i < elements.length; i++) {
        if (elements[i].className == "omnium_addon") {
            var el = elements[i];
            folder = el.getAttribute('data-folder');
            el.setAttribute('href', omnium_folder + "/" + folder + info.suffix);
            el.getElementsByTagName('span')[0].innerHTML = info.browser;
        }
    }
})();


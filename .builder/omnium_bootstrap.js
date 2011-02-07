// From the YUI UI blog
// http://yuiblog.com/blog/2007/06/07/style/

function omnium_addCss(cssCode) {
    var styleElement = document.createElement("style");
        styleElement.type = "text/css";
    if (styleElement.styleSheet) {
        styleElement.styleSheet.cssText = cssCode;
    } else {
        styleElement.appendChild(document.createTextNode(cssCode));
    }
    document.getElementsByTagName("head")[0].appendChild(styleElement);
}


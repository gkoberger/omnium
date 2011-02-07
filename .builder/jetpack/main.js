var pageMod = require("page-mod");
const data = require("self").data;

pageMod.PageMod({
  include: %(included)s,
  contentScriptWhen: "ready",
  contentScriptFile: %(scripts)s,
});

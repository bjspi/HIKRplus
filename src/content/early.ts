if (location.hostname === "www.hikr.org") {
  if (localStorage.getItem("hikr-ext-wide-layout") === "true") {
    const style = document.createElement("style");
    style.id = "hikr-ext-early";
    style.textContent = [
      "html.hikr-ext-wide-layout body{min-width:0!important}",
      "html.hikr-ext-wide-layout #page,html.hikr-ext-wide-layout #wrap,html.hikr-ext-wide-layout #wrapper,html.hikr-ext-wide-layout #container,html.hikr-ext-wide-layout #content,html.hikr-ext-wide-layout #content_swiss,html.hikr-ext-wide-layout #contentmain{width:min(1480px,calc(100vw - 48px))!important;max-width:min(1480px,calc(100vw - 48px))!important;box-sizing:border-box!important}",
      "html.hikr-ext-wide-layout #page{display:flex!important;flex-wrap:wrap!important;align-items:flex-start!important;gap:0 14px!important}",
      "html.hikr-ext-wide-layout #page>#header,html.hikr-ext-wide-layout #page>.hr,html.hikr-ext-wide-layout #page>#cleardiv,html.hikr-ext-wide-layout #page>#footer,html.hikr-ext-wide-layout #page>.pnav,html.hikr-ext-wide-layout #page>.mnav{flex:0 0 100%!important;width:100%!important;max-width:100%!important}",
      "html.hikr-ext-wide-layout #page>br{display:none!important}",
      "html.hikr-ext-wide-layout #contentmain_swiss{flex:1 1 calc(100% - 334px)!important;width:auto!important;max-width:none!important;min-width:0!important;float:none!important;margin:0!important;box-sizing:border-box!important}",
      "html.hikr-ext-wide-layout #menu_rs_swiss{flex:0 0 320px!important;width:320px!important;max-width:320px!important;float:none!important;margin:0!important;box-sizing:border-box!important}",
    ].join("");
    document.documentElement.appendChild(style);
    document.documentElement.classList.add("hikr-ext-wide-layout");
    if (document.body) {
      document.body.classList.add("hikr-ext-wide-layout");
    } else {
      new MutationObserver((_, obs) => {
        if (document.body) {
          document.body.classList.add("hikr-ext-wide-layout");
          obs.disconnect();
        }
      }).observe(document.documentElement, { childList: true });
    }
  }
}

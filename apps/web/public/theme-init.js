// Applies the light/dark preference before hydration (loaded with beforeInteractive).
// The server already paints the theme from the "oses_theme" cookie; this covers first-time visitors
// (system preference) and browsers where the cookie was cleared but localStorage still has the choice.
(function () {
  try {
    var cookie = document.cookie.match(/(?:^|; )oses_theme=(dark|light)/);
    var stored = localStorage.getItem("oses-theme");
    var mode = cookie ? cookie[1] : stored === "dark" || stored === "light" ? stored : null;
    var dark = mode ? mode === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
    if (!cookie && mode) document.cookie = "oses_theme=" + mode + "; path=/; max-age=31536000; samesite=lax";
  } catch (e) {}
})();

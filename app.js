const dbg = require("./lib/dbg");
dbg.app.enabled = false;
dbg.app("App debug enabled!"); //console.clear();

console.log(
  "========================================================================"
);
// Model for making an async function in a non-module
/* 
(async () => {
  console.log('that');
})();
*/

require("dotenv").config();

// This is how items in user, system, and .env are accessed:
//console.log(process.env.DEBUG);

var createError = require("http-errors");
var express = require("express");
var favicon = require("serve-favicon");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");

var indexRouter = require("./routes/index");
var dataRouter = require("./routes/data");

const notify = require("./routes/notify");
const notifyRouter = notify.notifyRouter;

var livereload = require("livereload");
var connectLiveReload = require("connect-livereload");
const liveReloadServer = livereload.createServer();

const { Server } = require("socket.io");

stationSettings = require("./public/assets/stationSettings.json");
const stationSettingsDefault = {};

for (let keya in stationSettings) {
  // list of settings
  let vala = stationSettings[keya]; // details of settings
  if (vala.list) {
    // if vala.list exists then vala[0] is the default option
    stationSettingsDefault["stationSettings_" + keya] = vala.list[0].name;
  }
}
// stationSettingsDefault will be merged with cookies for rendering
//console.log(stationSettingsDefault);
// Ping the browser

// https://dev.to/cassiolacerda/automatically-refresh-the-browser-on-node-express-server-changes-x1f680-1k0o
// https://github.com/livereload/livereload-js
liveReloadServer.server.once("connection", () => {
  setTimeout(() => {
    liveReloadServer.refresh("/");
  }, 100);
});

// ------------------
var app = express();
// ------------------

// Load the station settings file so that server rendering can use it.

app.locals.stationSettings = stationSettings;

// Install live reload js:
app.use(connectLiveReload());

if (process.env.TRACEHTTP === "all") {
  // This logs almost all requests.
  app.use(logger("dev"));
}
// This logs only response codes >=400.
else if (process.env.TRACEHTTP === "errors") {
  app.use(
    logger("dev", {
      skip: function (req, res) {
        return res.statusCode < 400;
      },
    })
  );
}

// Serve favicon https://expressjs.com/en/resources/middleware/serve-favicon.html
app.use(favicon(path.join(__dirname, "public/images", "favicon.ico")));

// view engine setup
// EJS is preferred since C/P links all provide straight HTML.
// Besides: VSCode does most of what pug would do in the editor.
let ejs = require("ejs");
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "/views"));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Merge the set cookies with the defaults so that everything will
// have a setting when rendered whether or not a cookie was
// actually set.

app.use(function (req, res, next) {
  let tmp = { ...stationSettingsDefault, ...req.cookies };
  req.cookies = tmp;

  next();
});

var qs = require("qs");
app.set("query parser", function (str) {
  return qs.parse(str, {
    /* custom options */
  });
});

// Files in 'public' appear at the top level.
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "@unit_test"))); // For testing only

// Serves node_modules as /assets/npm, to facilite popper and bootstrap.
// Urls for these are C/P with minimal editing.
app.use("/assets/npm", express.static(path.join(__dirname, "node_modules")));

// Just do a no-op get in order to sync the server's cookies with the client.
// the event callback in the view does this as the last thing after
// setting the cookie on the client. TODO less expensive way to do this?
app.get(
  "/refreshCookies",

  function (req, res) {
    res.send("Thank You!");
  }
);
app.use("/", indexRouter);

app.use("/data", dataRouter); // Database lives under here!
app.use("/notify", notifyRouter);

/* GET file from views. */
app.get("/\\w+", function (req, res, next) {
  const view = req.url.substring(1);

  // render any ejs file in

  res.render(view, {
    cookies: req.cookies,
    title: "HamSuite (app.js)",
    view: view,
  });
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;

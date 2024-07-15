//console.clear();
console.log(
  '========================================================================'
);
// Model for making an async function in a non-module
/* 
(async () => {
  console.log('that');
})();
*/

require('dotenv').config();

// This is how items in user, system, and .env are accessed:
//console.log(process.env.DEBUG);

var createError = require('http-errors');
var express = require('express');
var favicon = require('serve-favicon');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var dataRouter = require('./routes/data');

var livereload = require('livereload');
var connectLiveReload = require('connect-livereload');
const liveReloadServer = livereload.createServer();

// https://expressjs.com/en/resources/middleware/multer.html
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

// Ping the browser

// https://dev.to/cassiolacerda/automatically-refresh-the-browser-on-node-express-server-changes-x1f680-1k0o
// https://github.com/livereload/livereload-js
liveReloadServer.server.once('connection', () => {
  setTimeout(() => {
    liveReloadServer.refresh('/');
  }, 100);
});

// ------------------
var app = express();
// ------------------

// Load the station settings file so that server rendering can use it.

stationSettings = require('./public/assets/stationSettings.json');
app.locals.stationSettings = stationSettings;

// Install live reload js:
app.use(connectLiveReload());

// This logs almost all requests.
// app.use(logger('dev'));
// This logs only response codes >=400.
app.use(
  logger('common', {
    skip: function (req, res) {
      return res.statusCode < 400;
    },
  })
);

// Serve favicon https://expressjs.com/en/resources/middleware/serve-favicon.html
app.use(favicon(path.join(__dirname, 'public/images', 'favicon.ico')));

// view engine setup
// EJS is preferred since C/P links all provide straight HTML.
// Besides: VSCode does most of what pug would do in the editor.
let ejs = require('ejs');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

var qs = require('qs');
app.set('query parser', function (str) {
  return qs.parse(str, {
    /* custom options */
  });
});

// Files in 'public' appear at the top level.
app.use(express.static(path.join(__dirname, 'public')));

// Serves node_modules as /assets/npm, to facilite popper and bootstrap.
// Urls for these are C/P with minimal editing.
app.use('/assets/npm', express.static(path.join(__dirname, 'node_modules')));

// Just do a no-op get in order to sync the server's cookies with the client.
// the event callback in the view does this as the last thing after
// setting the cookie on the client. TODO less expensive way to do this?
app.get(
  '/refreshCookies',

  function (req, res) {
    res.send('Thank You!');
  }
);
app.use('/', indexRouter);

app.use('/data', dataRouter); // Database lives under here!

/* GET file from views. */
app.get('/\\w+', function (req, res, next) {
  const view = req.url.substring(1);

  // render any ejs file in

  res.render(view, {
    cookies: req.cookies,
    title: 'HamSuite (app.js)',
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
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;

"use strict";
// Database access:
// all requests and responses are json

var express = require("express");
var router = express.Router();
var path = require("path");
var parseADIF = require("../lib/parseADIF.js");

// Load station settings json
var stationSettingsPath = path.join(
  __dirname,
  "../public/assets",
  "stationSettings.json"
);
var stationSettings = require(stationSettingsPath);

// https://expressjs.com/en/resources/middleware/multer.html
const multer = require("multer");
const { error } = require("console");
const upload = multer({}); // Returns the Multer object set for memory storage by default.

//-----------------

//router.use(express.json());
//router.use(express.urlencoded({ extended: false }));

// routes:
// throw-away test and example function
// Place holder for now
router.post("/profile", upload.none(), function (req, res, next) {
  // req.body contains the text fields
  console.log(req.body);
  res.send("Thanks");
});

router.post("/upload", upload.single("files"), function (req, res, next) {
  let recordCount = {};
  // req.body will hold the text fields, if there were any
  if (req.file) {
    uploadHandler(req, res)
      .then((count) => {
        console.log("count= ", count);
        recordCount = count;
      })
      .then(() => {
        res.json({
          res: `Thanks! ${JSON.stringify(recordCount)} qsos from  ${
            req.file.originalname
          } imported.`,
        });
      });
  } else {
    res.json({ res: "No file given" });
  }
});

//router.post('/upload', function (req, res, next) {
// res.send('dummy');});

//https://restfulapi.net/http-methods/#:~:text=HTTP%20Methods%201%201.%20HTTP%20GET%20Use%20GET,Summary%20of%20HTTP%20Methods%20...%207%207.%20Glossary

/*  Reqiired methods
HTTP GET
HTTP POST
HTTP PUT
HTTP DELETE
HTTP PATCH
*/
/* Paths to be implemented: log, logMetaData, callBook
  - log - this is the qsos logged
  - logMetadata - Record of uploads qsos uploaded will have the adif header, upload data, and found ADIF types specified in the upload.
  - callbook - Mostly qrz.com data and manual notes. Displayed during log entry if available.

  */

module.exports = router;

//=============================================================\\
// Database access routines:
//=============================================================\\
// no async/await above here:

// Rethinkdb initialization
const r = require("rethinkdb");
var connection = null;
r.connect({ host: "localhost", port: 28015 }, function (err, conn) {
  if (err) throw err;
  connection = conn;
});

let databases = null; // Gets filled in when the rethinldb is contactedq
let conn = null;
// IFFE pattern
(async () => {
  try {
    conn = await r.connect({
      host: "localhost",
      port: 28015,
    });
    databases = await r.dbList().run(conn);
    //console.log(databases);
  } catch {
    console.log("in data.js: failed to open database, is it running?");
  }
})(); // () gets it called here.

// Check for the existence of the requested databases and tables. If not there then
// create them.  Completely transparent to user.
async function dbCheckAndCreate(database) {
  console.log("dbCheckAndCreate ", database);
  try {
    if (databases.indexOf(database) < 0) {
      // The database does not exist
      // Silently create the database called for and populate it with
      // our canonical tables:
      await r.dbCreate(database).run(conn);

      const result = await Promise.all([
        r.db(database).tableCreate("qso").run(conn),
        r.db(database).tableCreate("meta").run(conn),
        r.db(database).tableCreate("qrz").run(conn),
      ]);
      //console.log(result);
      databases.push(database); // Add to the internal list of known databases.
      const index1 = await r
        .db(database)
        .table("qso")
        .indexCreate("call")
        .run(conn);
      const index2 = await r
        .db(database)
        .table("qso")
        .indexCreate("band")
        .run(conn);
      const index3 = await r
        .db(database)
        .table("qso")
        .indexCreate("mode")
        .run(conn);
      console.log(index1, index2, index3);
    }
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

// - upload support:
// When the upload route is called this will run.
// Test the databases.
// parse the incoming file and record in the qso & meta databases.
// Send back a report.
async function uploadHandler(req, res) {
  console.log("uploadHandler()");
  const database = req.cookies.stationSettings_database;
  const go = await dbCheckAndCreate(database);

  let recordCount = await parseADIF.parseADIF(
    req.file.buffer,
    // pass the request body and the index to the metadata
    {
      ...req.body,
      //metaId: meta.metaInsertResult.generated_keys[0],
      database: database,
    },
    headerCallback,
    qsoCallback
  );
  return Promise.resolve(recordCount);
}

// Called by parseADIF when a header is encountered and also
// when a qso field defines a new type.
async function headerCallback(hdr, options) {
  console.log("headerCallback() ", hdr);
  if (options.metaId) {
    const updateResult = await r
      .db(options.database)
      .table("meta")
      .get(options.metaId)
      .update(hdr)
      .run(conn);
    console.log("headerCallback() result= ", updateResult);
  } else {
    const result = await r
      .db(options.database)
      .table("meta")
      .insert(hdr)
      .run(conn);
    options.metaId = result.generated_keys[0];
  }
}

// called when a qso record is added during an upload.
// options contains the id of the associated metadata record.
// ADIF fields are uppercase and internal representations are
// lower case and prefixed with an '_'.  This should allow checks to
// prevent them from leaking out.
// Date/time info is converted to native javascript reprentation.
// The database key is synthesized from the time_on and band fields. This
// is expected to generate unique keys in almost all cases.

async function qsoCallback(qso, options) {
  // Variables to be set inside if statements:
  let wl = 1; // In case none specified
  let lnWl;

  // converts the qso times to native dates:
  let qdate = qso.QSO_DATE; // These are strings
  let qtim = qso.TIME_ON;
  let qy = Number(qdate.substring(0, 4));
  let qmo = Number(qdate.substring(4, 6)) - 1;
  let qdy = Number(qdate.substring(6, 8));
  let qh = Number(qtim.substring(0, 2));
  let qm = Number(qtim.substring(2, 4));
  let qs = Number(qtim.substring(4, 6));
  let dateUTC = Date.UTC(qy, qmo, qdy, qh, qm, qs); // Needed for id
  qso._time_on = new Date(dateUTC);

  if (qso.QSO_DATE_OFF) {
    qdate = qso.QSO_DATE_OFF; // These are strings
    qtim = qso.TIME_OFF;
    qy = Number(qdate.substring(0, 4));
    qmo = Number(qdate.substring(4, 6)) - 1;
    qdy = Number(qdate.substring(6, 8));
    qh = Number(qtim.substring(0, 2));
    qm = Number(qtim.substring(2, 4));
    qs = Number(qtim.substring(4, 6));
    qso._time_off = new Date(Date.UTC(qy, qmo, qdy, qh, qm, qs));
  }

  // Uses the frequency or band to set the milliseconds of the _time_on.
  // This gives us a good probability that an id generated this way will be
  // unique. A single operator wouldnt generate 2 qsos in the same second,
  // a large contest operation might, but not in the same band.
  // We can still use id to do time searches since these are usually ranges.
  // The freauency or alternately the band is converted to a wavelength. The
  // log of the wavelength is scaled and added to the time in the milliseconds
  // part.

  if (qso.FREQ) {
    qso.freq = Number(qso.FREQ);
    wl = 300 / qso.FREQ;
  } else if (qso.BAND) {
    let band = toLowecase(qso.BAND);
    if (band === "submm") {
      wl = 0.001;
    } else if (band.endsWith("mm")) {
      wl = 0.001 * Number(band.substring(0, band.length - 2));
    } else if (band.endsWith("cm")) {
      wl = 0.01 * Number(band.substring(0, band.length - 2));
    } else if (band.endsWith("m")) {
      wl = Number(band.substring(0, band.length - 1));
    } // Default wl=1
  }
  if (wl < 0.001) {
    // Shortest wl
    wl = 0.001;
  }
  if (wl > 2190) {
    // longest wl
    wl = 2190;
  }
  let pseudoMS = Math.log(wl) * 128;
  // The result here is a mostly unique primary key
  qso.id = dateUTC + Math.floor(pseudoMS);

  if (options.metaId) {
    qso._metaId = options.metaId;
  }

  const result = await r
    .db(options.database)
    .table("qso")
    .insert(qso, {
      durability: "soft",
      returnChanges: true,
      conflict: "update",
    })
    .run(conn);
  //console.log(result.changes);

  return Promise.resolve(result);
}

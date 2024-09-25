"use strict";

// DHT 20240620

const { readFile } = require("node:fs/promises");
const { resolve } = require("node:path");
const { domainToASCII } = require("node:url");

// Except for the header ADIF fields look like this:
// <qso_date:8:d>19960513
// Inside the <> are 2 or 3 fields, the 3rd field inside the <> is optional.
// Between the colins Field 1 is the 'key' and Field 2 is the data. Field
// 3 is a single character data type for the data. Most are pre-defined.

// This is test code...
async function decodeADIF(path) {
  //result = "";
  try {
    const filePath = resolve(path);
    const contents = await readFile(filePath, "utf-8");

    // Got the file.

    parseADIF(
      contents,
      (header) => {
        console.dir(header);
      },
      (qso) => {
        console.log("qso callback");
        console.dir(qso);
      }
    );
  } catch (err) {
    console.error(err.message);
  }
}

//decodeADIF("wsjtx_log.adi");
// parse the contents of the string passed in as contents as adif.
// headerCallback will be called when a header is parsed, qsoCallback will be called when a qso is parsed.
// returns the number of qso's found.

// Module main
exports.parseADIF = async function parseADIF(
  contents,
  options,
  headerCallback, // Returns a promise
  // header callback called when header parsed and when a type is encountered.
  qsoCallback // Returns a promise
) {
  contents = contents.toString();

  let qso = {};
  let header = {};

  let inHeader = true;
  let key;
  let headerID;

  let recordCount = {};
  // locals  used in the loop
  let iStart = 0,
    iEnd = 0;

  iStart = contents.indexOf("<");

  // Check for a header string
  if (iStart > 0) {
    header["_"] = contents.slice(0, iStart);
  }

  while (iStart > -1) {
    iEnd = contents.indexOf(">", iStart);

    let params = contents
      .slice(iStart + 1, iEnd)
      .toUpperCase()
      .split(":");

    if (inHeader) {
      // parsing header records.
      key = params[0];

      if (key == "EOH") {
        inHeader = false;
        headerID = await headerCallback(header, options);
      } else {
        // Build the header from the supplied keys
        header[key] = contents.slice(iEnd + 1, iEnd + 1 + Number(params[1]));
      }
    } else {
      // Parsing qso records

      key = params[0];

      if (key === "EOR") {
        let qsoLogResult = await qsoCallback(qso, options);
        for (const property in qsoLogResult) {
          // HERE
          // Gather statistics summary.  Only numbers and non-zero
          if (
            typeof qsoLogResult[property] == "number" &&
            qsoLogResult[property] > 0
          ) {
            if (recordCount[property]) {
              recordCount[property] += qsoLogResult[property];
            } else {
              recordCount[property] = qsoLogResult[property];
            }
          }
        }
        qso = {};
      } else {
        qso[params[0]] = contents.slice(iEnd + 1, iEnd + 1 + Number(params[1]));
        if (params.length == 3) {
          // We have a type.
          headerCallback({ ["type:" + key]: params[2] }, options);
        }
      }
    }
    iStart = contents.indexOf("<", iEnd);
  }

  return recordCount;
};

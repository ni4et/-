"use strict";
// Database access:
// all requests and responses are json

var express = require("express");
var notifyRouter = express.Router();

var path = require("path");
const multer = require("multer");
const { error } = require("console");
const upload = multer({}); // Returns the Multer object set for memory storage by default.

const APPTOKEN = process.env.PUSHOVER_API_TOKEN;
const USERKEY = process.env.PUSHOVER_USER_KEY;

var Pushover = require("node-pushover");
var push = new Pushover({
  token: APPTOKEN,
  user: USERKEY,
});

// No callback function defined:
//push.send("Some title", "Node.js is Cool!! - no callback");

// A callback function is defined:
// push.send("Some title", "Node.js is Cool!!", function (err, res) {
//   if (err) return console.log(err);
//   console.log(res);
// });

notifyRouter.post("/test", upload.none(), function (req, res, next) {
  // req.body contains the text fields
  console.log("POST ", req.body);
  res.send("Thanks");
  notifyEmmiter.emit("test", req.body);
  push.send("notify", "test");
});

notifyRouter.post("/arm", upload.none(), function (req, res, next) {
  // req.body contains the text fields
  console.log("POST ", req.body);
  notifyEmmiter.once("wsjt", (decode) => {
    console.log("once(wsjtx):", decode);
    push.send("wsjt", decode.message);
  });
  res.send("Thanks");
});

const EventEmitter = require("node:events");
const notifyEmmiter = new EventEmitter();

notifyEmmiter.on("test", (body) => {
  console.log("on(test):", body);
});

/* notifyEmmiter.on("wsjt", (body) => {
  console.log("on(wsjtx):", body);
  push.send("wsjt", body.name, body.time);
}); */

module.exports.notifyRouter = notifyRouter;
module.exports.notifyEmmiter = notifyEmmiter;

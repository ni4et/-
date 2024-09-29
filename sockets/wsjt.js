const dbg = require("../lib/dbg");
const notify = require("../routes/notify");
const notifyEmmiter = notify.notifyEmmiter;
dbgp = dbg.wsjtx;

dbgp.enabled = true;
dbgp(" debug enabled!");

//const cluster = require('node:cluster');
const dgram = require("node:dgram");
const server = dgram.createSocket("udp4");
const parser = require("../lib/wsjt-x-parser");

var clientInfo;
// For the socket.io interface to the client

var socket = null; // emits to socket
var io = null; // inbound events on io

//console.log(server);
server.on("error", (err) => {
  console.error(`server error\n${err.stack}`);
  server.close();
});

server.on("message", (msg, rinfo) => {
  decodedMsg = parser.decode(msg);
  if (decodedMsg.type == "decode") {
    clientInfo = rinfo;
    //console.log(decodedMsg, rinfo);
    //console.log(`from: ${rinfo.address}:${rinfo.port}`);
    //console.dir(decodedMsg);
    let decode = {
      snr: decodedMsg.snr,
      delta_frequency: decodedMsg.delta_frequency,
      message: decodedMsg.message,
      type: decodedMsg.message_decode.type,
      time: decodedMsg.time,
      de_call: decodedMsg.message_decode.de_call,
    };
    console.log("decode= ", decode);
    socket.emit("decode", decode);
    notifyEmmiter.emit("wsjt", decode);

    console.log(decode);
  } else if (decodedMsg.type == "status") {
    dbgp(
      decodedMsg.freqency,
      decodedMsg.mode,
      decodedMsg.transmitting,
      decodedMsg.tx_df,
      decodedMsg.tx_enabled
    );
    if (socket) {
      decodedMsg.freqency = Number(decodedMsg.freqency);
      socket.emit("status", decodedMsg);
    }
  }
});

server.on("listening", () => {
  const address = server.address();
  console.log(`server listening ${address.address}:${address.port}`);
});

server.bind(2237, "0.0.0.0");
module.exports = registerWSJTX;
function registerWSJTX(io_in, socket_in) {
  dbgp("registerWSJTX");
  socket = socket_in; // Grab for local use
  // do your emits on socket.
  io = io_in;

  // Register 'on' methods for events from the client.
  // none at this time.
}

setTimeout(() => {}, 1000);

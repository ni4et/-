const { htmlPrefilter } = require("jquery");
const net = require("net");

const host = "172.18.0.61";
const port = 4532;

const client = net.createConnection(port, host, () => {
  console.log("Connected");
  client.write("f");
  client.write("m");
  setInterval(() => {
    client.write("f");
    client.write("m");
  }, 2000);
});

client.on("data", (data) => {
  console.log(`Received: ${data}`);
});

client.on("error", (error) => {
  console.log(`Error: ${error.message}`);
});

client.on("close", function () {
  console.log("Connection closed");
});

setTimeout(() => {
  client.destroy();
}, 15000);

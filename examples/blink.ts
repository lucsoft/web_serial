import { getPorts, open, USBPortInfo } from "../mod.ts";

const portInfo = getPorts().find((port) => port.type === "USB") as USBPortInfo;
if (!portInfo) {
  throw new Error("No serial ports found.");
}

const port = open({ name: portInfo.name, baudRate: 9600 });
console.log("Opened port:", portInfo.friendlyName);

let on = false;
setInterval(async () => {
  on = !on;
  await port.write(new Uint8Array([on ? 0x01 : 0x02]));
}, 1000);

while (true) {
    console.log(
        "read bytes:",
        await port.read()
    );
}
(async () => {
})();


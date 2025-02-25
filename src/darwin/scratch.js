import { getPorts, open } from '/Users/jeffhykin/repos/deno_serial/src/serial_port.ts';

console.log(`getPorts() is:`,getPorts())

var port = getPorts().filter(each=>each.name == "/dev/tty.usbmodem1101")[0]
// var port = getPorts()[1];

console.debug(`trying to open `,JSON.stringify(port))
var port = await open({ name: port.name, baudRate: 115200 });

var termiosFromC = Deno.readFileSync("/Users/jeffhykin/repos/deno_serial/src/darwin/toptions.dat")

console.log(`port.writable   is:`,port.writable   )
console.log(`port.fd is:`,port.fd)
var w = port.write("hello world")
var r = port.read()

import nix from '/Users/jeffhykin/repos/deno_serial/src/darwin/nix.ts'
var chunk = new TextEncoder().encode("hello world")
await nix.write(port.fd!, chunk, chunk.byteLength)
console.log(`wrote`)
var result = await port.read(10)
console.log(`read`,result)
console.log(`read`,new TextDecoder().decode(result))

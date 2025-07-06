import "../mod.ts";
import { delay } from "jsr:@std/async/delay";

const port = await navigator.serial.requestPort();
await port.open({ baudRate: 115200 });

port.readable!
    .pipeThrough(new TextDecoderStream())
    .pipeTo(new WritableStream({
        write(chunk) {
            console.log(chunk.trim());
        }
    }));

const writer = port.writable!.getWriter();

while (true) {
    await writer.write(new TextEncoder().encode("ON\n"));
    await delay(10);
    await writer.write(new TextEncoder().encode("OFF\n"));
    await delay(100);
}
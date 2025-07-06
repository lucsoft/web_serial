import { delay } from "jsr:@std/async";
import { InternalSerialPort } from "../mod.ts"

while (true) {
    using port = new InternalSerialPort("/dev/tty.usbserial-10", 115200);

    for (let index = 0; index < 10; index++) {
        await port.writeTextLine("ON");
        await delay(20);
        await port.writeTextLine("OFF");
        await delay(20);
    }
}
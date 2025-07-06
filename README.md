# WebSerial Polyfill for Deno

This project provides a polyfill for the [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API) in [Deno](https://deno.com/), enabling serial port communication in Deno applications using a familiar web-compatible interface.

## Usage

Currently, this project does not ship any pre-built binaries. To use the polyfill, you need to build the native adapter yourself:

1. Clone the repository and navigate to its directory.
2. Build the native binary using Cargo:

    ```sh
    cargo build --release
    ```

3. Set the `WEB_SERIAL_PATH` environment variable to the folder containing the compiled binary (typically `target/release`):

    ```sh
    export WEB_SERIAL_PATH=/path/to/deno_serial/target/release
    ```

4. Use the polyfill in your Deno project as documented.

Make sure you have [Rust and Cargo](https://www.rust-lang.org/tools/install) installed.


## Example

1. Arduino Blink Sketch

    Upload the following sketch to your Arduino:

    ```cpp
    String inputString = "";
    bool stringComplete = false;

    void setup() {
        Serial.begin(115200);
        inputString.reserve(200);

        pinMode(2, OUTPUT);
    }

    void loop() {
        if (!stringComplete) return;
        inputString.trim();
        if (inputString != "OFF" && inputString != "ON") return;
        digitalWrite(2, inputString == "ON");

        inputString = "";
        stringComplete = false;
    }

    void serialEvent() {
        while (Serial.available()) {
            char inChar = (char)Serial.read();
            inputString += inChar;
            if (inChar == '\n') {
            stringComplete = true;
            }
        }
    }
    ```

    Blinking via Web Serial in Deno:

    ```typescript
    import "../mod.ts"; // Import the polyfill
    import { delay } from "jsr:@std/async/delay";

    // get first available serial port
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });

    // read every chunk from the serial port
    port.readable!
        .pipeThrough(new TextDecoderStream())
        .pipeTo(new WritableStream({
            write(chunk) {
                console.log(chunk.trim());
            }
        }));

    // blink fast
    const writer = port.writable!.getWriter();

    while (true) {
        await writer.write(new TextEncoder().encode("ON\n"));
        await delay(100);
        await writer.write(new TextEncoder().encode("OFF\n"));
        await delay(100);
    }
    ```

## License

Apache-2.0. Check [LICENSE](./LICENSE) for more information.
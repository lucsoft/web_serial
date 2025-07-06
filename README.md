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

## License

Apache-2.0. Check [LICENSE](./LICENSE) for more information.
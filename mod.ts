const WEB_SERIAL_PATH = "./target/debug";


const OS_PREFIX = Deno.build.os === "windows" ? "" : "lib";
const OS_SUFFIX = Deno.build.os === "windows"
  ? ".dll"
  : Deno.build.os === "darwin"
  ? ".dylib"
  : ".so";

function getLibraryPath(lib: string): string {
  lib = `${OS_PREFIX}${lib}${OS_SUFFIX}`;
  if (WEB_SERIAL_PATH) {
    return `${WEB_SERIAL_PATH}/${lib}`;
  } else {
    return lib;
  }
}


const lib = Deno.dlopen(getLibraryPath("web_serial_adapter"), {
    "wsa_get_ports": {
        parameters: [],
        result: "pointer"
    },
    "wsa_free_cstring": { parameters: [ "pointer" ], result: "void" },
    "wsa_connect": {
        parameters: [
            // name
            "buffer",
            // baud rate
            "u32"
        ],
        result: "pointer"
    },
    "wsa_disconnect": {
        parameters: [
            "pointer"
        ],
        result: "void"
    },
    "wsa_read": {
        parameters: [
            // port pointer
            "pointer",
            // read callback
            "function",
            // disconnect callback
            "function"
        ],
        result: "void"
    },
    "wsa_write": {
        parameters: [
            // port pointer
            "pointer",
            // data pointer
            "pointer",
            // data length
            "usize"
        ],
        result: "bool",
        nonblocking: true
    }
});

interface UsbPortDevice {
    internal_id: string,
    vendor_id: number,
    product_id: number,
    manufacturer?: string,
    serial_number?: string,
    product?: string,
}


export class InternalSerialPort implements Disposable {

    static getPorts(): UsbPortDevice[] {
        const ptr = lib.symbols.wsa_get_ports();
        if (ptr === null) {
        throw new Error("Pointer was null!");
        }
        const data = Deno.UnsafePointerView.getCString(ptr);
        lib.symbols.wsa_free_cstring(ptr);
        return JSON.parse(data) as UsbPortDevice[];
    }
    private pointer: Deno.PointerValue<unknown>;
    constructor(
        public name: string,
        public baudRate: number = 115200,
    ) {
        const nameBuffer = new TextEncoder().encode(name);
        const pointer = lib.symbols.wsa_connect(nameBuffer, baudRate);
        if (pointer === null) {
            throw new Error("Failed to connect to port: " + name);
        }

        this.pointer = pointer;
    }

    async write(data: Uint8Array): Promise<boolean> {
        const dataPointer = Deno.UnsafePointer.of(data);
        return await lib.symbols.wsa_write(this.pointer, dataPointer, BigInt(data.length));
    }

    read() {
        return new ReadableStream<Uint8Array>({
            start: (controller) => {
                const readBlockCallback = new Deno.UnsafeCallback({
                    parameters: [ "usize", "buffer" ],
                    result: "void",
                },
                    (usize, data) => {
                        if (data === null || data === null) {
                            return;
                        }
                        const buffer = new Deno.UnsafePointerView(data).getArrayBuffer(Number(usize));
                        controller.enqueue(new Uint8Array(buffer));
                    }
                )

                const disconnectCallback = new Deno.UnsafeCallback({
                    parameters: [],
                    result: "void",
                }, () => {
                    controller.close();
                });

                lib.symbols.wsa_read(this.pointer, readBlockCallback.pointer, disconnectCallback.pointer);

            }
        })
    }

    writeTextLine(line: string): Promise<boolean> {
        const data = new TextEncoder().encode(line + "\n");
        return this.write(data);
    }

    [Symbol.dispose]() {
        lib.symbols.wsa_disconnect(this.pointer);
    }
}

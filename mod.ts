import 'https://esm.sh/v135/@types/w3c-web-serial/index.d.ts';

import { fail, assert } from "jsr:@std/assert";
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
        const {readable , writable } = new TransformStream<Uint8Array>();

        const writer = writable.getWriter();
        const readBlockCallback = new Deno.UnsafeCallback({
            parameters: [ "usize", "buffer" ],
            result: "void",
        }, (usize, data) => {
            if (data === null || data === null) {
                return;
            }
            const buffer = new Deno.UnsafePointerView(data).getArrayBuffer(Number(usize));
            // WARN: we should await but that callback doesn't support async
            writer.write(new Uint8Array(buffer));
        })

        const disconnectCallback = new Deno.UnsafeCallback({
            parameters: [],
            result: "void",
        }, () => {
            writer.close();
        });

        lib.symbols.wsa_read(this.pointer, readBlockCallback.pointer, disconnectCallback.pointer);

        return readable;
    }

    writeTextLine(line: string): Promise<boolean> {
        const data = new TextEncoder().encode(line + "\n");
        return this.write(data);
    }

    [Symbol.dispose]() {
        lib.symbols.wsa_disconnect(this.pointer);
    }
}

class SerialPortImpl extends EventTarget implements SerialPort {
    #internalPort: InternalSerialPort | null = null;
    #abortController = new AbortController();

    constructor(private info: UsbPortDevice) {
        super();
    }

    onconnect = () => { console.log("Serial connected"); };
    ondisconnect = () => { console.log("Serial disconnected"); };

    get connected() {
        return this.#internalPort !== null;
    }

    #readable: ReadableStream<Uint8Array<ArrayBufferLike>> | null = null;

    get readable(): ReadableStream<Uint8Array<ArrayBufferLike>> | null {
        if (this.#internalPort === null) {
            return null;
        }
        if (this.#readable === null) {
            this.#readable = this.#internalPort.read();
        }

        return this.#readable;
    }

    #writable: WritableStream<Uint8Array<ArrayBufferLike>> | null = null;

    get writable(): WritableStream<Uint8Array<ArrayBufferLike>> | null {
        if (this.#internalPort === null) {
            return null;
        }
        return this.#writable;
    }

    // deno-lint-ignore require-await
    async open(options: SerialOptions): Promise<void> {
        this.#internalPort = new InternalSerialPort(this.info.internal_id, options.baudRate);
        this.#writable = new WritableStream<Uint8Array<ArrayBufferLike>>({
            write: async (chunk, controller) => {
                if (controller.signal.aborted) {
                    return;
                }

                if (!await this.#internalPort?.write(chunk)) {
                    controller.error(new Error("Failed to write to serial port."));
                }
            }
        });
    }

    setSignals(_signals: SerialOutputSignals): Promise<void> {
        throw new Error("Method not implemented.");
    }

    getSignals(): Promise<SerialInputSignals> {
        throw new Error("Method not implemented.");
    }

    getInfo(): SerialPortInfo {
        return {
            usbVendorId: this.info.vendor_id,
            usbProductId: this.info.product_id
        };
    }

    async close(): Promise<void> {
        assert(this.connected, "Port is not connected.");
        this.#internalPort?.[ Symbol.dispose ]();
        this.#abortController.abort();
        await this.#writable?.close();
        this.#writable = null;
        this.#readable = null;
    }

    forget(): Promise<void> {
        throw new Error("Method not implemented.");
    }
}

class SerialImpl extends EventTarget implements Serial {
    onconnect = () => { console.log("Serial connected"); };
    ondisconnect = () => { console.log("Serial disconnected"); };

    getPorts(): Promise<SerialPort[]> {
        const ports = InternalSerialPort.getPorts();
        return Promise.resolve(ports.map(port => new SerialPortImpl(port)));
    }
    requestPort(options?: SerialPortRequestOptions): Promise<SerialPort> {
        const ports = InternalSerialPort.getPorts();

        if (ports.length === 0) {
            // this is not actually the real error, repalce with an expected error.
            throw new Error("No serial ports available.");
        }

        if (!options) {
            return Promise.resolve(new SerialPortImpl(ports[0]));
        }

        return Promise.resolve(new SerialPortImpl(ports.find(port => {
            return (options.filters || []).every(filter => {
                if (filter.usbVendorId && port.vendor_id !== filter.usbVendorId) {
                    return false;
                }

                if (filter.usbProductId && port.product_id !== filter.usbProductId) {
                    return false;
                }

                return true;
            })
        }) || fail("No matching serial port found.")));
    }
}


if (!('serial' in navigator)) {
    // @ts-expect-error The types define this property is not overridable, but before it wasn't defined
    navigator.serial = new SerialImpl();
}
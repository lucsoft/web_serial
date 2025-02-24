/**
MIT License

Copyright (c) 2023 Bernd Amend

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
 */

import type { SerialOptions, SerialPortInfo } from "../common/web_serial.ts";

const O_RDWR = 0x2;
const O_NOCTTY = 0x100;
const O_SYNC = 0x101000;
const TCSANOW = 0;

const CSIZE = 0o000060;
const CS5 = 0o000000;
const CS6 = 0o000020;
const CS7 = 0o000040;
const CS8 = 0o000060;
const CSTOPB = 0o000100;
const CREAD = 0o000200;
const PARENB = 0o000400;
const PARODD = 0o001000;
const HUPCL = 0o002000;
const CLOCAL = 0o004000;
const CRTSCTS = 0o20000000000;
const VTIME = 5;
const VMIN = 6;

function numberBaudrateToBaudrateValue(num: number) {
  switch (num) {
    case 9600:
      return 0o000015;
    case 19200:
      return 0o000016;
    case 38400:
      return 0o000017;
    case 57600:
      return 0o010001;
    case 115200:
      return 0o010002;
    case 230400:
      return 0o010003;
    case 460800:
      return 0o010004;
    case 500000:
      return 0o010005;
    case 576000:
      return 0o010006;
    case 921600:
      return 0o010007;
    case 1000000:
      return 0o010010;
    case 1152000:
      return 0o010011;
    case 1500000:
      return 0o010012;
    case 2000000:
      return 0o010013;
    case 2500000:
      return 0o010014;
    case 3000000:
      return 0o010015;
    case 3500000:
      return 0o010016;
    case 4000000:
      return 0o010017;
  }
  throw new Error("unsupported baudrate");
}

const library = Deno.dlopen(
  "/lib/libc.so.6",
  {
    open: {
      parameters: ["pointer", "i32"],
      result: "i32",
      nonblocking: false,
    },
    close: {
      parameters: ["i32"],
      result: "i32",
      nonblocking: false,
    },
    write: {
      parameters: ["i32", "pointer", "usize"],
      result: "isize",
      nonblocking: false,
    },
    read: {
      parameters: ["i32", "pointer", "usize"],
      result: "isize",
      nonblocking: true,
    },
    non_blocking__errno_location: {
      parameters: [],
      result: "pointer",
      nonblocking: true,
      name: "__errno_location",
    },
    __errno_location: {
      parameters: [],
      result: "pointer",
      nonblocking: false,
    },
    strerror: {
      parameters: ["i32"],
      result: "pointer",
      nonblocking: false,
    },
    tcgetattr: {
      parameters: ["i32", "pointer"],
      result: "i32",
      nonblocking: false,
    },
    tcsetattr: {
      parameters: ["i32", "i32", "pointer"],
      result: "i32",
      nonblocking: false,
    },
    cfsetspeed: {
      parameters: ["pointer", "u32"],
      result: "i32",
      nonblocking: false,
    },
  } as const,
);

async function nonBlockingErrno() {
  const ret = await library.symbols.non_blocking__errno_location();
  if (ret === null) {
    return 0;
  }
  const ptrView = new Deno.UnsafePointerView(ret);
  return ptrView.getInt32();
}

async function errno() {
  const ret = await library.symbols.__errno_location();
  if (ret === null) {
    return 0;
  }
  const ptrView = new Deno.UnsafePointerView(ret);
  return ptrView.getInt32();
}

async function strerror(errnum: number) {
  const ret = await library.symbols.strerror(errnum);
  if (ret === null) {
    return "";
  }
  const ptrView = new Deno.UnsafePointerView(ret);
  return ptrView.getCString();
}

async function geterrnoString() {
  return strerror(await errno());
}

async function getNonBlockingErrnoString() {
  return strerror(await nonBlockingErrno());
}

function is_platform_little_endian(): boolean {
  const buffer = new ArrayBuffer(2);
  new DataView(buffer).setInt16(0, 256, true);
  return new Int16Array(buffer)[0] === 256;
}

export class LinuxSerialPort implements AsyncDisposable {
  #fd: number | undefined;
  #state: "opened" | "closed" | "uninitialized" = "uninitialized";
  options: SerialOptions | undefined;

  constructor(name) {
    this.name = name;
  }
  
  get fd() {
    return this.#fd;
  }

  async open(options: SerialOptions) {
    if (this.#fd !== undefined) {
      throw new Error("already open");
    }

    const baudRate = numberBaudrateToBaudrateValue(options.baudRate);
    if (
      options.dataBits !== undefined && options.dataBits !== 7 &&
      options.dataBits !== 8
    ) {
      throw new Error("dataBits can only be undefined | 7 | 8");
    }

    if (options.stopBits !== undefined) {
      throw new Error("setting stopBits is not implemented");
    }

    if (options.parity !== undefined) {
      throw new Error("setting parity is not implemented");
    }

    if (
      options.bufferSize !== undefined && options.bufferSize <= 0
    ) {
      throw new Error("bufferSize needs to be >0");
    }

    if (options.flowControl !== undefined) {
      throw new Error("setting flowControl is not implemented");
    }

    this.options = options;
    const buffer = new TextEncoder().encode(this.filename);
    const fd = await library.symbols.open(
      Deno.UnsafePointer.of(buffer),
      O_RDWR | O_NOCTTY | O_SYNC,
    );

    if (fd < 0) {
      throw new Error(
        `Couldn't open '${this.filename}': ${await geterrnoString()}`,
      );
    }

    // termios tty{};
    const tty = new ArrayBuffer(100);
    const ttyPtr = Deno.UnsafePointer.of(tty);

    if (await library.symbols.tcgetattr(fd, ttyPtr) != 0) {
      LinuxSerialPort._internalClose(fd);
      throw new Error(`tcgetattr: ${await geterrnoString()}`);
    }

    await library.symbols.cfsetspeed(ttyPtr, baudRate);

    const dataView = new DataView(tty);
    const littleEndian = is_platform_little_endian();
    dataView.setUint32(0, 0, littleEndian); // c_iflag
    dataView.setUint32(4, 0, littleEndian); // c_oflag

    let cflag = dataView.getUint32(8, littleEndian);
    cflag &= ~PARENB; // Clear parity bit, disabling parity (most common)
    cflag &= ~CSTOPB; // Clear stop field, only one stop bit used in communication (most common)
    cflag &= ~CSIZE; // Clear all bits that set the data size
    if (options.dataBits === 7) {
      cflag |= CS7;
    } else {
      cflag |= CS8; // 8 bits per byte (most common)
    }
    cflag &= ~CRTSCTS; // Disable RTS/CTS hardware flow control (most common)
    cflag |= CREAD | CLOCAL; // Turn on READ & ignore ctrl lines (CLOCAL = 1)
    dataView.setUint32(8, cflag, littleEndian); // c_cflag

    dataView.setUint32(12, 0, littleEndian); // c_lflag
    
    const timeoutInSeconds = options.timeoutSeconds ?? 2
    let timeoutInTenthsOfASecond = Math.round(timeoutInSeconds*10)
    if (timeoutInTenthsOfASecond < 1) {
        console.warn(`Given timeout of ${timeoutInSeconds} seconds, clamping to 0.1 seconds`)
        timeoutInTenthsOfASecond = 1
    } else if (timeoutInTenthsOfASecond > 255) {
        console.warn(`Given timeout of ${timeoutInSeconds} seconds larger than max of 25.5 seconds, clamping to 25.5 seconds`)
        timeoutInTenthsOfASecond = 255
    }
    // Wait for up to 1s (10 deciseconds), returning as soon as any data is received.
    dataView.setUint8(17 + VTIME, timeoutInTenthsOfASecond);
    dataView.setUint8(17 + VMIN, options.minimumNumberOfCharsRead ?? 0);

    if (await library.symbols.tcsetattr(fd, TCSANOW, ttyPtr) != 0) {
      LinuxSerialPort._internalClose(fd);
      throw new Error(`tcsetattr: ${await geterrnoString()}`);
    }

    this.#fd = fd;
    this.#state = "opened";
  }
  
  async write(strOrBytes: string | Uint8Array) {
    if (this.#state = "closed" || this.#state = "uninitialized") {
        throw new Error(`Can't write to port because port is ${this.#state}`, "InvalidStateError");
    }
    if (typeof strOrBytes === "string") {
      strOrBytes = new TextEncoder().encode(strOrBytes);
    }
    const wlen = await library.symbols.write(
      this.#fd,
      Deno.UnsafePointer.of(strOrBytes),
      BigInt(strOrBytes.byteLength),
    );
    if (wlen < 0) {
        throw new Error(`Error while writing: ${await geterrnoString()}`);
    }
    if (Number(wlen) !== data.byteLength) {
        throw new Error("Couldn't write data");
    }
  }
  
  async read() {
    if (this.#state = "closed" || this.#state = "uninitialized") {
        throw new Error(`Can't read from port because port is ${this.#state}`, "InvalidStateError");
    }
    const bufferSize = (this?.options?.bufferSize ?? 255)
    const buffer = new Uint8Array(bufferSize+1);
    while (true) {
        const howManyBytes = await library.symbols.read(
            this.#fd,
            Deno.UnsafePointer.of(buffer),
            BigInt(bufferSize),
        )
        if (howManyBytes > 0) {
            return buf.subarray(0,howManyBytes);
        } else {
            await new Promise(r=>setTimeout(r,this?.options.waitTime??50))
        }
    }
  }
  
  async close() {
    const fd = this.#fd;
    this.#fd = undefined;
    this.#writable = null;
    this.#readable = null;
    await LinuxSerialPort._internalClose(fd);
  }

  static async _internalClose(fd: number | undefined) {
    if (fd === undefined) {
      return;
    }
    const ret = await library.symbols.close(fd);
    if (ret < 0) {
      throw new Error(`Error while closing: ${await geterrnoString()}`);
    }
  }
  
  async [Symbol.asyncDispose]() {
    await this.close();
  }
  
  [Symbol.for("Deno.customInspect")](
    inspect: typeof Deno.inspect,
    options: Deno.InspectOptions,
  ) {
    return `SerialPort ${
      inspect({ name: this.name, state: this.#state }, options)
    }`;
  }
}
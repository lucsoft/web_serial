import { cString, Deferred } from "../common/util.ts";
import nix, { UnixError, unwrap, CREAD, CLOCAL, PARENB, PARODD, CSTOPB, CSIZE, CS7, CS8, CRTSCTS, IXON, IXOFF, IXANY, ICANON, ECHO, ECHOE, ISIG, VMIN, VTIME, TCSANOW, F_SETFL, O_RDWR, O_NOCTTY, O_NDELAY, OPOST, INPCK, IGNPAR, } from "./nix.ts";
import {
  SerialOptions,
  SerialOutputSignals,
  SerialPort,
  SerialPortInfo,
} from "../common/web_serial.ts";

function bigIntTo64IntLittleEndianBytes(bigInt) {
    const buffer = new ArrayBuffer(8); // 64-bit number (8 bytes)
    const view = new DataView(buffer);
    // Store the BigInt into the DataView in little-endian format
    view.setBigUint64(0, bigInt, true); // true for little-endian
    // Convert the ArrayBuffer into a Uint8Array
    const uint8Array = new Uint8Array(buffer);
    return uint8Array;
}

function int64LittleEndianBytesToBigInt(uint8Array) {
    if (uint8Array instanceof Array) {
        if (uint8Array.length != 8) {
            throw new Error("Invalid input: Array must have exactly 8 elements for int64LittleEndianBytesToBigInt()");
        }
        uint8Array = new Uint8Array(uint8Array);
    }
    const buffer = uint8Array.buffer;
    const view = new DataView(buffer);
    // Extract the BigInt from the DataView, assuming little-endian byte order
    const bigInt = view.getBigUint64(0, true); // true for little-endian
    return bigInt;
}

let debug = false;
export class SerialPortDarwin implements SerialPort, AsyncDisposable {
  #info: SerialPortInfo;
  fd?: number;

  #state: "opened" | "closed" | "uninitialized" = "uninitialized";
  #bufferSize?: number;

  constructor(name: string) {
    this.#info = {name};
  }
  
  get name() {
    return this.#info.name
  }

  getInfo(): Promise<SerialPortInfo> {
    return Promise.resolve(this.#info);
  }

  async open(options: SerialOptions) {
    if (this.#state == "opened") {
      throw new Error("Port is already open", "InvalidStateError");
    }
    if (debug) {
        console.log(`opening port ${this.name}`)
    }

    if (options.dataBits && options.dataBits !== 7 && options.dataBits !== 8) {
      throw new TypeError("Invalid dataBits, must be one of: 7, 8");
    }

    if (options.stopBits && options.stopBits !== 1 && options.stopBits !== 2) {
      throw new TypeError("Invalid stopBits, must be one of: 1, 2");
    }

    if (options.bufferSize === 0) {
      throw new TypeError("Invalid bufferSize, must be greater than 0");
    }

    if (
      options.flowControl && options.flowControl !== "none" &&
      options.flowControl !== "software" && options.flowControl !== "hardware"
    ) {
      throw new TypeError(
        "Invalid flowControl, must be one of: none, software, hardware",
      );
    }

    if (
      options.parity && options.parity !== "none" &&
      options.parity !== "even" && options.parity !== "odd"
    ) {
      throw new TypeError(
        "Invalid parity, must be one of: none, even, odd",
      );
    }
    this.options = options;
    
    debug && console.log(`calling nix.open()`)
    const shouldCreate = 0;
    const fd = await nix.open(
      cString(this.#info.name),
      Number(O_RDWR | O_NOCTTY | O_NDELAY),
      shouldCreate,
    );
    unwrap(fd);
    this.fd = fd;
    
    // 
    // set all the termios settings
    // 
    var termiosStruct = new Uint8Array(72)
    unwrap(nix.tcgetattr(fd, termiosStruct));

    const timeoutInSeconds = options.timeoutSeconds ?? 2
    let timeoutInTenthsOfASecond = Math.round(timeoutInSeconds*10)
    if (timeoutInTenthsOfASecond < 1) {
        console.warn(`Given timeout of ${timeoutInSeconds} seconds, clamping to 0.1 seconds`)
        timeoutInTenthsOfASecond = 1
    } else if (timeoutInTenthsOfASecond > 255) {
        console.warn(`Given timeout of ${timeoutInSeconds} seconds larger than max of 25.5 seconds, clamping to 25.5 seconds`)
        timeoutInTenthsOfASecond = 255
    }
    
    var iflag   = [0,0,0,0,0,0,0,0];
    var oflag   = [0,0,0,0,0,0,0,0,];
    var cflag   = [0,203,0,0,0,0,0,0,];
    var lflag   = [0,0,0,0,0,0,0,0];
    var cc      = [4, 255, 255, 127, 23, 21, 18, 255, 3, 28, 26, 25, 17, 19, 22, 15, 0, 20, 20, 255];
    var unknown = [0,0,0,0];
    var ispeed  = [128,37,0,0,0,0,0,0]; // [128,37,0,0,0,0,0,0] means baudRate = 9600, (cfsetispeed() below changes this though)
    var ospeed  = [128,37,0,0,0,0,0,0];
    var termiosStruct = new Uint8Array([
        ...iflag, 
        ...oflag, 
        ...cflag, 
        ...lflag, 
        ...cc, 
        ...unknown,
        ...ispeed,
        ...ospeed,
    ])
    // set: baudRate
    unwrap(nix.cfsetispeed(termiosStruct, options.baudRate));
    unwrap(nix.cfsetospeed(termiosStruct, options.baudRate));
    
    var iflag   = int64LittleEndianBytesToBigInt(termiosStruct.slice(0,8));
    var oflag   = int64LittleEndianBytesToBigInt(termiosStruct.slice(8,16));
    var cflag   = int64LittleEndianBytesToBigInt(termiosStruct.slice(16,24));
    var lflag   = int64LittleEndianBytesToBigInt(termiosStruct.slice(24,32));
    var cc      = termiosStruct.slice(32,52);
    // var cc      = [4, 255, 255, 127, 23, 21, 18, 255, 3, 28, 26, 25, 17, 19, 22, 15, 0, 20, 20, 255];
    var unknown = termiosStruct.slice(52,56);
    var ispeed  = termiosStruct.slice(56,64);
    var ospeed  = termiosStruct.slice(64,72);
    
    cc[VMIN]    = 0;
    // set: timeout
    cc[VTIME]   = timeoutInTenthsOfASecond;

    // set: size
    cflag &= ~CSIZE;       // Clear data size bits
    switch (options.dataBits) {
        case 7:
            cflag |= CS7;
            break;
        case 8:
            cflag |= CS8;
            break;
    }

    // set: parity
    switch (options.parity) {
        case "odd":
            cflag |= PARENB; // parity enable = on
            cflag |= PARODD; // odd parity
            
            // iflag |= INPCK; // not sure what this does/did
            // iflag &= ~IGNPAR;
            break;
        case "even":
            cflag |= PARENB; // parity enable = on
            cflag &= ~PARODD; // even parity
            
            // iflag |= INPCK;
            // iflag &= ~IGNPAR;
            break;
        default:
            cflag &= ~PARENB;      // Disable parity
            cflag &= ~(PARENB | PARODD);
            
            // iflag &= ~INPCK;
            // iflag |= IGNPAR;
            break;
    }
    
    // set: stop bits
    switch (options.stopBits) {
        case 1:
            cflag &= ~CSTOPB;
            break;
        case 2:
            cflag |= CSTOPB;
            break;
    }

    // set: flow control
    switch (options.flowControl) {
        case "software":
            cflag &= ~CRTSCTS;
            iflag |= IXON | IXOFF;
            break;
        case "hardware":
            cflag |= CRTSCTS;
            iflag &= ~(IXON | IXOFF | IXANY);
            break;
        default:
            cflag &= ~CRTSCTS;
            iflag &= ~(IXON | IXOFF | IXANY);
    }
    
    // turn on READ & ignore ctrl lines
    cflag |= CREAD | CLOCAL;
    // make raw
    lflag &= ~(ICANON | ECHO | ECHOE | ISIG);

    var termiosStruct = new Uint8Array([
        ...bigIntTo64IntLittleEndianBytes(iflag),
        ...bigIntTo64IntLittleEndianBytes(oflag),
        ...bigIntTo64IntLittleEndianBytes(cflag),
        ...bigIntTo64IntLittleEndianBytes(lflag),
        ...cc,
        ...unknown,
        ...ispeed,
        ...ospeed,
    ])
    unwrap(nix.tcsetattr(fd, Number(TCSANOW), termiosStruct));

    this.#state = "opened";
    debug && console.log(`this.#state is:`,this.#state)
    this.#bufferSize = options.bufferSize ?? 255;
  }

  async write(strOrBytes: string | Uint8Array) {
    if (this.#state == "closed" || this.#state == "uninitialized") {
        throw new Error(`Can't write to port because port is ${this.#state}`, "InvalidStateError");
    }
    if (typeof strOrBytes === "string") {
      strOrBytes = new TextEncoder().encode(strOrBytes);
    }
    return nix.write(this.fd, strOrBytes, strOrBytes.byteLength)
  }
  
  async read() {
    if (this.#state == "closed" || this.#state == "uninitialized") {
        throw new Error(`Can't read from port because port is ${this.#state}`, "InvalidStateError");
    }
    const buf = new Uint8Array(this.#bufferSize+1);
    while (true) {
        let howManyBytes = unwrap(nix.read(this.fd, buf, this.#bufferSize));
        if (howManyBytes > 0) {
            return buf.subarray(0,howManyBytes);
        } else {
            await new Promise(r=>setTimeout(r,this?.options.waitTime??50))
        }
    }
  }
  
  close() {
    if (this.#state !== "opened") {
      throw new Error("Port is not open", "InvalidStateError");
    }
    unwrap(nix.close(this.fd));
    return Promise.resolve();
  }
  
  async [Symbol.asyncDispose]() {
    await this.close();
  }

  [Symbol.for("Deno.customInspect")](
    inspect: typeof Deno.inspect,
    options: Deno.InspectOptions,
  ) {
    return `SerialPort ${
      inspect({ name: this.#info.name, state: this.#state }, options)
    }`;
  }
}

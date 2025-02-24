export enum DataBits {
  FIVE = 5,
  SIX = 6,
  SEVEN = 7,
  EIGHT = 8,
}

export enum Parity {
  NONE = 0,
  ODD = 1,
  EVEN = 2,
}

export enum StopBits {
  ONE = 0,
  TWO = 2,
}

export enum FlowControl {
  NONE,
  SOFTWARE,
  HARDWARE,
}

export interface SerialOpenOptions {
  name: string;
  baudRate:
    | 9600
    | 19200
    | 38400
    | 57600
    | 115200
    | 230400
    | 460800
    | 500000
    | 576000
    | 921600
    | 1000000
    | 1152000
    | 1500000
    | 2000000
    | 2500000
    | 3000000
    | 3500000
    | 4000000;
  dataBits?: DataBits;
  stopBits?: StopBits;
  parity?: Parity;
  flowControl?: FlowControl;
  timeout?: number;
}

export enum ClearBuffer {
  INPUT,
  OUTPUT,
  ALL,
}

export interface SerialPort {
  readonly name?: string;

  baudRate: number;
  dataBits: DataBits;
  stopBits: StopBits;
  parity: Parity;
  flowControl: FlowControl;
  timeout: number;

  read(p: Uint8Array): Promise<number | null>;
  write(p: Uint8Array): Promise<number>;

  writeRequestToSend(level: boolean): void;
  writeDataTerminalReady(level: boolean): void;

  readClearToSend(): boolean;
  readDataSetReady(): boolean;
  readRingIndicator(): boolean;
  readCarrierDetect(): boolean;

  bytesToRead(): number;
  bytesToWrite(): number;

  clear(buffer: ClearBuffer): void;

  setBreak(): void;
  clearBreak(): void;

  flush(): void;

  close(): void;
}

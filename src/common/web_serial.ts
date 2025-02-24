export interface Serial {
  getPorts(): Promise<SerialPort[]>;
}

export interface SerialPortInfo {
  name: string;
  friendlyName?: string;
  manufacturer?: string;
  usbVendorId?: number;
  usbProductId?: number;
  serialNumber?: string;
}

export type ParityType = "none" | "even" | "odd";
export type FlowControlType = "none" | "software" | "hardware";

export interface SerialOptions {
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
  dataBits?: 7 | 8; // default 8
  stopBits?: 1 | 2; // default 1
  parity?: ParityType; // default none
  bufferSize?: number; // default 255
  flowControl?: FlowControlType;
  timeoutSeconds?: number;
}

export interface SerialOutputSignals {
  dataTerminalReady?: boolean;
  requestToSend?: boolean;
  break?: boolean;
}

export interface SerialInputSignals {
  dataCarrierDetect: boolean;
  ringIndicator: boolean;
  dataSetReady: boolean;
  clearToSend: boolean;
}

export interface SerialPort extends EventTarget {
  getInfo(): Promise<SerialPortInfo>;

  open(options: SerialOptions): Promise<void>;

  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;

  setSignals(signals: SerialOutputSignals): Promise<void>;
  getSignals(): Promise<SerialInputSignals>;

  close(): Promise<void>;
}

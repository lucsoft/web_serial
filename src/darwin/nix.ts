// TODO: put errorno inside this open
let nix
const getNix = ()=>(nix=nix||Deno.dlopen("libSystem.dylib", {
  open: {
    parameters: ["buffer", "i32", "i32"],
    result: "i32",
    // nonblocking: true,
  },

  ioctl: {
    parameters: ["i32", "i64"],
    result: "i32",
  },

  ioctl1: {
    parameters: ["i32", "i64", "buffer"],
    result: "i32",
    name: "ioctl",
  },

  tcgetattr: {
    parameters: ["i32", "buffer"],
    result: "i32",
  },

  tcsetattr: {
    parameters: ["i32", "i32", "buffer"],
    result: "i32",
  },

  cfmakeraw: {
    parameters: ["buffer"],
    result: "void",
  },

  fcntl: {
    parameters: ["i32", "i32", "i32"],
    result: "i32",
  },

  strerror: {
    parameters: ["i32"],
    result: "pointer",
  },

  aio_read: {
    parameters: ["buffer"],
    result: "i32",
  },

  aio_write: {
    parameters: ["buffer"],
    result: "i32",
  },

  aio_suspend: {
    parameters: ["buffer", "i32", "buffer"],
    result: "i32",
    nonblocking: true,
  },

  aio_cancel: {
    parameters: ["i32", "buffer"],
    result: "i32",
  },

  aio_error: {
    parameters: ["buffer"],
    result: "i32",
  },

  aio_return: {
    parameters: ["buffer"],
    result: "i64",
  },

  cfsetospeed: {
    parameters: ["buffer", "i32"],
    result: "i32",
  },

  cfsetispeed: {
    parameters: ["buffer", "i32"],
    result: "i32",
  },

  tcflush: {
    parameters: ["i32", "i32"],
    result: "i32",
  },

  close: {
    parameters: ["i32"],
    result: "i32",
  },

  read: {
    parameters: ["i32", "buffer", "i32"],
    result: "i32",
    // nonblocking: true,
  },

  write: {
    parameters: ["i32", "buffer", "i32"],
    result: "i32",
    // nonblocking: true,
  },
}).symbols);

export default getNix;

export class UnixError extends Error {
  errno: number;
  constructor(errno: number) {
    getNix()
    const str = nix.strerror(errno);
    const jstr = Deno.UnsafePointerView.getCString(str!);
    super(`UnixError: ${errno}: ${jstr}`);
    this.errno = errno;
  }
}

export function unwrap(result: number, error?: number) {
  if (result < 0) {
    let errno;
    if (error !== undefined) {
      errno = error;
    } else {
      const lib = Deno.dlopen("libSystem.dylib", {
        errno: {
          type: "i32",
        },
      });
      errno = lib.symbols.errno;
      lib.close();
    }
    throw new UnixError(errno);
  }
  return result;
}

// note Im pretty sure these are different than linix values for the same names (these came from testing on macOS with Apple clang version 14.0.0)
export const CREAD =    0b000000100000000000n
export const CLOCAL =   0b001000000000000000n
export const PARENB =   0b000001000000000000n
export const PARODD =   0b000010000000000000n
export const CSTOPB =   0b000000010000000000n
export const CSIZE =    0b000000001100000000n
export const CS7 =      0b000000001000000000n
export const CS8 =      0b000000001100000000n
export const CRTSCTS =  0b110000000000000000n
export const IXON =     0b000000001000000000n
export const IXOFF =    0b000000010000000000n
export const IXANY =    0b000000100000000000n
export const ICANON =   0b000000000100000000n
export const ECHO =     0b000000000000001000n
export const ECHOE =    0b000000000000000010n
export const ISIG =     0b000000000010000000n
export const VMIN =     0b000000000000010000n
export const VTIME =    0b000000000000010001n
export const TCSANOW =  0b000000000000000000n
export const F_SETFL =  0b000000000000000100n
export const O_RDWR =   0b000000000000000010n
export const O_NOCTTY = 0b100000000000000000n
export const O_NDELAY = 0b000000000000000100n
export const OPOST =    0b000000000000000001n

export const INPCK =    0b000000000000010000n
export const IGNPAR =   0b000000000000000100n
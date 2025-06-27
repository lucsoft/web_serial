import { SerialOpenOptions } from "./common/serial_port.ts"
import type { SerialPortInfo, SerialPort } from "./common/web_serial.ts";
// import { getPortsDarwin } from "./darwin/enumerate.ts";
import { getPortsWin, SerialPortWin } from "./windows/mod.ts"
import { getPortsDarwin } from "./darwin/enumerate.ts"
import { SerialPortDarwin } from "./darwin/serial_port.ts"
import { getPortsLinux } from "./linux/enumerate.ts"
import { SerialPortLinux } from "./linux/serial_port.ts"

export function getPorts() : SerialPortInfo[] {
    if (Deno.build.os === "windows") {
        return getPortsWin()
    } else if (Deno.build.os === "darwin") {
        return getPortsDarwin()
    } else if (Deno.build.os === "linux") {
        return getPortsLinux()
    } else {
        throw new Error(`Unsupported OS: ${Deno.build.os}`)
    }
}

export async function open(options: SerialOpenOptions) : Promise<SerialPort> {
    if (Deno.build.os === "windows") {
        return new SerialPortWin(options)
    } else if (Deno.build.os === "darwin") {
        const port = (new SerialPortDarwin(options.name))
        port.open(options)
        return port
    } else if (Deno.build.os === "linux") {
        const port = (new SerialPortLinux(options.name))
        port.open(options)
        return port
    } else {
        throw new Error(`Unsupported OS: ${Deno.build.os}`)
    }
}

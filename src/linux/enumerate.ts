import { FileSystem, glob } from "https://deno.land/x/quickr@0.7.4/main/file_system.js"

export async function getPortsLinux() {
  let ports = []
  for (const each of Deno.readDirSync("/dev/")) {
    if (!each.isDirectory && each.name.startsWith("tty")) {
      let type = each.name.startsWith("ttyUSB") ? "USB" : undefined
      ports.push({name:"/dev/" + each.name, type})
    }
  }
  return ports
}
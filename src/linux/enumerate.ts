import { FileSystem, glob } from "https://deno.land/x/quickr@0.7.4/main/file_system.js"

export async function getPortsLinux() {
  let ports = []
  for (const each of Deno.readDirSync("/dev/")) {
    if (each.name.startsWith("tty")) {
      ports.push({name:"/dev/" + each.name})
    }
  }
  return ports
}
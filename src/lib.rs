use serde::Serialize;
use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::ptr::null_mut;
use std::sync::{Arc, Mutex};
use std::{io, thread};

#[derive(Serialize)]
pub struct UsbPortDevice {
    internal_id: String,
    vendor_id: u16,
    product_id: u16,
    serial_number: Option<String>,
    manufacturer: Option<String>,
    product: Option<String>,
}

pub struct Context {
    port: Arc<Mutex<Box<dyn serialport::SerialPort>>>,
    closing: bool,
}

#[unsafe(no_mangle)]
pub extern "C" fn wsa_get_ports() -> *mut c_char {
    let ports = serialport::available_ports().expect("No ports found!");

    let list: Vec<UsbPortDevice> = ports
        .iter()
        .filter_map(|p| {
            if let serialport::SerialPortType::UsbPort(info) = &p.port_type {
                Some(UsbPortDevice {
                    internal_id: p.port_name.clone(),
                    vendor_id: info.vid,
                    product_id: info.pid,
                    serial_number: info.serial_number.clone(),
                    manufacturer: info.manufacturer.clone(),
                    product: info.product.clone(),
                })
            } else {
                None
            }
        })
        .collect();

    let json = serde_json::to_string(&list).expect("Failed to serialize ports");
    let c_string = CString::new(json).expect("Failed to create CString");
    c_string.into_raw()
}

/// # Safety
/// This function is unsafe because it assumes that the pointer passed to it was created by Rust
#[unsafe(no_mangle)]
pub unsafe extern "C" fn wsa_free_cstring(ptr: *mut c_char) {
    if ptr.is_null() {
        return;
    }
    unsafe {
        let _ = CString::from_raw(ptr);
    }
}

/// # Safety
/// This function is unsafe because it assumes that the pointer passed to it was created by Rust
#[unsafe(no_mangle)]
pub unsafe extern "C" fn wsa_connect(name_ptr: *mut c_char, baud_rate: u32) -> *mut Context {
    let _name = unsafe { CStr::from_ptr(name_ptr).to_string_lossy().into_owned() };

    let port = serialport::new(_name, baud_rate).open();

    if port.is_err() {
        println!("Failed to open port: {}", port.err().unwrap());
        return null_mut();
    }

    let port = Arc::new(Mutex::new(port.unwrap()));

    let ctx = Box::new(Context {
        port,
        closing: false,
    });

    Box::into_raw(ctx)
}

/// # Safety
/// This function is unsafe because it assumes that the pointer passed to it was created by Rust
#[unsafe(no_mangle)]
pub unsafe extern "C" fn wsa_read(
    ctx_ptr: *mut Context,
    read_block: extern "C" fn(size: usize, data: *const u8),
    disconnect: extern "C" fn(),
) {
    let ctx = unsafe { &*ctx_ptr };

    thread::spawn(move || {
        let port = Arc::clone(&ctx.port);
        let mut buf = [0u8; 1024];
        loop {
            if ctx.closing {
                break;
            }

            let mut port = port.lock().unwrap();

            match port.read(&mut buf) {
                Ok(bytes_read) => {
                    if bytes_read > 0 {
                        read_block(bytes_read, buf.as_ptr());
                    }
                }
                Err(ref e) if e.kind() == io::ErrorKind::TimedOut => continue,
                Err(err) => {
                    println!("Error reading from port: {err}");
                    disconnect();
                    if err.kind() == io::ErrorKind::BrokenPipe {
                        break;
                    }
                }
            }
        }
    });
}

/// # Safety
/// This function is unsafe because it assumes that the pointer passed to it was created by Rust
#[unsafe(no_mangle)]
pub unsafe extern "C" fn wsa_write(ctx_ptr: *mut Context, data: *const u8, size: usize) -> bool {
    let ctx = unsafe { &*ctx_ptr };

    let buf = unsafe { std::slice::from_raw_parts(data, size) };

    {
        let port = Arc::clone(&ctx.port);
        let mut port = port.lock().unwrap();
        port.write_all(buf).is_ok()
    }
}

/// # Safety
/// This function is unsafe because it assumes that the pointer passed to it was created by Rust
#[unsafe(no_mangle)]
pub unsafe extern "C" fn wsa_disconnect(ctx_ptr: *mut Context) {
    let ctx = unsafe { &mut *ctx_ptr };

    ctx.closing = true;
    let port = Arc::clone(&ctx.port);
    let port = port.lock().unwrap();

    drop(port);

    unsafe {
        drop(Box::from_raw(ctx_ptr));
    }
}

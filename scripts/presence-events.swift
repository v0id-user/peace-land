// Prints macOS power and lock events, one per line, for scripts/presence.ts:
//   ready       registered for events
//   will-sleep  the Mac is about to sleep; sleep waits until "ack" arrives on stdin (max 10s)
//   wake        the Mac powered back on
//   lock        the screen locked
//   unlock      the screen unlocked
// Exits when stdin closes, so it never outlives the reporter that started it.
//
//   swiftc -O scripts/presence-events.swift -o ~/.local/bin/v0id-presence-events

import Foundation
import IOKit.pwr_mgt

setvbuf(stdout, nil, _IOLBF, 0)

// iokit_common_msg() values; the C macros are not imported into Swift.
let canSystemSleep: UInt32 = 0xE000_0270
let systemWillSleep: UInt32 = 0xE000_0280
let systemHasPoweredOn: UInt32 = 0xE000_0300
let sleepHoldSeconds = 10.0

let ack = DispatchSemaphore(value: 0)
var rootPort: io_connect_t = 0

Thread.detachNewThread {
  while let line = readLine() {
    if line == "ack" { ack.signal() }
  }
  exit(0)
}

let callback: IOServiceInterestCallback = { _, _, messageType, messageArgument in
  switch messageType {
  case canSystemSleep:
    IOAllowPowerChange(rootPort, Int(bitPattern: messageArgument))
  case systemWillSleep:
    print("will-sleep")
    _ = ack.wait(timeout: .now() + sleepHoldSeconds)
    IOAllowPowerChange(rootPort, Int(bitPattern: messageArgument))
  case systemHasPoweredOn:
    print("wake")
  default:
    break
  }
}

var notifyPort: IONotificationPortRef?
var notifier: io_object_t = 0
rootPort = IORegisterForSystemPower(nil, &notifyPort, callback, &notifier)
if rootPort == 0 {
  FileHandle.standardError.write("presence-events: IORegisterForSystemPower failed\n".data(using: .utf8)!)
  exit(1)
}
CFRunLoopAddSource(CFRunLoopGetCurrent(), IONotificationPortGetRunLoopSource(notifyPort).takeUnretainedValue(), .defaultMode)

let center = DistributedNotificationCenter.default()
center.addObserver(forName: .init("com.apple.screenIsLocked"), object: nil, queue: nil) { _ in print("lock") }
center.addObserver(forName: .init("com.apple.screenIsUnlocked"), object: nil, queue: nil) { _ in print("unlock") }

print("ready")
CFRunLoopRun()

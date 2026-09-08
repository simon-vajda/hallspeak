import AVFoundation
import ExpoModulesCore
import WebRTC

/**
 Owns the listening session on iOS.

 libwebrtc's `RTCAudioSession` defaults to a call posture — `playAndRecord` with the
 voice-chat mode — and fights any other library that sets a category, so this module is the
 one owner: `expo-audio` is deliberately not installed. Two things here are defensive rather
 than merely conventional, because a receive-only peer connection is the case libwebrtc is
 least exercised on. The configuration asks for a playback posture, so the audio arrives on
 the media volume rather than the call volume and does not bias toward the earpiece; and the
 session is activated explicitly rather than left to auto-activation on track arrival, which
 has a long history of producing a live track with no sound.
 */
public class LinguacastAudioModule: Module {
  private var active = false

  public func definition() -> ModuleDefinition {
    Name("LinguacastAudio")

    Events("onRouteChange")

    // Before any peer connection exists: libwebrtc reads this configuration when it builds
    // its audio unit, and a configuration set afterwards is a configuration it has already
    // ignored.
    OnCreate {
      let configuration = RTCAudioSessionConfiguration.webRTC()
      configuration.category = AVAudioSession.Category.playback.rawValue
      configuration.mode = AVAudioSession.Mode.default.rawValue
      configuration.categoryOptions = [.allowBluetoothA2DP, .allowAirPlay]
      RTCAudioSessionConfiguration.setWebRTC(configuration)

      NotificationCenter.default.addObserver(
        self,
        selector: #selector(self.routeChanged),
        name: AVAudioSession.routeChangeNotification,
        object: nil
      )
    }

    OnDestroy {
      NotificationCenter.default.removeObserver(self)
    }

    AsyncFunction("activate") {
      try self.setSession(active: true)
    }

    AsyncFunction("deactivate") {
      try self.setSession(active: false)
    }

    Function("isActive") { () -> Bool in
      self.active
    }

    Function("currentRoute") { () -> String? in
      Self.routeName()
    }
  }

  /// Idempotent in both directions: the playback hold keeps the session across a producer
  /// that closed, and asking again for what is already held must not disturb it.
  private func setSession(active: Bool) throws {
    if active == self.active {
      return
    }

    let session = RTCAudioSession.sharedInstance()
    session.lockForConfiguration()
    defer { session.unlockForConfiguration() }

    if active {
      try session.setConfiguration(RTCAudioSessionConfiguration.webRTC(), active: true)
    } else {
      try session.setActive(false)
    }

    self.active = active
  }

  @objc private func routeChanged(_ notification: Notification) {
    sendEvent("onRouteChange", ["name": Self.routeName() as Any])
  }

  /// The port actually carrying the audio, or nothing. A name is never invented: the sheet
  /// withholds a label rather than printing one the platform did not give.
  private static func routeName() -> String? {
    AVAudioSession.sharedInstance().currentRoute.outputs.first?.portName
  }
}

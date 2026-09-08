import AVFoundation
import ExpoModulesCore
import MediaPlayer
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
struct NowPlayingInfo: Record {
  @Field var title: String = ""
  @Field var artist: String = ""
}

public class LinguacastAudioModule: Module {
  private var active = false
  private var playing = false
  private var playTarget: Any?
  private var pauseTarget: Any?

  public func definition() -> ModuleDefinition {
    Name("LinguacastAudio")

    Events("onRouteChange", "onRemotePlay", "onRemotePause")

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
      self.disableRemoteCommands()
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

    AsyncFunction("setNowPlaying") { (info: NowPlayingInfo) in
      self.enableRemoteCommands()

      var nowPlaying: [String: Any] = [
        MPMediaItemPropertyTitle: info.title,
        MPMediaItemPropertyArtist: info.artist,
        // Live and non-seekable, which is what withholds a scrubber and a progress bar.
        MPNowPlayingInfoPropertyIsLiveStream: true,
        MPNowPlayingInfoPropertyPlaybackRate: self.playing ? 1.0 : 0.0,
      ]
      nowPlaying[MPMediaItemPropertyPlaybackDuration] = 0.0
      MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlaying
    }

    AsyncFunction("clearNowPlaying") {
      self.disableRemoteCommands()
      MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
      MPNowPlayingInfoCenter.default().playbackState = .stopped
    }

    AsyncFunction("setPlaybackState") { (playing: Bool) in
      self.playing = playing
      MPNowPlayingInfoCenter.default().playbackState = playing ? .playing : .paused

      if var nowPlaying = MPNowPlayingInfoCenter.default().nowPlayingInfo {
        nowPlaying[MPNowPlayingInfoPropertyPlaybackRate] = playing ? 1.0 : 0.0
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlaying
      }
    }

    AsyncFunction("presentOutputPicker") {
      Self.presentRoutePicker()
    }.runOnQueue(.main)
  }

  /**
   Play and pause only. Every seek, skip and scrub command is disabled outright rather than
   left at its default: an enabled command the app cannot honour is a control a guest can
   press for nothing, and on iOS an enabled seek command is what adds the scrubber.
   */
  private func enableRemoteCommands() {
    let center = MPRemoteCommandCenter.shared()

    center.playCommand.isEnabled = true
    center.pauseCommand.isEnabled = true

    for command in Self.unsupportedCommands(center) {
      command.isEnabled = false
    }

    if playTarget == nil {
      playTarget = center.playCommand.addTarget { [weak self] _ in
        self?.sendEvent("onRemotePlay")
        return .success
      }
    }

    if pauseTarget == nil {
      pauseTarget = center.pauseCommand.addTarget { [weak self] _ in
        self?.sendEvent("onRemotePause")
        return .success
      }
    }
  }

  private func disableRemoteCommands() {
    let center = MPRemoteCommandCenter.shared()

    if let target = playTarget {
      center.playCommand.removeTarget(target)
      playTarget = nil
    }
    if let target = pauseTarget {
      center.pauseCommand.removeTarget(target)
      pauseTarget = nil
    }

    center.playCommand.isEnabled = false
    center.pauseCommand.isEnabled = false
  }

  private static func unsupportedCommands(_ center: MPRemoteCommandCenter) -> [MPRemoteCommand] {
    [
      center.changePlaybackPositionCommand,
      center.seekForwardCommand,
      center.seekBackwardCommand,
      center.skipForwardCommand,
      center.skipBackwardCommand,
      center.nextTrackCommand,
      center.previousTrackCommand,
      center.changePlaybackRateCommand,
      center.stopCommand,
      center.togglePlayPauseCommand,
    ]
  }

  /**
   iOS exposes its output chooser only as a view, so the picker is mounted offscreen and its
   own button is pressed. There is no API that presents it directly.
   */
  private static func presentRoutePicker() {
    guard
      let window = UIApplication.shared.connectedScenes
        .compactMap({ $0 as? UIWindowScene })
        .flatMap({ $0.windows })
        .first(where: { $0.isKeyWindow })
    else {
      return
    }

    let picker = AVRoutePickerView(frame: .zero)
    picker.isHidden = true
    window.addSubview(picker)

    for control in picker.subviews.compactMap({ $0 as? UIButton }) {
      control.sendActions(for: .touchUpInside)
    }

    DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
      picker.removeFromSuperview()
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

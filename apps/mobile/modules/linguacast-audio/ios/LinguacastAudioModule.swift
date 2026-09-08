import AVFoundation
import ExpoModulesCore
import MediaPlayer
import WebRTC

/**
 Owns the listening session on iOS.

 libwebrtc's `RTCAudioSession` fights any other library that sets a category, so this module
 is the one owner: `expo-audio` is deliberately not installed. The session is also activated
 explicitly rather than left to auto-activation on track arrival, which has a long history of
 producing a live track with no sound on a receive-only connection.
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
  private var volumeObservation: NSKeyValueObservation?

  public func definition() -> ModuleDefinition {
    Name("LinguacastAudio")

    Events("onRouteChange", "onVolumeChange", "onRemotePlay", "onRemotePause")

    // Before any peer connection exists: libwebrtc reads this configuration when it builds
    // its audio unit, and a configuration set afterwards is a configuration it has already
    // ignored.
    OnCreate {
      let configuration = RTCAudioSessionConfiguration.webRTC()
      // playAndRecord, not playback, even though nothing here records: libwebrtc plays
      // through a voice-processing audio unit, and that unit cannot start under a
      // playback-only category — measured as AUIOClient_StartIO failing with -66637 and a
      // live track that makes no sound.
      //
      // What is changed off libwebrtc's default is the mode and the options: the default
      // voice-chat mode applies call processing to interpreted speech and routes to the
      // earpiece, so the mode drops to default and .defaultToSpeaker moves it to the
      // speaker. Bluetooth is A2DP only — allowing HFP as well would drag a headset back
      // down to call quality.
      configuration.category = AVAudioSession.Category.playAndRecord.rawValue
      configuration.mode = AVAudioSession.Mode.default.rawValue
      configuration.categoryOptions = [.defaultToSpeaker, .allowBluetoothA2DP, .allowAirPlay]
      RTCAudioSessionConfiguration.setWebRTC(configuration)

      NotificationCenter.default.addObserver(
        self,
        selector: #selector(self.routeChanged),
        name: AVAudioSession.routeChangeNotification,
        object: nil
      )

      self.observeVolume()
    }

    OnDestroy {
      NotificationCenter.default.removeObserver(self)
      self.volumeObservation?.invalidate()
      self.volumeObservation = nil
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

    /// Read rather than set: routing and level both belong to the platform here.
    Function("systemVolume") { () -> Int in
      Self.currentVolume()
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

  }

  /**
   Play and pause only. Every seek, skip and scrub command is disabled outright rather than
   left at its default: an enabled command the app cannot honour is a control a guest can
   press for nothing, and on iOS an enabled seek command is what adds the scrubber.
   */
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


  @objc private func routeChanged(_ notification: Notification) {
    sendEvent("onRouteChange", ["name": Self.routeName() as Any])
  }

  /// The port actually carrying the audio, or nothing. A name is never invented: the sheet
  /// withholds a label rather than printing one the platform did not give.
  /**
   No notification exists for the device's own volume, so the session's property is observed.
   Without it the level the screen states would be frozen at whatever it read on mount.
   */
  private func observeVolume() {
    volumeObservation = AVAudioSession.sharedInstance().observe(\.outputVolume, options: [.new]) {
      [weak self] _, _ in
      self?.sendEvent("onVolumeChange", ["volume": Self.currentVolume()])
    }
  }

  private static func currentVolume() -> Int {
    Int((AVAudioSession.sharedInstance().outputVolume * 100).rounded())
  }

  private static func routeName() -> String? {
    AVAudioSession.sharedInstance().currentRoute.outputs.first?.portName
  }
}

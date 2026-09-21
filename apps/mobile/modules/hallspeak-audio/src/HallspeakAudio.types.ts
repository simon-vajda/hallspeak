export type HallspeakAudioModuleEvents = {
  /** Fired when the platform moves the audio to a different output. */
  onRouteChange: (event: { name: string | null }) => void;
  /** Fired when the guest changes the device's own media volume. */
  onVolumeChange: (event: { volume: number }) => void;
  /** The platform's own play control was pressed — lock screen, notification, headset. */
  onRemotePlay: () => void;
  /** The platform's own pause control was pressed. */
  onRemotePause: () => void;
  /**
   * The listening session's heartbeat, roughly every two seconds while it is held.
   *
   * React Native stops servicing JavaScript timers while the app is not visible, so a
   * deadline armed with `setTimeout` is not due until a guest looks at the phone — which is
   * the one moment a recovery does not need. Native events keep arriving, so this is the
   * clock the recovery runs on instead.
   */
  onTick: () => void;
  /**
   * The device moved to a different network. Reported because it is the cause a listener's
   * dropped audio has: waiting for ICE and the socket to discover it costs tens of seconds,
   * and the platform knows the moment it happens.
   */
  onNetworkChange: () => void;
};

export interface NowPlayingInfo {
  /** The channel, which is what a guest chose. */
  title: string;
  /** The event beneath it, which is where they are. */
  artist: string;
}

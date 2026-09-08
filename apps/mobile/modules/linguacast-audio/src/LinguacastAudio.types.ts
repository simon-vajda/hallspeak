export type LinguacastAudioModuleEvents = {
  /** Fired when the platform moves the audio to a different output. */
  onRouteChange: (event: { name: string | null }) => void;
  /** Fired when the guest changes the device's own media volume. */
  onVolumeChange: (event: { volume: number }) => void;
  /** The platform's own play control was pressed — lock screen, notification, headset. */
  onRemotePlay: () => void;
  /** The platform's own pause control was pressed. */
  onRemotePause: () => void;
};

export interface NowPlayingInfo {
  /** The channel, which is what a guest chose. */
  title: string;
  /** The event beneath it, which is where they are. */
  artist: string;
}

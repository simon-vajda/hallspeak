export type LinguacastAudioModuleEvents = {
  /** Fired when the platform moves the audio to a different output. */
  onRouteChange: (event: { name: string | null }) => void;
};

Pod::Spec.new do |s|
  s.name           = 'LinguacastAudio'
  s.version        = '1.0.0'
  s.summary        = 'Owns the listener audio session and its system media controls.'
  s.description    = 'Local Expo module: audio session, background survival, now playing.'
  s.author         = ''
  s.homepage       = 'https://linguacast.app'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # The WebRTC framework itself, and the same build react-native-webrtc links: the session
  # this module configures is libwebrtc's own RTCAudioSession, not a second AVAudioSession
  # beside it.
  s.dependency 'JitsiWebRTC', '~> 124.0.0'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end

require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |spec|
  spec.name = 'CineCrewPlayer'
  spec.version = package.fetch('version')
  spec.summary = 'Customizable cross-platform video player with native VLC playback.'
  spec.description = 'CineCrew Player includes its native VLC adapter for React Native playback.'
  spec.homepage = 'https://github.com/nahushr/cinecrew-player'
  spec.license = { :type => 'MIT', :file => 'packages/react-native-vlc-media-player/LICENSE' }
  spec.author = { 'CineCrew' => 'https://github.com/nahushr' }
  spec.source = { :git => 'https://github.com/nahushr/cinecrew-player.git' }
  spec.source_files = 'packages/react-native-vlc-media-player/ios/RCTVLCPlayer/*.{h,m}'
  spec.requires_arc = true
  spec.static_framework = true
  spec.ios.deployment_target = '11.0'
  spec.tvos.deployment_target = '10.2'
  spec.dependency 'React-Core'
  spec.ios.dependency 'MobileVLCKit', '3.5.1'
  spec.tvos.dependency 'TVVLCKit', '3.5.1'
end

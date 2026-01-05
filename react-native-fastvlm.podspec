require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'react-native-fastvlm'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = package['author']
  s.homepage       = package['homepage']
  s.platforms      = { :ios => '17.0' }
  s.swift_version  = '5.9'
  s.source         = { :git => package['repository']['url'], :tag => "v#{s.version}" }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # MLX dependencies for FastVLM
  s.dependency 'mlx-swift', '~> 0.21'
  s.dependency 'mlx-swift-lm', '~> 0.21'
  s.dependency 'ZIPFoundation', '~> 0.9'

  # Source files
  s.source_files = 'ios/**/*.{swift,h,m}'

  # Build settings
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule',
    'OTHER_SWIFT_FLAGS' => '-DMLX_SWIFT'
  }

  # Resource bundles (for model files if bundled)
  # s.resource_bundles = {
  #   'FastVLMResources' => ['ios/Resources/**/*']
  # }
end

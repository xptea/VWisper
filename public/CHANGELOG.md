# Changelog

All notable changes to VWisper will be documented in this file.

## [v1.0.2] - 7/8/2025
**[📥 Download Release](https://github.com/xptea/VWisper/releases/tag/1.0.2)**

### macOS
- **Added**: Dynamic taskbar detection and positioning - wave window automatically adjusts based on Dock visibility
- **Added**: Percentage-based positioning (8% from bottom) for better adaptability across different screen sizes
- **Added**: Smart Dock detection using macOS system preferences
- **Fixed**: Wave window positioning issues when Dock is visible vs hidden

### Windows
- **Added**: Optimized text injection using clipboard method for faster performance
- **Added**: Balanced key monitoring for improved reliability

### Linux
- **Added**: Enhanced audio preprocessing for better speech recognition quality

### All Platforms
#### Performance Optimizations
- **Added**: Dynamic audio processing queue system to prevent overlapping sessions
- **Added**: Enhanced audio preprocessing with high-pass filtering and improved normalization
- **Added**: Minimum audio length validation (200ms) to prevent empty transcriptions
- **Added**: Silence detection with auto-stop after 2 seconds of silence
- **Added**: Balanced timing system for optimal speed vs reliability

#### Text Injection Improvements
- **Added**: Clipboard-based text injection for macOS and Windows (3-5x faster)
- **Added**: Platform-specific optimizations (Cmd+V for macOS, Ctrl+V for Windows)
- **Added**: Fallback to character-by-character injection if clipboard fails
- **Added**: Reusable Enigo instances for better performance

#### Key Monitoring Enhancements
- **Added**: Balanced polling intervals (15ms) for reliable key detection
- **Added**: Optimized debounce timing (25ms) to prevent false triggers
- **Added**: Cross-platform consistency between Windows and macOS

#### Audio Processing
- **Added**: Enhanced audio preprocessing with DC offset removal
- **Added**: Intelligent volume normalization (boosts quiet audio, reduces loud audio)
- **Added**: High-pass filtering to remove low-frequency noise
- **Added**: Soft limiting to prevent audio clipping
- **Added**: Improved mono conversion for stereo inputs

#### Error Handling
- **Added**: Comprehensive error handling for audio processing failures
- **Added**: Graceful handling of insufficient audio length
- **Added**: Better error reporting and user feedback
- **Added**: Automatic cleanup on processing cancellation

#### Technical Improvements
- **Added**: ProcessingJob queue system for sequential audio processing
- **Added**: Thread-safe queue management with Arc<Mutex>
- **Added**: Platform-specific timing optimizations
- **Added**: Enhanced logging for debugging and monitoring

#### Fixed
- **Fixed**: Audio corruption issues from ultra-fast processing
- **Fixed**: "Empty transcription" errors from insufficient audio capture
- **Fixed**: Overlapping audio processing sessions
- **Fixed**: Race conditions in text injection
- **Fixed**: macOS Dock positioning conflicts
- **Fixed**: Audio preprocessing quality issues

#### Changed
- **Changed**: Audio processing from immediate to queue-based
- **Changed**: Text injection from character-by-character to clipboard-based
- **Changed**: Key monitoring from ultra-fast to balanced timing
- **Changed**: Audio preprocessing from minimal to enhanced filtering
- **Changed**: Window positioning from fixed to dynamic calculation

---

## [v1.0.1] - 7/8/2025
**[📥 Download Release](https://github.com/xptea/VWisper/releases/tag/1.0.1)**

### macOS
- Added: Application now fully quits when the Dashboard window is closed (temporary workaround while system-tray support is disabled).

### Windows
- No Windows-specific updates in this release.

### Linux
- No Linux-specific updates in this release.

### All Platforms
#### Added
- Update banner notification system
- Automatic update check functionality
- Improved dashboard window management

#### Fixed
- Issue with opening multiple dashboard windows
- Window focus and positioning improvements

#### Changed
- Enhanced error handling for window operations

---

## [v1.0.0] - 7/7/2025
**[📥 Download Release](https://github.com/xptea/VWisper/releases/tag/1.0.0)**

### Added
- Initial dashboard release
- Core transcription functionality
- Real-time audio processing
- Settings management
- Analytics and usage tracking
- History of transcription sessions
- Text playground for testing
- Groq API integration
- Global hotkey support (Right Ctrl for windows & linux or Left control on mac)
- System tray integration
- Cross-platform support (Windows, macOS, Linux)

### Features
- Live transcription with visual feedback
- Automatic text injection into active applications
- Customizable settings and preferences
- Usage statistics and analytics
- Dark/light/system theme support
- Update checking system
- Changelog viewer

---
# Changelog

All notable changes to VWisper will be documented in this file.

## [v1.0.4] - 7/9/2025
**[📥 Download Release](https://github.com/xptea/VWisper/releases/tag/1.0.4)**

### All Platforms
#### First-Time User Experience
- **Added**: Complete onboarding flow for new users without API keys configured
- **Added**: 5-step guided setup process with progress tracking and step indicators
- **Added**: Welcome screen highlighting VWisper's key features (speed, shortcuts, auto-typing)
- **Added**: Interactive "How VWisper Works" tutorial with step-by-step instructions
- **Added**: Built-in API key setup with direct links to Groq Console
- **Added**: Real-time API key testing and validation during onboarding
- **Added**: Visual feedback for successful API key verification
- **Added**: System-wide text field detection explanation for better user understanding

#### macOS-Specific Enhancements
- **Added**: Dedicated Mac accessibility permission step in onboarding flow
- **Added**: Automatic platform detection to show Mac-specific instructions
- **Added**: Real-time accessibility permission monitoring and status updates
- **Added**: Clear instructions for granting accessibility permissions through System Preferences
- **Added**: Automatic app restart after onboarding completion on macOS to apply accessibility permissions
- **Added**: Mac-specific UI elements and messaging for FN key usage
- **Fixed**: Accessibility permissions now properly take effect after onboarding restart

#### User Interface Improvements
- **Added**: Modern progress bar with percentage completion display
- **Added**: Step-by-step navigation with Previous/Next buttons
- **Added**: Visual step indicators showing current progress
- **Added**: Responsive design that works across different screen sizes
- **Added**: Professional onboarding cards with consistent spacing and typography
- **Added**: Success banners and error handling for better user feedback
- **Changed**: New users are automatically guided through setup instead of seeing empty dashboard
- **Changed**: Existing users with API keys skip onboarding and go directly to dashboard

---

## [v1.0.3] - 7/9/2025
**[📥 Download Release](https://github.com/xptea/VWisper/releases/tag/1.0.3)**

### All Platforms
#### Major UI/UX Redesign
- **Added**: Complete dashboard redesign with modern sidebar navigation using Shadcn UI components
- **Added**: Responsive sidebar with smooth animations and improved visual hierarchy
- **Added**: Full-width dashboard layout utilizing complete screen real estate
- **Added**: Curved corners and improved spacing throughout the interface
- **Added**: Loading states with skeleton components for better user feedback
- **Fixed**: Layout overflow issues and horizontal scrollbars
- **Fixed**: Content area now properly scales and uses available space
- **Changed**: Replaced top navigation bar with collapsible sidebar navigation
- **Changed**: Dashboard now uses modern card-based layout with consistent spacing

#### Enhanced Analytics Dashboard
- **Added**: Comprehensive time frame selector (Last 7 days, 30 days, 90 days, All time)
- **Added**: Dynamic analytics that update based on selected time period
- **Added**: New performance metrics including Words per Minute (WPM) and Characters per Minute (CPM)
- **Added**: Realistic "Time Saved" calculation based on average typing speed (40 WPM)
- **Added**: Quality score metrics for transcription accuracy assessment
- **Added**: Improved word count analytics with better categorization
- **Added**: Enhanced usage statistics with session-based insights
- **Fixed**: Removed duplicate and redundant metric cards
- **Fixed**: "Weekly Average" now displays as whole numbers for better readability
- **Fixed**: All charts and statistics now properly filter by selected time frame
- **Changed**: "Characters Transcribed" renamed to "Total Words" for clarity
- **Changed**: Grouped related metrics together for better organization
- **Changed**: Analytics overview moved exclusively to Analytics page (removed from other sections)

#### Technical Improvements
- **Added**: Proper responsive grid layouts that adapt to screen size
- **Added**: Consistent card design system across all dashboard components
- **Added**: Improved component organization and code structure
- **Fixed**: Scroll behavior and container overflow issues
- **Fixed**: Layout responsiveness across different screen sizes
- **Changed**: Enhanced component architecture for better maintainability

---

## [v1.0.2] - 7/8/2025
**[📥 Download Release](https://github.com/xptea/VWisper/releases/tag/1.0.2)**

### macOS
- **Added**: Fn key global hotkey monitoring using rdev crate for native macOS key detection
- **Added**: Automatic fallback to FN key if Control key detection fails
- **Added**: Dynamic taskbar detection and positioning - wave window automatically adjusts based on Dock visibility
- **Added**: Percentage-based positioning (8% from bottom) for better adaptability across different screen sizes
- **Added**: Smart Dock detection using macOS system preferences
- **Fixed**: Wave window positioning issues when Dock is visible vs hidden
- **Fixed**: Crash when injecting text via clipboard on macOS Sonoma
- **Changed**: Switched macOS text injection to character-by-character typing for improved stability and reliability

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
- **Added**: Thread-safe queue management with Arc
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
- **Changed**: Text injection from character-by-character to clipboard-based (Windows)
- **Changed**: macOS now defaults to character-by-character text injection to avoid clipboard-related crashes
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
- Global hotkey support (Right CTRL key on Windows & Linux and the FN key on Mac)
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
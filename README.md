# VWisper2

A cross-platform Tauri application with global key monitoring capabilities.

## Features

- Cross-platform support (macOS, Linux, Windows)
- Global key monitoring using Right CTRL key on Windows & Linux and the FN key on Mac
- Modular Rust codebase
- Wave window management

## Project Structure

```
src-tauri/src/
├── lib.rs              # Main library entry point
├── main.rs             # Binary entry point
├── mod.rs              # Module declarations
├── commands.rs         # Tauri commands for window management
├── state.rs            # Global application state management
└── platform/           # Platform-specific implementations
    ├── mod.rs          # Platform module declarations
    ├── macos.rs        # macOS key monitoring
    ├── linux.rs        # Linux key monitoring
    └── windows.rs      # Windows key monitoring
```

## Building

### Prerequisites

- [Rust](https://rustup.rs/)
- [Tauri CLI](https://tauri.app/v2/guides/getting-started/setup/)

### Development

1. Install dependencies:
   ```bash
   bun install
   ```

2. Run in development mode:
   ```bash
   bun run tauri dev
   ```

### Building for Production

Build for your current platform:
```bash
bun run tauri build
```

Build for specific platforms:
```bash
# macOS
bun run tauri build --target aarch64-apple-darwin
bun run tauri build --target x86_64-apple-darwin

# Linux
bun run tauri build --target x86_64-unknown-linux-gnu

# Windows
bun run tauri build --target x86_64-pc-windows-msvc
```

## Installation

### macOS

1. Download `VWisper_1.0.1.dmg` from the [Releases](https://github.com/xptea/VWisper/releases) page.
2. Double-click the DMG to mount it. A window will appear showing `VWisper.app` and an **Applications** shortcut.
3. **Drag and drop** `VWisper.app` onto the **Applications** folder.
4. Eject the disk image, then launch VWisper from `/Applications`.

> On first launch macOS will ask for Microphone and Accessibility permissions—grant both so VWisper can record audio and handle global shortcuts.

### Windows

1. Download either `vwisper_1.0.1_x64-setup.exe` (regular installer) **or** `vwisper_1.0.1_x64_en-US.msi` from the Releases page.
2. Run the chosen installer and follow the prompts.
3. After installation, start VWisper from the Start Menu or the desktop shortcut.

### Linux (coming soon)

Pre-built packages for major distributions will be provided in a future release. Until then you can clone the repository and follow the **Building** instructions above to build from source.

## Usage

1. Start the application
2. Hold the Right CTRL key on Windows & Linux and the FN key on Mac anywhere on your system to show the wave window
3. Release the Right CTRL key on Windows & Linux and the FN key on Mac to hide the wave window

## Platform Support

### macOS
- Uses `device_query` crate for global key monitoring
- Supports both Intel and Apple Silicon

### Linux
- Uses `device_query` crate for global key monitoring
- Works with X11 and Wayland (via device_query)

### Windows
- Uses `device_query` crate for global key monitoring
- Supports Windows 10 and later

## Development Notes

- The application uses a modular architecture for better maintainability
- Platform-specific code is isolated in the `platform/` directory
- Global state is managed through the `state.rs` module
- Tauri commands are defined in `commands.rs`

### macOS Issues
On macOS, you may need to grant accessibility permissions to the application in System Preferences > Security & Privacy > Privacy > Accessibility.

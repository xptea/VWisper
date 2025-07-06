# VWisper2

A cross-platform Tauri application with global key monitoring capabilities.

## Features

- Cross-platform support (macOS, Linux, Windows)
- Global key monitoring using Control key
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
- [Bun](https://bun.sh/) (for frontend dependencies)
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

## Usage

1. Start the application
2. Hold the Control key anywhere on your system to show the wave window
3. Release the Control key to hide the wave window

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

## Troubleshooting

### Linux Issues
If you encounter permission issues on Linux, you may need to run the application with elevated privileges for global key monitoring:
```bash
sudo bun run tauri dev
```

### Windows Issues
On Windows, ensure you're running the latest version and have the necessary Visual Studio build tools installed.

### macOS Issues
On macOS, you may need to grant accessibility permissions to the application in System Preferences > Security & Privacy > Privacy > Accessibility.

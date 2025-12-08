# paperlesspaper-web

> ⚠️ **Warning: This project is a work in progress!**

## Overview

**paperlesspaper-web** is a modern web application for creating, editing, and managing paperlesspaper ePaper devices. It provides a modular, extensible interface for customizing visual elements, integrating with external services, and managing user settings—all in a user-friendly, browser-based environment that also works as an app on Android and iOS.

## Features

- Modular widget editors (e.g., Calendar, Weather, RSS, Baby Birth, etc.)
- Customizable color palettes and dithering options
- Icon selection and management
- Integration with external services (Google Calendar, Weather, RSS, etc.)
- Device and user settings management
- Modern, responsive UI with SCSS modules

## Project Structure

- `index.tsx` – Main entry point
- `dither/` – Dithering algorithms, color helpers, palettes, and utilities
- `Fields/` – UI components for field editing (color, language, LUT, etc.)
- `Icons/` – Icon components and SVG assets
- `Integrations/` – Integration editors and assets for external services
- `Overview/` – Overview and photo frame components
- `Settings/` – Device and user settings components

## Getting Started

### Prerequisites

- Node.js (v18 or later recommended)
- npm or yarn

### Installation

1. Clone the repository:
   ```sh
   git clone https://github.com/paperlesspaper/paperlesspaper-web.git
   cd paperlesspaper-web
   ```
2. Install dependencies:
   ```sh
   npm install
   # or
   yarn install
   ```

### Running the App

Start the development server:

```sh
npm run dev
# or
yarn dev
```

The app will be available at `http://localhost:3000` by default.

## Usage

1. Open the app in your browser.
2. Select or create a widget from the available editors.
3. Customize fields, colors, icons, and integrations as needed.
4. Save or export your configuration.

## Contributing

Contributions are welcome! Please open issues or pull requests for bug fixes, new features, or improvements.

1. Fork the repository
2. Create a new branch (`git checkout -b feature/your-feature`)
3. Commit your changes
4. Push to your fork and open a pull request

## License

This project is licensed under the Apache License, Version 2.0. See the [LICENSE](LICENSE) file for details.

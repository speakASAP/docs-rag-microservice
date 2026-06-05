# Incab Static Files

This directory contains static files for the incab section of the portal.

## Directory Structure

```
incab/
├── css/                    # CSS files
├── js/                     # JavaScript files
│   ├── plugins/           # Third-party plugins
│   ├── vendor/            # Vendor dependencies
│   └── inspinia.js        # Main application script
└── dist/                  # Compiled bundles
    ├── vendor-core-*.bundle.min.js  # Core Angular.js dependencies
    ├── vendor-optional.bundle.min.js # Optional Angular.js modules
    ├── plugins-core.bundle.min.js   # Core plugins
    └── plugins-optional.bundle.min.js # Optional plugins
```

## Build Process

The JavaScript files are bundled using webpack. To build:

1. Install dependencies:

```bash
npm install
```

1. Run the build:

```bash
npm run build
```

This will generate optimized bundles in the `dist` directory.

## Bundle Structure

- Core bundles (loaded immediately):
  - `vendor-core-*.bundle.min.js` - Core Angular.js dependencies
  - `plugins-core.bundle.min.js` - Core plugins (jQuery, datepicker, etc.)

- Optional bundles (loaded on demand):
  - `vendor-optional.bundle.min.js` - Optional Angular.js modules (ocLazyLoad)
  - `plugins-optional.bundle.min.js` - Optional plugins (pace.js)

## Development

To watch for changes during development:

```bash
npm run watch
```

## Dependencies

- Angular.js 1.8.3
- jQuery 2.2.4
- Bootstrap 3.x
- Various Angular.js plugins and UI components

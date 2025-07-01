# MCP IIIF Images Server

A Model Context Protocol (MCP) server for working with IIIF (International Image Interoperability Framework) manifests and images.   See [this video](https://youtu.be/vsVKQWhAFBg) for a demonstration.

## Features

This MCP server contains the following tools:
- `fetch_iiif_manifest`: Fetch a IIIF manifest from a URL.  (Note that clients may have difficulty processing large amounts of JSON.)
- `fetch_iiif_image`: Retrieve a IIIF image from a base URI, fetching info.json and returning the image data (default: max 1500px dimension, max 1,000,000 pixels total)
- `fetch_iiif_image_region`: Retrieve a specific region of a IIIF image using percentage coordinates, with the region scaled to fit within the same constraints

*Caveats*
- The code scales the images to dimensions acceptable to Claude.  It will not work with a Level 0 Image API implementation.
- Claude may not process some IIIF Manifests due to the size of the file.

## Claude Desktop Configuration

### Install from Claude Desktop Extension (DXT) file

1. Install and log in to Claude Desktop
2. Download the `.dxt` file from the [latest release](https://github.com/mikeapp/mcp-iiif-images/releases) 
3. Double-click the `.dxt` file
4. Install the extension when prompted by Claude

### Install from Source Code

1. Clone this repository
2. Install dependencies: `npm install`
3. Make the server executable: `chmod +x server/server.js`

To use this MCP server with Claude Desktop, add the following configuration to your Claude Desktop config file. Adjust the file path as necessary. You may also need to provide the full path to your `node` command.

#### macOS
Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mcp-iiif-images": {
      "command": "node",
      "args": ["/PATH/TO/mcp-iiif-images/server/server.js"]
    }
  }
}
```

#### Windows
Edit `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mcp-iiif-images": {
      "command": "node",
      "args": ["C:\\path\\to\\mcp-iiif-images\\server\\server.js"]
    }
  }
}
```

#### Linux
Edit `~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mcp-iiif-images": {
      "command": "node",
      "args": ["/path/to/mcp-iiif-images/server/server.js"]
    }
  }
}
```

## General MCP Usage

The server supports two transport modes:

### Standard Mode (stdio)
Run the server using stdio transport (default):
```bash
npm start
# or
node server/server.js
```

### HTTP Streaming Mode
Run the server using HTTP streaming transport:
```bash
node server/server.js --http
# or with custom port
node server/server.js --http --port 8080
```

### Command-line Options
- `--http`: Use HTTP streaming transport instead of stdio
- `--port PORT`: Port number for HTTP server (default: 3000)
- `--help`: Show help message

When using HTTP mode, the server will start an HTTP server with the following endpoints:
- `GET /sse`: Establish Server-Sent Events connection
- `POST /messages?sessionId=<id>`: Send MCP messages



### HTTP Streaming Mode

For HTTP streaming mode, you'll need to start the server manually with the `--http` flag and then configure Claude Desktop to connect via HTTP:

```bash
node server/server.js --http --port 3000
```

Then configure Claude Desktop to use the HTTP transport (refer to Claude Desktop documentation for HTTP transport configuration).

**Note**: Update the path in the `args` array to match the actual location where you've installed this server.

After updating the configuration, restart Claude Desktop for the changes to take effect.

## Testing

To run the tests:

```bash
# Run tests once
npm test

# Run tests in watch mode (automatically re-runs on file changes)
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

The project uses [Vitest](https://vitest.dev/) as the testing framework, which provides:
- Fast execution with ES modules support
- Jest-compatible API with better error messages
- Built-in coverage reporting
- Watch mode for development

## Available Tools

### fetch_iiif_manifest
Fetches and validates a IIIF manifest from a URL.

**Parameters:**
- `url` (required): The URL of the IIIF manifest to fetch

**Example usage:**
```
Please fetch the IIIF manifest from https://example.com/manifest.json
```

### fetch_iiif_image
Retrieve a IIIF image from a base URI, fetching info.json and returning the image data (default: max 1500px dimension, max 1,000,000 pixels total).

**Parameters:**
- `baseUri` (required): Base URI of the IIIF Image API resource (without /info.json)

**Example usage:**
```
Fetch the IIIF image at https://example.com/iiif/image123
```

### fetch_iiif_image_region
Retrieve a specific region of a IIIF image using percentage coordinates, with the region scaled to fit within the same constraints. Use this to fetch regions of interest at higher detail for more accurate image description and analysis.

**Parameters:**
- `baseUri` (required): Base URI of the IIIF Image API resource (without /info.json)
- `region` (required): Region in pct: format (e.g., 'pct:20,20,50,50' for x,y,width,height as percentages)

**Example usage:**
```
Fetch a region from the IIIF image at https://example.com/iiif/image123 with region pct:10,10,50,50
```


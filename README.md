# MCP IIIF Images Server

A Model Context Protocol (MCP) server for working with IIIF (International Image Interoperability Framework) manifests.

## Features

- `fetch_iiif_manifest`: Fetch and validate IIIF manifests from URLs
- `fetch_iiif_image`: Generate IIIF image URLs with proper size constraints

## Installation

1. Clone this repository
2. Install dependencies: `npm install`
3. Make the server executable: `chmod +x server.js`

## Usage

Run the server directly:
```bash
npm start
```

## Claude Desktop Configuration

To use this MCP server with Claude Desktop, add the following configuration to your Claude Desktop config file.   Adjust the file path as necessary.  You may also need to provide the fill path to your `node` command.

### macOS
Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mcp-iiif-images": {
      "command": "node",
      "args": ["/PATH/TO/mcp-iiif-images/server.js"]
    }
  }
}
```

### Windows
Edit `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mcp-iiif-images": {
      "command": "node",
      "args": ["C:\\path\\to\\mcp-iiif-images\\server.js"]
    }
  }
}
```

### Linux
Edit `~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mcp-iiif-images": {
      "command": "node",
      "args": ["/path/to/mcp-iiif-images/server.js"]
    }
  }
}
```

**Note**: Update the path in the `args` array to match the actual location where you've installed this server.

After updating the configuration, restart Claude Desktop for the changes to take effect.

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
Generates a IIIF image URL from a base URI by fetching the info.json and creating a URL for an image up to 2000px on the long edge.

**Parameters:**
- `baseUri` (required): Base URI of the IIIF Image API resource (without /info.json)

**Example usage:**
```
Fetch the IIIF image at https://example.com/iiif/image123
```


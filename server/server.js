#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { IIIFImageHandler } from "./iiif-image-handler.js";
import express from "express";
import { randomUUID } from "node:crypto";

class IIIFMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "mcp-iiif-images",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.iiifImageHandler = new IIIFImageHandler(2000);
    this.setupToolHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "fetch_iiif_manifest",
            description: "Fetch and validate a IIIF manifest from a URL",
            inputSchema: {
              type: "object",
              properties: {
                url: {
                  type: "string",
                  description: "URL of the IIIF manifest to fetch",
                },
              },
              required: ["url"],
            },
          },
          {
            name: "fetch_iiif_image",
            description: "Retrieve a IIIF image from a base URI, fetching info.json and returning the image data up to 2000px on the long edge",
            inputSchema: {
              type: "object",
              properties: {
                baseUri: {
                  type: "string",
                  description: "Base URI of the IIIF Image API resource (without /info.json)",
                },
              },
              required: ["baseUri"],
            },
          },
          {
            name: "fetch_iiif_image_region",
            description: "Retrieve a specific region of a IIIF image using percentage coordinates, with the region scaled to fit within 2000px on the long edge. Use this to fetch regions of interest at higher detail for more accurate image description and analysis.",
            inputSchema: {
              type: "object",
              properties: {
                baseUri: {
                  type: "string",
                  description: "Base URI of the IIIF Image API resource (without /info.json)",
                },
                region: {
                  type: "string",
                  description: "Region in pct: format (e.g., 'pct:20,20,50,50' for x,y,width,height as percentages)",
                },
              },
              required: ["baseUri", "region"],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === "fetch_iiif_manifest") {
        const { url } = args;
        
        if (!url) {
          throw new Error("URL parameter is required");
        }

        try {
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const contentType = response.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            console.warn(`Warning: Content-Type is ${contentType}, expected application/json`);
          }

          const text = await response.text();
          let jsonData;
          
          try {
            jsonData = JSON.parse(text);
          } catch (parseError) {
            throw new Error(`Invalid JSON: ${parseError.message}`);
          }

          // Validate IIIF manifest structure
          const context = jsonData["@context"];
          if (!context) {
            throw new Error("Invalid IIIF manifest: missing @context property");
          }
          
          let hasValidContext = false;
          if (typeof context === "string") {
            hasValidContext = context.startsWith("http://iiif.io/api/presentation/");
          } else if (Array.isArray(context)) {
            hasValidContext = context.some(ctx => 
              typeof ctx === "string" && ctx.startsWith("http://iiif.io/api/presentation/")
            );
          }
          
          if (!hasValidContext) {
            throw new Error("Invalid IIIF manifest: @context must contain a IIIF presentation API URL");
          }

          const hasValidType = (jsonData["@type"] === "sc:Manifest") || (jsonData["type"] === "Manifest");
          if (!hasValidType) {
            throw new Error("Invalid IIIF manifest: must have @type of 'sc:Manifest' or type of 'Manifest'");
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(jsonData, null, 2),
              },
            ],
          };
        } catch (error) {
          throw new Error(`Failed to fetch IIIF manifest: ${error.message}`);
        }
      }

      if (name === "fetch_iiif_image") {
        const { baseUri } = args;
        
        try {
          const result = await this.iiifImageHandler.generateImageUrl(baseUri, true);
          
          return {
            content: [
              {
                type: "resource",
                resource: {
                  uri: result.imageUrl,
                  mimeType: result.imageData.contentType,
                  blob: result.imageData.base64
                }
              }
            ],
          };
        } catch (error) {
          throw new Error(`Failed to fetch IIIF image: ${error.message}`);
        }
      }

      if (name === "fetch_iiif_image_region") {
        const { baseUri, region } = args;
        
        try {
          const result = await this.iiifImageHandler.generateImageRegionUrl(baseUri, region, true);
          
          return {
            content: [
              {
                type: "resource",
                resource: {
                  uri: result.imageUrl,
                  mimeType: result.imageData.contentType,
                  blob: result.imageData.base64
                }
              }
            ],
          };
        } catch (error) {
          throw new Error(`Failed to fetch IIIF image region: ${error.message}`);
        }
      }

      throw new Error(`Unknown tool: ${name}`);
    });
  }

  async run(useHttp = false, port = 3000) {
    if (useHttp) {
      await this.runHttpServer(port);
    } else {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
    }
  }

  async runHttpServer(port = 3000) {
    const app = express();
    app.use(express.json());

    // Store transports by session ID
    const transports = {};

    // Handle SSE endpoint for MCP
    app.get('/sse', async (req, res) => {
      console.log('Received GET request to /sse - establishing SSE connection');
      const transport = new SSEServerTransport('/messages', res);
      transports[transport.sessionId] = transport;
      
      res.on("close", () => {
        delete transports[transport.sessionId];
      });

      await this.server.connect(transport);
    });

    // Handle POST messages
    app.post("/messages", async (req, res) => {
      const sessionId = req.query.sessionId;
      const transport = transports[sessionId];
      
      if (transport) {
        await transport.handlePostMessage(req, res, req.body);
      } else {
        res.status(400).send('No transport found for sessionId');
      }
    });

    // Start the server
    app.listen(port, () => {
      console.log(`MCP IIIF Images server listening on port ${port}`);
      console.log(`SSE endpoint: http://localhost:${port}/sse`);
      console.log(`Messages endpoint: http://localhost:${port}/messages`);
    });

    // Handle server shutdown
    process.on('SIGINT', async () => {
      console.log('Shutting down server...');
      // Close all active transports
      for (const sessionId in transports) {
        try {
          console.log(`Closing transport for session ${sessionId}`);
          await transports[sessionId].close();
          delete transports[sessionId];
        } catch (error) {
          console.error(`Error closing transport for session ${sessionId}:`, error);
        }
      }
      console.log('Server shutdown complete');
      process.exit(0);
    });
  }
}

// Parse command-line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let useHttp = false;
  let port = 3000;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--http') {
      useHttp = true;
    } else if (args[i] === '--port' && i + 1 < args.length) {
      port = parseInt(args[i + 1], 10);
      i++; // Skip the next argument since we consumed it
    } else if (args[i] === '--help') {
      console.log(`
Usage: node server.js [options]

Options:
  --http        Use HTTP streaming transport instead of stdio (default: false)
  --port PORT   Port number for HTTP server (default: 3000)
  --help        Show this help message

Examples:
  node server.js                    # Run with stdio transport
  node server.js --http             # Run with HTTP transport on port 3000
  node server.js --http --port 8080 # Run with HTTP transport on port 8080
`);
      process.exit(0);
    }
  }

  if (isNaN(port) || port < 1 || port > 65535) {
    console.error('Error: Port must be a number between 1 and 65535');
    process.exit(1);
  }

  return { useHttp, port };
}

const { useHttp, port } = parseArgs();
const server = new IIIFMCPServer();
server.run(useHttp, port).catch(console.error);
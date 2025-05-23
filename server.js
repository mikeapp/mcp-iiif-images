#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { IIIFImageHandler } from "./iiif-image-handler.js";

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
            description: "Generate a IIIF image URL from a base URI, fetching info.json and creating a URL for an image up to 2000px on the long edge",
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

      throw new Error(`Unknown tool: ${name}`);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

const server = new IIIFMCPServer();
server.run().catch(console.error);
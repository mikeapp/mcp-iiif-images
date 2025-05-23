/**
 * IIIF Image API handler for generating image URLs with proper size constraints
 */
export class IIIFImageHandler {
  constructor(maxDimension = 2000) {
    this.maxDimension = maxDimension;
  }

  /**
   * Generate a IIIF image URL from a base URI
   * @param {string} baseUri - Base URI of the IIIF Image API resource
   * @param {boolean} fetchImage - Whether to fetch the actual image bytes
   * @returns {Promise<{imageUrl: string, info: object, imageData?: object}>} Generated URL, info, and optional image data
   */
  async generateImageUrl(baseUri, fetchImage = false) {
    if (!baseUri) {
      throw new Error("baseUri parameter is required");
    }

    // Ensure baseUri doesn't end with trailing slash
    const cleanBaseUri = baseUri.replace(/\/$/, '');
    const infoUrl = `${cleanBaseUri}/info.json`;
    
    // Fetch the info.json document
    const response = await fetch(infoUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    let info;
    
    try {
      info = JSON.parse(text);
    } catch (parseError) {
      throw new Error(`Invalid JSON in info.json: ${parseError.message}`);
    }

    // Extract width and height
    const width = info.width;
    const height = info.height;
    
    if (!width || !height) {
      throw new Error("Missing width or height in info.json");
    }

    // Determine API version
    const apiVersion = info["@context"] || info.profile;
    const isVersion3 = Array.isArray(apiVersion) ? 
      apiVersion.some(ctx => typeof ctx === 'string' && ctx.includes('/image/3/')) :
      (typeof apiVersion === 'string' && apiVersion.includes('/image/3/'));

    // Calculate constraints
    const constraints = this.calculateConstraints(info, width, height, isVersion3);
    
    // Calculate final dimensions
    const dimensions = this.calculateFinalDimensions(
      width, 
      height, 
      constraints, 
      isVersion3
    );

    // Determine size parameter
    const sizeParam = this.determineSizeParameter(
      dimensions.targetWidth,
      dimensions.targetHeight,
      width,
      height,
      isVersion3
    );

    // Build the image URL according to IIIF Image API
    const imageUrl = `${cleanBaseUri}/full/${sizeParam}/0/default.jpg`;

    const result = {
      imageUrl,
      info: {
        originalDimensions: { width, height },
        finalDimensions: { 
          width: dimensions.targetWidth, 
          height: dimensions.targetHeight 
        },
        apiVersion: isVersion3 ? 'v3' : 'v2',
        sizeParam,
        constraints
      }
    };

    // Fetch the actual image if requested
    if (fetchImage) {
      result.imageData = await this.fetchImageData(imageUrl);
    }

    return result;
  }

  /**
   * Calculate size constraints based on API version and server limits
   * @private
   */
  calculateConstraints(info, width, height, isVersion3) {
    let maxWidth = width;
    let maxHeight = height;
    let maxArea = width * height;

    // Apply server-imposed limits for v3
    if (isVersion3) {
      if (info.maxWidth !== undefined) {
        maxWidth = Math.min(maxWidth, info.maxWidth);
      }
      if (info.maxHeight !== undefined) {
        maxHeight = Math.min(maxHeight, info.maxHeight);
      } else if (info.maxWidth !== undefined) {
        // If maxWidth is specified without maxHeight, assume maxHeight = maxWidth
        maxHeight = Math.min(maxHeight, info.maxWidth);
      }
      if (info.maxArea !== undefined) {
        maxArea = Math.min(maxArea, info.maxArea);
      }
    }

    // Apply our constraint
    maxWidth = Math.min(maxWidth, this.maxDimension);
    maxHeight = Math.min(maxHeight, this.maxDimension);

    return { maxWidth, maxHeight, maxArea };
  }

  /**
   * Calculate final target dimensions respecting all constraints
   * @private
   */
  calculateFinalDimensions(width, height, constraints, isVersion3) {
    let targetWidth = width;
    let targetHeight = height;

    // Scale down to fit within width/height constraints
    const widthScale = constraints.maxWidth / width;
    const heightScale = constraints.maxHeight / height;
    const sizeScale = Math.min(widthScale, heightScale, 1.0);

    targetWidth = Math.floor(width * sizeScale);
    targetHeight = Math.floor(height * sizeScale);

    // Check area constraint for v3
    if (isVersion3 && constraints.maxArea !== undefined) {
      const currentArea = targetWidth * targetHeight;
      if (currentArea > constraints.maxArea) {
        const areaScale = Math.sqrt(constraints.maxArea / currentArea);
        targetWidth = Math.floor(targetWidth * areaScale);
        targetHeight = Math.floor(targetHeight * areaScale);
      }
    }

    return { targetWidth, targetHeight };
  }

  /**
   * Determine the appropriate size parameter for the IIIF URL
   * @private
   */
  determineSizeParameter(targetWidth, targetHeight, originalWidth, originalHeight, isVersion3) {
    if (targetWidth === originalWidth && targetHeight === originalHeight) {
      // Requesting full size - use appropriate keyword for API version
      return isVersion3 ? "max" : "full";
    } else {
      return `${targetWidth},${targetHeight}`;
    }
  }

  /**
   * Fetch image data and convert to base64
   * @private
   */
  async fetchImageData(imageUrl) {
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return {
      contentType,
      base64,
      size: arrayBuffer.byteLength
    };
  }
}
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IIIFImageHandler } from '../server/iiif-image-handler.js';

// Mock node-fetch
vi.mock('node-fetch', () => ({
  default: vi.fn()
}));

describe('IIIFImageHandler', () => {
  const handler = new IIIFImageHandler();

  describe('calculateRegionDimensions', () => {
    it('should return full image dimensions for "full" region', () => {
      const parsedRegion = { type: 'full' };
      const imageWidth = 5040;
      const imageHeight = 7520;

      const result = handler.calculateRegionDimensions(parsedRegion, imageWidth, imageHeight);

      expect(result.width).toBe(imageWidth);
      expect(result.height).toBe(imageHeight);
    });

    it('should calculate correct pixel dimensions for percentage region', () => {
      const parsedRegion = { type: 'pct', x: 15, y: 30, width: 25, height: 30 };
      const imageWidth = 5040;
      const imageHeight = 7520;

      const result = handler.calculateRegionDimensions(parsedRegion, imageWidth, imageHeight);

      // 25% of 5040 = 1260, 30% of 7520 = 2256
      expect(result.width).toBe(Math.floor((25 / 100) * imageWidth));
      expect(result.height).toBe(Math.floor((30 / 100) * imageHeight));
      expect(result.width).toBe(1260);
      expect(result.height).toBe(2256);
    });

    it('should handle fractional percentages correctly', () => {
      const parsedRegion = { type: 'pct', x: 0, y: 0, width: 33.33, height: 66.67 };
      const imageWidth = 300;
      const imageHeight = 600;

      const result = handler.calculateRegionDimensions(parsedRegion, imageWidth, imageHeight);

      // 33.33% of 300 = 99.99 -> floor(99.99) = 99
      // 66.67% of 600 = 400.02 -> floor(400.02) = 400
      expect(result.width).toBe(Math.floor((33.33 / 100) * imageWidth));
      expect(result.height).toBe(Math.floor((66.67 / 100) * imageHeight));
      expect(result.width).toBe(99);
      expect(result.height).toBe(400);
    });

    it('should handle small regions correctly', () => {
      const parsedRegion = { type: 'pct', x: 0, y: 0, width: 1, height: 1 };
      const imageWidth = 100;
      const imageHeight = 100;

      const result = handler.calculateRegionDimensions(parsedRegion, imageWidth, imageHeight);

      // 1% of 100 = 1
      expect(result.width).toBe(1);
      expect(result.height).toBe(1);
    });

    it('should calculate correct dimensions for pct:30,30,10,10 region on 1000x1000 image', () => {
      const parsedRegion = { type: 'pct', x: 30, y: 30, width: 10, height: 10 };
      const imageWidth = 1000;
      const imageHeight = 1000;

      const result = handler.calculateRegionDimensions(parsedRegion, imageWidth, imageHeight);

      // 10% of 1000 = 100
      expect(result.width).toBe(100);
      expect(result.height).toBe(100);
    });
  });

  describe('calculateConstraints', () => {
    it('should use image dimensions as default constraints', () => {
      const info = { width: 1000, height: 800 };
      const width = 1000;
      const height = 800;
      const isVersion3 = false;

      const result = handler.calculateConstraints(info, width, height, isVersion3);

      expect(result.maxWidth).toBe(Math.min(width, handler.maxDimension));
      expect(result.maxHeight).toBe(Math.min(height, handler.maxDimension));
      expect(result.maxArea).toBe(Math.min(width * height, handler.maxArea));
    });

    it('should apply v3 API constraints from info object', () => {
      const info = {
        width: 2000,
        height: 3000,
        maxWidth: 1200,
        maxHeight: 1800,
        maxArea: 500000
      };
      const width = 2000;
      const height = 3000;
      const isVersion3 = true;

      const result = handler.calculateConstraints(info, width, height, isVersion3);

      expect(result.maxWidth).toBe(Math.min(1200, handler.maxDimension));
      expect(result.maxHeight).toBe(Math.min(1800, handler.maxDimension));
      expect(result.maxArea).toBe(Math.min(500000, handler.maxArea));
    });

    it('should apply v2 API constraints from profile array', () => {
      const info = {
        width: 2000,
        height: 3000,
        profile: [
          "http://iiif.io/api/image/2/level2.json",
          {
            maxWidth: 1200,
            maxHeight: 1800,
            maxArea: 500000
          }
        ]
      };
      const width = 2000;
      const height = 3000;
      const isVersion3 = false;

      const result = handler.calculateConstraints(info, width, height, isVersion3);

      expect(result.maxWidth).toBe(Math.min(1200, handler.maxDimension));
      expect(result.maxHeight).toBe(Math.min(1800, handler.maxDimension));
      expect(result.maxArea).toBe(Math.min(500000, handler.maxArea));
    });

    it('should assume maxHeight equals maxWidth when maxHeight not specified in v3', () => {
      const info = {
        width: 2000,
        height: 3000,
        maxWidth: 1000
      };
      const width = 2000;
      const height = 3000;
      const isVersion3 = true;

      const result = handler.calculateConstraints(info, width, height, isVersion3);

      expect(result.maxWidth).toBe(Math.min(1000, handler.maxDimension));
      expect(result.maxHeight).toBe(Math.min(1000, handler.maxDimension));
    });

    it('should assume maxHeight equals maxWidth when maxHeight not specified in v2', () => {
      const info = {
        width: 2000,
        height: 3000,
        profile: [
          "http://iiif.io/api/image/2/level2.json",
          {
            maxWidth: 1000
          }
        ]
      };
      const width = 2000;
      const height = 3000;
      const isVersion3 = false;

      const result = handler.calculateConstraints(info, width, height, isVersion3);

      expect(result.maxWidth).toBe(Math.min(1000, handler.maxDimension));
      expect(result.maxHeight).toBe(Math.min(1000, handler.maxDimension));
    });

    it('should handle v2 API with no profile constraints', () => {
      const info = {
        width: 1000,
        height: 800,
        profile: ["http://iiif.io/api/image/2/level2.json"]
      };
      const width = 1000;
      const height = 800;
      const isVersion3 = false;

      const result = handler.calculateConstraints(info, width, height, isVersion3);

      expect(result.maxWidth).toBe(Math.min(width, handler.maxDimension));
      expect(result.maxHeight).toBe(Math.min(height, handler.maxDimension));
      expect(result.maxArea).toBe(Math.min(width * height, handler.maxArea));
    });

    it('should apply handler maxDimension constraint over server constraints', () => {
      const customHandler = new IIIFImageHandler(500, 100000);
      const info = {
        width: 2000,
        height: 3000,
        maxWidth: 1200,
        maxHeight: 1800
      };
      const width = 2000;
      const height = 3000;
      const isVersion3 = true;

      const result = customHandler.calculateConstraints(info, width, height, isVersion3);

      expect(result.maxWidth).toBe(500); // handler.maxDimension wins
      expect(result.maxHeight).toBe(500); // handler.maxDimension wins
    });

    it('should apply handler maxArea constraint over server constraints', () => {
      const customHandler = new IIIFImageHandler(2000, 200000);
      const info = {
        width: 1000,
        height: 800,
        maxArea: 500000
      };
      const width = 1000;
      const height = 800;
      const isVersion3 = true;

      const result = customHandler.calculateConstraints(info, width, height, isVersion3);

      expect(result.maxArea).toBe(200000); // handler.maxArea wins
    });

    it('should handle null maxArea in handler', () => {
      const customHandler = new IIIFImageHandler(1500, null);
      const info = {
        width: 1000,
        height: 800,
        maxArea: 500000
      };
      const width = 1000;
      const height = 800;
      const isVersion3 = true;

      const result = customHandler.calculateConstraints(info, width, height, isVersion3);

      expect(result.maxArea).toBe(500000); // server constraint applies
    });
  });

  describe('calculateFinalDimensions', () => {
    it('should scale down proportionally to fit within constraints', () => {
      // Test case: dimensions of 5040x7520 with maxWidth=1000, maxHeight=1000, isVersion3=true
      const width = 5040;
      const height = 7520;
      const constraints = {
        maxWidth: 1000,
        maxHeight: 1000,
        maxArea: undefined
      };
      const isVersion3 = true;

      const result = handler.calculateFinalDimensions(width, height, constraints, isVersion3);

      // Expected behavior: should scale down proportionally to fit within 1000x1000
      const expectedScale = Math.min(1000/5040, 1000/7520, 1.0);
      const expectedWidth = Math.floor(width * expectedScale);
      const expectedHeight = Math.floor(height * expectedScale);

      expect(result.targetWidth).toBe(expectedWidth);
      expect(result.targetHeight).toBe(expectedHeight);
    });

    it('should maintain 100x100 dimensions for pct:30,30,10,10 region when no scaling needed', () => {
      // Test case: 100x100 region with large constraints - should not scale
      const width = 100;
      const height = 100;
      const constraints = {
        maxWidth: 1000,
        maxHeight: 1000,
        maxArea: undefined
      };
      const isVersion3 = true;

      const result = handler.calculateFinalDimensions(width, height, constraints, isVersion3);

      // No scaling should occur since 100x100 fits within 1000x1000 constraints
      expect(result.targetWidth).toBe(100);
      expect(result.targetHeight).toBe(100);
    });
  });

  describe('generateImageRegionUrl', () => {
    let fetchMock;

    beforeEach(async () => {
      fetchMock = (await vi.importMock('node-fetch')).default;
      fetchMock.mockClear();
    });

    it('should generate correct URL for region pct:15,30,25,30', async () => {
      // Mock the info.json response for the Bodleian image
      const mockInfoResponse = {
        "@context": "http://iiif.io/api/image/2/context.json",
        "protocol": "http://iiif.io/api/image",
        "width": 5040,
        "height": 7520,
        "sizes": [
          { "width": 157, "height": 235 },
          { "width": 315, "height": 470 },
          { "width": 630, "height": 940 },
          { "width": 1260, "height": 1880 },
          { "width": 2520, "height": 3760 }
        ],
        "tiles": [
          { "width": 256, "height": 256, "scaleFactors": [1, 2, 4, 8, 16, 32] }
        ],
        "@id": "https://iiif.bodleian.ox.ac.uk/iiif/image/79bf8325-22fa-4696-afe5-7d827d84f393",
        "profile": [
          "http://iiif.io/api/image/2/level2.json",
          {
            "formats": ["jpg", "png", "webp"],
            "qualities": ["native", "color", "gray", "bitonal"],
            "supports": ["regionByPct", "regionSquare", "sizeByForcedWh", "sizeByWh", "sizeAboveFull", "sizeUpscaling", "rotationBy90s", "mirroring"],
            "maxWidth": 1000,
            "maxHeight": 1000
          }
        ],
        "service": [
          {
            "@context": "http://iiif.io/api/annex/services/physdim/1/context.json",
            "profile": "http://iiif.io/api/annex/services/physdim",
            "physicalScale": 0.00846667,
            "physicalUnits": "cm"
          }
        ]
      };

      // Mock fetch to return the info.json
      fetchMock.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockInfoResponse))
      });

      const baseUri = 'https://iiif.bodleian.ox.ac.uk/iiif/image/79bf8325-22fa-4696-afe5-7d827d84f393';
      const region = 'pct:15,30,25,30';

      const result = await handler.generateImageRegionUrl(baseUri, region, false);

      // Verify the fetch was called correctly
      expect(fetchMock).toHaveBeenCalledWith(`${baseUri}/info.json`);

      // Verify the generated URL structure
      expect(result.imageUrl).toContain(baseUri);
      expect(result.imageUrl).toContain('pct:15,30,25,30');
      expect(result.imageUrl).toMatch(/\/\d+,\d+\/0\/default\.jpg$/);

      // Verify region dimensions calculation
      const expectedRegionWidth = Math.floor((25 / 100) * 5040); // 25% of 5040 = 1260
      const expectedRegionHeight = Math.floor((30 / 100) * 7520); // 30% of 7520 = 2256
      
      expect(result.info.regionDimensions.width).toBe(expectedRegionWidth);
      expect(result.info.regionDimensions.height).toBe(expectedRegionHeight);
      expect(result.info.regionParam).toBe('pct:15,30,25,30');
      expect(result.info.apiVersion).toBe('v2');

      // Verify the final dimensions respect maxWidth and maxHeight constraints
      const maxWidth = mockInfoResponse.profile[1].maxWidth;
      const maxHeight = mockInfoResponse.profile[1].maxHeight;
      
      expect(result.info.finalDimensions.width).toBeLessThanOrEqual(maxWidth);
      expect(result.info.finalDimensions.height).toBeLessThanOrEqual(maxHeight);
      
      // The region (1260x2256) should be scaled down to fit within 1000x1000
      // Scale factor should be min(1000/1260, 1000/2256) = min(0.794, 0.443) = 0.443
      const expectedScale = Math.min(maxWidth / expectedRegionWidth, maxHeight / expectedRegionHeight);
      const expectedFinalWidth = Math.floor(expectedRegionWidth * expectedScale);
      const expectedFinalHeight = Math.floor(expectedRegionHeight * expectedScale);
      
      expect(result.info.finalDimensions.width).toBe(expectedFinalWidth);
      expect(result.info.finalDimensions.height).toBe(expectedFinalHeight);
    });
  });
});
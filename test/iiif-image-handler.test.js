import { describe, it, expect } from 'vitest';
import { IIIFImageHandler } from '../server/iiif-image-handler.js';

describe('IIIFImageHandler', () => {
  const handler = new IIIFImageHandler();

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
  });
});
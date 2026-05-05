import {TIFFUtil} from '../TIFFUtil';

const readFirstPixel = (rgba: Uint8ClampedArray): [number, number, number, number] => {
    return [rgba[0], rgba[1], rgba[2], rgba[3]];
};

describe('TIFFUtil mapNormalizedChannelsToRgba', () => {
    it('renders one band as grayscale', () => {
        const rgba = TIFFUtil.mapNormalizedChannelsToRgba(
            [new Uint8ClampedArray([80])],
            1
        );
        expect(readFirstPixel(rgba)).toEqual([80, 80, 80, 255]);
    });

    it('renders two bands with blended blue channel', () => {
        const rgba = TIFFUtil.mapNormalizedChannelsToRgba(
            [new Uint8ClampedArray([30]), new Uint8ClampedArray([90])],
            1
        );
        expect(readFirstPixel(rgba)).toEqual([30, 90, 60, 255]);
    });

    it('renders three bands directly as RGB', () => {
        const rgba = TIFFUtil.mapNormalizedChannelsToRgba(
            [new Uint8ClampedArray([10]), new Uint8ClampedArray([20]), new Uint8ClampedArray([30])],
            1
        );
        expect(readFirstPixel(rgba)).toEqual([10, 20, 30, 255]);
    });

    it('renders four bands with luminance boost from 4th band', () => {
        const rgba = TIFFUtil.mapNormalizedChannelsToRgba(
            [
                new Uint8ClampedArray([100]),
                new Uint8ClampedArray([110]),
                new Uint8ClampedArray([120]),
                new Uint8ClampedArray([255])
            ],
            1
        );
        expect(readFirstPixel(rgba)).toEqual([135, 145, 155, 255]);
    });
});

describe('TIFFUtil isTiffFile', () => {
    it('detects .tif extension', () => {
        const file = new File(['x'], 'tile.tif', {type: 'application/octet-stream'});
        expect(TIFFUtil.isTiffFile(file)).toBe(true);
    });

    it('detects .tiff extension', () => {
        const file = new File(['x'], 'tile.tiff', {type: 'application/octet-stream'});
        expect(TIFFUtil.isTiffFile(file)).toBe(true);
    });

    it('detects TIFF mime type', () => {
        const file = new File(['x'], 'tile.bin', {type: 'image/tiff'});
        expect(TIFFUtil.isTiffFile(file)).toBe(true);
    });

    it('returns false for non TIFF image', () => {
        const file = new File(['x'], 'tile.png', {type: 'image/png'});
        expect(TIFFUtil.isTiffFile(file)).toBe(false);
    });
});

describe('TIFFUtil mapNormalizedChannelsToRgba fallback behavior', () => {
    it('defaults missing green/blue channels from first channel', () => {
        const rgba = TIFFUtil.mapNormalizedChannelsToRgba(
            [new Uint8ClampedArray([42]), new Uint8ClampedArray([]), new Uint8ClampedArray([])],
            1
        );
        expect(readFirstPixel(rgba)).toEqual([42, 42, 42, 255]);
    });

    it('renders alpha as opaque for all pixels', () => {
        const rgba = TIFFUtil.mapNormalizedChannelsToRgba(
            [new Uint8ClampedArray([1, 2, 3])],
            3
        );
        expect(rgba[3]).toBe(255);
        expect(rgba[7]).toBe(255);
        expect(rgba[11]).toBe(255);
    });
});

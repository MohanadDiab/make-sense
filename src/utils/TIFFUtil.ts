import {fromArrayBuffer} from 'geotiff';

export type TiffDecodeResult = {
    image: HTMLImageElement;
    width: number;
    height: number;
    bandCount: number;
}

export class TIFFUtil {
    private static cache = new WeakMap<File, TiffCacheEntry>();

    public static isTiffFile(fileData: File): boolean {
        const fileName = fileData.name.toLowerCase();
        const mimeType = (fileData.type || '').toLowerCase();
        return fileName.endsWith('.tif')
            || fileName.endsWith('.tiff')
            || mimeType.includes('image/tiff');
    }

    public static async decodeToImage(fileData: File, selectedBands?: number[]): Promise<TiffDecodeResult> {
        const cacheEntry = await TIFFUtil.getOrCreateCacheEntry(fileData);
        const normalizedBands = TIFFUtil.normalizeBands(selectedBands, cacheEntry.bandCount);
        const cacheKey = normalizedBands.join(',');
        const cachedImage = cacheEntry.renderedImageByBands.get(cacheKey);
        const renderedImage = cachedImage || await TIFFUtil.renderImageForBands(cacheEntry.image, normalizedBands, cacheEntry.width, cacheEntry.height);
        if (!cachedImage) {
            cacheEntry.renderedImageByBands.set(cacheKey, renderedImage);
        }
        return {
            image: renderedImage,
            width: cacheEntry.width,
            height: cacheEntry.height,
            bandCount: cacheEntry.bandCount
        };
    }

    private static async getOrCreateCacheEntry(fileData: File): Promise<TiffCacheEntry> {
        const cached = TIFFUtil.cache.get(fileData);
        if (cached) {
            return cached;
        }

        const arrayBuffer = await fileData.arrayBuffer();
        const tiff = await fromArrayBuffer(arrayBuffer);
        const image = await tiff.getImage();
        const entry: TiffCacheEntry = {
            image,
            width: image.getWidth(),
            height: image.getHeight(),
            bandCount: image.getSamplesPerPixel(),
            renderedImageByBands: new Map<string, HTMLImageElement>()
        };
        TIFFUtil.cache.set(fileData, entry);
        return entry;
    }

    private static async renderImageForBands(
        image: TiffRasterImage,
        selectedBands: number[],
        width: number,
        height: number
    ): Promise<HTMLImageElement> {
        const rasters = await image.readRasters({samples: selectedBands});
        const rgba = TIFFUtil.composeRgba(rasters, width, height);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        const imageData = new ImageData(rgba, width, height);
        context.putImageData(imageData, 0, 0);
        const renderedImage = new Image();
        renderedImage.src = canvas.toDataURL('image/png');
        await new Promise((resolve, reject) => {
            renderedImage.onload = resolve;
            renderedImage.onerror = reject;
        });
        return renderedImage;
    }

    private static normalizeBands(selectedBands: number[], sampleCount: number): number[] {
        if (!selectedBands || selectedBands.length === 0) {
            return [...Array(Math.min(sampleCount, 3)).keys()];
        }
        const uniqueBands = Array.from(new Set(selectedBands))
            .filter((band) => band >= 0 && band < sampleCount);
        return uniqueBands.length ? uniqueBands : [...Array(Math.min(sampleCount, 3)).keys()];
    }

    private static composeRgba(
        rasters: TypedArray | TypedArray[],
        width: number,
        height: number
    ): Uint8ClampedArray {
        const pixelCount = width * height;
        const channels = TIFFUtil.ensureArray(rasters);
        const normalizedChannels = channels.map(TIFFUtil.normalizeChannel);
        return TIFFUtil.mapNormalizedChannelsToRgba(normalizedChannels, pixelCount);
    }

    public static mapNormalizedChannelsToRgba(
        normalizedChannels: Uint8ClampedArray[],
        pixelCount: number
    ): Uint8ClampedArray {
        const rgba = new Uint8ClampedArray(pixelCount * 4);

        for (let index = 0; index < pixelCount; index++) {
            const [red, green, blue] = TIFFUtil.resolveRgbPixel(normalizedChannels, index);
            rgba[index * 4] = red;
            rgba[index * 4 + 1] = green;
            rgba[index * 4 + 2] = blue;
            rgba[index * 4 + 3] = 255;
        }
        return rgba;
    }

    private static resolveRgbPixel(channels: Uint8ClampedArray[], index: number): [number, number, number] {
        const first = channels[0]?.[index] ?? 0;
        const second = channels[1]?.[index] ?? first;
        const third = channels[2]?.[index] ?? second;
        const fourth = channels[3]?.[index] ?? 0;

        if (channels.length <= 1) {
            return [first, first, first];
        }

        if (channels.length === 2) {
            const mixedBlue = Math.round((first + second) / 2);
            return [first, second, mixedBlue];
        }

        if (channels.length === 3) {
            return [first, second, third];
        }

        // Four or more selected bands: keep RGB from first three and blend in 4th as luminance boost.
        const blendFactor = fourth / 255;
        const boost = Math.round(35 * blendFactor);
        return [
            Math.min(255, first + boost),
            Math.min(255, second + boost),
            Math.min(255, third + boost)
        ];
    }

    private static ensureArray(rasters: TypedArray | TypedArray[]): TypedArray[] {
        if (Array.isArray(rasters)) {
            return rasters as TypedArray[];
        }
        return [rasters as TypedArray];
    }

    private static normalizeChannel(channel: TypedArray): Uint8ClampedArray {
        let min = Number.POSITIVE_INFINITY;
        let max = Number.NEGATIVE_INFINITY;
        for (let i = 0; i < channel.length; i++) {
            const value = Number(channel[i]);
            if (value < min) {
                min = value;
            }
            if (value > max) {
                max = value;
            }
        }
        if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
            return new Uint8ClampedArray(channel.length);
        }

        const normalized = new Uint8ClampedArray(channel.length);
        const range = max - min;
        for (let i = 0; i < channel.length; i++) {
            normalized[i] = Math.round(((Number(channel[i]) - min) / range) * 255);
        }
        return normalized;
    }
}

type TypedArray = Uint8Array | Uint16Array | Uint32Array | Int8Array | Int16Array | Int32Array | Float32Array | Float64Array;
type TiffRasterImage = {
    getWidth: () => number;
    getHeight: () => number;
    getSamplesPerPixel: () => number;
    readRasters: (input: {samples: number[]}) => Promise<TypedArray | TypedArray[]>;
}

type TiffCacheEntry = {
    image: TiffRasterImage;
    width: number;
    height: number;
    bandCount: number;
    renderedImageByBands: Map<string, HTMLImageElement>;
}

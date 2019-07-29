const cursor = require('ansi')(process.stdout);

module.exports = class FourColorASCIICanvas {

    /**
     * @param {number} width
     * @param {number} height
     * @param {object} options
     * @param {string} options.palette - 'black-on-white' | 'white-on-black'
     */
    constructor (width, height, options = { palette: 'white-on-black' }) {
        this._width = width;
        this._height = height;
        this._palette = (options || {}).palette === 'black-on-white'
            ? FourColorASCIICanvas.INVERTED_PALETTE
            : FourColorASCIICanvas.PALETTE

        this._previousPixels = [];
    }

    static get PALETTE () {
        // One character = two pixels aligned vertically.
        // The characters below are chosen based on the pixel density of their high and low parts,
        // so that they can be mapped to a range of RGB colors based on their brightness.
        return [
            [' ', '.', '+', 'u'],
            ['`', ':', 'L', 'd'],
            ['"', 'T', 'I', '6'],
            ['*', 'P', '9', '8']
        ];
    }

    static get INVERTED_PALETTE () {
        return FourColorASCIICanvas.PALETTE.slice().reverse().map(row => row.slice().reverse());
    }

    paint (pixels) {

        const getBrighnessLevel = (ndarray, index) => {
            const r = ndarray[index + 0];
            const g = ndarray[index + 1];
            const b = ndarray[index + 2];

            // luminance-based
            return (0.299 * r + 0.587 * g + 0.114 * b) / 64 | 0;
        };

        const getChar = (ndarray, topPixelIndex, bottomPixelIndex) => {
            const topBrightnessLevel = getBrighnessLevel(ndarray, topPixelIndex);
            const bottomBrightnessLevel = getBrighnessLevel(ndarray, bottomPixelIndex);

            return this._palette[topBrightnessLevel][bottomBrightnessLevel];
        };

        const canvasLength = this._width * this._height;

        if (pixels.length !== canvasLength * 4) {
            throw new Error('Pixel array does not match the dimensions of the canvas');
        }

        let sameCharCounter = 0;

        cursor
            .buffer()
            .goto(1, 1);

        for (let j = 0; j < this._height; j += 2) {
            for (let i = 0; i < this._width; ++i) {
                const topPixelIndex = (j * this._width + i) * 4;
                const bottomPixelIndex = ((j + 1) * this._width + i) * 4;
                const char = getChar(pixels, topPixelIndex, bottomPixelIndex);
                const previousFrameChar = getChar(this._previousPixels, topPixelIndex, bottomPixelIndex);

                if (char === previousFrameChar) {
                    ++sameCharCounter;
                } else {
                    const x = i + 1;
                    const y = j / 2 + 1;
                    const gotoXY = `\x1b[${x};${y}H`;

                    // Do not send a goto instruction if is is more costly than re-writing the characters
                    if (sameCharCounter > gotoXY.length) {
                        cursor._buffer.splice(cursor._buffer.length - sameCharCounter);
                        cursor.goto(x, y);
                    }

                    sameCharCounter = 0;
                }

                cursor.write(char);
            }

            ++sameCharCounter;
            cursor.write('\n');
        }

        if (sameCharCounter) {
            cursor._buffer.splice(cursor._buffer.length - sameCharCounter);
        }

        // Avoid leaving the cursor in the middle of the canvas
        cursor
            .goto(this._width + 1, this._height / 2)
            .flush();

        this._previousPixels = pixels;
    }
}

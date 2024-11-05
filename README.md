# flawless-webvidcap

Flawless, CPU-bound, video capture utility with no frame drops. Originally developed for streaming graphics.

## Requirements

- `ffmpeg` program must be installed on server
  - https://command-not-found.com/ffmpeg
- puppeteer javascript library - https://pptr.dev/
  - install with `npm`

## Usage

```bash
npm install puppeteer # install requirement into node_modules directory

./record-parallel (url) (width px) (height px) (RESERVED) (RESERVED) (output video format) (number of chunks)
```

- pass anything for "reserved" arguments - they are placeholders to make the chunk recording parameters match the subprocess parameters for less confusion.
  - TODO: fix this

### Output Formats

- webm
- mp4
  - mp4 x264 codec does not support transparency
  - mp4 x264 requires even sizes of pixels for width and height of video
- mov
  - raw RGBA PNG frames in MOV container -> high memory usage, source quality video

## Details

- this solution optimizes really well. by breaking it into pieces, the parts could even be completed on multiple servers!
  - works by updating the offsets of all videos / animations while running
- steps through frame by frame and stitches together a video at the end
  - sets offset of each video playing on the page to the current timestamp
- recording is actually possible on CPU-only servers!
  - this takes more time. approximately 1 minute to download a five-second 1080 video using 16 cores
- supports animated GIFs and animated PNGs (APNG)
  - breaks each animated GIF or APNG into multiple images which are replaced within the browser using data URLs
  - GIF and APNG extractor program is passed input from within javascript and retrieves the output images from filenames
- uses hooks to handle `setInterval` and `clearInterval` callbacks when needed for recording
- able to break into chunks and record in parallel for speed
  - the last few chunks are smaller than the rest in order to optimize workflow and CPU usage - practical fine tuning

## Execution Steps
- export a PNG for each frame. use parallel processes to generate different "chunks" starting at offsets
- stitch them together using `ffmpeg`

# Known Issues
- no support for different framerates of animated PNGs - assume 30 FPS

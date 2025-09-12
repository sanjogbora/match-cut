# Match Cut Generator

Auto-Aligned Match Cut Video Generator - Create smooth eye-aligned animations from your photos.

## Features

- **Automatic Face Detection**: Uses MediaPipe to detect faces and eye positions
- **Perfect Eye Alignment**: Aligns all images so eyes stay in the same position
- **Multiple Export Formats**: Export as GIF or MP4 with customizable settings
- **Real-time Preview**: See your animation before exporting
- **Browser-based Processing**: All processing happens locally - your images never leave your device
- **Responsive Design**: Works on desktop and mobile devices

## How to Use

1. **Upload Images**: Drag and drop or select multiple photos with visible faces
2. **Automatic Processing**: The app detects faces and aligns them based on eye positions
3. **Preview Animation**: Watch your match cut animation in real-time
4. **Customize Settings**: Adjust frame duration, resolution, and format
5. **Export**: Download your finished animation as GIF or MP4

## Technology Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Face Detection**: MediaPipe Face Landmarker
- **Image Processing**: HTML Canvas API
- **Video Export**: FFmpeg.wasm, WebCodecs API
- **Styling**: Tailwind CSS
- **Icons**: Lucide React

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Browser Compatibility

- **Chrome/Edge**: Full support (WebCodecs + FFmpeg.wasm)
- **Firefox**: Limited support (FFmpeg.wasm only)
- **Safari**: Limited support (FFmpeg.wasm only)

## Privacy

This application processes all images locally in your browser. No images are uploaded to any server, ensuring complete privacy and security of your photos.

## License

MIT License - feel free to use and modify for your projects.
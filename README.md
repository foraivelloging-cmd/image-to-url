# 🖼️ Image Compressor Pro

A lightning-fast, client-side image compression tool built with React and Tailwind CSS. Optimize your images without compromising privacy—everything happens right in your browser!

## ✨ Features

*   **🚀 Client-Side Processing**: All image compression is done locally in your browser. No images are uploaded to any server, ensuring 100% privacy and blazing-fast speeds.
*   **🎯 Drag & Drop**: Easily drag and drop multiple images to compress them instantly.
*   **📋 Smart Paste**: Paste images directly from your clipboard (Ctrl+V / Cmd+V). Supports direct files, copied image data, Base64 strings, and even image URLs!
*   **🎛️ Fine-Grained Control**: Adjust compression quality and maximum dimensions on the fly to get the perfect balance between size and quality.
*   **🔄 Format Conversion**: Convert your images to modern web formats like WebP, JPEG, or PNG.
*   **📦 Batch Download**: Download all your compressed images at once in a convenient ZIP file.
*   **🌓 Beautiful UI**: A sleek, dark-themed, responsive interface built with Tailwind CSS.

## 🛠️ Tech Stack

*   **Frontend**: React 18, TypeScript, Vite
*   **Styling**: Tailwind CSS, Lucide React (Icons)
*   **Compression Engine**: `browser-image-compression`
*   **Archiving**: `jszip`, `file-saver`

## 🚀 Getting Started

Follow these steps to run the project locally:

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. Clone the repository (or download the source code):
   ```bash
   git clone <repository-url>
   ```

2. Navigate to the project directory:
   ```bash
   cd image-compressor
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and visit `http://localhost:3000` (or the port provided by Vite in your terminal).

## 💡 How to Use

1. **Upload**: Drag and drop images into the drop zone, click to browse, or simply paste (`Ctrl+V`) an image from your clipboard anywhere on the page.
2. **Tweak Settings**: Use the sidebar controls to adjust the compression quality, max width/height, and output format.
3. **Preview**: Compare the original and compressed sizes in real-time.
4. **Download**: Click the download button on individual images, or use the "Download All (ZIP)" button at the top to get everything at once.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the issues page if you want to contribute.

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

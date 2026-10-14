# Advanced Photo Studio & Image Editor for ImageLite Pro

A full-featured, studio-grade client-side image editing suite integrated directly into ImageLite Pro, allowing users to crop, rotate, flip, fine-tune color adjustments (brightness, contrast, saturation), and apply visual filters with real-time interactive canvas previews before compressing, uploading, or downloading.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following user preferences were confirmed during clarification:
> - **Editing Capabilities**: Full creative suite including aspect-ratio cropping, 90° rotation, horizontal/vertical flipping, and granular color adjustments (brightness, contrast, saturation).
> - **UX Access**: Dedicated **Edit** button on both the single-image view and multi-upload image cards, launching an immersive, dark-room styled photo editing modal.
> - **Save Workflow**: Preserves the original file and generates a newly edited version (with customizable name tag like `_edited`), allowing comparative workflows and non-destructive experimentation.

---

### 1. Overview & Core Concept

- **What It Does**: Adds an interactive image editing modal to ImageLite Pro. Users can open any imported, pasted, or uploaded image in a canvas-based studio editor, apply geometric transforms (crop, rotate, flip) and color adjustments (brightness, contrast, saturation, preset grading), see real-time 60fps canvas previews, and commit the changes as a new file ready for instant upload or download.
- **Target Audience**: Content creators, web designers, digital marketers, and power users who need rapid image refinement, renaming, and compression without jumping into heavy external graphic software.
- **Key Value**: Eliminates context switching between Photoshop/Canva and ImageLite Pro, providing an end-to-end workflow: import/paste → edit & crop → rename → compress → upload to ImageKit/ImgBB or download as ZIP.

---

### 2. User Experience & Visual Design

#### Key User Flows

1. **Launch Studio Editor**:
   - The user clicks the **Edit Photo** button (sparkle/slider icon) located on the active image card or the single-image preview toolbar.
   - An immersive modal overlay opens with smooth backdrop blur, showcasing the full canvas workspace and editing toolbars.

2. **Crop & Geometric Transforms**:
   - **Aspect Ratio Presets**: Freeform, 1:1 (Square/Avatar), 4:3 (Card/Standard), 16:9 (Landscape/Banner), 9:16 (Story/Mobile).
   - **Interactive Crop Box**: Draggable corner handles and boundary box over the canvas.
   - **Rotate & Flip**: 90° clockwise rotation button, 90° counter-clockwise rotation button, horizontal flip, and vertical flip.

3. **Color & Lighting Fine-Tuning**:
   - **Sliders with Live Preview**:
     - *Brightness* (-100% to +100%, default 0)
     - *Contrast* (-100% to +100%, default 0)
     - *Saturation* (-100% to +100%, default 0)
     - *Warmth / Temperature* (Cool to Warm tint)
   - **One-Click Quick Presets**:
     - *Original (Clean)*, *Vivid (Boosted contrast & saturation)*, *Cinematic / Muted Warm*, *B&W Studio*, *Vintage Sepia*, *Cyber Noir*.
   - **Reset Tool**: One-click "Reset Adjustments" button to restore default values.

4. **Save & Version Creation**:
   - User clicks **"Save as New Version"** (or optionally "Replace Current").
   - A new `UploadedFile` entry is created with status `pending`, pre-named with the user's custom prefix (e.g. `saqibviusal7_edited`), compressed preview URL generated from the canvas export, and added to the upload queue.
   - The original image remains completely intact in the list.

#### Visual Identity & Design System

- **Aesthetic Direction**: Professional dark-room studio theme with slate neutral palette (`bg-slate-950`, `bg-slate-900`, `border-slate-800`), crisp typography, and emerald/blue active accents.
- **Top Bar & Workspace**:
  - Top header: Clean title `"Photo Studio"`, dimensions readout (`1920 × 1080 px`), zoom control (`Fit`, `100%`), and Close button.
  - Central stage: Centered checkerboard background with drop shadow for transparent PNG/WebP support.
  - Right / Bottom inspector: Tabbed segmented control (`Transform`, `Adjust`, `Presets`) with numeric slider readouts and quick reset buttons.
- **Typography & Precision**: Numeric indicator values formatted with `tabular-nums` and monospace font tags (`100%`, `+15`, `4:3`).

---

### 3. Key Product Decisions & Trade-Offs

- **Client-Side HTML5 Canvas vs External API**:
  - *Chosen Approach*: Pure in-browser Canvas 2D manipulation using pixel shaders and transformation matrices.
  - *Why*: 0ms latency, zero server bandwidth costs, fully offline capable, completely private (user photos never leave the browser during editing).
  - *Alternatives Considered*: Server-side Sharp processing via Express (passed over because it requires server round-trips and doesn't provide real-time slider feedback).

- **Non-Destructive Versioning vs Overwrite**:
  - *Chosen Approach*: Creates a new `UploadedFile` item while keeping the original.
  - *Why*: Prevents irreversible user mistakes, enables comparing original vs edited output, and aligns directly with the user's selected preference.

- **Lightweight Built-In Cropper vs Bulky 3rd-Party Library**:
  - *Chosen Approach*: Lightweight, custom Canvas-based crop overlay and mathematical viewport transform.
  - *Why*: Zero additional heavy npm bundle overhead, guaranteed React 19 compatibility without peer-dependency conflicts.

---

### 4. Technical Architecture & Data Strategy

```
┌──────────────────────────────────────────────────────────────────────────┐
│                             ImageLite Pro App                            │
├─────────────────────────────────────┬────────────────────────────────────┤
│ Left Panel: Configuration & Settings│ Right Panel: Viewport & Workspace  │
│  - Custom Name Prefix               │  - Single / Multi Image View       │
│  - Auto-Upload Toggle               │  - [Edit Photo] Trigger Button     │
│  - Compress & Format Options        │  - ImageCard Component             │
└─────────────────────────────────────┴──────────────────┬─────────────────┘
                                                         │ Launches
                                                         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                   PhotoEditorModal (Canvas Studio Engine)                │
├──────────────────────────────────────────────────────────────────────────┤
│ Top Bar: Image Metadata (W x H) · Zoom · Aspect Ratio · Close Button     │
├─────────────────────────────────────┬────────────────────────────────────┤
│ Canvas Stage Viewport               │ Tool Inspector Sidebar / Drawer    │
│  - Offscreen Rendering Canvas       │  - Tab 1: Transform (Crop/Rotate)  │
│  - Interactive Crop Rect Boundary   │  - Tab 2: Adjust (Sliders)         │
│  - Real-time Zoom & Pan Matrix      │  - Tab 3: Presets (Vivid, B&W, etc)│
├─────────────────────────────────────┴────────────────────────────────────┤
│ Bottom Footer: [Reset Changes] · [Cancel] · [Save as New Version]       │
└──────────────────────────────────────────────────────────────────────────┘
```

#### State & Data Model Extensions

- **`PhotoEditorModal` State**:
  ```typescript
  interface ImageAdjustments {
    brightness: number;  // -100 to 100
    contrast: number;    // -100 to 100
    saturation: number;  // -100 to 100
    warmth: number;      // -100 to 100
    blur: number;        // 0 to 20 px
    rotation: number;    // 0, 90, 180, 270 deg
    flipH: boolean;
    flipV: boolean;
    cropRect: { x: number; y: number; width: number; height: number } | null;
    aspectRatio: 'free' | '1:1' | '4:3' | '16:9' | '9:16';
  }
  ```

- **Output Pipeline**:
  - Generates full-resolution Blob (`canvas.toBlob(...)`) preserving original alpha transparency where applicable.
  - Dispatches `onSave(newFile: File, newName: string)` to `App.tsx`.
  - Automatically hooks into the existing auto-upload, custom naming, and compression pipelines.

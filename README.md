<div align="center">

<!-- Badges -->

<a href="https://github.com/cifertech/PixelForge" title="Go to GitHub repo"><img src="https://img.shields.io/static/v1?label=cifertech&message=PixelForge&color=cyan&logo=github" alt="cifertech - PixelForge"></a>
![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/cifertech/PixelForge/total)
<a href="https://github.com/cifertech/PixelForge"><img src="https://img.shields.io/github/stars/cifertech/PixelForge?style=social" alt="stars - PixelForge"></a>
<a href="https://github.com/cifertech/PixelForge"><img src="https://img.shields.io/github/forks/cifertech/PixelForge?style=social" alt="forks - PixelForge"></a>
   
<h4>
    <a href="https://twitter.com/techcifer">TWITTER</a>
  <span> · </span>
    <a href="https://www.instagram.com/cifertech/">INSTAGRAM</a>
  <span> · </span>
    <a href="https://www.youtube.com/c/techcifer">YOUTUBE</a>
  <span> · </span>
    <a href="https://cifertech.net/">WEBSITE</a>
  </h4>
</div> 
 
<br />


# 🎨 PixelForge  

**PixelForge** is a fast, browser-based converter that transforms PNG/JPG images into ready-to-use Arduino `.h` files.  
Perfect for ESP32, STM32, Arduino, RP2040, and any display using RGB565 or OLED bitmap formats.

Convert → Preview → Export → Flash.

<br/>

&nbsp;

## 🚀 Features

### 🖼 Image Conversion Engine
- Convert to:
  - **RGB565 / BGR565**
  - **1-bit, 4-bit, 8-bit OLED bitmaps**
- Auto-detect color mode & byte-swap
- Supports multiple frames for animations
- Runs entirely in your browser (offline)

&nbsp;

### 📏 Size & Scaling
- Custom width/height
- Built-in presets:
  - 240×240  
  - 128×128  
  - 115×110  
  - 100×100  
  - 96×64  
  - 64×48  
  - 32×32  
  - 16×16  

&nbsp;

### 👁 Live Preview System
- Original frame
- Scaled output
- TFT/OLED simulation
- Animation preview for multi-frame assets
  
&nbsp;

### ⚙ Output Format
- Clean **PROGMEM** C arrays:
  - `uint16_t` for RGB565
  - `uint8_t` for OLED (1/4/8-bit)
- Auto-grouped arrays for animations
  
&nbsp;

### 🌗 Interface
GitHub-style Light / Dark mode
Developer-friendly layout
Large code panel with scrolling
Clean typography & responsive design


| Display Library  | Status    | Notes                              |
| ---------------- | --------- | ---------------------------------- |
| **TFT_eSPI**     | ✅ Full    | RGB565/BGR565 + optional byte-swap |
| **U8g2**         | ✅ Full    | 1-bit, 4-bit, 8-bit OLED modes     |
| **Adafruit_GFX** | ⚠ Planned | Coming soon                        |


&nbsp;

### 🤝 Contribute
Want to help make PixelForge even better?

- Report bugs
- Request new display formats
- Improve OLED/TFT color accuracy
- Add new presets or workflows
- Star ⭐ and share the project

Every contribution makes the tool better. Thank you! ❤️

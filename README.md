# MyLittleLab

**MyLittleLab** is a web-based particle simulation created by **Alessandro Bezerra**, inspired by [Jeffrey Ventrella’s Cluester project](http://www.ventrella.com/Clusters/). This project explores how **simple rules** can lead to **complex, lifelike behaviors**, using modern web technologies for interactive visualization.

## 🌱 Overview

MyLittleLab simulates thousands of particles—also called “cells”—that interact with each other based on group-specific rules like attraction, repulsion, and self-avoidance. The combination of these rules leads to **emergent behavior**, where the whole system seems to behave in an intelligent or organic way.

Each group can have different:
- Sizes
- Colors
- Membrane behaviors
- Interaction rules with other groups

Here’s a simple example:
- Red particles attract blue.
- Blue particles repel red.
- Add green: now red repels both, blue attracts red, green attracts blue and repels red.

With just a few groups and rules, the system can go from static to dynamic, creating behavior that *feels alive*.

Built with:
- 🎮 **Three.js** for 2.5D rendering
- 💅 **Bootstrap** + custom CSS for styling
- 🛠️ **Node.js** for development tooling

## 📺 Demo Video

Check out a demo of MyLittleLab in action: 

[![MyLittleLab Demo](https://img.youtube.com/vi/m7UbT_fIBlw/0.jpg)](https://www.youtube.com/watch?v=m7UbT_fIBlw)

## 🔧 Build

To get started with the project locally:

### 🛠 Development

```bash
git clone https://github.com/your-username/mylittlelab.git
cd mylittlelab
npm install
npm run dev

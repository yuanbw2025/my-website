**English** | [中文文档](./README-GAME.md)

# 🎮 Kung Fu Marbles

<p align="center">
  <strong>⚔️ A wuxia-themed brick breaker game, built with pure HTML5 Canvas, zero dependencies, play instantly</strong>
</p>

<p align="center">
  <a href="#play-now">Play Now</a> •
  <a href="#features">Features</a> •
  <a href="#levels">Levels</a> •
  <a href="#controls">Controls</a> •
  <a href="#technical-details">Technical Details</a>
</p>

---

## 🎯 What is this?

**Kung Fu Marbles** is a brick breaker (Breakout) game infused with Chinese martial arts (wuxia) aesthetics. You control a flying sword, smashing bricks, protecting the heart, and conquering eight unique stages — all set in a pixel-art martial arts world.

The entire game is a single HTML file with zero external dependencies. Just open it in a browser and play.

### 💡 In One Sentence

> **Wield your sword as a paddle, your marble as a blade — forge your legend in the pixel jianghu.**

---

## 🕹️ Play Now

🔗 **[Click here to play](https://yuanbw2025.github.io/my-website/game.html)**

> Works on desktop and mobile, auto-adapts to any screen orientation.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🏯 **Wuxia Aesthetics** | Ancient Chinese color palette, particle sword-energy effects, starfield background |
| ⚔️ **8 Unique Levels** | From "Beginner's Trial" to "Ultimate Challenge", each with distinct brick formations |
| ❤️ **Heart Guardian** | A beating heart sits at the center of each level — protect it at all costs |
| 🌟 **3-Star Rating** | Earn ⭐⭐⭐ based on clear time, aim for perfect scores |
| 🎵 **Dynamic SFX** | Procedurally generated sound effects via Web Audio API — no audio files needed |
| 📱 **Cross-Platform** | Desktop mouse/keyboard + mobile touch gestures, plays perfectly everywhere |
| 🏆 **Leaderboard** | Local leaderboard system, tracks your best records per level |
| ⚡ **Zero Dependencies** | Single HTML file, no installation, just open in any browser |
| 🎨 **Particle System** | Brick shatter effects, hit feedback, trail glow — visuals cranked to the max |
| ⚙️ **Rich Settings** | SFX/music volume, screen shake intensity, particle density, FPS display |

---

## 🗺️ Levels

| Level | Name | Theme | Time Limit |
|-------|------|-------|-----------|
| 1 | Beginner's Trial | Circular array, introductory | 120s |
| 2 | Blade Storm | Grid formation + hard brick guards | 100s |
| 3 | Shield Fortress | Cross-shaped shields around the heart | 100s |
| 4 | Spiral Sword Array | Spiral arm formation, dynamic rhythm | 90s |
| 5 | Diamond Edge | Diamond array + steel bricks | 90s |
| 6 | Yin-Yang Fish | Tai Chi layout | 85s |
| 7 | Endless Abyss | Dense multi-layer defense lines | 80s |
| 8 | Ultimate Challenge | All brick types, final test | 75s |

---

## 🎮 Controls

### Desktop

| Action | Key |
|--------|-----|
| Move sword | Move mouse left/right |
| Launch marble | Click mouse / Spacebar |
| Charged launch | Hold mouse then release (longer hold = faster launch) |
| Pause | `Esc` / `P` key |

### Mobile

| Action | Gesture |
|--------|---------|
| Move sword | Swipe left/right |
| Launch marble | Tap screen |
| Charged launch | Long press then release |

---

## 🛠️ Technical Details

### Tech Stack

- **HTML5 Canvas** — All rendering
- **Vanilla JavaScript** — Game logic, ES6+ strict mode
- **Web Audio API** — Procedurally generated sound effects (no audio files)
- **Zero Dependencies** — No libraries or frameworks

### Game Engine Features

| Feature | Implementation |
|---------|---------------|
| Physics | Rectangle + circle collision detection, reflection angle calculation |
| Particles | Custom particle engine, 3 density levels |
| Audio | Web Audio API oscillators + noise synthesis |
| Levels | Procedurally generated, 8 different formations |
| Save System | localStorage for progress/settings/leaderboard |
| Responsive | Dynamic brick sizing, adapts to any screen |

### Brick Types

| Type | HP | Description |
|------|-----|-------------|
| Normal | 1 | Standard brick, one hit to break |
| Hard | 2 | Requires two hits |
| Steel | 3 | The toughest brick |
| ❤️ Heart | 3-5 | Core level objective |

---

## 📁 File Structure

```
my-website/
└── game.html    # The entire game, single file, ~600 lines
```

Yes, the whole game lives in one file. Open and play.

---

## 🚀 Run Locally

```bash
# Method 1: Just open the file
open game.html

# Method 2: Use any HTTP server
python3 -m http.server 8080
# Then visit http://localhost:8080/game.html
```

---

## 📄 License

MIT License — Free to use, modify, and distribute.

---

<p align="center">
  <strong>⚔️ Wield your sword, launch your marble — forge your legend in the pixel jianghu</strong><br/>
  <sub>Built with ❤️ by <a href="https://github.com/yuanbw2025">yuanbw2025</a> · AI-assisted by Claude (Anthropic)</sub>
</p>

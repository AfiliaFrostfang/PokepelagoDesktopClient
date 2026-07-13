# Pokepelago Client

Welcome to the **[Pokepelago Desktop Client](https://github.com/AfiliaFrostfang/PokepelagoDesktopClient/)**, this is a modified fork of **[PokePelagoClient by dowlee](https://github.com/dowlle/PokepelagoClient) that adds electron to build a Desktop Webview Client.

This client allows you to play Pokepelago in a Webclient on your PC rather then needing to use your Browser.

## Installation
1. Download the latest Setup [here](https://github.com/AfiliaFrostfang/PokepelagoDesktopClient/releases).
2. Launch the Client from your Desktop.
3. Follow along further down with How to Connect & How to Play.

## Compiling & Building

Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

1. **Clone the repository**:
   ```bash
   git clone https://github.com/AfiliaFrostfang/PokepelagoDesktopClient.git
   cd PokepelagoDesktopClient
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run the desktop client locally**:
   ```bash
   npm run electron:dev
   ```
   This launches the app as a desktop window using local bundled assets, so no hosted production server is required.

4. **Build a desktop package**:
   ```bash
   npm run electron:build
   ```
   The packaged app is written to the release directory for your platform.

5. **Run the web build normally** (optional):
   ```bash
   npm run dev
   ```

6. **Build for production**:
   ```bash
   npm run build
   ```

## How to Connect

> **Important:** This client runs locally on your Machine -- you do **not** launch it from the Archipelago Launcher.

1. Open your build Client or the installed [Pokepelago Desktop Client](https://github.com/AfiliaFrostfang/PokepelagoDesktopClient/releases) on your Machine.
2. Enter your AP server address (hostname and port), your slot name, and password (if any).
3. The client connects to the server via WebSocket. If your server uses HTTPS, the client will use a secure connection automatically.

## How to Play

1. Start your Archipelago Server with the Pokepelago `.apworld` generated seed.
2. Open your build Client or the installed [Pokepelago Desktop Client](https://github.com/AfiliaFrostfang/PokepelagoDesktopClient/releases) on your Machine.
3. Enter your **Hostname**, **Port**, and **Slot Name** (e.g., `AshKetchum`) in the connection prompt.
4. Once connected, your `Oak's Lab` starting items will automatically sync.
5. Use the input bar at the top to "guess" Pokémon names. 
6. As you guess Pokémon and receive items from the multiworld, more Pokémon will become catchable!

## Debugging

The client includes an auto-guesser script designed for testing seed mathematically. You can activate it by enabling the Debug Controls in the UI settings or using the custom debug triggers.

---

### Contributing

Feel free to open issues or submit pull requests if you want to improve the client's UI or add new tracking features!

## License

The Pokepelago client is licensed under the **GNU Affero General Public License v3.0 or later** (`AGPL-3.0-or-later`) — see [LICENSE](LICENSE). Copyright (C) 2026 Dowlle.

The Pokepelago APWorld (the Python world, distributed separately) is licensed under the MIT License.
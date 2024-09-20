# Toddys-youtube


Fork of @distube/youtube

Works with https://github.com/ybd-project/ytdl-core

Optimized memory + cpu

Faster (ig)

Use module instead of commonJS

Updated with latest youtube features (i hope so)

# Installation

```npm install toddys-youtube``` or ```pnpm add toddys-youtube```

# Usage

Creating the bot
```js
import { DisTube } from 'distube'
import { ToddysPlugin } from "toddys-youtube";

const distube = new DisTube(client, {
  plugins: [
    new ToddysPlugin({}),
  ],
});
```

# Changelog

```
Version 1.0.7

+ Updated @ybd-project/ytdl-core to 5.1.8
+ Removed some depreacted stuff
+ Oops (fixed errors 403)
+ Made the code more faster and efficient
+ Optimized cpu and ram by more
+ Removed old usage from @ybd-project/ytdl-core
+ Renamed YoutubePlugin to ToddysPlugin
```
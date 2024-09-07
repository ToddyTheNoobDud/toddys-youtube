# Toddys-youtube


Fork of @distube/youtube

Works with https://github.com/ybd-project/ytdl-core

Optimized memory

Faster (ig)

Use module instead of commonJS


# Installation

```npm install toddys-youtube``` or ```pnpm add toddys-youtube```

# Usage

Creating the bot
```js
import { DisTube } from 'distube'
import { YouTubePlugin } from "toddys-youtube";

const distube = new DisTube(client, {
  plugins: [
    new YouTubePlugin({}),
  ],
});
```
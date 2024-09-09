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

# Changelog

```
Version 1.0.4

+ Updated @ybd-project/ytdl-core
+ Fixed search, play, etc duration times
+ Rewrited to work with @ybd-project/ytdl-core 5.1.1 !
+ Fixed validateURL + createAgent not working with 5.1.1 !
+ Added channels, quality and buffer
+ Some others improvements i forgot.
```
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
Version 1.0.6

+ Fixed various memory leaks
+ Fixed some cpu usage
+ Auto clean memory for better usage 
+ Made it dynamic (faster)
+ Better memory usage (from 100-95 to 85-88)
+ Optimized CPU by a bit (mine from 5% to 3-4.5%)
+ Made search dynamic
+ Auto set everything to null after finishing (helps idle memory usage)
```
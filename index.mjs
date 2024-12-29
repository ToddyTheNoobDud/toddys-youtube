const { defineProperty, createAgent } = Object;
const { DisTubeError, ExtractorPlugin, Playlist, Song, checkInvalidKey } = require("distube");
const ytpl = require("@distube/ytpl");
const ytsr = require("@distube/ytsr");
const ytdl = require("@distube/ytdl-core");

const clone = (obj) => {
  if (obj === null || typeof obj !== "object") return obj;
  return Array.isArray(obj) ? obj.map(clone) : Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, clone(v)]));
};

const toSecond = (input) => {
  if (!input) return 0;
  if (typeof input !== "string") return Number(input) || 0;
  const timeParts = input.split(":").reverse();
  return timeParts.reduce((total, part, index) => total + (Number(part.replace(/[^\d.]+/g, "")) || 0) * Math.pow(60, index), 0);
};

const parseNumber = (input) => Number(String(input).replace(/[^\d.]+/g, "")) || 0;

class YouTubePlugin extends ExtractorPlugin {
  #cookies;
  #ytdlOptions;

  constructor(options = {}) {
    super();
    checkInvalidKey(options, ["cookies", "ytdlOptions"], "YouTubePlugin");
    this.#cookies = options.cookies ? clone(options.cookies) : undefined;
    this.#ytdlOptions = options.ytdlOptions ? clone(options.ytdlOptions) : {};
    this.#ytdlOptions.agent = createAgent(this.#cookies);
  }

  get ytdlOptions() {
    if (this.#cookies !== this.#cookies) {
      this.#ytdlOptions.agent = createAgent(this.#cookies);
    }
    return this.#ytdlOptions;
  }

  get ytCookie() {
    const agent = this.#ytdlOptions.agent;
    return agent ? agent.jar.getCookieStringSync("https://www.youtube.com") : "";
  }

  validate(url) {
    return ytdl.validateURL(url) || ytpl.validateID(url);
  }

  async resolve(url, options) {
    if (ytpl.validateID(url)) {
      const info = await ytpl(url, { limit: Infinity, requestOptions: { headers: { cookie: this.ytCookie } } });
      return new YouTubePlaylist(this, info, options);
    }
    if (ytdl.validateURL(url)) {
      const info = await ytdl.getBasicInfo(url, this.ytdlOptions);
      return new YouTubeSong(this, info, options);
    }
    throw new DisTubeError("CANNOT_RESOLVE_SONG", url);
  }

  async getStreamURL(song) {
    if (!song.url || !ytdl.validateURL(song.url)) throw new DisTubeError("CANNOT_RESOLVE_SONG", song);
    const info = await ytdl.getInfo(song.url, this.ytdlOptions);
    if (!info.formats?.length) throw new DisTubeError("UNAVAILABLE_VIDEO");
    
    Object.assign(song, {
      ageRestricted: info.ageRestricted,
      views: info.views,
      likes: info.likes,
      thumbnail: info.thumbnail,
      related: info.related,
      chapters: info.chapters,
      storyboards: info.storyboards,
    });

    const format = info.formats
      .filter(f => f.hasAudio && (!song.isLive || f.isHLS))
      .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0) || (b.bitrate || 0) - (a.bitrate || 0))[0];

    if (!format) throw new DisTubeError("UNPLAYABLE_FORMATS");
    return format.url;
  }

  async getRelatedSongs(song) {
    const related = song.related || (await ytdl.getBasicInfo(song.url, this.ytdlOptions)).related_videos;
    return related.filter(r => r.id).map(r => new YouTubeRelatedSong(this, r));
  }

  async searchSong(query, options) {
    const result = await this.search(query, { type: "video", limit: 1 });
    if (!result?.[0]) return null;
    const info = result[0];
    return new Song({
      plugin: this,
      source: "youtube",
      playFromSource: true,
      id: info.id,
      name: info.name,
      url: info.url,
      thumbnail: info.thumbnail,
      duration: info.duration,
      views: info.views,
      uploader: info.uploader,
    }, options);
  }

  async search(query, options = {}) {
    const { items } = await ytsr(query, {
      type: "video",
      limit: 10,
      safeSearch: false,
      ...options,
      requestOptions: { headers: { cookie: this.ytCookie } },
    });
    return items.map(i => i.type === "video" ? new YouTubeSearchResultSong(this, i) : new YouTubeSearchResultPlaylist(i));
  }
}

class YouTubeSong extends Song {
  constructor(plugin, info, options) {
    const i = info.videoDetails;
    super({
      plugin,
      source: "youtube",
      playFromSource: true,
      id: i.videoId,
      name: i.title,
      isLive: Boolean(i.isLive),
      duration: i.isLive ? 0 : toSecond(i.lengthSeconds),
      url: i.video_url || `https://youtu.be/${i.videoId}`,
      thumbnail: i.thumbnails?.sort((a, b) => b.width - a.width)?.[0]?.url,
      views: parseNumber(i.viewCount || i.view_count || i.views),
      likes: parseNumber(i.likes),
      uploader: {
        name: i.author?.name || i.author?.user,
        url: i.author?.channel_url || i.author?.external_channel_url || i.author?.user_url || i.author?.id ? `https://www.youtube.com/channel/${i.author.id}` : i.author?.user ? `https://www.youtube.com/${i.author.user}` : undefined,
      },
      ageRestricted: Boolean(i.age_restricted),
    }, options);
    
    this.chapters = i.chapters || [];
    this.storyboards = i.storyboards || [];
    this.related = info.related_videos || [];
  }
}

class YouTubePlaylist extends Playlist {
  constructor(plugin, info, options) {
    const songs = info.items.map(i => new Song({
      plugin,
      playFromSource: true,
      source: "youtube",
      id: i.id,
      name: i.title,
      url: i.url,
      thumbnail: i.thumbnail,
      duration: toSecond(i.duration),
      isLive: Boolean(i.isLive),
      uploader: {
        name: i.author?.name,
        url: i.author?.url || i.author?.channelID ? `https://www.youtube.com/channel/${i.author.channelID}` : undefined,
      },
    }));
    super({
      source: "youtube",
      id: info.id,
      name: info.title,
      url: info.url,
      thumbnail: info.thumbnail?.url,
      songs,
    }, options);
  }
}

class YouTubeRelatedSong extends Song {
  constructor(plugin, info) {
    if (!info.id) throw new DisTubeError("CANNOT_RESOLVE_SONG", info);
    super({
      plugin,
      source: "youtube",
      playFromSource: true,
      id: info.id,
      name: info.title,
      url: `https://youtu.be/${info.id}`,
      thumbnail: info.thumbnails?.sort((a, b) => b.width - a.width)?.[0]?.url,
      isLive: Boolean(info.isLive),
      duration: info.isLive ? 0 : toSecond(info.length_seconds),
      views: parseNumber(info.view_count),
      uploader: typeof info.author === "string" ? { name: info.author } : {
        name: info.author?.name || info.author?.user,
        url: info.author?.channel_url || info.author?.external_channel_url || info.author?.user_url || info.author?.id ? `https://www.youtube.com/channel/${info.author.id}` : info.author?.user ? `https://www.youtube.com/${info.author.user}` : undefined,
      },
    });
  }
}

class YouTubeSearchResultSong extends Song {
  constructor(plugin, info) {
    super({
      plugin,
      source: "youtube",
      playFromSource: true,
      id: info.id,
      name: info.name,
      url: `https://youtu.be/${info.id}`,
      thumbnail: info.thumbnail,
      isLive: info.isLive,
      duration: toSecond(info.duration),
      views: parseNumber(info.views),
      uploader: {
        name: info.author?.name,
        url: info.author?.url,
      },
    });
  }
}

class YouTubeSearchResultPlaylist {
  constructor(info) {
    this.id = info.id;
    this.name = info.name;
    this.url = `https://www.youtube.com/playlist?list=${info.id}`;
    this.uploader = {
      name: info.owner?.name,
      url: info.owner?.url,
    };
    this.length = info.length;
  }
}

const SearchResultType = {
  VIDEO: "video",
  PLAYLIST: "playlist",
};

module.exports = {
  SearchResultType,
  YouTubePlaylist,
  YouTubePlugin,
  YouTubeRelatedSong,
  YouTubeSearchResultPlaylist,
  YouTubeSearchResultSong,
  YouTubeSong,
};

export const SearchResultType = "video" | "playlist";

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
import ytpl from "@distube/ytpl";
import ytsr from "@distube/ytsr";
import { YtdlCore } from "@ybd-project/ytdl-core";
import ytdl from "@ybd-project/ytdl-core/old" // Support for ValidateURL :D

const ytdlCore = new YtdlCore({
  clients: ["webCreator", "ios"],
  disableDefaultClients: true,
  quality: ["highestaudio"],
  notParsingHLSFormat: true,
  liveBuffer: 512
});

/**
 * Clone an object.
 *
 * @param obj - The object to clone
 */
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Convert a duration string to seconds.
 *
 * @param input - The duration string
 */
function toSecond(input) {
  if (!input) return 0;
  if (typeof input !== "string") return Number(input) || 0;
  const time = input.split(":").reverse();
  let seconds = 0;
  for (let i = 0; i < 3; i++) if (time[i]) seconds += Number(time[i].replace(/[^\d.]+/g, "")) * Math.pow(60, i);
  if (time.length > 3) seconds += Number(time[3].replace(/[^\d.]+/g, "")) * 24 * 60 * 60;
  return seconds;
}
/**
 * Parse a number from a string.
 *
 * @param input - The string to parse
 */
function parseNumber(input) {
  if (typeof input === "string") return Number(input.replace(/[^\d.]+/g, "")) || 0;
  return Number(input) || 0;
}
import { DisTubeError, ExtractorPlugin, Playlist, Song, checkInvalidKey } from "distube";

var YouTubePlugin = class extends ExtractorPlugin {
  static {
    __name(this, "YouTubePlugin");
  }
  #ytdlOptions;
  constructor(options = {}) {
    super();
    checkInvalidKey(options, ["cookies", "ytdlOptions"], "YouTubePlugin");
    this.#ytdlOptions = options?.ytdlOptions ? clone(options.ytdlOptions) : {};
    this.#ytdlOptions.agent = undefined;
  }
  get ytdlOptions() {
    return this.#ytdlOptions;
  }
  get ytCookie() {
    return "";
  }
  validate(url) {
    return ytdl.validateURL(url)
  }
  async resolve(url, options) {
    if (ytpl.validateID(url)) {
      const info = await ytpl(url, { limit: Infinity });
      return new YouTubePlaylist(this, info, options);
    }
    if (ytdl.validateURL(url)) return new YouTubeSong(this, await ytdlCore.getBasicInfo(url, this.ytdlOptions), options);
    throw new DisTubeError("CANNOT_RESOLVE_SONG", url);
  }
  async getStreamURL(song) {
    if (!song.url && !song.id) throw new DisTubeError("CANNOT_RESOLVE_SONG", song);
    const info = await ytdlCore.getFullInfo(song.url, this.ytdlOptions) || {};
    if (!info.formats?.length) throw new DisTubeError("UNAVAILABLE_VIDEO");
    const newSong = new YouTubeSong(this, info, {});
    song.ageRestricted = newSong.ageRestricted;
    song.views = newSong.views;
    song.likes = newSong.likes;
    song.thumbnail = newSong.thumbnail;
    song.related = newSong.related;
    song.chapters = newSong.chapters;
    song.storyboards = newSong.storyboards;
    const format = info.formats.filter((f) => f.hasAudio && (!newSong.isLive || f.isHLS)).sort((a, b) => Number(b.audioBitrate) - Number(a.audioBitrate) || Number(a.bitrate) - Number(b.bitrate))[0];
    if (!format) throw new DisTubeError("UNPLAYABLE_FORMATS");
    return format.url;
  }

  async getRelatedSongs(song) {
    return (song.related ? song.related : (await ytdlCore.getBasicInfo(song.url, this.ytdlOptions)).related_videos).filter((r) => r.id).map((r) => new YouTubeRelatedSong(this, r));
  }
  async searchSong(query, options) {
    const result = await this.search(query, { type: "video" /* VIDEO */, limit: 1 });
    if (!result?.[0]) return null;
    const info = result[0];
    return new Song(
      {
        plugin: this,
        source: "youtube",
        playFromSource: true,
        id: info.id,
        name: info.name,
        url: info.url,
        thumbnail: info.thumbnail,
        duration: info.duration,
        views: info.views,
        uploader: info.uploader
      },
      options
    );
  }
  destructor() {
    this.#ytdlOptions.agent = null;
  }

  /**
   * Search for a song.
   *
   * @param query              - The string search for
   * @param options            - Search options
   * @param options.limit      - Limit the results
   * @param options.type       - Type of results (`video` or `playlist`).
   * @param options.safeSearch - Whether or not use safe search (YouTube restricted mode)
   *
   * @returns Array of results
   */
  async search(query, options = {}) {
    const { items } = await ytsr(query, Object.assign(
      {
        type: options.type || "video" /* VIDEO */,
        limit: options.limit || 10,
        safeSearch: options.safeSearch || false,
        requestOptions: { headers: { cookie: this.ytCookie } },
      },
      options
    ));
    return items.map((i) => {
      if (i.type === "video") return new YouTubeSearchResultSong(this, i);
      return new YouTubeSearchResultPlaylist(i);
    });
  }
  async getSong(url, options) {
    const song = await this.resolve(url, options);
    if (!song) return null;
    return song;
  }
  async getPlaylist(url, options) {
    const playlist = await this.resolve(url, options);
    if (!playlist || !(playlist instanceof YouTubePlaylist)) return null;
    return playlist;
  }
  async getRelatedSongs(song) {
    return (song.related ? song.related : (await ytdl.getBasicInfo(song.url, { ...this.ytdlOptions, requestOptions: { headers: { cookie: this.#ytdlOptions.agent ? this.#ytdlOptions.agent.jar.getCookieStringSync("https://www.youtube.com") : "" } } })).related_videos).filter((r) => r.id).map((r) => new YouTubeRelatedSong(this, r));
  }
  async searchSong(query, options) {
    const result = await this.search(query, { type: "video" /* VIDEO */, limit: 1 });
    if (!result?.[0]) return null;
    const info = result[0];
    return new Song(
      {
        plugin: this,
        source: "youtube",
        playFromSource: true,
        id: info.id,
        name: info.name,
        url: info.url,
        thumbnail: info.thumbnail,
        duration: info.duration,
        views: info.views,
        uploader: info.uploader
      },
      options
    );
  }
  async searchPlaylist(query, options) {
    const result = await this.search(query, { type: "playlist" /* PLAYLIST */, limit: 1 });
    if (!result?.[0]) return null;
    const info = result[0];
    return new YouTubePlaylist(this, info, options);
  }
  destructor() {
    this.#ytdlOptions.agent = null;
  }
};

var YouTubeSong = class extends Song {
  static {
    __name(this, "YouTubeSong");
  }
  chapters;
  storyboards;
  related;
  constructor(plugin, info, options) {
    const { videoDetails: i } = info;
    super(
      {
        plugin,
        source: "youtube",
        playFromSource: true,
        id: i.videoId,
        name: i.title,
        isLive: Boolean(i.isLive),
        duration: i.isLive ? 0 : toSecond(i.lengthSeconds || i.length),
        url: i.video_url || `https://youtu.be/${i.videoId}`,
        thumbnail: i.thumbnails?.[0]?.url,
        views: parseNumber(i.viewCount || i.view_count || i.views),
        likes: parseNumber(i.likes),
        uploader: {
          name: i.author?.name || i.author?.user,
          url: i.author?.channel_url || i.author?.external_channel_url || i.author?.user_url || i.author?.id ? `https://www.youtube.com/channel/${i.author.id}` : i.author?.user ? `https://www.youtube.com/${i.author.user}` : void 0
        },
        ageRestricted: Boolean(i.age_restricted)
      },
      options
    );
    this.chapters = i.chapters || [];
    this.storyboards = i.storyboards || [];
    this.related = info.related_videos || [];
  }
  destructor() {
    this.chapters = null;
    this.storyboards = null;
    this.related = null;
  }
};
var YouTubePlaylist = class extends Playlist {
  static {
    __name(this, "YouTubePlaylist");
  }
  constructor(plugin, info, options) {
    const songs = info.items.map(
      (i) => new Song({
        plugin,
        playFromSource: true,
        source: "youtube",
        id: i.id,
        name: i.title,
        url: i.url,
        thumbnail: i.thumbnail,
        duration: i.isLive ? 0 : toSecond(i.length_seconds),
        isLive: Boolean(i.isLive),
        uploader: {
          name: i.author?.name,
          url: i.author?.url || i.author?.channelID ? `https://www.youtube.com/channel/${i.author.channelID}` : void 0
        }
      })
    );
    super(
      {
        source: "youtube",
        id: info.id,
        name: info.title,
        url: info.url,
        thumbnail: info.thumbnail?.url,
        songs
      },
      options
    );
  }
  destructor() {
    this.songs = null;
  }
};
var YouTubeRelatedSong = class extends Song {
  static {
    __name(this, "YouTubeRelatedSong");
  }
  constructor(plugin, info) {
    if (!info.id) throw new DisTubeError("CANNOT_RESOLVE_SONG", info);
    super({
      plugin,
      source: "youtube",
      playFromSource: true,
      id: info.id,
      name: info.title,
      url: `https://youtu.be/${info.id}`,
      thumbnail: info.thumbnails?.[0]?.url,
      isLive: Boolean(info.isLive),
      duration: info.isLive ? 0 : toSecond(info.length_seconds),
      views: parseNumber(info.view_count),
      uploader: typeof info.author === "string" ? {
        name: info.author
      } : {
        name: info.author?.name || info.author?.user,
        url: info.author?.channel_url || info.author?.external_channel_url || info.author?.user_url || info.author?.id ? `https://www.youtube.com/channel/${info.author.id}` : info.author?.user ? `https://www.youtube.com/${info.author.user}` : void 0
      }
    });
    
  }
  destructor() {
    this.thumbnail = null;
    this.uploader = null;
  }
};
const YouTubeSearchResultSong = class extends Song {
  static __name = "YouTubeSearchResultSong";
  constructor(plugin, { id, name, thumbnail, isLive, duration, views, author }) {
    super({
      plugin,
      source: "youtube",
      playFromSource: true,
      id,
      name,
      url: `https://youtu.be/${id}`,
      thumbnail,
      isLive,
      duration: toSecond(duration) || duration,
      views: parseNumber(views),
      uploader: { name: author?.name, url: author?.url }
    });
  }
};
const YouTubeSearchResultPlaylist = class {
  static __name = "YouTubeSearchResultPlaylist";
  /**
   * YouTube  playlist id
   */
  id;
  /**
   * Playlist title.
   */
  name;
  /**
   * Playlist URL.
   */
  url;
  /**
   * Playlist owner
   */
  uploader;
  /**
   * Number of videos in the playlist
   */
  length;
  constructor({ id, name, owner }) {
    this.id = id;
    this.name = name;
    this.url = `https://www.youtube.com/playlist?list=${id}`;
    this.uploader = { name: owner?.name, url: owner?.url };
  }
};
export {
  YouTubePlaylist,
  YouTubePlugin,
  YouTubeRelatedSong,
  YouTubeSearchResultPlaylist,
  YouTubeSearchResultSong,
  YouTubeSong
};
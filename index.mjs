  export const SearchResultType = "video" | "playlist";

  var __defProp = Object.defineProperty;
  var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

  // src/index.ts
  import ytpl from "@distube/ytpl";
  import ytsr from "@distube/ytsr";
  import { YtdlCore } from "@ybd-project/ytdl-core";

  const ytdlCore = new YtdlCore({
    clients: ["webCreator", "ios"],
    disableDefaultClients: true,
    quality: ["highestaudio"],
    notParsingHLSFormat: true,
    liveBuffer: 512,
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
    let seconds = 0;
    if (typeof input === "string") {
      const time = input
        .split(":")
        .reverse()
        .map((t) => Number(t.replace(/[^\d.]+/g, "")));
      for (let i = 0; i < 3; i++) if (time[i]) seconds += time[i] * Math.pow(60, i);
      if (time.length > 3) seconds += time[3] * 24 * 60 * 60;
    } else {
      seconds = Number(input) || 0;
    }
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

  var ToddysPlugin = class extends ExtractorPlugin {
    static {
      __name(this, "ToddysPlugin");
    }
    #ytdlOptions;
    constructor(options = {}) {
      super();
      checkInvalidKey(options, ["cookies", "ytdlOptions"], "ToddysPlugin");
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
      return YtdlCore.validateURL(url)
    }
    async resolve(url, options) {
      if (ytpl.validateID(url)) {
        return new YouTubePlaylist(this, await ytpl(url, { limit: Infinity }), options);
      }

      const info = await ytdlCore.getBasicInfo(url, this.ytdlOptions);
      if (!info) return null;

      return new YouTubeSong(this, info, options);
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

      const formats = info.formats.filter((f) => f.hasAudio && (!newSong.isLive || f.isHLS));
      if (!formats.length) throw new DisTubeError("UNPLAYABLE_FORMATS");

      return formats.sort((a, b) => Number(b.audioBitrate) - Number(a.audioBitrate))[0].url;
    }

    async getRelatedSongs(song) {
      const related = song.related || (await ytdlCore.getBasicInfo(song.url, this.ytdlOptions)).related_videos;
      return related.filter(r => r.id).map(r => new YouTubeRelatedSong(this, r));
    }

    async searchSong(query, options) {
      const result = (await this.search(query, { type: "video" /* VIDEO */, limit: 1 }))[0];
      if (!result) return null;

      return new Song(
        {
          plugin: this,
          source: "youtube",
          playFromSource: true,
          id: result.id,
          name: result.name,
          url: result.url,
          thumbnail: result.thumbnail,
          duration: result.duration,
          views: result.views,
          uploader: result.uploader
        },
        options
      );
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
          type: options.type ?? "video" /* VIDEO */,
          limit: options.limit ?? 10,
          safeSearch: options.safeSearch ?? false,
          requestOptions: { headers: { cookie: this.ytCookie } },
        },
        options
      ));

      return items.map(i => i.type === "video" ? new YouTubeSearchResultSong(this, i) : new YouTubeSearchResultPlaylist(i));
    }

    async getSong(url, options) {
      return (await this.resolve(url, options)) ?? null;
    }

    async getPlaylist(url, options) {
      return (await this.resolve(url, options)) instanceof YouTubePlaylist ? await this.resolve(url, options) : null;
    }

    async getRelatedSongs(song) {
      return (song.related || (await ytdlCore.getBasicInfo(song.url, this.ytdlOptions)).related_videos).filter(r => r.id).map(r => new YouTubeRelatedSong(this, r));
    }

    destructor() {
      this.#ytdlOptions.agent = null;
      super.destructor();
    }
  }
  var YouTubeSong = class extends Song {
    constructor(plugin, info, options) {
      const { videoDetails: i } = info;
      super({
        plugin,
        source: "youtube",
        playFromSource: true,
        id: i.videoId,
        name: i.title,
        isLive: Boolean(i.isLive),
        duration: i.isLive ? 0 : toSecond(i.lengthSeconds || i.length),
        url: i.video_url || `https://youtu.be/${i.videoId}`,
        thumbnail: i.thumbnails?.[0]?.url || null,
        views: parseNumber(i.viewCount || i.view_count || i.views),
        likes: parseNumber(i.likes),
        uploader: {
          name: i.author?.name || i.author?.user || null,
          url: i.author?.channel ? `https://www.youtube.com/channel/${i.author.id}` : i.author?.user ? `https://www.youtube.com/${i.author.user}` : null
        },
        ageRestricted: Boolean(i.age_restricted)
      }, options);
      this.chapters = i.chapters || [];
      this.storyboards = i.storyboards || [];
      this.related = info.related_videos || [];
    }

    destructor() {
      this.chapters.length = 0;
      this.storyboards.length = 0;
      this.related.length = 0;
      this.uploader.name = null;
      this.uploader.url = null;
      this.uploader = null;
      super.destructor();
    }
  }
  var YouTubePlaylist = class extends Playlist {
    constructor(plugin, info, options) {
      const songs = info.items.map(i => new Song({
        plugin,
        playFromSource: true,
        source: "youtube",
        id: i.id,
        name: i.title,
        url: i.url,
        thumbnail: i.thumbnail,
        duration: i.isLive ? 0 : toSecond(i.length_seconds),
        isLive: Boolean(i.isLive),
        uploader: { name: i.author?.name, url: i.author?.channelID ? `https://www.youtube.com/channel/${i.author.channelID}` : void 0 }
      }));
      super({
        source: "youtube",
        id: info.id,
        name: info.title,
        url: info.url,
        thumbnail: info.thumbnail?.url,
        songs
      }, options);
    }

    destructor() {
      this.songs.forEach(song => song.destructor());
      this.songs.length = 0;
      super.destructor();
    }
  }
  var YouTubeRelatedSong = class extends Song {
    constructor(plugin, info) {
      if (!info.id) throw new DisTubeError("CANNOT_RESOLVE_SONG", info);
      super({
        plugin,
        source: "youtube",
        playFromSource: true,
        id: info.id,
        name: info.title,
        url: `https://youtu.be/${info.id}`,
        thumbnail: info.thumbnails?.[0]?.url || null,
        isLive: Boolean(info.isLive),
        duration: info.isLive ? 0 : toSecond(info.length_seconds),
        views: parseNumber(info.view_count),
        uploader: typeof info.author === "string" ? {
          name: info.author
        } : {
          name: info.author?.name || info.author?.user || null,
          url: info.author?.channel_url || info.author?.external_channel_url || info.author?.user_url || info.author?.id ? `https://www.youtube.com/channel/${info.author.id}` : info.author?.user ? `https://www.youtube.com/${info.author.user}` : null
        }
      });
    }

    destructor() {
      this.thumbnail = null;
      if (this.uploader) {
        this.uploader.name = null;
        this.uploader.url = null;
      }
      this.uploader = null;
      super.destructor();
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
        thumbnail: thumbnail || null,
        isLive: Boolean(isLive), // Ensure isLive is a boolean
        duration: toSecond(duration) || duration,
        views: parseNumber(views),
        uploader: {
          name: (author && author.name) || null,
          url: (author && author.url) ? author.url : null // Defaulting to null if no author URL
        }
      });
    }

    destructor() {
      this.id = null;
      this.name = null;
      this.url = null;
      this.thumbnail = null;
      this.isLive = null;
      this.duration = null;
      this.views = null;
      this.uploader.name = null;
      this.uploader.url = null;
      this.uploader = null;
      super.destructor();
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
    ToddysPlugin,
    YouTubeRelatedSong,
    YouTubeSearchResultPlaylist,
    YouTubeSearchResultSong,
    YouTubeSong
  };

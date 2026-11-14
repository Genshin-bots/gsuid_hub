// 二次元壁纸墙预设。value 为实际背景（图片/视频 URL 或 API），thumb 为壁纸墙缩略图。
// 视频预设（.webm/.mp4）由 isVideoBackgroundUrl 识别并走 <video> 渲染；
// anim 为托管在 files.seeusercontent.com 的降档动图预览（320px/10fps 循环 webp），
// 供壁纸墙/预设卡片直接以 <img> 播放，避免在密集列表里挂 <video> 解码器。

export interface WallpaperPreset {
  id: string;
  /** i18n key（themes 命名空间） */
  name: string;
  value: string;
  thumb?: string;
  anim?: string;
}

export const animeWallpaperPresets: WallpaperPreset[] = [
  {
    id: 'anime3',
    name: 'themes.animeStreet',
    value: 'https://cdn.pixabay.com/photo/2024/05/26/15/27/anime-8788959_1280.jpg',
  },
  {
    id: 'anime4',
    name: 'themes.animeRail',
    value: 'https://files.seeusercontent.com/2026/03/13/5nQg/gg.jpg',
  },
  { id: 'anime5', name: 'themes.randomWife', value: 'https://api.paugram.com/wallpaper' },
  {
    id: 'anime6',
    name: 'themes.ruinsGirl',
    value: 'https://files.seeusercontent.com/2026/03/13/w5oD/aa.jpg',
  },
  {
    id: 'anime7',
    name: 'themes.kamisatoAyaka',
    value: 'https://files.seeusercontent.com/2026/06/20/Jth9/aeb070e9498a448d60e76caddd36432b.jpg',
  },
  {
    id: 'anime8',
    name: 'themes.sayu',
    value: 'https://files.seeusercontent.com/2026/06/20/sgO1/2026-06-21-06-13-29.png',
  },
  {
    id: 'anime9',
    name: 'themes.bidens',
    value: 'https://files.seeusercontent.com/2026/06/20/u2Sj/a694927.jpg',
  },
  {
    id: 'anime10',
    name: 'themes.blueGirl',
    value: 'https://files.seeusercontent.com/2026/06/20/qS9l/44873217_p0.jpg',
  },
  {
    id: 'anime11',
    name: 'themes.miku',
    value: 'https://files.seeusercontent.com/2026/06/20/kL1z/wallpaper894.jpg',
  },
  // —— 动态壁纸（moewalls 预览 webm，thumb 为同源静态图）——
  {
    id: 'vidSnowTears',
    name: 'themes.vidSnowTears',
    anim: 'https://files.seeusercontent.com/2026/11/13/kC6z/vidSnowTears.webp',
    value: 'https://moewalls.com/wp-content/uploads/preview/2026/tears-in-the-snow-preview.webm',
    thumb: 'https://moewalls.com/wp-content/uploads/2026/11/tears-in-the-snow-thumb-364x205.jpg',
  },
  {
    id: 'vidSilentTrain',
    name: 'themes.vidSilentTrain',
    anim: 'https://files.seeusercontent.com/2026/11/13/3txG/vidSilentTrain.webp',
    value:
      'https://moewalls.com/wp-content/uploads/preview/2026/silent-train-ride-just-listen-to-the-song-preview.webm',
    thumb:
      'https://moewalls.com/wp-content/uploads/2026/04/silent-train-ride-just-listen-to-the-song-thumb-364x205.jpg',
  },
  {
    id: 'vidTavernNap',
    name: 'themes.vidTavernNap',
    anim: 'https://files.seeusercontent.com/2026/11/13/4lHy/vidTavernNap.webp',
    value:
      'https://moewalls.com/wp-content/uploads/preview/2024/elf-sleeping-outside-tavern-preview.webm',
    thumb:
      'https://moewalls.com/wp-content/uploads/2024/06/elf-sleeping-outside-tavern-thumb-364x205.jpg',
  },
  {
    id: 'vidFernField',
    name: 'themes.vidFernField',
    anim: 'https://files.seeusercontent.com/2026/11/13/5Tji/vidFernField.webp',
    value:
      'https://moewalls.com/wp-content/uploads/preview/2024/fern-in-flower-field-sousou-no-frieren-preview.webm',
    thumb:
      'https://moewalls.com/wp-content/uploads/2024/06/fern-in-flower-field-sousou-no-frieren-thumb-364x205.jpg',
  },
  {
    id: 'vidYaeMiko',
    name: 'themes.vidYaeMiko',
    anim: 'https://files.seeusercontent.com/2026/11/13/zU1j/vidYaeMiko.webp',
    value:
      'https://moewalls.com/wp-content/uploads/preview/2026/yae-miko-sakura-cherry-blossoms-genshin-impact-preview.webm',
    thumb:
      'https://moewalls.com/wp-content/uploads/2026/09/yae-miko-sakura-cherry-blossoms-genshin-impact-thumb-364x205.jpg',
  },
  {
    id: 'vidYoimiyaAyaka',
    name: 'themes.vidYoimiyaAyaka',
    anim: 'https://files.seeusercontent.com/2026/11/13/0qQg/vidYoimiyaAyaka.webp',
    value:
      'https://moewalls.com/wp-content/uploads/preview/2022/yoimiya-and-ayaka-genshin-impact-preview.webm',
    thumb:
      'https://moewalls.com/wp-content/uploads/2022/08/yoimiya-and-ayaka-genshin-impact-thumb-364x205.jpg',
  },
  {
    id: 'vidKafka',
    name: 'themes.vidKafka',
    anim: 'https://files.seeusercontent.com/2026/11/13/cQ0j/vidKafka.webp',
    value:
      'https://moewalls.com/wp-content/uploads/preview/2024/kafka-umbrella-honkai-star-rail-preview.webm',
    thumb:
      'https://moewalls.com/wp-content/uploads/2024/06/kafka-umbrella-honkai-star-rail-thumb-364x205.jpg',
  },
  {
    id: 'vidCityTop',
    name: 'themes.vidCityTop',
    anim: 'https://files.seeusercontent.com/2026/11/13/upQ0/vidCityTop.webp',
    value:
      'https://moewalls.com/wp-content/uploads/preview/2024/stelle-city-top-view-honkai-star-rail-preview.webm',
    thumb:
      'https://moewalls.com/wp-content/uploads/2024/06/stelle-city-top-view-honkai-star-rail-thumb-364x205.jpg',
  },
  {
    id: 'vidRainCity',
    name: 'themes.vidRainCity',
    anim: 'https://files.seeusercontent.com/2026/11/13/tsV7/vidRainCity.webp',
    value:
      'https://moewalls.com/wp-content/uploads/preview/2025/nissan-silvia-s13-anime-girl-rainy-cityscape-preview.webm',
    thumb:
      'https://moewalls.com/wp-content/uploads/2025/08/nissan-silvia-s13-anime-girl-rainy-cityscape-thumb-364x205.jpg',
  },
  {
    id: 'vidPurpleRain',
    name: 'themes.vidPurpleRain',
    anim: 'https://files.seeusercontent.com/2026/11/13/jDu9/vidPurpleRain.webp',
    value:
      'https://moewalls.com/wp-content/uploads/preview/2025/anime-girl-hologram-in-the-purple-rain-preview.webm',
    thumb:
      'https://moewalls.com/wp-content/uploads/2025/08/anime-girl-hologram-in-the-purple-rain-thumb-364x205.jpg',
  },
  {
    id: 'vidSunsetBeach',
    name: 'themes.vidSunsetBeach',
    anim: 'https://files.seeusercontent.com/2026/11/13/x3pM/vidSunsetBeach.webp',
    value:
      'https://moewalls.com/wp-content/uploads/preview/2026/anime-school-girl-sunset-beach-heart-preview.webm',
    thumb:
      'https://moewalls.com/wp-content/uploads/2026/11/anime-school-girl-sunset-beach-heart-thumb-364x205.jpg',
  },
  {
    id: 'vidGalaxyEyes',
    name: 'themes.vidGalaxyEyes',
    anim: 'https://files.seeusercontent.com/2026/11/13/oE0t/vidGalaxyEyes.webp',
    value:
      'https://moewalls.com/wp-content/uploads/preview/2025/a-universe-within-her-galaxy-eyes-preview.webm',
    thumb:
      'https://moewalls.com/wp-content/uploads/2025/08/a-universe-within-her-galaxy-eyes-thumb-364x205.jpg',
  },
  {
    id: 'vidWhiteRose',
    name: 'themes.vidWhiteRose',
    anim: 'https://files.seeusercontent.com/2026/11/13/D7ee/vidWhiteRose.webp',
    value:
      'https://moewalls.com/wp-content/uploads/preview/2026/white-rose-anime-girl-preview.webm',
    thumb:
      'https://moewalls.com/wp-content/uploads/2026/11/white-rose-anime-girl-thumb-364x205.jpg',
  },
  {
    id: 'vidMikuMirai',
    name: 'themes.vidMikuMirai',
    anim: 'https://files.seeusercontent.com/2026/11/13/7dhO/vidMikuMirai.webp',
    value:
      'https://moewalls.com/wp-content/uploads/preview/2022/hatsune-miku-magical-mirai-preview.webm',
    thumb:
      'https://moewalls.com/wp-content/uploads/2022/08/hatsune-miku-magical-mirai-thumb-364x205.jpg',
  },
  {
    id: 'vidSummer',
    name: 'themes.vidSummer',
    anim: 'https://files.seeusercontent.com/2026/11/13/7wdF/vidSummer.webp',
    value: 'https://moewalls.com/wp-content/uploads/preview/2022/summer-memories-preview.webm',
    thumb: 'https://moewalls.com/wp-content/uploads/2022/08/summer-memories-thumb-364x205.jpg',
  },
  // —— 静态壁纸（wallhaven SFW 精选，thumb 为官方缩略图）——
  {
    id: 'wpScenery01',
    name: 'themes.wpScenery01',
    value: 'https://w.wallhaven.cc/full/yq/wallhaven-yqe81l.png',
    thumb: 'https://th.wallhaven.cc/lg/yq/yqe81l.jpg',
  },
  {
    id: 'wpScenery02',
    name: 'themes.wpScenery02',
    value: 'https://w.wallhaven.cc/full/gw/wallhaven-gwdvxq.jpg',
    thumb: 'https://th.wallhaven.cc/lg/gw/gwdvxq.jpg',
  },
  {
    id: 'wpScenery03',
    name: 'themes.wpScenery03',
    value: 'https://w.wallhaven.cc/full/og/wallhaven-ogjwvl.jpg',
    thumb: 'https://th.wallhaven.cc/lg/og/ogjwvl.jpg',
  },
  {
    id: 'wpScenery04',
    name: 'themes.wpScenery04',
    value: 'https://w.wallhaven.cc/full/gw/wallhaven-gw5ypd.jpg',
    thumb: 'https://th.wallhaven.cc/lg/gw/gw5ypd.jpg',
  },
  {
    id: 'wpScenery05',
    name: 'themes.wpScenery05',
    value: 'https://w.wallhaven.cc/full/yq/wallhaven-yq5mlk.jpg',
    thumb: 'https://th.wallhaven.cc/lg/yq/yq5mlk.jpg',
  },
  {
    id: 'wpScenery06',
    name: 'themes.wpScenery06',
    value: 'https://w.wallhaven.cc/full/je/wallhaven-jedrqw.jpg',
    thumb: 'https://th.wallhaven.cc/lg/je/jedrqw.jpg',
  },
  {
    id: 'wpScenery07',
    name: 'themes.wpScenery07',
    value: 'https://w.wallhaven.cc/full/9o/wallhaven-9ozlpk.png',
    thumb: 'https://th.wallhaven.cc/lg/9o/9ozlpk.jpg',
  },
  {
    id: 'wpScenery08',
    name: 'themes.wpScenery08',
    value: 'https://w.wallhaven.cc/full/qr/wallhaven-qrl7mr.jpg',
    thumb: 'https://th.wallhaven.cc/lg/qr/qrl7mr.jpg',
  },
  {
    id: 'wpScenery09',
    name: 'themes.wpScenery09',
    value: 'https://w.wallhaven.cc/full/1q/wallhaven-1qdk61.png',
    thumb: 'https://th.wallhaven.cc/lg/1q/1qdk61.jpg',
  },
  {
    id: 'wpScenery10',
    name: 'themes.wpScenery10',
    value: 'https://w.wallhaven.cc/full/ml/wallhaven-ml2191.jpg',
    thumb: 'https://th.wallhaven.cc/lg/ml/ml2191.jpg',
  },
  {
    id: 'wpScenery11',
    name: 'themes.wpScenery11',
    value: 'https://w.wallhaven.cc/full/po/wallhaven-powjde.jpg',
    thumb: 'https://th.wallhaven.cc/lg/po/powjde.jpg',
  },
  {
    id: 'wpScenery12',
    name: 'themes.wpScenery12',
    value: 'https://w.wallhaven.cc/full/d8/wallhaven-d8k5rm.jpg',
    thumb: 'https://th.wallhaven.cc/lg/d8/d8k5rm.jpg',
  },
  {
    id: 'wpScenery13',
    name: 'themes.wpScenery13',
    value: 'https://w.wallhaven.cc/full/6l/wallhaven-6ll6l6.png',
    thumb: 'https://th.wallhaven.cc/lg/6l/6ll6l6.jpg',
  },
  {
    id: 'wpScenery14',
    name: 'themes.wpScenery14',
    value: 'https://w.wallhaven.cc/full/6l/wallhaven-6le25w.png',
    thumb: 'https://th.wallhaven.cc/lg/6l/6le25w.jpg',
  },
  {
    id: 'wpScenery15',
    name: 'themes.wpScenery15',
    value: 'https://w.wallhaven.cc/full/w5/wallhaven-w5lpm6.png',
    thumb: 'https://th.wallhaven.cc/lg/w5/w5lpm6.jpg',
  },
  {
    id: 'wpScenery16',
    name: 'themes.wpScenery16',
    value: 'https://w.wallhaven.cc/full/xe/wallhaven-xej3dz.png',
    thumb: 'https://th.wallhaven.cc/lg/xe/xej3dz.jpg',
  },
  {
    id: 'wpScenery17',
    name: 'themes.wpScenery17',
    value: 'https://w.wallhaven.cc/full/og/wallhaven-ogyyg5.jpg',
    thumb: 'https://th.wallhaven.cc/lg/og/ogyyg5.jpg',
  },
  {
    id: 'wpScenery18',
    name: 'themes.wpScenery18',
    value: 'https://w.wallhaven.cc/full/e8/wallhaven-e83378.jpg',
    thumb: 'https://th.wallhaven.cc/lg/e8/e83378.jpg',
  },
  {
    id: 'wpScenery19',
    name: 'themes.wpScenery19',
    value: 'https://w.wallhaven.cc/full/k8/wallhaven-k8l8md.jpg',
    thumb: 'https://th.wallhaven.cc/lg/k8/k8l8md.jpg',
  },
  {
    id: 'wpScenery20',
    name: 'themes.wpScenery20',
    value: 'https://w.wallhaven.cc/full/8g/wallhaven-8gjd9y.jpg',
    thumb: 'https://th.wallhaven.cc/lg/8g/8gjd9y.jpg',
  },
  {
    id: 'wpScenery21',
    name: 'themes.wpScenery21',
    value: 'https://w.wallhaven.cc/full/po/wallhaven-poyqx9.png',
    thumb: 'https://th.wallhaven.cc/lg/po/poyqx9.jpg',
  },
  {
    id: 'wpScenery22',
    name: 'themes.wpScenery22',
    value: 'https://w.wallhaven.cc/full/yq/wallhaven-yq9w9x.jpg',
    thumb: 'https://th.wallhaven.cc/lg/yq/yq9w9x.jpg',
  },
  {
    id: 'wpScenery23',
    name: 'themes.wpScenery23',
    value: 'https://w.wallhaven.cc/full/8g/wallhaven-8grpl2.jpg',
    thumb: 'https://th.wallhaven.cc/lg/8g/8grpl2.jpg',
  },
  {
    id: 'wpScenery24',
    name: 'themes.wpScenery24',
    value: 'https://w.wallhaven.cc/full/gw/wallhaven-gwmg23.png',
    thumb: 'https://th.wallhaven.cc/lg/gw/gwmg23.jpg',
  },
  {
    id: 'wpCity01',
    name: 'themes.wpCity01',
    value: 'https://w.wallhaven.cc/full/5y/wallhaven-5y57x8.png',
    thumb: 'https://th.wallhaven.cc/lg/5y/5y57x8.jpg',
  },
  {
    id: 'wpCity02',
    name: 'themes.wpCity02',
    value: 'https://w.wallhaven.cc/full/6l/wallhaven-6l2rk7.jpg',
    thumb: 'https://th.wallhaven.cc/lg/6l/6l2rk7.jpg',
  },
  {
    id: 'wpCity03',
    name: 'themes.wpCity03',
    value: 'https://w.wallhaven.cc/full/8g/wallhaven-8grlqj.png',
    thumb: 'https://th.wallhaven.cc/lg/8g/8grlqj.jpg',
  },
  {
    id: 'wpCity04',
    name: 'themes.wpCity04',
    value: 'https://w.wallhaven.cc/full/1q/wallhaven-1q176g.jpg',
    thumb: 'https://th.wallhaven.cc/lg/1q/1q176g.jpg',
  },
  {
    id: 'wpCity05',
    name: 'themes.wpCity05',
    value: 'https://w.wallhaven.cc/full/gw/wallhaven-gwde5e.png',
    thumb: 'https://th.wallhaven.cc/lg/gw/gwde5e.jpg',
  },
  {
    id: 'wpCity06',
    name: 'themes.wpCity06',
    value: 'https://w.wallhaven.cc/full/d8/wallhaven-d8wwyg.png',
    thumb: 'https://th.wallhaven.cc/lg/d8/d8wwyg.jpg',
  },
  {
    id: 'wpCity07',
    name: 'themes.wpCity07',
    value: 'https://w.wallhaven.cc/full/gw/wallhaven-gw5877.png',
    thumb: 'https://th.wallhaven.cc/lg/gw/gw5877.jpg',
  },
  {
    id: 'wpCity08',
    name: 'themes.wpCity08',
    value: 'https://w.wallhaven.cc/full/qr/wallhaven-qrjjyd.png',
    thumb: 'https://th.wallhaven.cc/lg/qr/qrjjyd.jpg',
  },
  {
    id: 'wpCity09',
    name: 'themes.wpCity09',
    value: 'https://w.wallhaven.cc/full/3q/wallhaven-3qwzpy.png',
    thumb: 'https://th.wallhaven.cc/lg/3q/3qwzpy.jpg',
  },
  {
    id: 'wpCity10',
    name: 'themes.wpCity10',
    value: 'https://w.wallhaven.cc/full/je/wallhaven-jedgo5.jpg',
    thumb: 'https://th.wallhaven.cc/lg/je/jedgo5.jpg',
  },
  {
    id: 'wpCity11',
    name: 'themes.wpCity11',
    value: 'https://w.wallhaven.cc/full/yq/wallhaven-yqgj3l.jpg',
    thumb: 'https://th.wallhaven.cc/lg/yq/yqgj3l.jpg',
  },
  {
    id: 'wpCity12',
    name: 'themes.wpCity12',
    value: 'https://w.wallhaven.cc/full/d8/wallhaven-d8v5jm.jpg',
    thumb: 'https://th.wallhaven.cc/lg/d8/d8v5jm.jpg',
  },
  {
    id: 'wpSky01',
    name: 'themes.wpSky01',
    value: 'https://w.wallhaven.cc/full/e8/wallhaven-e83mxl.png',
    thumb: 'https://th.wallhaven.cc/lg/e8/e83mxl.jpg',
  },
  {
    id: 'wpSky02',
    name: 'themes.wpSky02',
    value: 'https://w.wallhaven.cc/full/yq/wallhaven-yqkl97.jpg',
    thumb: 'https://th.wallhaven.cc/lg/yq/yqkl97.jpg',
  },
  {
    id: 'wpSky03',
    name: 'themes.wpSky03',
    value: 'https://w.wallhaven.cc/full/3q/wallhaven-3q5k8y.png',
    thumb: 'https://th.wallhaven.cc/lg/3q/3q5k8y.jpg',
  },
  {
    id: 'wpSky04',
    name: 'themes.wpSky04',
    value: 'https://w.wallhaven.cc/full/1q/wallhaven-1qr6mg.png',
    thumb: 'https://th.wallhaven.cc/lg/1q/1qr6mg.jpg',
  },
  {
    id: 'wpSky05',
    name: 'themes.wpSky05',
    value: 'https://w.wallhaven.cc/full/po/wallhaven-powyee.png',
    thumb: 'https://th.wallhaven.cc/lg/po/powyee.jpg',
  },
  {
    id: 'wpSky06',
    name: 'themes.wpSky06',
    value: 'https://w.wallhaven.cc/full/po/wallhaven-po7m99.jpg',
    thumb: 'https://th.wallhaven.cc/lg/po/po7m99.jpg',
  },
  {
    id: 'wpSky07',
    name: 'themes.wpSky07',
    value: 'https://w.wallhaven.cc/full/po/wallhaven-pow9e3.png',
    thumb: 'https://th.wallhaven.cc/lg/po/pow9e3.jpg',
  },
  {
    id: 'wpSky08',
    name: 'themes.wpSky08',
    value: 'https://w.wallhaven.cc/full/d8/wallhaven-d83pkl.jpg',
    thumb: 'https://th.wallhaven.cc/lg/d8/d83pkl.jpg',
  },
  {
    id: 'wpSky09',
    name: 'themes.wpSky09',
    value: 'https://w.wallhaven.cc/full/9o/wallhaven-9oolmx.jpg',
    thumb: 'https://th.wallhaven.cc/lg/9o/9oolmx.jpg',
  },
  {
    id: 'wpSky10',
    name: 'themes.wpSky10',
    value: 'https://w.wallhaven.cc/full/8g/wallhaven-8gj3ky.jpg',
    thumb: 'https://th.wallhaven.cc/lg/8g/8gj3ky.jpg',
  },
  {
    id: 'wpSky11',
    name: 'themes.wpSky11',
    value: 'https://w.wallhaven.cc/full/je/wallhaven-je1kdw.png',
    thumb: 'https://th.wallhaven.cc/lg/je/je1kdw.jpg',
  },
  {
    id: 'wpSky12',
    name: 'themes.wpSky12',
    value: 'https://w.wallhaven.cc/full/1q/wallhaven-1q23yg.jpg',
    thumb: 'https://th.wallhaven.cc/lg/1q/1q23yg.jpg',
  },
  {
    id: 'wpAnime01',
    name: 'themes.wpAnime01',
    value: 'https://w.wallhaven.cc/full/9o/wallhaven-9oo8k1.jpg',
    thumb: 'https://th.wallhaven.cc/lg/9o/9oo8k1.jpg',
  },
  {
    id: 'wpAnime02',
    name: 'themes.wpAnime02',
    value: 'https://w.wallhaven.cc/full/3q/wallhaven-3q6m6y.png',
    thumb: 'https://th.wallhaven.cc/lg/3q/3q6m6y.jpg',
  },
  {
    id: 'wpAnime03',
    name: 'themes.wpAnime03',
    value: 'https://w.wallhaven.cc/full/3q/wallhaven-3qwqld.png',
    thumb: 'https://th.wallhaven.cc/lg/3q/3qwqld.jpg',
  },
  {
    id: 'wpAnime04',
    name: 'themes.wpAnime04',
    value: 'https://w.wallhaven.cc/full/qr/wallhaven-qrow67.png',
    thumb: 'https://th.wallhaven.cc/lg/qr/qrow67.jpg',
  },
  {
    id: 'wpAnime05',
    name: 'themes.wpAnime05',
    value: 'https://w.wallhaven.cc/full/21/wallhaven-21d6g9.png',
    thumb: 'https://th.wallhaven.cc/lg/21/21d6g9.jpg',
  },
  {
    id: 'wpAnime06',
    name: 'themes.wpAnime06',
    value: 'https://w.wallhaven.cc/full/e8/wallhaven-e88r8o.png',
    thumb: 'https://th.wallhaven.cc/lg/e8/e88r8o.jpg',
  },
  {
    id: 'wpAnime07',
    name: 'themes.wpAnime07',
    value: 'https://w.wallhaven.cc/full/rq/wallhaven-rqo8km.png',
    thumb: 'https://th.wallhaven.cc/lg/rq/rqo8km.jpg',
  },
  {
    id: 'wpAnime08',
    name: 'themes.wpAnime08',
    value: 'https://w.wallhaven.cc/full/6l/wallhaven-6ll7dx.png',
    thumb: 'https://th.wallhaven.cc/lg/6l/6ll7dx.jpg',
  },
  {
    id: 'wpAnime09',
    name: 'themes.wpAnime09',
    value: 'https://w.wallhaven.cc/full/w5/wallhaven-w5xdzx.jpg',
    thumb: 'https://th.wallhaven.cc/lg/w5/w5xdzx.jpg',
  },
  {
    id: 'wpAnime10',
    name: 'themes.wpAnime10',
    value: 'https://w.wallhaven.cc/full/gw/wallhaven-gww27e.jpg',
    thumb: 'https://th.wallhaven.cc/lg/gw/gww27e.jpg',
  },
  {
    id: 'wpAnime11',
    name: 'themes.wpAnime11',
    value: 'https://w.wallhaven.cc/full/ml/wallhaven-mll7j1.jpg',
    thumb: 'https://th.wallhaven.cc/lg/ml/mll7j1.jpg',
  },
  {
    id: 'wpAnime12',
    name: 'themes.wpAnime12',
    value: 'https://w.wallhaven.cc/full/ly/wallhaven-lyjvl2.jpg',
    thumb: 'https://th.wallhaven.cc/lg/ly/lyjvl2.jpg',
  },
  {
    id: 'wpAnime13',
    name: 'themes.wpAnime13',
    value: 'https://w.wallhaven.cc/full/vp/wallhaven-vpp8gm.jpg',
    thumb: 'https://th.wallhaven.cc/lg/vp/vpp8gm.jpg',
  },
  {
    id: 'wpAnime14',
    name: 'themes.wpAnime14',
    value: 'https://w.wallhaven.cc/full/8g/wallhaven-8g9wyy.png',
    thumb: 'https://th.wallhaven.cc/lg/8g/8g9wyy.jpg',
  },
  {
    id: 'wpAnime15',
    name: 'themes.wpAnime15',
    value: 'https://w.wallhaven.cc/full/21/wallhaven-212k56.jpg',
    thumb: 'https://th.wallhaven.cc/lg/21/212k56.jpg',
  },
  {
    id: 'wpAnime16',
    name: 'themes.wpAnime16',
    value: 'https://w.wallhaven.cc/full/vp/wallhaven-vpp688.jpg',
    thumb: 'https://th.wallhaven.cc/lg/vp/vpp688.jpg',
  },
  {
    id: 'wpAnime17',
    name: 'themes.wpAnime17',
    value: 'https://w.wallhaven.cc/full/ly/wallhaven-lydzk2.png',
    thumb: 'https://th.wallhaven.cc/lg/ly/lydzk2.jpg',
  },
  {
    id: 'wpAnime18',
    name: 'themes.wpAnime18',
    value: 'https://w.wallhaven.cc/full/8g/wallhaven-8geml1.jpg',
    thumb: 'https://th.wallhaven.cc/lg/8g/8geml1.jpg',
  },
  {
    id: 'wpAnime19',
    name: 'themes.wpAnime19',
    value: 'https://w.wallhaven.cc/full/e8/wallhaven-e8e9y8.jpg',
    thumb: 'https://th.wallhaven.cc/lg/e8/e8e9y8.jpg',
  },
  {
    id: 'wpAnime20',
    name: 'themes.wpAnime20',
    value: 'https://w.wallhaven.cc/full/5y/wallhaven-5y5537.png',
    thumb: 'https://th.wallhaven.cc/lg/5y/5y5537.jpg',
  },
  {
    id: 'wpAnime21',
    name: 'themes.wpAnime21',
    value: 'https://w.wallhaven.cc/full/xe/wallhaven-xe762v.jpg',
    thumb: 'https://th.wallhaven.cc/lg/xe/xe762v.jpg',
  },
  {
    id: 'wpAnime22',
    name: 'themes.wpAnime22',
    value: 'https://w.wallhaven.cc/full/21/wallhaven-216o5y.png',
    thumb: 'https://th.wallhaven.cc/lg/21/216o5y.jpg',
  },
  {
    id: 'wpAnime23',
    name: 'themes.wpAnime23',
    value: 'https://w.wallhaven.cc/full/d8/wallhaven-d83okm.jpg',
    thumb: 'https://th.wallhaven.cc/lg/d8/d83okm.jpg',
  },
  {
    id: 'wpAnime24',
    name: 'themes.wpAnime24',
    value: 'https://w.wallhaven.cc/full/yq/wallhaven-yqq3wd.png',
    thumb: 'https://th.wallhaven.cc/lg/yq/yqq3wd.jpg',
  },
  {
    id: 'wpAnime25',
    name: 'themes.wpAnime25',
    value: 'https://w.wallhaven.cc/full/21/wallhaven-21293g.jpg',
    thumb: 'https://th.wallhaven.cc/lg/21/21293g.jpg',
  },
  {
    id: 'wpAnime26',
    name: 'themes.wpAnime26',
    value: 'https://w.wallhaven.cc/full/w5/wallhaven-w55vwr.png',
    thumb: 'https://th.wallhaven.cc/lg/w5/w55vwr.jpg',
  },
  {
    id: 'wpAnime27',
    name: 'themes.wpAnime27',
    value: 'https://w.wallhaven.cc/full/vp/wallhaven-vpylkm.png',
    thumb: 'https://th.wallhaven.cc/lg/vp/vpylkm.jpg',
  },
  {
    id: 'wpAnime28',
    name: 'themes.wpAnime28',
    value: 'https://w.wallhaven.cc/full/5y/wallhaven-5yp939.png',
    thumb: 'https://th.wallhaven.cc/lg/5y/5yp939.jpg',
  },
];

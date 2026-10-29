import { CONFIG } from './config.js';

export const isTouch =
  ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

export const state = {
  running: false,
  locked: false,
  room1Cleared: false,
  gameOver: false,
  room2Wave: 0,
  room2Wave1Spawned: false,
  room2Wave2Spawned: false,
  room2Cleared: false,
  boss: {
    hp: 1100, maxHp: 1100,
    state: 'sleep',
    animTime: 0,
    attackCooldown: 0,
    iceCooldown: 0,
    qteCooldown: 15,
    qteTriggeredPhase2: false,
    _stunTimer: 0,
    _dashing: false,
    _slamTarget: null,
  },
  qte: {
    active: false,
    mashCount: 0,
    target: 10,
    timer: 0,
  },
  player: {
    pos: new THREE.Vector3(0, CONFIG.player.eyeHeight, 18),
    vel: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    onGround: true,
    hp: CONFIG.player.maxHp, mana: CONFIG.player.maxMana,
    dashTimer: 0, dashCooldown: 0, dashDir: new THREE.Vector3(0, 0, -1),
  },
  weapon: { ammo: CONFIG.weapon.magSize, cooldown: 0, reloading: 0 },
  spell: { active: 0 },
  touch: {
    x: 0, y: 0,
    active: false,
    sprint: false,
    shootHeld: false,
  },
  view: { bob: 0, recoil: 0, cast: 0, muzzle: 0, reloadShake: 0 },
  savePoint: { near: false, feedbackTimer: 0 },
  arch: { near: false },
  dialogue: {
    active: false,
    isCutscene: false,
    style: 'cutscene',
    activeLines: [],
    npcInView: false,
    typing: false,
    charIndex: 0,
    timer: 0,
    tutorialTimer: 0,
    speed: 0.028,
    currentLine: 0,
    lines: [
      { speaker: 'npc', name: 'Сейкр', portrait: 'assets/happyg.png', style: 'cutscene', text: '«А-а-а! Очнулся! Привет-привет! Ну наконец-то, а то я уже думал, что ты там навсегда застрял! Добро пожаловать!»' },
      { speaker: 'player', name: 'Кирио', portrait: 'assets/herostartled.png', style: 'cutscene', text: '«Я... я же... я мёртв? Я ведь... Где я? И почему всё вокруг... серое?»' },
      { speaker: 'npc', name: 'Сейкр', portrait: 'assets/idleg.png', style: 'cutscene', text: '«Ну... ты был мёртв! Это же очевидно!»' },
      { speaker: 'npc', name: 'Сейкр', portrait: 'assets/happyg.png', style: 'cutscene', text: '«Но кто сказал, что смерть — это конец? Для тебя это, скажем так... повышение!»' },
      { speaker: 'player', name: 'Кирио', portrait: 'assets/herostartled.png', style: 'cutscene', text: '«Повышение?.. А ты... ты кто вообще? И почему ты... розовый?»' },
      { speaker: 'npc', name: 'Сейкр', portrait: 'assets/happyg.png', style: 'cutscene', text: '«Я — Сейкр! Меня отправили сюда высшие боги! Мы с тобой в одной лодке, Кирио! Мне поручено помогать тебе, следить за тобой и... ну, не давать тебе заскучать!»' },
      { speaker: 'player', name: 'Кирио', portrait: 'assets/herostartled.png', style: 'cutscene', text: '«Откуда ты знаешь моё имя? Хотя я... Думаю я не хочу знать»' },
      { speaker: 'npc', name: 'Сейкр', portrait: 'assets/idleg.png', style: 'cutscene', text: '«Это правильный настрой, дорогой друг»' },
      { speaker: 'npc', name: 'Сейкр', portrait: 'assets/sadg.png', style: 'cutscene', text: '«Тут, конечно, всё серое и скучное,»' },
      { speaker: 'npc', name: 'Сейкр', portrait: 'assets/idleg.png', style: 'cutscene', text: '«НО! Зато тут есть экшн, магия и черно-белая кровь! Разве не весело?»' },
      { speaker: 'player', name: 'Кирио', portrait: 'assets/heroidle.png', style: 'cutscene', text: '«Весело... Ладно. Допустим, у меня нет выбора. И как я должен... убивать этих твоих монстров?»' },
      { speaker: 'npc', name: 'Сейкр', portrait: 'assets/idleg.png', style: 'tutorial', text: '«Ты нравишься мне всё больше, Кирио!»' },
      { speaker: 'npc', name: 'Сейкр', portrait: 'assets/happyg.png', style: 'tutorial', text: '«Боги выдали тебе всё необходимое для работы! Пистолет — для обычной мелочи, а твоя левая рука теперь — настоящий магический инструмент. Я, конечно, добавил пару штрихов от себя, чтобы было красивее!»' },
      { speaker: 'player', name: 'Кирио', portrait: 'assets/heroidle.png', style: 'tutorial', text: '«Пистолет... Классика жанра. Ну и что дальше?»' },
      { speaker: 'npc', name: 'Сейкр', portrait: 'assets/idleg.png', style: 'tutorial', text: '«Слушай мою команду! Для начала — просто подвигайся! Твои ноги (нажми WASD) должны вспомнить, как ходить. И не забывай крутить головой (двигай Мышкой), а то вляпаешься в стену! Также у тебя есть рывок! (Shift)»' },
      { speaker: 'player', name: 'Кирио', portrait: 'assets/heroidle.png', style: 'tutorial', text: '«Да понял я, понял. Ходить я умею. Ты лучше скажи, где тут монстры?»' },
      { speaker: 'npc', name: 'Сейкр', portrait: 'assets/idleg.png', style: 'tutorial', text: '«Не-е-ет, от меня так просто не сбежишь, Кирио! Нажми ЛКМ, чтобы пальнуть из пистолета по вон тем мишеням. А потом опробуй свою магию! Клавиша 1 — заморозка, клавиша 2 — взрыв! Вперед, Избранный!»' },
    ],
    postLines: [
      { speaker: 'npc', name: 'Сейкр', portrait: 'assets/happyg.png', style: 'cutscene', text: '«Ну что, Кирио? Готов к работе? Мишени вон там — тренируйся!»' },
    ]
  }
};

export const keys = {};
(() => {
  const lerp = (a, b, t) => a + (b - a) * t;

  const THEMES = {
    grove: {
      key: 'grove',
      name: 'Olive Grove',
      skyTop: '#3b6b48',
      skyBottom: '#9dcf83',
      fog: '#d9edc5',
      ground: '#7f9b4f',
      accent: '#d7c96d',
      shadow: '#253728',
    },
    medina: {
      key: 'medina',
      name: 'Medina Rooftops',
      skyTop: '#7f6743',
      skyBottom: '#d6b47d',
      fog: '#efe1bc',
      ground: '#9d8b6c',
      accent: '#5f8668',
      shadow: '#42352d',
    },
    desert: {
      key: 'desert',
      name: 'Shifting Dunes',
      skyTop: '#a76d2d',
      skyBottom: '#f2cf79',
      fog: '#ffe8aa',
      ground: '#caa15d',
      accent: '#86c0b6',
      shadow: '#5a4429',
    },
    ruins: {
      key: 'ruins',
      name: 'Moon Ruins',
      skyTop: '#4b3c63',
      skyBottom: '#8d77a8',
      fog: '#cbb8df',
      ground: '#6d6671',
      accent: '#a3bf7d',
      shadow: '#261f31',
    },
    eclipse: {
      key: 'eclipse',
      name: 'Eclipse Frontier',
      skyTop: '#24193b',
      skyBottom: '#5c486f',
      fog: '#9d8db7',
      ground: '#6c7051',
      accent: '#cae16b',
      shadow: '#181220',
    },
    rebirth: {
      key: 'rebirth',
      name: 'Original Olive Tree',
      skyTop: '#302148',
      skyBottom: '#91c96a',
      fog: '#d9f4b6',
      ground: '#5d7c3d',
      accent: '#f5df83',
      shadow: '#1a1322',
    },
  };

  function baseLevel(index, act, title, theme, worldWidth, worldHeight = 720) {
    return {
      id: index,
      act,
      title,
      theme,
      worldWidth,
      worldHeight,
      start: { x: 110, y: 520 },
      goal: { x: worldWidth - 180, y: 450, w: 64, h: 96, type: 'gate' },
      platforms: [],
      spikes: [],
      enemies: [],
      collectibles: [],
      powerups: [],
      windZones: [],
      switches: [],
      doors: [],
      messages: [],
      ambient: theme.key === 'desert' ? 'wind' : 'music',
      colors: theme,
    };
  }

  function addArc(level, x1, y1, x2, y2, count, height = 80, hidden = false) {
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      level.collectibles.push({
        x: lerp(x1, x2, t),
        y: lerp(y1, y2, t) - Math.sin(t * Math.PI) * height,
        r: 9,
        hidden,
      });
    }
  }

  function addHiddenCluster(level, x, y) {
    level.collectibles.push({ x, y, r: 9, hidden: true });
    level.collectibles.push({ x: x + 28, y: y - 12, r: 9, hidden: true });
    level.collectibles.push({ x: x - 24, y: y - 18, r: 9, hidden: true });
  }

  function platform(x, y, w, h, style = 'solid') {
    return { type: style, x, y, w, h };
  }

  function movingPlatform(x, y, w, h, axis, range, speed, phase = 0, style = 'moving') {
    return {
      type: style,
      x,
      y,
      w,
      h,
      baseX: x,
      baseY: y,
      axis,
      range,
      speed,
      phase,
    };
  }

  function fallingPlatform(x, y, w, h, delay = 0.45) {
    return {
      type: 'falling',
      x,
      y,
      w,
      h,
      baseX: x,
      baseY: y,
      delay,
      fallTimer: 0,
      triggered: false,
      vy: 0,
    };
  }

  function spikeStrip(level, x, y, w) {
    level.spikes.push({ x, y, w, h: 22 });
  }

  function enemy(level, x, y, minX, maxX, speed) {
    level.enemies.push({ x, y, w: 34, h: 34, minX, maxX, speed, dir: 1, alive: true });
  }

  function addDoor(level, id, x, y, w = 28, h = 150) {
    level.doors.push({ id, x, y, w, h, open: false });
  }

  function addSwitch(level, id, x, y) {
    level.switches.push({ id, x, y, w: 34, h: 16, active: false });
  }

  function powerup(level, type, x, y) {
    level.powerups.push({ type, x, y, r: 15, collected: false });
  }

  function buildAct1(levelNumber) {
    const diff = levelNumber - 1;
    const theme = THEMES.grove;
    const level = baseLevel(levelNumber, 1, `Act 1 · Grove Step ${levelNumber}`, theme, 2500 + diff * 55);
    const groundY = 610;
    level.start = { x: 120, y: 540 };
    level.messages.push('Collect olive seeds and bounce to the green gate.');
    level.platforms.push(platform(0, groundY, 360, 110, 'ground'));
    let cursor = 360;
    let previousX = 190;
    let previousY = groundY - 34;

    for (let section = 0; section < 6; section += 1) {
      const gap = 90 + ((diff + section) % 3) * 24;
      const width = 250 + ((section + diff) % 3) * 60;
      const y = groundY - (section % 2 === 0 ? 0 : 54) - (((section + diff) % 4 === 0) ? 38 : 0);
      const x = cursor + gap;
      level.platforms.push(platform(x, y, width, 110, section % 2 === 0 ? 'ground' : 'stone'));
      addArc(level, previousX, previousY, x + width * 0.48, y - 34, 5 + (section % 2), 56 + section * 6);

      if (section % 2 === 1) {
        spikeStrip(level, x + 96, y - 22, 54);
      }
      if (section === 2 && diff >= 2) {
        level.platforms.push(movingPlatform(cursor + gap * 0.5, groundY - 84, 96, 20, 'y', 56, 1.15 + diff * 0.02, 0.5));
      }
      if (section === 4 && diff >= 4) {
        level.platforms.push(fallingPlatform(x + width * 0.45, y - 130, 92, 18, 0.42));
        addArc(level, x + width * 0.45, y - 154, x + width * 0.45 + 92, y - 154, 4, 34);
      }
      if ((section === 1 || section === 4) && diff >= 1) {
        level.platforms.push(platform(x + 76, y - 146, 140, 18, 'ledge'));
        addArc(level, x + 76, y - 170, x + 216, y - 170, 4, 30);
      }
      if (section >= 3 && diff >= 2 && section % 2 === 0) {
        enemy(level, x + 120, y - 34, x + 80, x + width - 80, 74 + diff * 3);
      }
      previousX = x + width * 0.5;
      previousY = y - 28;
      cursor = x + width;
    }

    const finaleX = cursor + 110;
    level.platforms.push(platform(finaleX, groundY - 72, 360, 182, 'goal-ground'));
    addArc(level, previousX, previousY, finaleX + 140, groundY - 118, 7, 90);
    addHiddenCluster(level, 520 + diff * 18, 360 - (diff % 3) * 18);
    if (levelNumber === 1) {
      powerup(level, 'bounce', 980, 470);
      level.messages.push('Space jumps. Land softly to keep control.');
    } else if (levelNumber === 2) {
      powerup(level, 'magnet', 1320, 420);
    } else if (levelNumber === 5) {
      powerup(level, 'shield', 1700, 420);
    } else if (levelNumber >= 7) {
      powerup(level, diff % 2 === 0 ? 'speed' : 'bounce', 1520 + diff * 20, 430);
    }
    level.goal = { x: finaleX + 228, y: groundY - 168, w: 72, h: 96, type: 'gate' };
    return level;
  }

  function buildAct2(levelNumber) {
    const diff = levelNumber - 11;
    const theme = THEMES.medina;
    const level = baseLevel(levelNumber, 2, `Act 2 · Medina Roof ${diff + 1}`, theme, 3050 + diff * 70);
    level.start = { x: 120, y: 520 };
    level.messages.push('Roof switches open old doors.');

    const roofHeights = [560, 510, 450, 520, 430, 500, 420];
    const roofWidths = [320, 290, 280, 310, 300, 280, 360];
    let x = 0;
    let previousCenter = 140;
    let previousY = 540;

    level.platforms.push(platform(0, 590, 320, 130, 'roof'));
    x = 360;

    roofHeights.forEach((roofY, index) => {
      const width = roofWidths[index];
      const gap = 110 + ((diff + index) % 3) * 24;
      x += gap;
      level.platforms.push(platform(x, roofY, width, 130, 'roof'));
      addArc(level, previousCenter, previousY - 20, x + width * 0.5, roofY - 36, 6, 78);
      if (index % 2 === 0) {
        level.platforms.push(platform(x + 82, roofY - 120, 120, 18, 'awning'));
        addArc(level, x + 82, roofY - 148, x + 202, roofY - 148, 4, 28);
      }
      if (index === 1) {
        addDoor(level, 'A', x + width + 46, roofY - 90, 28, 160);
        addSwitch(level, 'A', x + 110, roofY - 14);
      }
      if (index === 3 && diff >= 3) {
        addDoor(level, 'B', x + width + 52, roofY - 90, 28, 160);
        addSwitch(level, 'B', x + 120, roofY - 134);
        level.platforms.push(platform(x + 70, roofY - 180, 118, 18, 'awning'));
      }
      if (index === 4) {
        level.platforms.push(movingPlatform(x + width * 0.35, roofY - 94, 98, 18, 'y', 70, 1.25 + diff * 0.04, index));
      }
      if (index >= 2) {
        spikeStrip(level, x + 64, roofY - 22, 50 + (index % 2) * 24);
      }
      if (index >= 3) {
        enemy(level, x + 96, roofY - 34, x + 60, x + width - 60, 90 + diff * 5);
      }
      previousCenter = x + width * 0.5;
      previousY = roofY;
      x += width;
    });

    const endX = x + 130;
    level.platforms.push(platform(endX, 420, 420, 300, 'roof-goal'));
    addArc(level, previousCenter, previousY - 20, endX + 160, 378, 8, 88);
    addHiddenCluster(level, 940 + diff * 45, 290);
    powerup(level, diff % 3 === 0 ? 'shield' : 'speed', 1500 + diff * 40, 360);
    level.goal = { x: endX + 250, y: 322, w: 72, h: 98, type: 'gate' };
    return level;
  }

  function buildAct3(levelNumber) {
    const diff = levelNumber - 21;
    const theme = THEMES.desert;
    const level = baseLevel(levelNumber, 3, `Act 3 · Dune Flight ${diff + 1}`, theme, 3380 + diff * 76);
    level.start = { x: 120, y: 540 };
    level.messages.push('Wind can lift Kora or push across sand.');

    const dunes = [
      { x: 0, y: 606, w: 360 },
      { x: 520, y: 580, w: 280 },
      { x: 980, y: 622, w: 250 },
      { x: 1420, y: 546, w: 300 },
      { x: 1880, y: 604, w: 260 },
      { x: 2320, y: 520, w: 320 },
      { x: 2820, y: 590, w: 320 },
    ];

    dunes.forEach((dune, i) => {
      level.platforms.push(platform(dune.x, dune.y, dune.w, 114, 'sand'));
      if (i > 0) {
        const prev = dunes[i - 1];
        addArc(level, prev.x + prev.w * 0.55, prev.y - 24, dune.x + dune.w * 0.45, dune.y - 24, 6, 92);
      }
      if (i === 1 || i === 4) {
        level.windZones.push({ x: dune.x - 120, y: 250, w: 140, h: 390, forceX: 100 + diff * 5, forceY: -560 - diff * 15 });
        level.platforms.push(movingPlatform(dune.x - 48, dune.y - 120, 96, 18, 'y', 90, 1.18 + diff * 0.03, i * 0.7, 'sand-moving'));
      }
      if (i === 2 || i === 5) {
        level.platforms.push(movingPlatform(dune.x + 40, dune.y - 148, 116, 18, 'x', 92, 1.15 + diff * 0.04, i * 0.4, 'sand-moving'));
      }
      if (i === 3) {
        level.platforms.push(fallingPlatform(dune.x + 80, dune.y - 120, 96, 18, 0.35));
        level.platforms.push(fallingPlatform(dune.x + 200, dune.y - 160, 96, 18, 0.45));
      }
      if (i >= 2) {
        spikeStrip(level, dune.x + 74, dune.y - 22, 54 + (i % 2) * 20);
      }
      if (i >= 1 && i !== 4) {
        enemy(level, dune.x + 90, dune.y - 34, dune.x + 55, dune.x + dune.w - 55, 98 + diff * 5);
      }
    });

    level.windZones.push({ x: 2490, y: 210, w: 180, h: 410, forceX: 240 + diff * 10, forceY: -340 });
    level.platforms.push(platform(3040, 420, 300, 300, 'oasis'));
    addArc(level, 2540, 360, 3160, 360, 9, 120);
    addHiddenCluster(level, 1710 + diff * 18, 250);
    powerup(level, diff % 2 === 0 ? 'magnet' : 'bounce', 2060 + diff * 32, 420);
    powerup(level, diff % 3 === 0 ? 'shield' : 'speed', 2960 + diff * 20, 360);
    level.goal = { x: 3215, y: 324, w: 76, h: 96, type: 'gate' };
    return level;
  }

  function buildAct4(levelNumber) {
    const diff = levelNumber - 31;
    const theme = THEMES.ruins;
    const level = baseLevel(levelNumber, 4, `Act 4 · Moon Puzzle ${diff + 1}`, theme, 3720 + diff * 85);
    level.start = { x: 120, y: 530 };
    level.messages.push('Ancient switches control locked moon doors.');

    level.platforms.push(platform(0, 600, 340, 120, 'ruin'));
    level.platforms.push(platform(480, 560, 240, 160, 'ruin'));
    level.platforms.push(platform(840, 500, 220, 220, 'ruin'));
    level.platforms.push(platform(1190, 420, 220, 300, 'ruin'));
    level.platforms.push(platform(1500, 590, 230, 130, 'ruin'));
    level.platforms.push(platform(1810, 470, 250, 250, 'ruin'));
    level.platforms.push(platform(2230, 390, 260, 330, 'ruin'));
    level.platforms.push(platform(2640, 560, 230, 160, 'ruin'));
    level.platforms.push(platform(3020, 450, 280, 270, 'ruin'));
    level.platforms.push(platform(3440, 360, 360, 360, 'ruin-goal'));

    addArc(level, 180, 550, 600, 520, 6, 80);
    addArc(level, 600, 520, 950, 460, 6, 88);
    addArc(level, 950, 460, 1300, 380, 6, 96);
    addArc(level, 1620, 550, 1940, 430, 6, 90);
    addArc(level, 1940, 430, 2360, 350, 7, 96);
    addArc(level, 2740, 520, 3170, 410, 7, 92);
    addArc(level, 3170, 410, 3610, 320, 8, 112);

    level.platforms.push(fallingPlatform(380, 470, 86, 18, 0.4));
    level.platforms.push(fallingPlatform(720, 410, 86, 18, 0.38));
    level.platforms.push(fallingPlatform(1090, 350, 86, 18, 0.35));
    level.platforms.push(movingPlatform(1700, 400, 110, 18, 'x', 110, 1.25 + diff * 0.05, 0.2, 'ruin-moving'));
    level.platforms.push(movingPlatform(2500, 320, 100, 18, 'y', 86, 1.32 + diff * 0.05, 0.9, 'ruin-moving'));

    addDoor(level, 'A', 1452, 438, 30, 152);
    addSwitch(level, 'A', 945, 484);
    addDoor(level, 'B', 2602, 408, 30, 152);
    addSwitch(level, 'B', 1964, 454);

    if (diff >= 4) {
      addDoor(level, 'C', 3388, 300, 30, 160);
      addSwitch(level, 'C', 2860, 544);
      level.platforms.push(platform(2820, 470, 90, 18, 'ledge'));
      level.platforms.push(platform(2928, 420, 90, 18, 'ledge'));
    }

    spikeStrip(level, 520, 538, 72);
    spikeStrip(level, 1548, 568, 78);
    spikeStrip(level, 2288, 368, 72);
    spikeStrip(level, 3100, 428, 78);
    enemy(level, 560, 526, 530, 650, 96 + diff * 4);
    enemy(level, 1870, 436, 1860, 1980, 110 + diff * 5);
    enemy(level, 3090, 416, 3070, 3240, 118 + diff * 5);
    level.windZones.push({ x: 1710, y: 250, w: 120, h: 250, forceX: 0, forceY: -420 });

    addHiddenCluster(level, 1305 + diff * 24, 220);
    powerup(level, 'shield', 1735, 350);
    powerup(level, diff % 2 === 0 ? 'bounce' : 'magnet', 3120, 390);
    level.goal = { x: 3615, y: 264, w: 82, h: 96, type: 'gate' };
    return level;
  }

  function buildAct5(levelNumber) {
    const diff = levelNumber - 41;
    const theme = THEMES.eclipse;
    const level = baseLevel(levelNumber, 5, `Act 5 · Eclipse Trial ${diff + 1}`, theme, 4140 + diff * 94);
    level.start = { x: 120, y: 530 };
    level.messages.push('Every relic matters now. Reach the final grove.');

    const structures = [
      { x: 0, y: 602, w: 320 },
      { x: 470, y: 542, w: 220 },
      { x: 820, y: 470, w: 210 },
      { x: 1170, y: 600, w: 200 },
      { x: 1500, y: 500, w: 230 },
      { x: 1860, y: 410, w: 240 },
      { x: 2250, y: 566, w: 210 },
      { x: 2580, y: 450, w: 220 },
      { x: 2910, y: 360, w: 230 },
      { x: 3270, y: 540, w: 250 },
      { x: 3650, y: 430, w: 250 },
    ];

    structures.forEach((s, i) => {
      level.platforms.push(platform(s.x, s.y, s.w, 120 + (i % 3) * 20, 'eclipse'));
      if (i > 0) {
        const p = structures[i - 1];
        addArc(level, p.x + p.w * 0.55, p.y - 28, s.x + s.w * 0.45, s.y - 28, 6 + (i % 2), 90 + (i % 3) * 10);
      }
      if (i === 1 || i === 5 || i === 8) {
        level.platforms.push(movingPlatform(s.x + 40, s.y - 112, 100, 18, i % 2 === 0 ? 'x' : 'y', 92, 1.32 + diff * 0.06, i * 0.4, 'eclipse-moving'));
      }
      if (i === 2 || i === 6) {
        level.platforms.push(fallingPlatform(s.x + 68, s.y - 100, 94, 18, 0.32));
      }
      if (i !== 0 && i !== 10) {
        spikeStrip(level, s.x + 66, s.y - 22, 56 + (i % 2) * 24);
      }
      if (i >= 2) {
        enemy(level, s.x + 90, s.y - 34, s.x + 56, s.x + s.w - 56, 112 + diff * 6);
      }
    });

    level.windZones.push({ x: 1080, y: 190, w: 160, h: 420, forceX: 140, forceY: -520 });
    level.windZones.push({ x: 2360, y: 180, w: 170, h: 420, forceX: 180, forceY: -420 });
    level.windZones.push({ x: 3400, y: 220, w: 180, h: 350, forceX: 240, forceY: -260 });

    addDoor(level, 'A', 1438, 350, 30, 150);
    addSwitch(level, 'A', 880, 454);
    addDoor(level, 'B', 3205, 390, 30, 150);
    addSwitch(level, 'B', 2620, 434);

    if (diff >= 4) {
      addDoor(level, 'C', 3950, 280, 30, 170);
      addSwitch(level, 'C', 3330, 524);
    }

    addHiddenCluster(level, 2050 + diff * 35, 225);
    powerup(level, 'magnet', 1600, 450);
    powerup(level, 'shield', 2760, 400);
    powerup(level, diff % 2 === 0 ? 'speed' : 'bounce', 3730, 380);
    level.platforms.push(platform(4020, 330, 360, 390, 'eclipse-goal'));
    level.goal = { x: 4225, y: 236, w: 84, h: 94, type: 'gate' };
    return level;
  }

  function buildFinalLevel() {
    const level = baseLevel(50, 5, 'Act 5 · The Original Olive Tree', THEMES.rebirth, 4700);
    level.start = { x: 120, y: 520 };
    level.messages.push('Return to the tree and heal the world.');

    level.platforms.push(platform(0, 606, 320, 114, 'rebirth'));
    level.platforms.push(platform(500, 558, 240, 162, 'rebirth'));
    level.platforms.push(platform(870, 472, 210, 248, 'rebirth'));
    level.platforms.push(platform(1220, 596, 220, 124, 'rebirth'));
    level.platforms.push(platform(1540, 470, 250, 250, 'rebirth'));
    level.platforms.push(platform(1930, 390, 250, 330, 'rebirth'));
    level.platforms.push(platform(2320, 550, 240, 170, 'rebirth'));
    level.platforms.push(platform(2660, 440, 230, 280, 'rebirth'));
    level.platforms.push(platform(3000, 350, 250, 370, 'rebirth'));
    level.platforms.push(platform(3380, 510, 260, 210, 'rebirth'));
    level.platforms.push(platform(3750, 380, 260, 340, 'rebirth'));
    level.platforms.push(platform(4140, 300, 440, 420, 'tree-island'));

    addArc(level, 160, 548, 610, 510, 7, 88);
    addArc(level, 610, 510, 950, 430, 7, 98);
    addArc(level, 950, 430, 1660, 430, 9, 124);
    addArc(level, 1660, 430, 2050, 340, 7, 110);
    addArc(level, 2050, 340, 2750, 388, 10, 136);
    addArc(level, 2750, 388, 3120, 300, 7, 114);
    addArc(level, 3120, 300, 3900, 330, 10, 144);
    addArc(level, 3900, 330, 4360, 230, 8, 120);

    level.platforms.push(movingPlatform(720, 420, 100, 18, 'y', 80, 1.4, 0.2, 'rebirth-moving'));
    level.platforms.push(fallingPlatform(1450, 358, 96, 18, 0.35));
    level.platforms.push(movingPlatform(2480, 330, 100, 18, 'x', 110, 1.45, 0.5, 'rebirth-moving'));
    level.platforms.push(fallingPlatform(3310, 310, 96, 18, 0.3));
    level.platforms.push(movingPlatform(3970, 250, 110, 18, 'y', 70, 1.5, 0.8, 'rebirth-moving'));

    spikeStrip(level, 548, 536, 80);
    spikeStrip(level, 1248, 574, 74);
    spikeStrip(level, 2346, 528, 72);
    spikeStrip(level, 3410, 488, 82);
    enemy(level, 565, 524, 535, 665, 118);
    enemy(level, 1605, 436, 1580, 1730, 126);
    enemy(level, 2700, 406, 2680, 2830, 136);
    enemy(level, 3785, 346, 3770, 3940, 145);

    addDoor(level, 'A', 1820, 240, 34, 150);
    addSwitch(level, 'A', 982, 456);
    addDoor(level, 'B', 4100, 230, 34, 150);
    addSwitch(level, 'B', 3420, 504);

    level.windZones.push({ x: 1080, y: 180, w: 180, h: 420, forceX: 180, forceY: -520 });
    level.windZones.push({ x: 2870, y: 140, w: 180, h: 420, forceX: 220, forceY: -300 });

    powerup(level, 'magnet', 2060, 336);
    powerup(level, 'shield', 3110, 296);
    powerup(level, 'bounce', 3890, 330);
    addHiddenCluster(level, 4380, 145);

    level.goal = { x: 4315, y: 110, w: 160, h: 190, type: 'tree' };
    level.finale = true;
    return level;
  }

  const levels = [];
  for (let i = 1; i <= 10; i += 1) levels.push(buildAct1(i));
  for (let i = 11; i <= 20; i += 1) levels.push(buildAct2(i));
  for (let i = 21; i <= 30; i += 1) levels.push(buildAct3(i));
  for (let i = 31; i <= 40; i += 1) levels.push(buildAct4(i));
  for (let i = 41; i <= 49; i += 1) levels.push(buildAct5(i));
  levels.push(buildFinalLevel());

  window.KORA_LEVELS = levels;
})();

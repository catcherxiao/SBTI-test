import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = process.cwd();
const indexHtmlPath = path.join(repoRoot, 'index.html');
const libraryDir = path.join(repoRoot, 'library');

const siteUrl = 'https://sbti.cyou';
const siteName = 'SBTI 性格测试';
const source = fs.readFileSync(indexHtmlPath, 'utf8');

function extractBetween(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start === -1 || end === -1) {
    throw new Error(`Unable to extract block between "${startMarker}" and "${endMarker}"`);
  }
  return source.slice(start + startMarker.length, end).trim();
}

function evaluateExpression(expressionSource) {
  return vm.runInNewContext(expressionSource);
}

const TYPE_LIBRARY = evaluateExpression(`({${extractBetween('const TYPE_LIBRARY = {', '};\n    const TYPE_IMAGES')}})`);
const TYPE_IMAGES = evaluateExpression(`({${extractBetween('const TYPE_IMAGES = {', '};\n\n    const NORMAL_TYPES')}})`);
const NORMAL_TYPES = evaluateExpression(`([${extractBetween('const NORMAL_TYPES = [', '];\n    const DIM_EXPLANATIONS')}])`);
const dimensionMeta = evaluateExpression(`({${extractBetween('const dimensionMeta = {', '};\n    const questions')}})`);
const MODEL_GROUPS = evaluateExpression(`([${extractBetween('const MODEL_GROUPS = [', '];\n    const TYPE_PATTERN_TEXT')}])`);

const NORMAL_SET = new Set(NORMAL_TYPES.map((type) => type.code));
const TYPE_PATTERN_TEXT = Object.fromEntries(NORMAL_TYPES.map((type) => [type.code, type.pattern]));
const LIBRARY_TYPE_CODES = [
  ...NORMAL_TYPES.map((type) => type.code),
  ...Object.keys(TYPE_LIBRARY).filter((code) => !NORMAL_SET.has(code))
];

const LEVEL_NUMBER = { L: 1, M: 2, H: 3 };
const LEVEL_TEXT = { L: '偏低', M: '中段', H: '偏高' };
const SPECIAL_RELATED = {
  DRUNK: ['GOGO', 'FUCK', 'SHIT', 'WOC!'],
  HHHH: ['GOGO', 'MALO', 'IMSB', 'JOKE-R']
};

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function titleForType(type) {
  return `${type.code}（${type.cn}）人格详情 - ${siteName}`;
}

function descriptionForType(type) {
  return `查看 ${type.code}（${type.cn}）的人格设定、典型表现、图鉴介绍和相近类型。`;
}

function encodeTypePath(code) {
  return encodeURIComponent(code).replaceAll('!', '%21');
}

function normalizeAssetPath(assetPath = '') {
  if (!assetPath) return '';
  if (assetPath.startsWith('/')) return assetPath;
  return `/${assetPath.replace(/^\.\//, '')}`;
}

function getWebpAssetPath(assetPath = '') {
  return normalizeAssetPath(assetPath).replace(/\.(png|jpe?g)$/i, '.webp');
}

function buildPictureMarkup(assetPath, altText, options = {}) {
  const { loading = 'lazy', eager = false } = options;
  const originalPath = normalizeAssetPath(assetPath);
  const webpPath = getWebpAssetPath(assetPath);
  const fetchpriority = eager ? ' fetchpriority="high"' : '';

  return `<picture>
        <source srcset="${webpPath}" type="image/webp" />
        <img src="${originalPath}" alt="${escapeHtml(altText)}" loading="${loading}"${fetchpriority} />
      </picture>`;
}

function buildSummary(type, isNormal) {
  return `${type.code}（${type.cn}）是 ${siteName}里的${isNormal ? '标准人格' : '特殊人格'}之一。这个页面整理了它的一句话印象、完整设定、${isNormal ? '维度画像' : '触发逻辑'}与相近类型，方便你在不重做测试的情况下直接了解这个人格的整体气质与典型表现。`;
}

function getPatternGroups(pattern) {
  return pattern.split('-').map((group) => group.split(''));
}

function getRelatedCodes(code) {
  if (!NORMAL_SET.has(code)) {
    return (SPECIAL_RELATED[code] || []).filter((item) => TYPE_LIBRARY[item]);
  }

  const targetPattern = TYPE_PATTERN_TEXT[code];
  const targetVector = targetPattern.replaceAll('-', '').split('').map((level) => LEVEL_NUMBER[level]);

  return NORMAL_TYPES
    .filter((candidate) => candidate.code !== code)
    .map((candidate) => {
      const candidateVector = candidate.pattern.replaceAll('-', '').split('').map((level) => LEVEL_NUMBER[level]);
      const distance = candidateVector.reduce((total, value, index) => total + Math.abs(value - targetVector[index]), 0);
      return { code: candidate.code, distance };
    })
    .sort((a, b) => a.distance - b.distance || a.code.localeCompare(b.code, 'en'))
    .slice(0, 4)
    .map((item) => item.code);
}

function buildClueSection(type) {
  if (!NORMAL_SET.has(type.code)) {
    if (type.code === 'DRUNK') {
      return {
        paragraph: 'DRUNK 不靠标准维度画像直接命中，而是由饮酒补充题触发。也就是说，它更像一个隐藏分支：先出现饮酒入口题，再根据后续补充题的选择，直接切到这个人格。',
        bullets: [
          '先看常规 30 题，再插入 1 道饮酒入口题。',
          '当入口题命中“饮酒”选项时，会继续出现额外补充题。',
          '触发后结果直接归为 DRUNK，同时系统仍会保留一个最接近的常规人格作为参考。'
        ]
      };
    }

    return {
      paragraph: 'HHHH 是一个兜底型特殊人格。它不会因为某一个单独题目直接命中，而是在整套 15 维画像都没有明显靠近任何标准人格时，作为“常规人格库没有完全接住你”的结果出现。',
      bullets: [
        '常规人格的整体匹配度偏低时，系统才会启用 HHHH。',
        '它更像一类“暂时找不到标准模板”的结果，而不是常规画像中的稳定类型。',
        '这种情况下，查看十五维条形图和最接近人格列表，通常更能帮助理解结果。'
      ]
    };
  }

  const pattern = TYPE_PATTERN_TEXT[type.code];
  const groupedPattern = getPatternGroups(pattern);
  const focusGroups = MODEL_GROUPS
    .map((group, index) => {
      const levels = groupedPattern[index];
      const emphasis = levels.reduce((total, level) => total + Math.abs(LEVEL_NUMBER[level] - LEVEL_NUMBER.M), 0);
      return { group, levels, emphasis };
    })
    .sort((a, b) => b.emphasis - a.emphasis || a.group.key.localeCompare(b.group.key, 'en'));

  const topGroups = focusGroups.slice(0, 2).map((item) => item.group.name);
  return {
    paragraph: `${type.code} 的标准维度画像是 ${pattern}。从 15 维分布看，${topGroups.join('、')} 这几组题通常更容易把它和其他人格区分开，也更适合拿来观察你是否稳定靠近这个类型。`,
    bullets: focusGroups.slice(0, 3).map((item) => {
      const detail = item.group.dims.map((dim, index) => `${dimensionMeta[dim].name}${LEVEL_TEXT[item.levels[index]]}`).join(' / ');
      return `${item.group.name}：${detail}`;
    })
  };
}

function buildRelatedCards(code) {
  return getRelatedCodes(code).map((relatedCode) => {
    const related = TYPE_LIBRARY[relatedCode];
    return `
      <a class="type-card" href="/library/${encodeTypePath(related.code)}/">
        <div class="kicker">相关人格</div>
        <strong>${escapeHtml(related.code)}（${escapeHtml(related.cn)}）</strong>
        <p>${escapeHtml(related.intro)}</p>
      </a>
    `;
  }).join('');
}

function buildHead({ title, description, canonicalPath, imagePath, jsonLd }) {
  const canonicalUrl = `${siteUrl}${canonicalPath}`;
  const imageUrl = imagePath ? `${siteUrl}${normalizeAssetPath(imagePath)}` : `${siteUrl}/icons/icon-512.png`;
  return `  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="robots" content="index,follow" />
  <meta name="theme-color" content="#4d6a53" />
  <link rel="canonical" href="${canonicalUrl}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${siteName}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:image" content="${imageUrl}" />
  <link rel="stylesheet" href="/library/page.css" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <script src="/library/page.js" defer></script>
  <title>${escapeHtml(title)}</title>`;
}

function buildLayout({ breadcrumb, hero, body, note }) {
  return `<div class="page-shell">
    ${breadcrumb}
    ${hero}
    ${body}
    <p class="site-note">${note}</p>
  </div>`;
}

function buildDetailPage(code) {
  const type = TYPE_LIBRARY[code];
  const isNormal = NORMAL_SET.has(code);
  const summary = buildSummary(type, isNormal);
  const clue = buildClueSection(type);
  const patternText = TYPE_PATTERN_TEXT[code];
  const imagePath = TYPE_IMAGES[code];
  const title = titleForType(type);
  const description = descriptionForType(type);
  const canonicalPath = `/library/${encodeTypePath(code)}/`;
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: '人格图鉴', item: `${siteUrl}/library/` },
        { '@type': 'ListItem', position: 3, name: `${type.code}（${type.cn}）`, item: `${siteUrl}${canonicalPath}` }
      ]
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      description,
      url: `${siteUrl}${canonicalPath}`,
      primaryImageOfPage: imagePath ? `${siteUrl}${normalizeAssetPath(imagePath)}` : undefined
    }
  ];

  const breadcrumb = `<nav class="breadcrumb" aria-label="面包屑">
    <a href="/">首页</a>
    <span aria-hidden="true">></span>
    <a href="/library/">人格图鉴</a>
    <span aria-hidden="true">></span>
    <span>${escapeHtml(type.code)}（${escapeHtml(type.cn)}）</span>
  </nav>`;

  const hero = `<header class="page-card hero-card">
    <div class="hero-grid">
      <div class="hero-copy">
        <div class="eyebrow">${isNormal ? 'Standard Type' : 'Special Type'}</div>
        <h1>${escapeHtml(type.code)}（${escapeHtml(type.cn)}）</h1>
        <p>${escapeHtml(summary)}</p>
        <div class="hero-actions">
          <a class="btn-primary" href="/test/">开始测试</a>
          <a href="/library/">返回人格图鉴</a>
          <a href="/">回到首页</a>
          <a href="/?screen=result" data-latest-result-link hidden>我的最新测试结果</a>
        </div>
        <div class="hero-meta">
          <span class="meta-chip">一句话印象：${escapeHtml(type.intro)}</span>
          <span class="meta-chip">${isNormal ? `维度画像：${escapeHtml(patternText)}` : `命中方式：${type.code === 'DRUNK' ? '饮酒补充题触发' : '常规人格库兜底'}`}</span>
        </div>
      </div>
      <div class="hero-media">
        ${buildPictureMarkup(imagePath, `${type.code}（${type.cn}）人格图鉴插图`, { loading: 'eager', eager: true })}
      </div>
    </div>
  </header>`;

  const body = `<div class="section-grid">
    <div class="stack">
      <section class="page-card section-card">
        <h2>人格简介</h2>
        <p>${escapeHtml(summary)}</p>
        <p>${escapeHtml(type.intro)} 这个一句话印象，通常最能快速对应到 ${type.code}（${type.cn}）给人的第一观感。</p>
      </section>
      <section class="page-card section-card">
        <h2>完整设定</h2>
        <p>${escapeHtml(type.desc)}</p>
      </section>
      <section class="page-card section-card">
        <h2>适合从哪类题看出来</h2>
        <p>${escapeHtml(clue.paragraph)}</p>
        <ul>
          ${clue.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </section>
      <section class="page-card section-card">
        <h2>相近人格</h2>
        <p>如果你对这个类型感兴趣，也可以继续看看下面这些站内相关人格页，方便横向对照设定和描述风格。</p>
        <div class="related-grid">
          ${buildRelatedCards(code)}
        </div>
      </section>
    </div>
    <aside class="stack">
      <section class="page-card section-card aside-card">
        <h2>页内导航</h2>
        <div class="meta-row">
          <strong>站内入口</strong>
          <a href="/">首页</a>
          <a href="/library/">人格图鉴总页</a>
          <a href="/test/">直接开始测试</a>
          <a href="/?screen=result" data-latest-result-link hidden>回到我的测试结果</a>
        </div>
      </section>
      <section class="page-card section-card aside-card">
        <h2>页面信息</h2>
        <div class="meta-row">
          <strong>人格分类</strong>
          <span>${isNormal ? '标准人格' : '特殊人格'}</span>
        </div>
        <div class="meta-row">
          <strong>图鉴图片</strong>
          <span>图片会在首屏完整展示，方便直接浏览和查看细节。</span>
        </div>
        <div class="meta-row">
          <strong>原始创意</strong>
          <span>原作者：B站@蛆肉儿串儿；网页版本感谢 UnluckyNinja/SBTI-test 提供项目基础。</span>
        </div>
      </section>
    </aside>
  </div>`;

  const note = `本页整理了 ${escapeHtml(type.code)}（${escapeHtml(type.cn)}）的图鉴信息、相近人格和站内入口，方便直接浏览，也方便单独分享给朋友。`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
${buildHead({ title, description, canonicalPath, imagePath, jsonLd })}
</head>
<body>
${buildLayout({ breadcrumb, hero, body, note })}
</body>
</html>
`;
}

function buildLibraryIndex() {
  const title = `人格图鉴总页 - ${siteName}`;
  const description = '查看 27 种 SBTI 荒诞人格的总览卡片，并进入每个人格的独立详情页。';
  const canonicalPath = '/library/';
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: '人格图鉴', item: `${siteUrl}/library/` }
      ]
    },
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      description,
      url: `${siteUrl}${canonicalPath}`
    }
  ];

  const breadcrumb = `<nav class="breadcrumb" aria-label="面包屑">
    <a href="/">首页</a>
    <span aria-hidden="true">></span>
    <span>人格图鉴</span>
  </nav>`;

  const hero = `<header class="page-card hero-card">
    <div class="hero-grid">
      <div class="hero-copy">
        <div class="eyebrow">Personality Index</div>
        <h1>人格图鉴 / 类型百科</h1>
        <p>这是 SBTI 性格测试的图鉴总页。你可以在这里直接浏览全部 27 种人格，并进入每个人格的独立详情页查看设定、图片、相近类型与站内链接。</p>
        <div class="hero-actions">
          <a class="btn-primary" href="/test/">开始测试</a>
          <a href="/">回到首页</a>
          <a href="/?screen=result" data-latest-result-link hidden>我的最新测试结果</a>
        </div>
        <div class="hero-meta">
          <span class="meta-chip">已收录人格：${LIBRARY_TYPE_CODES.length} 种</span>
          <span class="meta-chip">点击卡片可查看对应人格详情</span>
        </div>
      </div>
      <div class="hero-media">
        ${buildPictureMarkup('/image/CTRL.png', 'SBTI 人格图鉴封面示意图', { loading: 'eager', eager: true })}
      </div>
    </div>
  </header>`;

  const cards = LIBRARY_TYPE_CODES.map((code) => {
    const type = TYPE_LIBRARY[code];
    const isNormal = NORMAL_SET.has(code);
    return `
      <a class="type-card" href="/library/${encodeTypePath(code)}/">
        <div class="type-card-thumb">
          ${buildPictureMarkup(TYPE_IMAGES[code], `${type.code}（${type.cn}）人格图鉴插图`)}
        </div>
        <div class="kicker">${isNormal ? '标准人格' : '特殊人格'}</div>
        <strong>${escapeHtml(type.code)}（${escapeHtml(type.cn)}）</strong>
        <p>${escapeHtml(type.intro)}</p>
      </a>
    `;
  }).join('');

  const body = `<div class="stack">
    <section class="page-card section-card">
      <h2>全部人格</h2>
      <p>下面这些卡片都会跳到各自的人格详情页。你可以直接浏览设定、图片和相近类型，也更方便把某个具体人格单独分享给朋友看。</p>
      <div class="library-grid">
        ${cards}
      </div>
    </section>
    <section class="page-card section-card">
      <h2>如何使用这个图鉴</h2>
      <ul>
        <li>如果你已经做过测试，可以先点“我的最新测试结果”回到结果页。</li>
        <li>如果只是想先逛设定，直接点任意人格卡片就能查看独立详情。</li>
        <li>每个人格页都补了面包屑、相近人格和回到图鉴总页的站内链接，方便连续浏览。</li>
      </ul>
    </section>
  </div>`;

  const note = '图鉴总页保留了当前站点的视觉语言，只额外补充了更完整的首屏介绍、站内跳转和人格详情入口。';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
${buildHead({ title, description, canonicalPath, imagePath: '/image/CTRL.png', jsonLd })}
</head>
<body>
${buildLayout({ breadcrumb, hero, body, note })}
</body>
</html>
`;
}

ensureDir(libraryDir);
fs.writeFileSync(path.join(libraryDir, 'index.html'), buildLibraryIndex());

for (const code of LIBRARY_TYPE_CODES) {
  const detailDir = path.join(libraryDir, code);
  ensureDir(detailDir);
  fs.writeFileSync(path.join(detailDir, 'index.html'), buildDetailPage(code));
}

console.log(`Generated ${LIBRARY_TYPE_CODES.length + 1} static library pages.`);

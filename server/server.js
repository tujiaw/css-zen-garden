const express = require('express');
const path = require('path');
const fs = require('fs');
const { designList } = require('./data/masterlist');
const { zenUrls } = require('./data/urls');
const { en } = require('./data/en');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const numDesigns = 8; // number of designs to show in nav
const currentDesignDefault = '214';

// Set up EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files - serve from parent directory
app.use(express.static(path.join(__dirname, '..')));

// Helper functions
function hsc(str) {
  return String(str).replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getTypekitId(cssUrl) {
  if (/^http/.test(cssUrl)) {
    return null; // Skip external URLs for now
  }

  const cssPath = path.join(__dirname, '..', cssUrl);
  if (fs.existsSync(cssPath)) {
    const css = fs.readFileSync(cssPath, 'utf8');
    const match = css.match(/\/\*\s*TYPEKIT_KIT_ID:\s*([0-9a-z]+)\s*\*\//i);
    return match ? match[1] : null;
  }
  return null;
}

function getDesignList(start, count, list) {
  let result = '';
  for (let i = start - 1; i >= (start - count) && i >= 0; i--) {
    const [id, name, designer, designerUrl] = list[i];
    result += `
      <li>
        <a href="/${id}/">${hsc(name)}</a>
        <span class="designer-name">${hsc(designer)}</span>
      </li>`;
  }
  return result;
}

// Helper to load language data
function loadLanguage(lang = 'en') {
  // For now, only English is supported
  return en;
}

// Main route handler
app.get(['/', '/:design/', '/:design', '/tr/:lang/:design/', '/tr/:lang/:design', '/tr/:lang/:design/page:page/', '/tr/:lang/:design/page:page', '/:design/page:page/', '/:design/page:page', '/tr/:lang/', '/tr/:lang', '/tr/:lang/page:page/', '/tr/:lang/page:page'], (req, res) => {
  const { design, lang, page } = req.params;
  const queryCss = req.query.css;

  // Determine current design
  let currentDesign = design || queryCss || currentDesignDefault;

  // Determine language
  const currentLang = lang || 'en';
  const langData = loadLanguage(currentLang);

  // Determine page
  const thisPage = page ? parseInt(page) : false;

  // Determine CSS path
  let currentStyleSheet;
  if (/^\d+$/.test(currentDesign)) {
    currentStyleSheet = `/${currentDesign}/${currentDesign}.css`;
  } else {
    currentStyleSheet = currentDesign;
  }

  // Get TypeKit ID
  const typekitId = getTypekitId(currentStyleSheet);

  // Calculate list start position
  let listStart;
  if (thisPage) {
    listStart = Math.max(0, designList.length - (thisPage * numDesigns));
  } else {
    listStart = designList.length;
  }

  // Build language URL
  const langURL = lang ? `/tr/${lang}` : '';

  // Generate design list
  const designListHtml = getDesignList(listStart, numDesigns, designList);

  // Navigation links
  let navHtml = '';
  if (listStart > numDesigns) {
    const nextPage = (thisPage || 0) + 1;
    navHtml += `
      <li class="next">
        <a href="${langURL}/${currentDesign}/page${nextPage}/">
          ${langData.sidebar['design-archives-next']} <span class="indicator">&rsaquo;</span>
        </a>
      </li>`;
  }

  if (thisPage > 0) {
    const prev = thisPage - 1;
    const prevPage = prev > 0 ? `page${prev}/` : '';
    navHtml += `
      <li class="previous">
        <a href="${langURL}/${currentDesign}/${prevPage}">
          <span class="indicator">&lsaquo;</span> ${langData.sidebar['design-archives-previous']}
        </a>
      </li>`;
  }

  navHtml += `
    <li class="viewall">
      <a href="${zenUrls['zen-view-all']}" title="${langData.sidebar['design-archives-viewall-title']}">
        ${langData.sidebar['design-archives-viewall-text']}
      </a>
    </li>`;

  // Render the page
  res.render('index', {
    lang: langData.lang,
    head: langData.head,
    intro: langData.intro,
    main: langData.main,
    footer: langData.footer,
    sidebar: langData.sidebar,
    foot: langData.foot,
    zenUrls,
    currentStyleSheet,
    typekitId,
    designListHtml,
    navHtml,
    hsc,
  });
});

// Handle alldesigns page with pagination
app.get(['/pages/alldesigns', '/pages/alldesigns/', '/pages/alldesigns.html'], (req, res) => {
  const page = parseInt(req.query.pg) || 1;
  const perPage = 12;
  const startIndex = (page - 1) * perPage;
  const endIndex = Math.min(startIndex + perPage, designList.length);
  const totalPages = Math.ceil(designList.length / perPage);

  // Get designs for current page (in reverse order - newest first)
  const pageDesigns = [];
  for (let i = designList.length - 1 - startIndex; i >= designList.length - endIndex && i >= 0; i--) {
    pageDesigns.push(designList[i]);
  }

  // Generate pagination links
  let paginationHtml = '';
  for (let i = 1; i <= totalPages; i++) {
    const isActive = i === page ? ' class="current"' : '';
    paginationHtml += `
		<li>
			<a href="/pages/alldesigns/?pg=${i}"${isActive}>
				${i}		</a>
		</li>`;
  }

  // Generate design list HTML
  let designListHtml = '';
  pageDesigns.forEach(([id, name, designer, designerUrl]) => {
    const safeDesignerUrl = designerUrl === '#' ? '#' : designerUrl;
    const safeDesignerName = hsc(designer);
    const safeName = hsc(name);
    const creditsFirst = Math.random() > 0.5;

    if (creditsFirst) {
      designListHtml += `
				<li>
					<div class="design-credits">
						<h3>${safeName}</h3>
						by <a href="${safeDesignerUrl}">${safeDesignerName}</a>
					</div>
					<a href="/${id}/" class="design-preview">
						<img src="/content/previews/${id}.png" alt="Design preview">
					</a>
				</li>`;
    } else {
      designListHtml += `
				<li>
					<a href="/${id}/" class="design-preview">
						<img src="/content/previews/${id}.png" alt="Design preview">
					</a>
					<div class="design-credits">
						<h3>${safeName}</h3>
						by <a href="${safeDesignerUrl}">${safeDesignerName}</a>
					</div>
				</li>`;
    }
  });

  // Read the static HTML file and replace the dynamic content
  const fs = require('fs');
  const htmlPath = path.join(__dirname, '..', 'pages', 'alldesigns.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  // Replace the design list
  html = html.replace(/<ul class="design-list" role="navigation">[\s\S]*?<\/ul>/, `<ul class="design-list" role="navigation">${designListHtml}
			</ul>`);

  // Replace pagination
  html = html.replace(/<ul class="design-nav" role="navigation">[\s\S]*?<\/ul>/, `<ul class="design-nav" role="navigation">${paginationHtml}
</ul>`);

  res.send(html);
});

// Handle legacy routes and static pages
app.get('/pages/*', (req, res) => {
  // Remove trailing slash for file lookup
  const requestPath = req.path.replace(/\/$/, '');
  const pageName = requestPath.split('/').pop();

  // Try .html first, then .php
  const htmlPath = path.join(__dirname, '..', requestPath + '.html');
  const phpPath = path.join(__dirname, '..', requestPath + '.php');

  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else if (fs.existsSync(phpPath)) {
    // For PHP-only pages, provide a simple message
    const phpPages = {
      'about': {
        title: 'CSS Zen Garden: About',
        content: '<h2>About the CSS Zen Garden</h2><p>The CSS Zen Garden is a project to showcase web design using CSS.</p><p>Created by Dave Shea, it demonstrates what can be accomplished through CSS-based design.</p>'
      },
      'resources': {
        title: 'CSS Zen Garden: Resources',
        content: '<h2>CSS Resources</h2><p>Here are some helpful CSS resources:</p><ul><li><a href="https://developer.mozilla.org/en-US/docs/Web/CSS">MDN CSS Documentation</a></li><li><a href="https://css-tricks.com/">CSS-Tricks</a></li><li><a href="https://www.w3.org/Style/CSS/">W3C CSS</a></li></ul>'
      },
      'submit': {
        title: 'CSS Zen Garden: Submit a Design',
        content: '<h2>Submit a Design</h2><p>We welcome new submissions to the CSS Zen Garden!</p><p>Please read the <a href="/pages/faq/">FAQ</a> for submission guidelines.</p><p>Submit your design via GitHub: <a href="https://github.com/mezzoblue/csszengarden.com">github.com/mezzoblue/csszengarden.com</a></p>'
      },
      'translations': {
        title: 'CSS Zen Garden: Translations',
        content: '<h2>Translations</h2><p>The CSS Zen Garden has been translated into multiple languages.</p><p>Currently available translations are being migrated to this new Node.js version.</p>'
      }
    };

    if (phpPages[pageName]) {
      res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${phpPages[pageName].title}</title>
  <link rel="stylesheet" media="screen" href="/content/content.css">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  <div class="page-wrapper">
    <header role="banner" class="page-banner">
      <h1>CSS Zen Garden</h1>
      <a href="/" class="return"><span>Return to CSS Zen Garden</span></a>
    </header>
    <div class="page-body">
      <div class="page-main" role="main">
        ${phpPages[pageName].content}
      </div>
    </div>
  </div>
</body>
</html>`);
    } else {
      res.status(404).send('Page not found');
    }
  } else {
    res.status(404).send('Page not found');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`CSS Zen Garden running at http://localhost:${PORT}/`);
  console.log(`Current design: http://localhost:${PORT}/214/`);
});

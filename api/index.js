// Vercel serverless function
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// Import data
const { designList } = require('../server/data/masterlist');
const { zenUrls } = require('../server/data/urls');
const { en } = require('../server/data/en');

const PORT = process.env.PORT || 3000;
const numDesigns = 8;
const currentDesignDefault = '214';

// Set up EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'server', 'views'));

// Static files - serve from root directory
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
    return null;
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

function loadLanguage(lang = 'en') {
  return en;
}

// Main route handler
app.get(['/', '/:design/', '/:design', '/tr/:lang/:design/', '/tr/:lang/:design', '/tr/:lang/:design/page:page/', '/tr/:lang/:design/page:page', '/:design/page:page/', '/:design/page:page', '/tr/:lang/', '/tr/:lang', '/tr/:lang/page:page/', '/tr/:lang/page:page'], (req, res) => {
  const { design, lang, page } = req.params;
  const queryCss = req.query.css;

  let currentDesign = design || queryCss || currentDesignDefault;
  const currentLang = lang || 'en';
  const langData = loadLanguage(currentLang);
  const thisPage = page ? parseInt(page) : false;

  let currentStyleSheet;
  if (/^\d+$/.test(currentDesign)) {
    currentStyleSheet = `/${currentDesign}/${currentDesign}.css`;
  } else {
    currentStyleSheet = currentDesign;
  }

  const typekitId = getTypekitId(currentStyleSheet);

  let listStart;
  if (thisPage) {
    listStart = Math.max(0, designList.length - (thisPage * numDesigns));
  } else {
    listStart = designList.length;
  }

  const langURL = lang ? `/tr/${lang}` : '';
  const designListHtml = getDesignList(listStart, numDesigns, designList);

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

  const pageDesigns = [];
  for (let i = designList.length - 1 - startIndex; i >= designList.length - endIndex && i >= 0; i--) {
    pageDesigns.push(designList[i]);
  }

  let paginationHtml = '';
  for (let i = 1; i <= totalPages; i++) {
    const isActive = i === page ? ' class="current"' : '';
    paginationHtml += `
		<li>
			<a href="/pages/alldesigns/?pg=${i}"${isActive}>
				${i}		</a>
		</li>`;
  }

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

  const htmlPath = path.join(__dirname, '..', 'pages', 'alldesigns.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  html = html.replace(/<ul class="design-list" role="navigation">[\s\S]*?<\/ul>/, `<ul class="design-list" role="navigation">${designListHtml}
			</ul>`);

  html = html.replace(/<ul class="design-nav" role="navigation">[\s\S]*?<\/ul>/, `<ul class="design-nav" role="navigation">${paginationHtml}
</ul>`);

  res.send(html);
});

// Handle legacy routes and static pages
app.get('/pages/*', (req, res) => {
  const requestPath = req.path.replace(/\/$/, '');
  const pageName = requestPath.split('/').pop();

  const htmlPath = path.join(__dirname, '..', requestPath + '.html');
  const phpPath = path.join(__dirname, '..', requestPath + '.php');

  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    res.status(404).send('Page not found');
  }
});

// Export for Vercel
module.exports = app;

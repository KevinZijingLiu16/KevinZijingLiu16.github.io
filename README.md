# Kevin Liu portfolio

Static portfolio site for GitHub Pages. No build step: plain HTML, CSS and JavaScript.

- `index.html` home page with selected work, jams, demos, live GitHub repositories and contact
- `about.html` bio, CV, thesis, reference letter, character art
- `projects/` case studies for Remains, Paper Blast and Mannequin Escape
- `assets/css/site.css`, `assets/js/site.js` shared styles and scripts
- `assets/img/`, `assets/docs/` images (WebP) and PDFs

## Publish

1. Create a public repository named `KevinZijingLiu16.github.io`.
2. Upload or push these files to the `main` branch.
3. In the repository, open Settings > Pages and set Source to "Deploy from a branch", branch `main`, folder `/ (root)`.
4. The site goes live at https://kevinzijingliu16.github.io/ within a minute or two.

## Edit

- Add a project: copy an `<article class="card">` block in `index.html` and change the text, image and links.
- Add a case study: copy `projects/paper-blast.html`, rename it, and link to it from a card.
- Images: put WebP or JPG files in `assets/img/` and keep them under about 300 KB.

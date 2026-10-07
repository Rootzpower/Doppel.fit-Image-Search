// ==UserScript==
// @name        Doppel.fit Image Search
// @namespace   Violentmonkey Scripts
// @icon        https://github.com/Rootzpower/Doppel.fit-Image-Search/raw/main/icon.png
// @version     3.0.2
//
// @include     *://www.google.*/search*
// @include     *://www.google.*/imghp*
// @grant       GM_xmlhttpRequest
// @grant       GM_openInTab
// @connect     doppel.fit
// @connect     *
//
// @author      Rootzpower
// @description Reverse image search on Doppel.fit: hover button over Google Images results and Alt + Right Click
// @downloadURL https://raw.githubusercontent.com/Rootzpower/Doppel.fit-Image-Search/main/Doppel.fit_Image-Search.js
// @updateURL   https://raw.githubusercontent.com/Rootzpower/Doppel.fit-Image-Search/main/Doppel.fit_Image-Search.js
// ==/UserScript==

(function () {
    'use strict';

    // ---------- Configuration ----------
    const API_URL      = 'https://doppel.fit/api/v1/products/search/image/upload';
    const RESULT_URL   = 'https://doppel.fit/s/image?hash=';
    const MIN_SIZE     = 60;      // minimum px (width and height) to show the button
    const MAX_SIDE     = 1024;    // max side of the uploaded image (resized via canvas)
    const JPEG_QUALITY = 0.9;
    const TIMEOUT_MS   = 30000;
    const HIDE_DELAY   = 250;     // ms before hiding the button after leaving the image
    const LABEL        = '🔍 Doppel.fit';

    // ---------- Styles and button ----------
    const style = document.createElement('style');
    style.textContent = `
        .doppel-search-btn {
            position: fixed;
            z-index: 2147483647;
            background: #6366f1;
            color: #fff;
            font: 600 11px system-ui, -apple-system, sans-serif;
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(0,0,0,.35);
            display: none;
            user-select: none;
            white-space: nowrap;
            transition: background .2s;
        }
        .doppel-search-btn:hover { background: #4f46e5; }
        .doppel-search-btn.busy  { background: #6b7280; cursor: progress; }
        .doppel-search-btn.error { background: #dc2626; }
    `;
    document.head.appendChild(style);

    const btn = document.createElement('div');
    btn.className = 'doppel-search-btn';
    btn.textContent = LABEL;
    document.body.appendChild(btn);

    let currentSrc = null;
    let hideTimer = null;
    let busy = false;

    // ---------- Image detection ----------
    function getSrc(img) {
        return img.currentSrc || img.src ||
               img.getAttribute('data-src') || img.getAttribute('data-iurl') || null;
    }

    function isUsableSrc(src) {
        if (!src) return false;
        if (src.startsWith('data:image/svg')) return false;
        if (src.startsWith('data:image/gif')) return false;   // lazy-load placeholders
        if (src.startsWith('data:') && src.length < 1000) return false;
        return true;
    }

    // Returns the first usable <img> under the cursor (even with overlays on top)
    function findImageAt(x, y) {
        const els = document.elementsFromPoint(x, y);
        for (const el of els) {
            if (el === btn) return 'btn';
            if (el.tagName !== 'IMG') continue;
            const rect = el.getBoundingClientRect();
            if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) continue;
            const src = getSrc(el);
            if (!isUsableSrc(src)) continue;
            return { img: el, src, rect };
        }
        return null;
    }

    function resetButton() {
        busy = false;
        btn.className = 'doppel-search-btn';
        btn.textContent = LABEL;
    }

    function positionButton(rect) {
        // Top-right corner of the image, clamped to the viewport
        const left = Math.min(Math.max(rect.right - 100, 4), window.innerWidth - 110);
        const top  = Math.max(rect.top + 6, 4);
        btn.style.left = left + 'px';
        btn.style.top = top + 'px';
        btn.style.display = 'block';
    }

    function showButton(found) {
        clearTimeout(hideTimer);
        if (busy) return;
        currentSrc = found.src;
        positionButton(found.rect);
    }

    function scheduleHide() {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            if (!busy) btn.style.display = 'none';
        }, HIDE_DELAY);
    }

    document.addEventListener('mouseover', (e) => {
        if (e.target === btn) { clearTimeout(hideTimer); return; }
        const found = findImageAt(e.clientX, e.clientY);
        if (found === 'btn') { clearTimeout(hideTimer); return; }
        if (found) showButton(found);
        else scheduleHide();
    }, true);

    // Coordinates become stale on scroll
    window.addEventListener('scroll', () => {
        if (!busy) btn.style.display = 'none';
    }, true);

    btn.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    btn.addEventListener('mouseleave', scheduleHide);

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (busy || !currentSrc) return;
        processAndSearch(currentSrc);
    });

    // Alt + Right Click on an image
    document.addEventListener('contextmenu', (e) => {
        if (!e.altKey || busy) return;
        const found = findImageAt(e.clientX, e.clientY);
        if (found && found !== 'btn') {
            e.preventDefault();
            e.stopPropagation();
            currentSrc = found.src;
            positionButton(found.rect);
            processAndSearch(found.src);
        }
    }, true);

    // ---------- Visual state ----------
    function setBusy(text) {
        busy = true;
        btn.className = 'doppel-search-btn busy';
        btn.textContent = text;
    }

    function setError(text) {
        busy = true; // keep the button visible while the message is shown
        btn.className = 'doppel-search-btn error';
        btn.textContent = '⚠ ' + text;
        btn.style.display = 'block';
        setTimeout(() => { resetButton(); btn.style.display = 'none'; }, 5000);
    }

    // ---------- Image conversion ----------
    function dataUrlToBlob(dataUrl) {
        const [meta, b64] = dataUrl.split(',');
        const mime = (meta.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new Blob([bytes], { type: mime });
    }

    function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
        });
    }

    // Resizes (max side MAX_SIDE) and converts to JPEG; guarantees an image/* MIME type
    async function toJpegDataUrl(blob) {
        const bmp = await createImageBitmap(blob);
        const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
        const w = Math.max(1, Math.round(bmp.width * scale));
        const h = Math.max(1, Math.round(bmp.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';           // avoids a black background on transparent PNG/WebP
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(bmp, 0, 0, w, h);
        return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    }

    // Fallback without canvas: fixes the MIME type if it comes as octet-stream
    async function rawDataUrl(blob) {
        const url = await blobToDataUrl(blob);
        if (/^data:image\//.test(url)) return url;
        return url.replace(/^data:[^;,]*/, 'data:image/jpeg');
    }

    async function prepareImage(blob) {
        try {
            return await toJpegDataUrl(blob);
        } catch (err) {
            console.warn('[Doppel] Canvas failed, sending original image:', err);
            return rawDataUrl(blob);
        }
    }

    function fetchBlob(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                responseType: 'blob',
                timeout: TIMEOUT_MS,
                onload: (resp) => {
                    if (resp.status >= 200 && resp.status < 300 && resp.response) resolve(resp.response);
                    else reject(new Error('HTTP ' + resp.status + ' while downloading image'));
                },
                onerror: () => reject(new Error('Network error while fetching image')),
                ontimeout: () => reject(new Error('Timeout while fetching image'))
            });
        });
    }

    // ---------- Main flow ----------
    async function processAndSearch(imageUrl) {
        if (busy) return;
        try {
            setBusy('Preparing…');
            const blob = imageUrl.startsWith('data:')
                ? dataUrlToBlob(imageUrl)
                : await fetchBlob(imageUrl);
            const dataUrl = await prepareImage(blob);
            setBusy('Uploading…');
            await sendToDoppel(dataUrl);
        } catch (err) {
            console.error('[Doppel]', err);
            setError(err.message || 'Error');
        }
    }

    function extractHash(res) {
        if (!res || typeof res !== 'object') return null;
        return res.hash || res.id || res.search_id || res.searchId ||
               (res.data && (res.data.hash || res.data.id || res.data.search_id)) || null;
    }

    function sendToDoppel(dataUrl) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: API_URL,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Origin': 'https://doppel.fit',
                    'Referer': 'https://doppel.fit/s/image?pending=1'
                },
                data: JSON.stringify({ image: dataUrl, skipEmbedding: true }),
                timeout: TIMEOUT_MS,
                onload: (resp) => {
                    console.log('[Doppel] HTTP', resp.status, resp.responseText);
                    let res = null;
                    try { res = JSON.parse(resp.responseText); } catch (_) { /* not JSON */ }
                    const hash = resp.status >= 200 && resp.status < 300 ? extractHash(res) : null;
                    if (hash) {
                        GM_openInTab(RESULT_URL + encodeURIComponent(hash), { active: true });
                        resetButton();
                        btn.style.display = 'none';
                        resolve();
                    } else {
                        reject(new Error('HTTP ' + resp.status + ', no hash returned (see console, F12)'));
                    }
                },
                onerror: () => reject(new Error('Failed to connect to Doppel.fit API')),
                ontimeout: () => reject(new Error('Doppel.fit API timeout'))
            });
        });
    }
})();

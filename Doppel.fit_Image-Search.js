// ==UserScript==
// @name        Doppel.fit Image Search
// @namespace   Violentmonkey Scripts
// @icon        https://github.com/Rootzpower/Doppel.fit-Image-Search/raw/main/icon.png
// @version     2.9.3
//
// @match       *://*.google.com/*
// @match       *://*.google.pt/*
// @include     *://*.google.*/search*
// @include     *://*.google.*/imghp*
// @grant       GM_xmlhttpRequest
// @grant       GM_openInTab
//
// @author      Rootzpower
// @description Reverse image search on Doppel.fit via hover button and Alt + Right Click
// @downloadURL https://raw.githubusercontent.com/Rootzpower/Doppel.fit-Image-Search/main/Doppel.fit_Image-Search.js
// @updateURL   https://raw.githubusercontent.com/Rootzpower/Doppel.fit-Image-Search/main/Doppel.fit_Image-Search.js
// ==/UserScript==

(function() {
    'use strict';

    const style = document.createElement('style');
    style.textContent = `
        .doppel-search-btn {
            position: absolute;
            z-index: 999999;
            background: #6366f1;
            color: #ffffff;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 11px;
            font-weight: 600;
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            display: none;
            user-select: none;
            transition: background 0.2s;
        }
        .doppel-search-btn:hover {
            background: #4f46e5;
        }
    `;
    document.head.appendChild(style);

    const btn = document.createElement('div');
    btn.className = 'doppel-search-btn';
    btn.textContent = '🔍 Doppel.fit';
    document.body.appendChild(btn);

    let currentImgUrl = null;

    // Helper to extract real image URL on Google Images
    function extractImgSrc(element) {
        if (!element) return null;
        let img = element.nodeName === 'IMG' ? element : element.querySelector('img');
        if (!img && element.parentElement) {
            img = element.parentElement.querySelector('img');
        }
        if (img) {
            return img.src || img.getAttribute('data-src') || img.getAttribute('data-iurl');
        }
        return null;
    }

    document.addEventListener('mouseover', function(e) {
        const src = extractImgSrc(e.target);

        if (src && !src.startsWith('data:image/svg')) {
            const rect = e.target.getBoundingClientRect();
            const width = rect.width || e.target.offsetWidth || 0;
            const height = rect.height || e.target.offsetHeight || 0;

            if (width > 30 && height > 30) {
                currentImgUrl = src;
                btn.style.top = (rect.top + window.scrollY + 8) + 'px';
                btn.style.left = (rect.left + window.scrollX + width - 95) + 'px';
                btn.style.display = 'block';
            }
        }
    }, true);

    btn.addEventListener('mouseleave', function() {
        btn.style.display = 'none';
    });

    btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        btn.style.display = 'none';
        if (currentImgUrl) {
            processAndSearch(currentImgUrl);
        }
    });

    document.addEventListener('contextmenu', function(e) {
        if (e.altKey) {
            const src = extractImgSrc(e.target);
            if (src) {
                e.preventDefault();
                e.stopPropagation();
                processAndSearch(src);
            }
        }
    }, true);

    function processAndSearch(imageUrl) {
        // If image is already provided in Base64
        if (imageUrl.startsWith('data:image/')) {
            sendToDoppel(imageUrl);
            return;
        }

        GM_xmlhttpRequest({
            method: "GET",
            url: imageUrl,
            responseType: "blob",
            onload: function(response) {
                if (response.status === 200) {
                    const reader = new FileReader();
                    reader.onloadend = function() {
                        sendToDoppel(reader.result);
                    };
                    reader.readAsDataURL(response.response);
                } else {
                    alert("Failed to download image.");
                }
            },
            onerror: function() {
                alert("Error fetching image.");
            }
        });
    }

    function sendToDoppel(base64Image) {
        GM_xmlhttpRequest({
            method: "POST",
            url: "https://doppel.fit/api/v1/products/search/image/upload",
            headers: {
                "Content-Type": "application/json"
            },
            data: JSON.stringify({ image: base64Image }),
            onload: function(apiResp) {
                try {
                    const res = JSON.parse(apiResp.responseText);
                    if (res.hash) {
                        GM_openInTab(`https://doppel.fit/s/image?hash=${res.hash}`, { active: true });
                    } else if (res.id) {
                        GM_openInTab(`https://doppel.fit/s/image?hash=${res.id}`, { active: true });
                    } else {
                        alert("Doppel.fit did not return a valid image hash.");
                    }
                } catch (err) {
                    alert("Error processing response from Doppel.fit.");
                }
            },
            onerror: function() {
                alert("Failed to connect to Doppel.fit API.");
            }
        });
    }
})();

// ==UserScript==
// @name         Doppel.fit Image Search
// @namespace    https://github.com/Rootzpower
// @version      2.7.1
// @description  Reverse image search on Doppel.fit via hover button and Alt + Right Click
// @author       Rootzpower
// @icon         https://github.com/Rootzpower/Doppel.fit-Image-Search/blob/main/icon.png?raw=true
// @match        *://*.google.com/*
// @match        *://*.google.pt/*
// @include      *://*.google.*/search*
// @include      *://*.google.*/imghp*
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @downloadURL  https://raw.githubusercontent.com/Rootzpower/Doppel.fit-Image-Search/main/Doppel.fit_Image-Search.js
// @updateURL    https://raw.githubusercontent.com/Rootzpower/Doppel.fit-Image-Search/main/Doppel.fit_Image-Search.js
// ==UserScript==

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

    function getRealImgSrc(target) {
        if (!target) return null;
        let img = target.nodeName === 'IMG' ? target : target.querySelector('img');
        if (img) {
            return img.src || img.getAttribute('data-src') || img.getAttribute('data-iurl');
        }
        return null;
    }

    document.addEventListener('mouseover', function(e) {
        const src = getRealImgSrc(e.target);

        if (src && !src.startsWith('data:image/svg')) {
            const rect = e.target.getBoundingClientRect();
            const width = rect.width || e.target.offsetWidth || 0;
            const height = rect.height || e.target.offsetHeight || 0;

            if (width > 40 && height > 40) {
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
            const src = getRealImgSrc(e.target);
            if (src) {
                e.preventDefault();
                e.stopPropagation();
                processAndSearch(src);
            }
        }
    }, true);

    function processAndSearch(imageUrl) {
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
                    alert("Falha ao descarregar a imagem de origem.");
                }
            },
            onerror: function() {
                alert("Erro ao obter a imagem.");
            }
        });
    }

    function sendToDoppel(base64Data) {
        GM_xmlhttpRequest({
            method: "POST",
            url: "https://doppel.fit/api/v1/products/search/image/upload",
            headers: {
                "Content-Type": "application/json"
            },
            data: JSON.stringify({ image: base64Data }),
            onload: function(apiResp) {
                try {
                    const res = JSON.parse(apiResp.responseText);
                    const hash = res.hash || res.id || (res.data && (res.data.hash || res.data.id));
                    
                    if (hash) {
                        GM_openInTab(`https://doppel.fit/s/image?hash=${hash}`, { active: true });
                    } else {
                        console.log("Doppel API Response:", res);
                        alert("O Doppel.fit não devolveu um hash válido. Verifica a consola (F12).");
                    }
                } catch (err) {
                    console.error("Erro na resposta:", apiResp.responseText);
                    alert("Erro ao processar resposta do Doppel.fit.");
                }
            },
            onerror: function() {
                alert("Falha ao ligar à API do Doppel.fit.");
            }
        });
    }
})();// ==UserScript==
// @name         Doppel.fit Image Search
// @namespace    Violentmonkey Scripts
// @version      2.3.0
// @description  Reverse image search on Doppel.fit via hover button and Alt + Right Click
// @author       Rootzpower
// @icon         https://github.com/Rootzpower/Doppel.fit-Image-Search/blob/main/icon.png?raw=true
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @downloadURL  https://raw.githubusercontent.com/Rootzpower/Doppel.fit-Image-Search/main/Doppel.fit_Image-Search.js
// @updateURL    https://raw.githubusercontent.com/Rootzpower/Doppel.fit-Image-Search/main/Doppel.fit_Image-Search.js
// ==/UserScript==
(function() {
    'use strict';

    // 1. Styles for the overlay button
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

    // 2. Create button element
    const btn = document.createElement('div');
    btn.className = 'doppel-search-btn';
    btn.textContent = '🔍 Doppel.fit';
    document.body.appendChild(btn);

    let currentImgUrl = null;

    // Show button on image hover
    document.addEventListener('mouseover', function(e) {
        if (e.target && e.target.nodeName === 'IMG' && e.target.src) {
            const rect = e.target.getBoundingClientRect();
            if (rect.width > 80 && rect.height > 80) { // Ignore small icons
                currentImgUrl = e.target.src;
                btn.style.top = (rect.top + window.scrollY + 6) + 'px';
                btn.style.left = (rect.left + window.scrollX + rect.width - 95) + 'px';
                btn.style.display = 'block';
            }
        }
    }, true);

    // Hide button on mouse leave
    btn.addEventListener('mouseleave', function() {
        btn.style.display = 'none';
    });

    // Click event triggers search directly
    btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        btn.style.display = 'none';
        if (currentImgUrl) {
            processAndSearch(currentImgUrl);
        }
    });

    // Secondary support for Alt + Right Click
    document.addEventListener('contextmenu', function(e) {
        if (e.altKey && e.target && e.target.nodeName === 'IMG' && e.target.src) {
            e.preventDefault();
            e.stopPropagation();
            processAndSearch(e.target.src);
        }
    }, true);

    function processAndSearch(imageUrl) {
        GM_xmlhttpRequest({
            method: "GET",
            url: imageUrl,
            responseType: "blob",
            onload: function(response) {
                if (response.status === 200) {
                    const reader = new FileReader();
                    reader.onloadend = function() {
                        const base64Image = reader.result;

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
                                    const hash = res.hash || res.id;
                                    if (hash) {
                                        GM_openInTab(`https://doppel.fit/s/image?hash=${hash}`, { active: true });
                                    } else {
                                        alert("Doppel.fit did not return a valid image hash.");
                                    }
                                } catch (e) {
                                    alert("Error parsing response from Doppel.fit.");
                                }
                            },
                            onerror: function() {
                                alert("Failed to connect to Doppel.fit API.");
                            }
                        });
                    };
                    reader.readAsDataURL(response.response);
                } else {
                    alert("Failed to download the source image.");
                }
            },
            onerror: function() {
                alert("Error fetching the image.");
            }
        });
    }
})();

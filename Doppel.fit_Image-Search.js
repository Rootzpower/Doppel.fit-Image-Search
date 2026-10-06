// ==UserScript==
// @name         Doppel.fit Image Search
// @namespace    https://github.com/Rootzpower
// @version      1.3
// @description  Reverse image search on Doppel.fit via hover button and Alt + Right Click
// @author       Rootzpower
// @icon         https://github.com/Rootzpower/Doppel.fit-Image-Search/blob/main/icon.png?raw=true
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @downloadURL https://codeberg.org/gongchandang49/bypass-all-shortlinks-debloated/raw/branch/main/Bypass_All_Shortlinks.user.js
// @updateURL https://codeberg.org/gongchandang49/bypass-all-shortlinks-debloated/raw/branch/main/Bypass_All_Shortlinks.meta.js
// ==/UserScript==
(function() {
    'use strict';

    // 1. Estilos para o botão que aparece sobre a imagem
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

    // Criar o elemento do botão
    const btn = document.createElement('div');
    btn.className = 'doppel-search-btn';
    btn.textContent = '🔍 Doppel.fit';
    document.body.appendChild(btn);

    let currentImgUrl = null;

    // Mostrar botão ao passar o rato por cima de uma imagem
    document.addEventListener('mouseover', function(e) {
        if (e.target && e.target.nodeName === 'IMG' && e.target.src) {
            const rect = e.target.getBoundingClientRect();
            if (rect.width > 80 && rect.height > 80) { // Ignorar ícones muito pequenos
                currentImgUrl = e.target.src;
                btn.style.top = (rect.top + window.scrollY + 6) + 'px';
                btn.style.left = (rect.left + window.scrollX + rect.width - 95) + 'px';
                btn.style.display = 'block';
            }
        }
    }, true);

    // Esconder o botão se o rato sair da zona
    btn.addEventListener('mouseleave', function() {
        btn.style.display = 'none';
    });

    // Clique no botão dispara a pesquisa diretamente
    btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        btn.style.display = 'none';
        if (currentImgUrl) {
            processAndSearch(currentImgUrl);
        }
    });

    // Suporte secundário para Alt + Clique Direito
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
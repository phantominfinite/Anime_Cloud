// --- UI MODULE ---
class UI {
    static translate(cat, term) {
        return (CONFIG.dictionary[cat] && CONFIG.dictionary[cat][term]) || term;
    }

    static showToast(title, msg, type = 'success') {
        const toast = document.getElementById('toast');
        const icon = document.getElementById('toast-icon');
        
        document.getElementById('toast-title').textContent = title;
        document.getElementById('toast-msg').textContent = msg;
        
        icon.className = type === 'success' ? 'fa-solid fa-circle-check text-primary text-lg' : 'fa-solid fa-circle-info text-accent text-lg';
        
        toast.style.transform = 'translate(-50%, 0)';
        setTimeout(() => { toast.style.transform = 'translate(-50%, -200%)'; }, 3000);
    }

    static updateAmbientBg(url) {
        const bg = document.getElementById('ambient-bg');
        bg.style.backgroundImage = `url('${url}')`;
    }

    static toggleSettings() {
        const menu = document.getElementById('settings-sheet');
        const backdrop = menu.querySelector('div:first-child');
        const sheet = menu.querySelector('div:last-child');
        
        if (menu.classList.contains('hidden')) {
            menu.classList.remove('hidden');
            // Update stats
            document.getElementById('stat-favs').textContent = Storage.get('favs').length;
            document.getElementById('stat-history').textContent = Storage.get('history').length;

            const tgStatEl = document.getElementById('stat-tg');
            if (tgStatEl) {
                API.getTgStats().then(stats => {
                    if (stats && typeof stats.anime_count === 'number') {
                        tgStatEl.textContent = stats.anime_count;
                    }
                }).catch(() => {});
            }

            // Check System Health
            API.checkSystemHealth().then(health => {
                const dot = document.getElementById('health-dot');
                const text = document.getElementById('health-text');
                if (health && health.status === 'operational') {
                    dot.className = 'w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]';
                    text.textContent = `All Systems Operational`;
                    text.className = 'text-emerald-500 font-bold';
                } else {
                    dot.className = 'w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_10px_#f43f5e]';
                    text.textContent = 'System Issues Detected';
                    text.className = 'text-rose-500 font-bold';
                }
            });

            requestAnimationFrame(() => {
                backdrop.classList.remove('opacity-0');
                sheet.classList.remove('translate-y-full');
            });
        } else {
            backdrop.classList.add('opacity-0');
            sheet.classList.add('translate-y-full');
            setTimeout(() => menu.classList.add('hidden'), 300);
        }
    }

    static setTheme(themeName) {
        const body = document.body;
        // Keep reduced-motion if exists
        const isReduced = body.classList.contains('reduced-motion');
        body.className = `antialiased pb-28 selection:bg-primary selection:text-white transition-colors duration-500 theme-${themeName}`;
        if(isReduced) body.classList.add('reduced-motion');
        
        localStorage.setItem('ac_ult_theme', themeName);
        this.showToast('تغییر تم', `تم ${themeName} فعال شد`);
    }

    static toggleReducedMotion(checkbox) {
        if (checkbox.checked) {
            document.body.classList.add('reduced-motion');
            localStorage.setItem('ac_ult_reduced', '1');
        } else {
            document.body.classList.remove('reduced-motion');
            localStorage.setItem('ac_ult_reduced', '0');
        }
    }

    static renderCards(data, containerId, isRow = false) {
        const container = document.getElementById(containerId);
        if (!container.dataset.appending) container.innerHTML = ''; 

        if (!data || !data.length) {
            if(!container.dataset.appending) container.innerHTML = '<div class="col-span-full text-center text-gray-500 py-10 opacity-50">موردی یافت نشد.</div>';
            return;
        }

        const html = data.map((anime, idx) => {
            const delay = (idx % 10) * 50;
            return `
            <div class="group relative cursor-pointer card-hover animate-scale-in ${isRow ? 'min-w-[150px] w-[150px]' : 'w-full'}" 
                    style="animation-delay: ${delay}ms"
                    onmousemove="UI.handleCardTilt(event, this)"
                    onmouseleave="UI.resetCardTilt(this)"
                    onclick="App.openAnime(${anime.mal_id})">
                <div class="card-inner aspect-[2/3] rounded-2xl overflow-hidden relative mb-3 bg-surface shadow-lg border border-white/5">
                    <img src="${anime.images.jpg.image_url}" class="w-full h-full object-cover transition-transform duration-700" loading="lazy" alt="${anime.title}">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity"></div>
                    
                    <!-- Score Badge -->
                    <div class="absolute top-2 left-2 bg-black/40 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-bold text-white border border-white/10 flex items-center gap-1">
                        <i class="fa-solid fa-star text-yellow-400 text-[8px]"></i> ${anime.score || 'N/A'}
                    </div>

                    <!-- Play Icon on Hover -->
                    <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div class="w-10 h-10 bg-primary/90 rounded-full flex items-center justify-center text-white shadow-xl shadow-primary/40 transform scale-50 group-hover:scale-100 transition-transform">
                            <i class="fa-solid fa-play text-xs"></i>
                        </div>
                    </div>
                </div>
                <h3 class="text-sm font-bold text-white leading-tight line-clamp-1 group-hover:text-primary transition-colors">${anime.title}</h3>
                <div class="flex items-center justify-between mt-1">
                    <p class="text-[10px] text-gray-500">${this.translate('type', anime.type)} • ${anime.year || '?'}</p>
                </div>
            </div>
            `;
        }).join('');
        
        if(container.dataset.appending) {
            container.insertAdjacentHTML('beforeend', html);
            delete container.dataset.appending;
        } else {
            container.innerHTML = html;
        }
    }

    static async openModal(anime) {

// TG dynamic episodes
const tgFiles = await API.getTgEpisodes(anime.mal_id);
const hasTgFiles = tgFiles && tgFiles.length > 0;
const safeTitle = (anime.title||'').replace(/'/g, "");

let primaryAction = '';
let primaryLabel = '';
let primaryIcon = '';

if (hasTgFiles) {
// Check if we have a streamable URL or just file_id
// The API returns { url: "/api/stream/{file_id}" } which is good for our player
const firstUrl = (tgFiles[0].url || '').replace(/'/g, "\'");
primaryAction = `TelegramApp.openFileFromTelegram('${firstUrl}')`;
primaryLabel = 'پخش قسمت ۱';
primaryIcon = 'fa-play';
} else {
primaryAction = `UI.showToast('در حال آپلود', 'فایل‌های این انیمه هنوز موجود نیستند', 'info')`;
primaryLabel = 'در حال آپلود';
primaryIcon = 'fa-lock';
}

        const container = document.getElementById('modal-container');
        const content = document.getElementById('modal-content');
        container.classList.remove('translate-y-full');

        const isFav = Storage.check('favs', anime.mal_id);
        const trailerUrl = anime.trailer?.embed_url;

        // Pre-fetch extra data
        const [chars, recs] = await Promise.all([
            API.getCharacters(anime.mal_id),
            API.getRecommendations(anime.mal_id)
        ]);

        // Parallax Header & Content
        content.innerHTML = `
            <div class="relative h-[60vh] w-full group">
                <img src="${anime.images.jpg.large_image_url}" class="w-full h-full object-cover mask-image-gradient" alt="Cover">
                <div class="absolute inset-0 bg-gradient-to-t from-[#08080a] via-[#08080a]/50 to-transparent"></div>
                
                <div class="absolute bottom-0 left-0 right-0 p-6 md:p-10 pb-12 z-10">
                        <div class="flex flex-wrap gap-2 mb-4">
                        ${anime.genres.slice(0,3).map(g => `<span class="px-3 py-1 bg-white/10 text-white border border-white/10 rounded-full text-xs backdrop-blur-md">${this.translate('genres', g.name)}</span>`).join('')}
                    </div>
                    <h1 class="text-3xl md:text-5xl font-black text-white leading-none mb-4 text-glow">${anime.title}</h1>
                    <div class="flex items-center gap-6 text-sm text-gray-300 font-medium">
                        <span class="flex items-center gap-1"><i class="fa-regular fa-clock"></i> ${anime.duration}</span>
                        <span class="flex items-center gap-1 text-yellow-400"><i class="fa-solid fa-star"></i> ${anime.score || 'N/A'}</span>
                        <span class="text-primary">${anime.rating || 'N/A'}</span>
                    </div>
                </div>
            </div>

            <div class="px-6 md:px-10 -mt-6 relative z-20">
                <!-- Action Buttons -->
                <div class="flex flex-wrap gap-3 mb-8">
                    <div id="live-room-count" class="hidden w-full text-center text-[10px] text-green-400 font-bold mb-2 animate-pulse">0 نفر زنده</div>
                    <!-- Play Manual (if exists) -->
                    <button onclick="${primaryAction}" class="flex-1 bg-white text-black py-3.5 rounded-xl font-black text-base hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-white/10 flex items-center justify-center gap-2">
                        <i class="fa-solid ${primaryIcon}"></i> ${primaryLabel}
                    </button>
                    
                    <!-- Play Trailer (if exists) -->
                    ${trailerUrl ? `
                    <button onclick="App.playVideo('trailer', '${trailerUrl}', '${anime.title.replace(/'/g, "")}')" 
                            class="flex-1 bg-primary text-white py-3.5 rounded-xl font-bold text-base hover:bg-primary/90 transition-all shadow-lg shadow-primary/30 flex items-center justify-center gap-2">
                        <i class="fa-brands fa-youtube"></i> تریلر
                    </button>
                    ` : ''}

                    <button id="btn-fav-modal" onclick="App.toggleFavFromModal(${anime.mal_id}, '${anime.title.replace(/'/g, "")}', '${anime.images.jpg.image_url}', this)" 
                        class="w-14 rounded-xl flex items-center justify-center border border-white/10 glass text-xl transition active:scale-90 ${isFav ? 'text-accent border-accent' : 'text-gray-300'}">
                        <i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>
                    </button>
                </div>

                
${hasTgFiles ? `
<div class="mb-8 p-5 bg-[#101012] rounded-2xl border border-primary/40">
<div class="flex items-center justify-between mb-3">
<h3 class="text-gray-400 text-xs font-bold tracking-widest uppercase">لیست قسمت‌ها</h3>
<span class="text-[10px] px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/30">پخش آنلاین</span>
</div>
<div class="space-y-2 max-h-64 overflow-y-auto no-scrollbar">
${tgFiles.map((file, index) => {
    const safeUrl = (file.url || '').replace(/'/g, "\'");
    const label = file.label || `قسمت ${file.episode || index + 1}`;
    const epnum = file.episode || (index + 1);
    const quality = file.quality || '';

    const qualityBadge = quality
        ? `<span class="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">${quality}</span>`
        : '';

    return `
        <button type="button"
            onclick="TelegramApp.openFileFromTelegram('${safeUrl}')"
            class="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-right transition group">

            <div class="flex flex-col gap-1">
                <div class="flex items-center gap-2 text-xs text-gray-300">
                    <span class="font-bold text-white group-hover:text-primary transition">قسمت ${epnum}</span>
                    ${qualityBadge}
                </div>
                <div class="text-sm text-gray-400 group-hover:text-white line-clamp-1 transition">${label}</div>
            </div>

            <i class="fa-solid fa-play text-lg text-white/50 group-hover:text-primary transition"></i>
        </button>
    `;
}).join('')}}
</div>
</div>
` : ''}

<!-- Synopsis -->
                <div class="mb-8">
                    <div class="flex justify-between items-center mb-3">
                        <h3 class="text-gray-500 font-bold text-xs uppercase tracking-widest">داستان</h3>
                        <button onclick="App.translateSynopsis(this)" data-text="${anime.synopsis ? anime.synopsis.replace(/"/g, '&quot;') : ''}" 
                                class="text-[10px] bg-primary/10 text-primary px-3 py-1 rounded-full hover:bg-primary hover:text-white transition border border-primary/20">
                            <i class="fa-solid fa-language"></i> ترجمه فارسی
                        </button>
                    </div>
                    <p id="synopsis-text" class="text-gray-300 leading-relaxed font-light text-justify text-sm md:text-base opacity-90">${anime.synopsis || 'توضیحی موجود نیست.'}</p>
                </div>

                <!-- Info Grid -->
                <div class="grid grid-cols-2 gap-3 mb-8">
                    <div class="bg-white/5 p-4 rounded-xl border border-white/5">
                        <div class="text-gray-500 text-[10px] mb-1">استودیو</div>
                        <div class="text-sm font-bold text-white truncate">${anime.studios[0]?.name || '-'}</div>
                    </div>
                    <div class="bg-white/5 p-4 rounded-xl border border-white/5">
                        <div class="text-gray-500 text-[10px] mb-1">وضعیت</div>
                        <div class="text-sm font-bold text-green-400 truncate">${this.translate('status', anime.status)}</div>
                    </div>
                    <div class="bg-white/5 p-4 rounded-xl border border-white/5">
                        <div class="text-gray-500 text-[10px] mb-1">رتبه جهانی</div>
                        <div class="text-sm font-bold text-white">#${anime.rank}</div>
                    </div>
                    <div class="bg-white/5 p-4 rounded-xl border border-white/5">
                        <div class="text-gray-500 text-[10px] mb-1">فصل</div>
                        <div class="text-sm font-bold text-white truncate">${anime.season || ''} ${anime.year || ''}</div>
                    </div>
                </div>

                <!-- Characters (Horizontal Scroll) -->
                ${chars && chars.length ? `
                <div class="mb-8">
                    <h3 class="text-gray-500 font-bold mb-4 text-xs uppercase tracking-widest">بازیگران</h3>
                    <div class="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                        ${chars.slice(0, 15).map(c => `
                            <div class="flex-shrink-0 w-20 text-center group cursor-pointer">
                                <div class="w-16 h-16 rounded-full overflow-hidden mx-auto mb-2 border-2 border-white/10 group-hover:border-primary transition">
                                    <img src="${c.character.images.jpg.image_url}" class="w-full h-full object-cover">
                                </div>
                                <p class="text-[10px] text-gray-300 truncate group-hover:text-white">${c.character.name}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <!-- Recommendations -->
                ${recs && recs.length ? `
                <div class="mb-8">
                    <h3 class="text-gray-500 font-bold mb-4 text-xs uppercase tracking-widest">پیشنهادهای مشابه</h3>
                    <div class="grid grid-cols-3 gap-3">
                        ${recs.slice(0, 6).map(r => `
                            <div class="cursor-pointer group" onclick="App.openAnime(${r.entry.mal_id})">
                                <div class="aspect-[2/3] rounded-xl overflow-hidden bg-white/5 mb-1 relative">
                                    <img src="${r.entry.images.jpg.image_url}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-110 transition duration-500">
                                    <div class="absolute inset-0 bg-black/20 group-hover:bg-transparent transition"></div>
                                </div>
                                <p class="text-[10px] text-gray-400 truncate group-hover:text-primary transition">${r.entry.title}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <!-- Comments -->
                <div class="mb-8 p-5 bg-[#101012] rounded-2xl border border-white/5">
                    <h3 class="text-gray-400 text-xs font-bold mb-4">نظرات کاربران</h3>
                    <div id="comments-container-${anime.mal_id}" class="space-y-4 mb-5"></div>
                    <div class="flex gap-2">
                        <input id="comment-input-${anime.mal_id}" type="text" placeholder="نظر خود را بنویسید..." class="w-full bg-[#1c1c20] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none transition">
                        <button onclick="App.postComment(${anime.mal_id})" class="bg-primary text-white p-3 rounded-xl hover:bg-primary/80 transition shadow-lg shadow-primary/20"><i class="fa-solid fa-paper-plane"></i></button>
                    </div>
                </div>
            </div>
        `;
        
        App.renderComments(anime.mal_id);
    }

    static closeModal() {
        document.getElementById('modal-container').classList.add('translate-y-full');
        setTimeout(() => {
                document.getElementById('modal-content').innerHTML = '';
        }, 500);
    }

    static closePlayer() {
        const overlay = document.getElementById('player-overlay');
        overlay.classList.add('opacity-0');
        if (window.plyrPlayer) {
            window.plyrPlayer.destroy();
            window.plyrPlayer = null;
        }
        setTimeout(() => {
            overlay.classList.add('hidden');
            document.getElementById('video-embed-container').innerHTML = '';
        }, 300);
    }

    static switchLibraryTab(tab) {
        // UI Toggle
        const favBtn = document.getElementById('lib-tab-favs');
        const histBtn = document.getElementById('lib-tab-history');
        const favContent = document.getElementById('lib-content-favs');
        const histContent = document.getElementById('lib-content-history');

        if (tab === 'favs') {
            favBtn.className = 'text-xl font-black text-white border-b-2 border-primary pb-3 px-2 transition-colors';
            histBtn.className = 'text-xl font-bold text-gray-500 hover:text-gray-300 pb-3 px-2 transition-colors';
            favContent.classList.remove('hidden');
            histContent.classList.add('hidden');
            App.loadFavorites();
        } else {
            histBtn.className = 'text-xl font-black text-white border-b-2 border-primary pb-3 px-2 transition-colors';
            favBtn.className = 'text-xl font-bold text-gray-500 hover:text-gray-300 pb-3 px-2 transition-colors';
            histContent.classList.remove('hidden');
            favContent.classList.add('hidden');
            App.loadHistory();
        }
    }

    static deferredPrompt = null;
    static initPWAInstall() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            const btn = document.getElementById('install-btn');
            if(btn) btn.classList.remove('hidden');
        });
    }

    static async installPWA() {
        if (!this.deferredPrompt) return;
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            this.deferredPrompt = null;
            document.getElementById('install-btn').classList.add('hidden');
        }
    }
}

UI.initPWAInstall();

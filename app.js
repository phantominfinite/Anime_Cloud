// --- APP CONTROLLER ---
class App {
    static currentPage = 1;
    static ws = null;
    
    static async init() {
        // Initialize Settings
        const savedTheme = localStorage.getItem('ac_ult_theme') || 'indigo';
        const reduced = localStorage.getItem('ac_ult_reduced') === '1';
        
        UI.setTheme(savedTheme);
        if (reduced) {
            const toggle = document.getElementById('reduced-motion-toggle');
            if (toggle) toggle.checked = true;
            document.body.classList.add('reduced-motion');
        }

        // Splash Intro fade-out
        const intro = document.getElementById('intro-overlay');
        if (intro) {
            setTimeout(() => {
                intro.style.opacity = '0';
                intro.style.transform = 'scale(1.02)';
                intro.style.pointerEvents = 'none';
                setTimeout(() => intro.remove(), 800);
            }, 1400);
        }

        // Register Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('SW registered', reg))
                .catch(err => console.error('SW failed', err));
        }

        this.loadHome();
        this.initSearchListener();
        this.initKeyboardShortcuts();
        this.renderContinueSection();
        this.initWebSocket();
    }

    static initWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/ws`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'new_episode') {
                    const data = message.data;
                    UI.showToast('قسمت جدید!', `قسمت ${data.episode} انیمه کد ${data.anime_mal_id} اضافه شد.`);
                } else if (message.type === 'online_count') {
                    const countEl = document.getElementById('user-count-num');
                    if (countEl) countEl.textContent = message.count;
                }
            } catch (e) {
                console.error("WS Message Error", e);
            }
        };

        this.ws.onclose = () => {
            // Try reconnecting after a while
            setTimeout(() => this.initWebSocket(), 5000);
        };
    }

    static async loadHome() {
        const [season, trending, top] = await Promise.all([
            API.getSeasonNow(),
            API.getTrending(),
            API.getTop(1)
        ]);

        // Hero Slider with Ambient Background Logic
        if (season) {
            document.getElementById('hero-wrapper').innerHTML = season.map(anime => {
                const trailer = anime.trailer?.embed_url ? `
                    <div class="absolute inset-0 z-0 opacity-0 group-[.swiper-slide-active]:opacity-40 transition-opacity duration-1000 delay-500 pointer-events-none mix-blend-screen hidden md:block">
                        <iframe src="${anime.trailer.embed_url}?autoplay=1&mute=1&controls=0&showinfo=0&loop=1&playlist=${anime.trailer.youtube_id}" 
                                class="w-[120%] h-[120%] -ml-[10%] -mt-[10%] opacity-60 grayscale-[50%]"></iframe>
                    </div>` : '';

                return `
                <div class="swiper-slide relative w-full h-full bg-cover bg-center cursor-pointer group overflow-hidden" 
                        style="background-image: url('${anime.images.jpg.large_image_url}')"
                        onclick="App.openAnime(${anime.mal_id})">
                        
                        ${trailer}

                        <div class="absolute inset-0 bg-black/40 group-hover:bg-transparent transition duration-500 z-10"></div>
                        <div class="absolute bottom-12 left-6 right-6 md:left-12 md:right-12 z-20 transform transition-transform duration-700 group-hover:-translate-y-2">
                        <div class="bg-primary/90 backdrop-blur-md px-3 py-1 rounded-lg text-xs font-bold inline-block mb-3 text-white shadow-lg shadow-primary/40 border border-white/10">پیشنهاد فصل</div>
                        <h2 class="text-3xl md:text-5xl font-black text-white line-clamp-2 drop-shadow-2xl mb-2">${anime.title}</h2>
                        <div class="flex items-center gap-3 text-sm text-gray-200">
                            <span class="bg-black/30 px-2 py-0.5 rounded border border-white/10">${anime.type}</span>
                            <span>${anime.score || '?'} <i class="fa-solid fa-star text-yellow-400 text-xs"></i></span>
                        </div>
                        </div>
                </div>
            `}).join('');
            
            // Init Swiper
            new Swiper('.mainSwiper', {
                effect: 'fade',
                speed: 1000,
                autoplay: { delay: 5000, disableOnInteraction: false },
                pagination: { el: '.swiper-pagination', clickable: true },
                on: {
                    slideChange: function () {
                        if (season[this.realIndex]) {
                            UI.updateAmbientBg(season[this.realIndex].images.jpg.large_image_url);
                        }
                    },
                    init: function() {
                        if (season[0]) UI.updateAmbientBg(season[0].images.jpg.large_image_url);
                    }
                }
            });
        }

        // Initial Content Render
        if (trending) UI.renderCards(trending, 'trending-row', true);
        if (top) UI.renderCards(top, 'top-grid');

        // Filter Logic for Trending
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // UI Update
                document.querySelectorAll('.filter-btn').forEach(b => {
                    b.className = 'filter-btn whitespace-nowrap px-6 py-2.5 rounded-xl text-sm font-medium bg-surface border border-white/10 text-gray-400 hover:text-white transition-all';
                });
                e.target.className = 'filter-btn active whitespace-nowrap px-6 py-2.5 rounded-xl text-sm font-bold border border-transparent transition-all shadow-lg bg-primary text-white';
                
                // Filter Logic
                const genre = e.target.dataset.genre;
                if (genre === 'all') {
                    UI.renderCards(trending, 'trending-row', true);
                } else {
                    const filtered = trending.filter(a => a.genres.some(g => g.name.includes(genre)));
                    UI.renderCards(filtered, 'trending-row', true);
                }
            });
        });
    }

    static async loadMoreTopAnime() {
        const btn = document.querySelector('#load-more-text');
        const parentBtn = btn.parentElement;
        btn.textContent = 'در حال دریافت...';
        parentBtn.classList.add('opacity-70', 'cursor-not-allowed');
        
        this.currentPage++;
        const newData = await API.getTop(this.currentPage);
        if (newData) {
            const container = document.getElementById('top-grid');
            container.dataset.appending = 'true';
            UI.renderCards(newData, 'top-grid');
        }
        
        btn.textContent = 'بارگذاری بیشتر';
        parentBtn.classList.remove('opacity-70', 'cursor-not-allowed');
    }

    static initSearchListener() {
        let timeout;
        document.getElementById('search-input').addEventListener('input', (e) => {
            clearTimeout(timeout);
            if (e.target.value.length < 3) return;
            
            document.getElementById('search-results').innerHTML = '<div class="col-span-full flex justify-center py-20"><div class="spinner"></div></div>';
            
            timeout = setTimeout(async () => {
                const filters = {
                    status: document.getElementById('filter-status').value,
                    type: document.getElementById('filter-type').value
                };
                const results = await API.search(e.target.value, filters);
                UI.renderCards(results, 'search-results');
            }, 800);
        });
    }

    static async openAnime(id) {
        // Show loader modal
        const container = document.getElementById('modal-container');
        container.classList.remove('translate-y-full');
        document.getElementById('modal-content').innerHTML = '<div class="h-screen flex items-center justify-center"><div class="spinner"></div></div>';
        
        // Connect to live room
        if (App.ws) {
            App.ws.close();
            // We reconnect with the specific room URL logic or just send a message
            // Simplified: Re-init WS with param or handle in current WS
            // For now, let's just use a separate connection or update the existing one
            // ideally we send a "join_room" message.
            // But our backend expects path param /ws/{id}.
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/api/ws/${id}`;
            App.ws = new WebSocket(wsUrl);
            App.ws.onmessage = App.handleWsMessage;
        }

        const fullData = await API.getDetails(id);
        if(fullData) {
            await UI.openModal(fullData);
            Storage.addToHistory({
                mal_id: fullData.mal_id,
                title: fullData.title,
                images: fullData.images,
                type: fullData.type,
                year: fullData.year,
                score: fullData.score
            });
            this.renderContinueSection();
        }
    }

    static playVideo(type, source, title) {
        const overlay = document.getElementById('player-overlay');
        const container = document.getElementById('video-embed-container');
        const titleEl = document.getElementById('player-title');
        
        overlay.classList.remove('hidden');
        setTimeout(() => overlay.classList.remove('opacity-0'), 10);
        titleEl.textContent = title;

        if (type === 'manual' || type === 'stream') {
            // Plyr Integration
            container.innerHTML = `
                <video id="player" playsinline controls class="w-full h-full">
                    <source src="${source}" type="video/mp4" />
                </video>
            `;
            window.plyrPlayer = new Plyr('#player', {
                controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'],
                settings: ['quality', 'speed', 'loop']
            });
            window.plyrPlayer.play();

        } else if (type === 'trailer') {
                container.innerHTML = `<iframe src="${source}?autoplay=1" allow="autoplay; encrypted-media" class="w-full h-full rounded-xl border-none shadow-2xl"></iframe>`;
        }
    }

    static toggleFavFromModal(id, title, img, btn) {
        const added = Storage.toggleList('favs', { mal_id: id, title: title, images: { jpg: { image_url: img } }, score: '?' });
        const icon = btn.querySelector('i');
        if (added) {
            icon.className = 'fa-solid fa-heart';
            btn.classList.add('text-accent', 'border-accent');
            btn.classList.remove('text-gray-300');
            UI.showToast('علاقه‌مندی', 'به لیست اضافه شد');
        } else {
            icon.className = 'fa-regular fa-heart';
            btn.classList.remove('text-accent', 'border-accent');
            btn.classList.add('text-gray-300');
            UI.showToast('حذف', 'از لیست حذف شد', 'info');
        }
    }

    static loadFavorites() {
        const favs = Storage.get('favs');
        UI.renderCards(favs, 'lib-content-favs');
    }

    static loadHistory() {
        const hist = Storage.get('history');
        UI.renderCards(hist, 'lib-content-history');
    }

    static async postComment(id) {
        const input = document.getElementById(`comment-input-${id}`);
        const text = input.value.trim();
        if(!text) {
            UI.showToast('خطا', 'لطفا متن نظر را بنویسید', 'error');
            return;
        }
        
        // Get User Info from Telegram
        let userName = 'کاربر مهمان';
        if (TelegramApp.user && TelegramApp.user.first_name) {
                userName = TelegramApp.user.first_name;
        }

        await API.getInternal(`/anime/${id}/comments`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_name: userName, text: text })
        });

        input.value = '';
        // Optimistic UI update or wait for WS
        // this.renderComments(id); // Let WS handle it
        UI.showToast('ثبت شد', 'نظر شما با موفقیت ثبت شد');
    }

    static async renderComments(id) {
        const comments = await API.getInternal(`/anime/${id}/comments`);
        const container = document.getElementById(`comments-container-${id}`);
        
        if (!comments || !comments.length) {
            container.innerHTML = '<p class="text-xs text-gray-500 text-center py-4 border border-dashed border-white/10 rounded-xl">اولین نظر را شما بنویسید.</p>';
            return;
        }
        container.innerHTML = comments.map(c => `
            <div class="bg-[#18181b] p-3 rounded-xl border border-white/5 shadow-sm animate-fade-in flex gap-3">
                <div class="flex-1">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-primary text-xs font-bold bg-primary/10 px-2 py-0.5 rounded-md">${c.user}</span>
                        <span class="text-[10px] text-gray-500">${c.date}</span>
                    </div>
                    <p class="text-xs text-gray-300 leading-relaxed">${c.text}</p>
                </div>
                <button onclick="App.likeComment(${c.id}, this)" class="self-start flex flex-col items-center gap-1 text-gray-500 hover:text-rose-500 transition group">
                    <i class="fa-regular fa-heart group-active:scale-125 transition-transform"></i>
                    <span class="text-[9px] font-bold">${c.likes || 0}</span>
                </button>
            </div>
        `).join('');
    }

    static async likeComment(commentId, btn) {
        // Optimistic UI
        const icon = btn.querySelector('i');
        const count = btn.querySelector('span');
        
        if(icon.classList.contains('fa-solid')) return; // Already liked (local check only for demo, real implementation needs user tracking)

        icon.classList.remove('fa-regular');
        icon.classList.add('fa-solid', 'text-rose-500');
        count.textContent = parseInt(count.textContent) + 1;
        count.classList.add('text-rose-500');

        // API Call
        try {
            await API.getInternal(`/comments/${commentId}/like`, { method: 'POST' });
        } catch(e) {
            console.error(e);
            // Revert on error
            icon.classList.add('fa-regular');
            icon.classList.remove('fa-solid', 'text-rose-500');
            count.textContent = parseInt(count.textContent) - 1;
        }
    }


    static initKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            const tag = (e.target && e.target.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea' || e.metaKey || e.ctrlKey || e.altKey) return;

            if (e.key === '/') {
                e.preventDefault();
                Router.navigate('search');
                const input = document.getElementById('search-input');
                if (input) input.focus();
            } else if (e.key.toLowerCase() === 'f') {
                Router.navigate('library');
                UI.switchLibraryTab('favs');
            } else if (e.key.toLowerCase() === 'r') {
                this.openRandomAnime();
            }
        });
    }

    static renderContinueSection() {
        const section = document.getElementById('continue-section');
        const row = document.getElementById('continue-row');
        if (!section || !row) return;

        const hist = Storage.get('history');
        if (!hist.length) {
            section.classList.add('hidden');
            row.innerHTML = '';
            return;
        }

        section.classList.remove('hidden');
        UI.renderCards(hist.slice(0, 15), 'continue-row', true);
    }

    static async openRandomAnime() {
        UI.showToast('انیمه رندوم', 'در حال انتخاب یک انیمه برایت...', 'info');
        const random = await API.getRandom();
        if (random && random.mal_id) {
            this.openAnime(random.mal_id);
        } else {
            UI.showToast('خطا', 'نتوانستم انیمه تصادفی پیدا کنم', 'error');
        }
    }
    
    static async loadSchedule() {
        const container = document.getElementById('schedule-content');
        const nav = document.getElementById('schedule-days-nav');
        
        // If already loaded
        if(container.dataset.loaded) return;

        const data = await API.getSchedule();
        if(!data) {
            container.innerHTML = '<div class="col-span-full text-center text-red-400">خطا در دریافت برنامه پخش</div>';
            return;
        }

        const days = [
            {key: 'saturday', label: 'شنبه'},
            {key: 'sunday', label: 'یکشنبه'},
            {key: 'monday', label: 'دوشنبه'},
            {key: 'tuesday', label: 'سه‌شنبه'},
            {key: 'wednesday', label: 'چهارشنبه'},
            {key: 'thursday', label: 'پنج‌شنبه'},
            {key: 'friday', label: 'جمعه'}
        ];

        // Render Nav
        nav.innerHTML = days.map((d, i) => `
            <button onclick="App.filterSchedule('${d.key}', this)" 
                class="px-5 py-2.5 rounded-xl text-sm font-bold border border-white/5 transition-all whitespace-nowrap ${i===0 ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white/5 text-gray-400 hover:text-white'}">
                ${d.label}
            </button>
        `).join('');

        // Store data globally for filtering
        window.scheduleData = data;
        this.filterSchedule('saturday', nav.firstElementChild);
        container.dataset.loaded = 'true';
    }

    static filterSchedule(day, btn) {
        // Update UI active state
        document.querySelectorAll('#schedule-days-nav button').forEach(b => {
            b.className = 'px-5 py-2.5 rounded-xl text-sm font-bold border border-white/5 transition-all whitespace-nowrap bg-white/5 text-gray-400 hover:text-white';
        });
        btn.className = 'px-5 py-2.5 rounded-xl text-sm font-bold border border-white/5 transition-all whitespace-nowrap bg-primary text-white shadow-lg shadow-primary/20 animate-scale-in';

        const container = document.getElementById('schedule-content');
        
        // Fix for Jikan V4 structure which returns list directly usually, but check if grouped
        // Actually Jikan V4 /schedules returns data as array of anime objects with broadcast.day
        
        // Let's filter properly
        const filtered = window.scheduleData.filter(anime => {
                const bDay = anime.broadcast.day;
                if (!bDay) return false;
                // Simple mapping because Jikan uses UTC or JST days
                // We just match string loosely for demo
                return bDay.toLowerCase().includes(day);
        });

        if(!filtered.length) {
            container.innerHTML = '<div class="col-span-full text-center text-gray-500 py-20 opacity-50">برنامه‌ای برای این روز یافت نشد.</div>';
            return;
        }

        container.innerHTML = filtered.map(anime => `
            <div class="flex gap-4 bg-[#18181b] p-3 rounded-2xl border border-white/5 hover:border-white/10 transition group cursor-pointer animate-fade-in" onclick="App.openAnime(${anime.mal_id})">
                <div class="w-20 h-28 rounded-xl overflow-hidden flex-shrink-0 relative">
                    <img src="${anime.images.jpg.image_url}" class="w-full h-full object-cover">
                </div>
                <div class="flex flex-col justify-center py-1">
                    <h3 class="text-sm font-bold text-white line-clamp-2 mb-2 group-hover:text-primary transition">${anime.title}</h3>
                    <div class="flex items-center gap-3 text-[11px] text-gray-400">
                        <span>${anime.broadcast.time || 'نامشخص'}</span>
                        <span class="w-1 h-1 rounded-full bg-gray-600"></span>
                        <span class="text-emerald-400">${anime.score || 'N/A'}</span>
                    </div>
                    <div class="mt-3 flex gap-2">
                        ${anime.genres.slice(0, 2).map(g => `<span class="px-2 py-0.5 bg-white/5 rounded-md text-[9px] text-gray-400">${UI.translate('genres', g.name)}</span>`).join('')}
                    </div>
                </div>
            </div>
        `).join('');
    }

    static async translateSynopsis(btn) {
        const originalText = btn.getAttribute('data-text');
        const target = document.getElementById('synopsis-text');
        if (!originalText || !target) return;

        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btn.disabled = true;

        try {
            const encodedText = encodeURIComponent(originalText.substring(0, 499));
            const url = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=en|fa`;
            const res = await fetch(url);
            const data = await res.json();
            if (data && data.responseData) {
                target.textContent = data.responseData.translatedText + '...';
                target.classList.remove('text-justify');
                target.classList.add('text-right');
                btn.innerHTML = '<i class="fa-solid fa-check"></i>';
                btn.className = "text-[10px] bg-green-500/10 text-green-500 px-3 py-1 rounded-full border border-green-500/20";
            } else { throw new Error(); }
        } catch (e) {
            UI.showToast('خطا', 'سرویس ترجمه در دسترس نیست', 'error');
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    }
}
